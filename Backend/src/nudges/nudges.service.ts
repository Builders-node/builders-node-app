import { Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { guideUnlockUrl } from '../guide/guide.service';
import { MailService } from '../mail/mail.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How far back a nudge will reach. Without a window, the first run would mail
 * everyone who ever stalled at a stage — including people from months ago who
 * have long since moved on.
 */
const WINDOW_DAYS = 14;

/** A recovery code lives this long; the one on the form only lasts 10 minutes. */
const RECOVERY_CODE_TTL_MS = 2 * DAY_MS;

/** Stages where the next move is ours, and how long before it counts as stale. */
const WAITING_ON_US: Record<string, string> = {
  SUBMITTED: 'First check',
  MEETING_SCHEDULED: 'Meeting',
  MEETING_APPROVED: 'Past meeting — payment link',
  PAYMENT_CONFIRMED: 'Paid — onboarding',
};
const STALE_AFTER_DAYS = 5;

type Outcome = { sent: number; failed: number };
const none = (): Outcome => ({ sent: 0, failed: 0 });

/**
 * The follow-ups nobody had time to send by hand. Runs once a day.
 *
 * Every nudge here is capped and claimed before it is sent: the stamp or
 * counter moves in a conditional update first, so a doubled cron run sends
 * nothing twice. A failed send gives the claim back, so tomorrow tries again.
 *
 * mail.service.ts once argued against scheduled nudges for spam reasons. That
 * holds for an uncapped drip; these are one or two emails per person, each
 * about a step they started themselves.
 */
@Injectable()
export class NudgesService {
  private readonly logger = new Logger(NudgesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async runDaily(now = new Date(), deadline = Date.now() + 25_000) {
    const steps = {
      bookingReminders: () => this.bookingReminders(now, deadline),
      paymentReminders: () => this.paymentReminders(now, deadline),
      unfinishedApplications: () => this.unfinishedApplications(now, deadline),
      guideFollowUps: () => this.guideFollowUps(now, deadline),
      staleDigest: () => this.staleDigest(now),
    };
    const report: Record<string, Outcome | { error: string }> = {};
    // Each step on its own: one failing must not stop the others.
    for (const [name, step] of Object.entries(steps)) {
      try {
        report[name] = await step();
      } catch (error) {
        this.logger.error(`Nudge step ${name} failed: ${(error as Error).message}`);
        report[name] = { error: (error as Error).message };
      }
    }
    return report;
  }

  /** "Book your call": day 3 and day 7 after the first check passed. */
  private async bookingReminders(now: Date, deadline: number): Promise<Outcome> {
    const outcome = none();
    const candidates = await this.prisma.application.findMany({
      where: {
        status: 'FIRST_APPROVED',
        autoMeetingReminders: { lt: 2 },
        firstApprovedAt: { gte: new Date(now.getTime() - WINDOW_DAYS * DAY_MS) },
      },
      select: { id: true, email: true, fullName: true, firstApprovedAt: true, autoMeetingReminders: true, meetingReminderSentAt: true },
    });

    for (const app of candidates) {
      if (Date.now() > deadline) break;
      const daysIn = (now.getTime() - app.firstApprovedAt!.getTime()) / DAY_MS;
      const dueAt = app.autoMeetingReminders === 0 ? 3 : 7;
      if (daysIn < dueAt) continue;
      // An admin pressed Remind recently — don't follow it with another.
      if (app.meetingReminderSentAt && now.getTime() - app.meetingReminderSentAt.getTime() < 2 * DAY_MS) continue;

      const claimed = await this.prisma.application.updateMany({
        where: { id: app.id, status: 'FIRST_APPROVED', autoMeetingReminders: app.autoMeetingReminders },
        data: { autoMeetingReminders: { increment: 1 }, meetingReminderSentAt: now },
      });
      if (claimed.count === 0) continue;

      if (await this.mail.sendMeetingReminder(app.email, app.fullName)) {
        outcome.sent += 1;
      } else {
        outcome.failed += 1;
        await this.prisma.application.update({
          where: { id: app.id },
          data: { autoMeetingReminders: app.autoMeetingReminders, meetingReminderSentAt: app.meetingReminderSentAt },
        });
      }
    }
    return outcome;
  }

  /** "Your payment link is waiting": day 2, and once more three days later. */
  private async paymentReminders(now: Date, deadline: number): Promise<Outcome> {
    const outcome = none();
    const candidates = await this.prisma.application.findMany({
      where: {
        status: 'PAYMENT_LINK_SENT',
        paymentLink: { not: null },
        paymentLinkSentAt: { gte: new Date(now.getTime() - WINDOW_DAYS * DAY_MS) },
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        paymentLink: true,
        paymentAmountCents: true,
        paymentCurrency: true,
        paymentLinkSentAt: true,
        paymentReminderSentAt: true,
      },
    });

    for (const app of candidates) {
      if (Date.now() > deadline) break;
      const sentAt = app.paymentLinkSentAt!.getTime();
      const last = app.paymentReminderSentAt?.getTime() ?? null;
      // A resend moves paymentLinkSentAt past the last reminder: that starts
      // the count again, as it should for a new link.
      const remindersSoFar = last === null || last < sentAt ? 0 : last - sentAt < 4 * DAY_MS ? 1 : 2;
      const due =
        (remindersSoFar === 0 && now.getTime() - sentAt >= 2 * DAY_MS) ||
        (remindersSoFar === 1 && now.getTime() - last! >= 3 * DAY_MS);
      if (!due) continue;

      const claimed = await this.prisma.application.updateMany({
        where: { id: app.id, status: 'PAYMENT_LINK_SENT', paymentReminderSentAt: app.paymentReminderSentAt },
        data: { paymentReminderSentAt: now },
      });
      if (claimed.count === 0) continue;

      const amount = app.paymentAmountCents ? { cents: app.paymentAmountCents, currency: app.paymentCurrency } : undefined;
      if (await this.mail.sendPaymentReminder(app.email, app.fullName, app.paymentLink!, amount)) {
        outcome.sent += 1;
      } else {
        outcome.failed += 1;
        await this.prisma.application.update({
          where: { id: app.id },
          data: { paymentReminderSentAt: app.paymentReminderSentAt },
        });
      }
    }
    return outcome;
  }

  /**
   * Forms filled in but never confirmed. They were invisible: the payload sat
   * in ApplicationVerification until the cleanup deleted it. One email, at
   * least an hour after they stopped, with a fresh code that lasts two days.
   */
  private async unfinishedApplications(now: Date, deadline: number): Promise<Outcome> {
    const outcome = none();
    const candidates = await this.prisma.applicationVerification.findMany({
      where: {
        reminderSentAt: null,
        createdAt: { lte: new Date(now.getTime() - 60 * 60 * 1000), gte: new Date(now.getTime() - 7 * DAY_MS) },
      },
      select: { id: true, email: true, payloadJson: true },
    });

    for (const pending of candidates) {
      if (Date.now() > deadline) break;
      // Applied some other way since (or already has an open application).
      const applied = await this.prisma.application.findUnique({ where: { email: pending.email }, select: { status: true } });
      if (applied && !['FIRST_REJECTED', 'MEETING_REJECTED'].includes(applied.status)) continue;

      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const claimed = await this.prisma.applicationVerification.updateMany({
        where: { id: pending.id, reminderSentAt: null },
        data: { reminderSentAt: now, code, attempts: 0, expiresAt: new Date(now.getTime() + RECOVERY_CODE_TTL_MS) },
      });
      if (claimed.count === 0) continue;

      let fullName = '';
      try {
        fullName = (JSON.parse(pending.payloadJson) as { fullName?: string }).fullName ?? '';
      } catch {
        /* a name is a nicety */
      }
      if (await this.mail.sendApplicationUnfinished(pending.email, fullName || 'there', code)) {
        outcome.sent += 1;
      } else {
        outcome.failed += 1;
        await this.prisma.applicationVerification.update({ where: { id: pending.id }, data: { reminderSentAt: null } });
      }
    }
    return outcome;
  }

  /** Two notes after the guide — day 2 and day 6 — until they apply. */
  private async guideFollowUps(now: Date, deadline: number): Promise<Outcome> {
    const outcome = none();
    const leads = await this.prisma.guideRequest.findMany({
      where: {
        sentAt: { not: null, gte: new Date(now.getTime() - 21 * DAY_MS) },
        followUpCount: { lt: 2 },
      },
      select: { id: true, email: true, name: true, accessKey: true, source: true, sentAt: true, followUpCount: true },
    });
    if (leads.length === 0) return outcome;

    // Anyone who has already applied is past needing a nudge toward it.
    const applied = new Set(
      (
        await this.prisma.application.findMany({
          where: { email: { in: leads.map((lead) => lead.email) } },
          select: { email: true },
        })
      ).map((row) => row.email),
    );
    const applyUrl = `${this.mail.frontendBaseUrl()}/apply?utm_source=guide-followup&utm_medium=email`;

    for (const lead of leads) {
      if (Date.now() > deadline) break;
      if (applied.has(lead.email)) continue;
      const step = (lead.followUpCount + 1) as 1 | 2;
      const daysSince = (now.getTime() - lead.sentAt!.getTime()) / DAY_MS;
      if (daysSince < (step === 1 ? 2 : 6)) continue;

      const claimed = await this.prisma.guideRequest.updateMany({
        where: { id: lead.id, followUpCount: lead.followUpCount },
        data: { followUpCount: step, lastFollowUpAt: now },
      });
      if (claimed.count === 0) continue;

      const links = { guideUrl: guideUnlockUrl(lead.accessKey, lead.source), applyUrl };
      if (await this.mail.sendGuideFollowUp(lead.email, lead.name, step, links)) {
        outcome.sent += 1;
      } else {
        outcome.failed += 1;
        await this.prisma.guideRequest.update({ where: { id: lead.id }, data: { followUpCount: lead.followUpCount } });
      }
    }
    return outcome;
  }

  /** One email to each Super Admin listing applicants we've left waiting. */
  private async staleDigest(now: Date): Promise<Outcome> {
    const outcome = none();
    const waiting = await this.prisma.application.findMany({
      where: { status: { in: Object.keys(WAITING_ON_US) } },
      select: {
        fullName: true,
        email: true,
        status: true,
        createdAt: true,
        firstApprovedAt: true,
        meetingApprovedAt: true,
        paymentConfirmedAt: true,
      },
    });
    const rows = waiting
      .map((app) => {
        const enteredAt =
          app.status === 'MEETING_SCHEDULED'
            ? app.firstApprovedAt
            : app.status === 'MEETING_APPROVED'
              ? app.meetingApprovedAt
              : app.status === 'PAYMENT_CONFIRMED'
                ? app.paymentConfirmedAt
                : app.createdAt;
        const days = Math.floor((now.getTime() - (enteredAt ?? app.createdAt).getTime()) / DAY_MS);
        return { fullName: app.fullName, email: app.email, stage: WAITING_ON_US[app.status], days };
      })
      .filter((row) => row.days > STALE_AFTER_DAYS)
      .sort((a, b) => b.days - a.days);
    if (rows.length === 0) return outcome;

    const admins = await this.prisma.user.findMany({ where: { role: 'SUPER_ADMIN' }, select: { email: true } });
    for (const admin of admins) {
      if (await this.mail.sendStaleApplicantsDigest(admin.email, rows)) outcome.sent += 1;
      else outcome.failed += 1;
    }
    return outcome;
  }
}
