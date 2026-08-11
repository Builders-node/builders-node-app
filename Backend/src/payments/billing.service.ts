import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';

/** How many days before the due date the nudge goes out. */
const REMINDER_DAYS_BEFORE = 3;

/**
 * How far ahead an invoice is raised.
 *
 * Long enough that nobody is asked to pay the same day they're told, short
 * enough that the amount is still recognisably about the coming month.
 */
const ISSUE_DAYS_AHEAD = 7;

export type BillingRunResult = {
  invoicesIssued: number;
  markedOverdue: number;
  remindersSent: number;
  /** Anything that failed for one member without stopping the run. */
  failures: string[];
};

/**
 * The daily billing pass.
 *
 * Everything here used to be missing entirely: nothing in the codebase ever
 * wrote the OVERDUE status, so an invoice stayed DUE forever — the Inbox badge
 * counted overdue rows by date and the Payments filter counted them by status,
 * and the two disagreed permanently. Nobody was reminded of anything, because
 * the API had no scheduled work of any kind.
 *
 * Driven by an HTTP endpoint rather than an in-process cron: the API is
 * deployed as a Vercel function, so a timer registered at boot would be a
 * no-op — the process isn't alive between requests to fire it.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
  ) {}

  async runDaily(now = new Date()): Promise<BillingRunResult> {
    const today = startOfUtcDay(now);
    const result: BillingRunResult = { invoicesIssued: 0, markedOverdue: 0, remindersSent: 0, failures: [] };

    // Issue first: an invoice raised today can still be picked up by the
    // reminder pass below if it happens to fall inside the window.
    await this.issueMonthly(today, result);
    await this.markOverdue(today, result);
    await this.remindBeforeDue(today, result);

    this.logger.log(
      `Billing run: ${result.invoicesIssued} issued, ${result.markedOverdue} marked overdue, ${result.remindersSent} reminders sent` +
        (result.failures.length ? `, ${result.failures.length} failed` : ''),
    );
    return result;
  }

  /**
   * Raise this month's invoice for everyone on a monthly amount.
   *
   * The membership's `dueDate` is the next one owed: we bill it, then roll it
   * forward a month. Nothing is generated for a member without an amount —
   * that's the switch an admin uses to decide who is billed automatically.
   */
  private async issueMonthly(today: Date, result: BillingRunResult): Promise<void> {
    const horizon = new Date(today);
    horizon.setUTCDate(horizon.getUTCDate() + ISSUE_DAYS_AHEAD);

    const memberships = await this.prisma.membership.findMany({
      where: {
        status: 'ACTIVE_MEMBER',
        monthlyAmountCents: { not: null },
        dueDate: { not: null, lte: horizon },
      },
      include: { user: { select: { id: true, email: true, profile: { select: { fullName: true } } } } },
    });

    for (const membership of memberships) {
      const dueDate = membership.dueDate!;
      // Their stay has ended: stop billing rather than invoicing someone who
      // has already left.
      if (membership.finishDate && dueDate > membership.finishDate) continue;

      const period = billingPeriodOf(dueDate);
      const description = `Membership — ${monthName(dueDate)}`;

      try {
        await this.prisma.payment.create({
          data: {
            userId: membership.userId,
            amountCents: membership.monthlyAmountCents!,
            currency: membership.currency,
            status: 'DUE',
            dueDate,
            description,
            billingPeriod: period,
          },
        });
        result.invoicesIssued += 1;

        await this.notifications.notify(membership.userId, {
          type: 'info',
          title: 'New invoice',
          body: `${description} — due ${formatDay(dueDate)}.`,
          link: '/account',
        });
        await this.mail.sendInvoiceIssued(
          membership.user.email,
          membership.user.profile?.fullName ?? membership.user.email,
          {
            description,
            amountCents: membership.monthlyAmountCents!,
            currency: membership.currency,
            dueDate,
            payUrl: null,
          },
        );
      } catch (error) {
        // A unique violation on (userId, billingPeriod) means this month is
        // already invoiced — the run is simply repeating, which is fine. The
        // date still has to move on, or it would try again forever.
        if (!isDuplicatePeriod(error)) {
          result.failures.push(`invoice ${membership.userId}: ${(error as Error).message}`);
          continue;
        }
      }

      // Rolled forward last, so a failure above leaves the member due for the
      // same month tomorrow rather than skipping a month's rent silently.
      await this.prisma.membership.update({
        where: { id: membership.id },
        data: { dueDate: addOneMonth(dueDate) },
      });
    }
  }

  /**
   * DUE → OVERDUE for anything past its day, with one email and one in-app
   * notice each.
   *
   * Compared against the start of today, not `now`: a payment due today is not
   * late, and comparing against the current moment would flag it from midnight.
   */
  private async markOverdue(today: Date, result: BillingRunResult): Promise<void> {
    const due = await this.prisma.payment.findMany({
      where: { status: 'DUE', dueDate: { lt: today } },
      include: { user: { select: { id: true, email: true, profile: { select: { fullName: true } } } } },
    });

    for (const payment of due) {
      try {
        // Status first. If the notification below fails, the row is still
        // correct — and it won't be picked up again tomorrow, so nobody gets
        // told twice.
        await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'OVERDUE' } });
        result.markedOverdue += 1;

        await this.notifications.notify(payment.userId, {
          type: 'warning',
          title: 'Payment overdue',
          body: `${payment.description} was due on ${formatDay(payment.dueDate)}.`,
          link: '/account',
        });
        await this.mail.sendPaymentOverdue(payment.user.email, payment.user.profile?.fullName ?? payment.user.email, {
          description: payment.description,
          amountCents: payment.amountCents,
          currency: payment.currency,
          dueDate: payment.dueDate,
          payUrl: payment.payUrl,
        });
      } catch (error) {
        // One member's bad row must not stop the rest of the run.
        result.failures.push(`overdue ${payment.id}: ${(error as Error).message}`);
      }
    }
  }

  /** A single in-app nudge a few days out. No email — this one isn't news yet. */
  private async remindBeforeDue(today: Date, result: BillingRunResult): Promise<void> {
    const horizon = new Date(today);
    horizon.setUTCDate(horizon.getUTCDate() + REMINDER_DAYS_BEFORE);

    const soon = await this.prisma.payment.findMany({
      where: {
        status: 'DUE',
        reminderSentAt: null,
        dueDate: { gte: today, lte: horizon },
      },
    });

    for (const payment of soon) {
      try {
        await this.notifications.notify(payment.userId, {
          type: 'info',
          title: 'Payment due soon',
          body: `${payment.description} is due on ${formatDay(payment.dueDate)}.`,
          link: '/account',
        });
        // Stamped after the notice, so a failure here means it retries
        // tomorrow rather than going silent.
        await this.prisma.payment.update({ where: { id: payment.id }, data: { reminderSentAt: new Date() } });
        result.remindersSent += 1;
      } catch (error) {
        result.failures.push(`reminder ${payment.id}: ${(error as Error).message}`);
      }
    }
  }
}

/** Midnight UTC on the day of `date`. Due dates are calendar days, not moments. */
export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDay(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}

/** "2026-09" — the month an automatic invoice covers. */
export function billingPeriodOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthName(date: Date): string {
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/**
 * The same day next month, clamped to the last day when that day doesn't exist.
 *
 * Without the clamp, a 31st rolls into the 1st or 2nd and every later invoice
 * drifts to a different day of the month than the member agreed to.
 */
export function addOneMonth(date: Date): Date {
  const day = date.getUTCDate();
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next;
}

/** Prisma's unique-constraint code. */
function isDuplicatePeriod(error: unknown): boolean {
  return (error as { code?: string })?.code === 'P2002';
}
