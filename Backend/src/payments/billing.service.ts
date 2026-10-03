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

/**
 * How many members are worked on at once. Each one is a few queries and an
 * email round-trip; one at a time, a few dozen members with a slow mail
 * provider was enough to run into Vercel's 30s limit. Five overlaps the
 * waiting without opening a flood of connections through the pooler.
 */
const CONCURRENCY = 5;

/**
 * How long the run may keep starting new work. Vercel stops the function at
 * 30s, and a run killed mid-flight reports nothing; stopping at 25s leaves time
 * to finish what's in hand and answer. Whatever is left is still due tomorrow —
 * every pass selects by state (DUE, unreminded, dueDate in range), so the next
 * run picks up exactly where this one stopped.
 */
export const BILLING_TIME_BUDGET_MS = 25_000;

export type BillingRunResult = {
  invoicesIssued: number;
  markedOverdue: number;
  remindersSent: number;
  /** Anything that failed for one member without stopping the run. */
  failures: string[];
  /** Items not started because the time budget ran out; tomorrow's run continues. */
  deferred: number;
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

  /**
   * @param now      the moment the run is for (tests pin it).
   * @param deadline wall-clock ms after which no new member is started.
   */
  async runDaily(now = new Date(), deadline = Date.now() + BILLING_TIME_BUDGET_MS): Promise<BillingRunResult> {
    const today = startOfUtcDay(now);
    const result: BillingRunResult = { invoicesIssued: 0, markedOverdue: 0, remindersSent: 0, failures: [], deferred: 0 };

    // Issue first: an invoice raised today can still be picked up by the
    // reminder pass below if it happens to fall inside the window.
    await this.issueMonthly(today, result, deadline);
    await this.markOverdue(today, result, deadline);
    await this.remindBeforeDue(today, result, deadline);

    this.logger.log(
      `Billing run: ${result.invoicesIssued} issued, ${result.markedOverdue} marked overdue, ${result.remindersSent} reminders sent` +
        (result.failures.length ? `, ${result.failures.length} failed` : '') +
        (result.deferred ? `, ${result.deferred} left for the next run` : ''),
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
  private async issueMonthly(today: Date, result: BillingRunResult, deadline: number): Promise<void> {
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

    result.deferred += await forEachBounded(memberships, deadline, async (membership) => {
      const dueDate = membership.dueDate!;
      // Their stay has ended: stop billing rather than invoicing someone who
      // has already left.
      if (membership.finishDate && dueDate > membership.finishDate) return;

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
          return;
        }
      }

      // Rolled forward last, so a failure above leaves the member due for the
      // same month tomorrow rather than skipping a month's rent silently.
      //
      // Conditional on the date still being the one just billed: if two runs
      // overlap, both reach here, and an unconditional update would move the
      // date on twice and skip a month. The anchor day is saved alongside,
      // which is how a member whose dueDate predates billingDay gets one.
      const anchor = anchorDayFor(dueDate, membership.billingDay);
      try {
        await this.prisma.membership.updateMany({
          where: { id: membership.id, dueDate },
          data: { dueDate: addOneMonth(dueDate, anchor), billingDay: anchor },
        });
      } catch (error) {
        result.failures.push(`roll ${membership.userId}: ${(error as Error).message}`);
      }
    });
  }

  /**
   * DUE → OVERDUE for anything past its day, with one email and one in-app
   * notice each.
   *
   * Compared against the start of today, not `now`: a payment due today is not
   * late, and comparing against the current moment would flag it from midnight.
   */
  private async markOverdue(today: Date, result: BillingRunResult, deadline: number): Promise<void> {
    const due = await this.prisma.payment.findMany({
      // Detached invoices (the member was erased) have nobody to tell.
      where: { status: 'DUE', dueDate: { lt: today }, userId: { not: null } },
      include: { user: { select: { id: true, email: true, profile: { select: { fullName: true } } } } },
    });

    result.deferred += await forEachBounded(due, deadline, async (payment) => {
      const { userId, user } = payment;
      if (!userId || !user) return;
      try {
        // Status first. If the notification below fails, the row is still
        // correct — and it won't be picked up again tomorrow, so nobody gets
        // told twice.
        //
        // Flipped only from DUE, and only the run that actually flipped it
        // sends anything: two overlapping runs both see this row as DUE, and
        // without the condition both would email the member.
        const flipped = await this.prisma.payment.updateMany({
          where: { id: payment.id, status: 'DUE' },
          data: { status: 'OVERDUE' },
        });
        if (flipped.count !== 1) return;
        result.markedOverdue += 1;

        await this.notifications.notify(userId, {
          type: 'warning',
          title: 'Payment overdue',
          body: `${payment.description} was due on ${formatDay(payment.dueDate)}.`,
          link: '/account',
        });
        await this.mail.sendPaymentOverdue(user.email, user.profile?.fullName ?? user.email, {
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
    });
  }

  /** A single in-app nudge a few days out. No email — this one isn't news yet. */
  private async remindBeforeDue(today: Date, result: BillingRunResult, deadline: number): Promise<void> {
    const horizon = new Date(today);
    horizon.setUTCDate(horizon.getUTCDate() + REMINDER_DAYS_BEFORE);

    const soon = await this.prisma.payment.findMany({
      where: {
        status: 'DUE',
        reminderSentAt: null,
        dueDate: { gte: today, lte: horizon },
        userId: { not: null },
      },
    });

    result.deferred += await forEachBounded(soon, deadline, async (payment) => {
      if (!payment.userId) return;
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
    });
  }
}

/**
 * Run `work` over `items`, at most CONCURRENCY at a time, starting nothing new
 * once `deadline` has passed. Returns how many items were never started.
 *
 * `work` is expected to catch its own failures (every pass records them per
 * member); anything that escapes is still contained here so one item can't
 * reject the whole pool and abandon the rest mid-flight.
 */
export async function forEachBounded<T>(
  items: readonly T[],
  deadline: number,
  work: (item: T) => Promise<void>,
  concurrency = CONCURRENCY,
): Promise<number> {
  let next = 0;
  const worker = async () => {
    while (next < items.length && Date.now() < deadline) {
      const item = items[next++];
      await work(item).catch(() => undefined);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return items.length - next;
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

/** Days in the UTC month containing `date`. */
function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * The anchor day (1-31) to bill on, given the due date being billed now and
 * the membership's stored `billingDay`.
 *
 * The stored day wins while the due date agrees with it — that is, the due
 * date sits on that day, or on the last day of a month too short to have it
 * (31 → Feb 28). If an admin has since moved the due date to some other day,
 * the date is the newer decision and becomes the anchor.
 */
export function anchorDayFor(dueDate: Date, billingDay: number | null | undefined): number {
  const day = dueDate.getUTCDate();
  if (billingDay && Number.isInteger(billingDay) && billingDay >= 1 && billingDay <= 31) {
    const clamped = Math.min(billingDay, daysInMonth(dueDate.getUTCFullYear(), dueDate.getUTCMonth()));
    if (clamped === day) return billingDay;
  }
  return day;
}

/**
 * The anchor day next month, clamped to the last day when that day doesn't exist.
 *
 * Without the clamp, a 31st rolls into the 1st or 2nd. And it has to start
 * from the anchor, not from `date`'s own day: stepping from an already-clamped
 * date (Jan 31 → Feb 28 → Mar 28 → ...) left the member on the 28th for good.
 * Defaults to `date`'s day for a member with no anchor stored yet.
 */
export function addOneMonth(date: Date, anchorDay = date.getUTCDate()): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const lastDay = daysInMonth(year, month);
  return new Date(Date.UTC(year, month, Math.min(anchorDay, lastDay)));
}

/** Prisma's unique-constraint code. */
function isDuplicatePeriod(error: unknown): boolean {
  return (error as { code?: string })?.code === 'P2002';
}
