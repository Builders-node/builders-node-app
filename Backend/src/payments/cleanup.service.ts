import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

const DAY_MS = 24 * 3600 * 1000;

/**
 * An unconfirmed application is dead after its 10-minute code expires; a month
 * is long past any "I'll find the email later". The row holds the whole form —
 * name, phone, about-me — for someone who never confirmed they meant to send it.
 */
export const VERIFICATION_RETENTION_DAYS = 30;

/** Expired reset / verification links are kept a week, for "why didn't my link work?". */
export const EXPIRED_TOKEN_GRACE_DAYS = 7;

/** Read notifications older than this are history nobody scrolls back to. */
export const READ_NOTIFICATION_RETENTION_DAYS = 180;

/** Per step: how many rows went, or why the step failed. */
export type CleanupStep = { deleted: number } | { error: string };

export type CleanupResult = {
  applicationVerifications: CleanupStep;
  passwordResetTokens: CleanupStep;
  emailVerificationTokens: CleanupStep;
  readNotifications: CleanupStep;
};

/**
 * Housekeeping for the daily job: rows that only ever grow and that nobody
 * needs once they're stale. Nothing used to delete any of them.
 *
 * Every step is independent and reports its own outcome — a failure in one
 * (a lock timeout, say) must not keep the others from running, and the job's
 * response says exactly which part didn't happen so tomorrow's run is the
 * retry.
 */
@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  async runDaily(now = new Date()): Promise<CleanupResult> {
    const daysAgo = (days: number) => new Date(now.getTime() - days * DAY_MS);

    const result: CleanupResult = {
      applicationVerifications: await this.step('applicationVerifications', () =>
        this.prisma.applicationVerification.deleteMany({
          where: { createdAt: { lt: daysAgo(VERIFICATION_RETENTION_DAYS) } },
        }),
      ),
      passwordResetTokens: await this.step('passwordResetTokens', () =>
        this.prisma.passwordResetToken.deleteMany({
          where: { expiresAt: { lt: daysAgo(EXPIRED_TOKEN_GRACE_DAYS) } },
        }),
      ),
      emailVerificationTokens: await this.step('emailVerificationTokens', () =>
        this.prisma.emailVerificationToken.deleteMany({
          where: { expiresAt: { lt: daysAgo(EXPIRED_TOKEN_GRACE_DAYS) } },
        }),
      ),
      // Unread ones stay however old they are: deleting something the member
      // never saw would be losing it, not tidying it.
      readNotifications: await this.step('readNotifications', () =>
        this.prisma.notification.deleteMany({
          where: { readAt: { not: null }, createdAt: { lt: daysAgo(READ_NOTIFICATION_RETENTION_DAYS) } },
        }),
      ),
    };

    this.logger.log(
      `Cleanup: ${Object.entries(result)
        .map(([name, step]) => `${name} ${'deleted' in step ? step.deleted : 'FAILED'}`)
        .join(', ')}`,
    );
    return result;
  }

  private async step(name: string, run: () => Promise<{ count: number }>): Promise<CleanupStep> {
    try {
      const { count } = await run();
      return { deleted: count };
    } catch (error) {
      const message = (error as Error)?.message ?? 'Unknown error';
      this.logger.error(`Cleanup step ${name} failed: ${message}`);
      return { error: message };
    }
  }
}
