import { PrismaService } from '../database/prisma.service';
import { AFFILIATE_KEY, parseAffiliateReward } from '../admin/global-settings';

/**
 * An application that made it in — what an affiliate is paid on. Shared by the
 * admin list and the member's own page so the two can never quote different
 * numbers.
 */
export const JOINED_APPLICATION_STATUSES = ['APPROVED', 'CREDENTIALS_SENT'];

export type AffiliateLedger = {
  referredCount: number;
  joinedCount: number;
  earnedCents: number;
  paidCents: number;
  owedCents: number;
  currency: string;
};

/**
 * What each affiliate has earned, been paid, and is owed.
 *
 * Earned is per referral at the reward fixed when that person joined (see
 * Application.referralRewardCents) — the current setting only prices joins
 * from before the snapshot existed. Paid is the sum of recorded payouts.
 * Both used to be one multiplication by today's reward, so owed never went
 * down and a reward change re-priced the past.
 */
export async function affiliateLedgers(prisma: PrismaService, userIds: string[]): Promise<Map<string, AffiliateLedger>> {
  const result = new Map<string, AffiliateLedger>();
  if (userIds.length === 0) return result;

  const [rewardRow, applications, payouts] = await Promise.all([
    prisma.globalSetting.findUnique({ where: { key: AFFILIATE_KEY } }),
    prisma.application.findMany({
      where: { referredByUserId: { in: userIds } },
      select: { referredByUserId: true, status: true, referralRewardCents: true },
    }),
    prisma.affiliatePayout.groupBy({ by: ['userId'], where: { userId: { in: userIds } }, _sum: { amountCents: true } }),
  ]);
  const reward = parseAffiliateReward(rewardRow?.value);
  const paidBy = new Map(payouts.map((row) => [row.userId, row._sum.amountCents ?? 0]));

  for (const id of userIds) {
    result.set(id, { referredCount: 0, joinedCount: 0, earnedCents: 0, paidCents: paidBy.get(id) ?? 0, owedCents: 0, currency: reward.currency });
  }
  for (const app of applications) {
    const ledger = result.get(app.referredByUserId!);
    if (!ledger) continue;
    ledger.referredCount += 1;
    if (JOINED_APPLICATION_STATUSES.includes(app.status)) {
      ledger.joinedCount += 1;
      ledger.earnedCents += app.referralRewardCents ?? reward.rewardCents;
    }
  }
  for (const ledger of result.values()) ledger.owedCents = Math.max(0, ledger.earnedCents - ledger.paidCents);
  return result;
}
