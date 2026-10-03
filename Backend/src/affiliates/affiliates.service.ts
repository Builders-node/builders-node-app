import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { AFFILIATE_KEY, parseAffiliateReward } from '../admin/global-settings';
import { affiliateLedgers } from './ledger';

/**
 * The affiliate programme.
 *
 * There is nothing to apply for and nothing to approve. Every account carries a
 * referral code from the moment it is created, so registering *is* joining —
 * which is why the affiliate page's only call to action is the signup button.
 *
 * What an admin needs, then, isn't a queue. It is the answer to "who is sending
 * us people, and what do we owe them" — and that is derived, not stored:
 * `User.signupSource` says who came through the affiliate page, and referral
 * credit on applications says what they have actually done. A second,
 * hand-maintained affiliate table could only ever disagree with both.
 */
@Injectable()
export class AffiliatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /**
   * Everyone worth counting as an affiliate, and their numbers.
   *
   * Two ways onto this list, because either on its own misses people who are
   * plainly affiliates: somebody who signed up through the affiliate page but
   * has not sent anyone yet, and a member who never saw that page but whose
   * link has brought in four applications.
   */
  async list() {
    const [sourced, referrers, reward] = await Promise.all([
      this.prisma.user.findMany({
        where: { signupSource: 'affiliate-page' },
        select: AFFILIATE_SELECT,
      }),
      // Who has been credited on an application, as ids — the rows themselves
      // are counted below and there is no reason to load them twice.
      this.prisma.application.groupBy({
        by: ['referredByUserId'],
        where: { referredByUserId: { not: null } },
        _count: { _all: true },
      }),
      this.reward(),
    ]);

    const referrerIds = referrers
      .map((row) => row.referredByUserId)
      .filter((id): id is string => Boolean(id));
    const known = new Set(sourced.map((user) => user.id));
    const missingIds = referrerIds.filter((id) => !known.has(id));

    const extra = missingIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: missingIds } }, select: AFFILIATE_SELECT })
      : [];

    const users = [...sourced, ...extra];
    if (users.length === 0) return [];

    const ids = users.map((user) => user.id);
    const [ledgers, recentPayouts] = await Promise.all([
      affiliateLedgers(this.prisma, ids),
      this.prisma.affiliatePayout.findMany({ where: { userId: { in: ids } }, orderBy: { paidAt: 'desc' } }),
    ]);
    const payoutsBy = new Map<string, typeof recentPayouts>();
    for (const payout of recentPayouts) payoutsBy.set(payout.userId, [...(payoutsBy.get(payout.userId) ?? []), payout]);
    const baseUrl = this.mail.frontendBaseUrl();

    return users
      .map((user) => {
        const ledger = ledgers.get(user.id)!;
        return {
          id: user.id,
          email: user.email,
          fullName: user.profile?.fullName ?? null,
          phone: user.profile?.phone ?? null,
          role: user.role,
          /** True when they arrived through the affiliate page rather than by referring someone. */
          fromAffiliatePage: user.signupSource === 'affiliate-page',
          referralCode: user.referralCode,
          inviteLink: user.referralCode ? `${baseUrl}/?ref=${user.referralCode}` : null,
          referredCount: ledger.referredCount,
          joinedCount: ledger.joinedCount,
          /** Counted on people who got in, never on applications. */
          earnedCents: ledger.earnedCents,
          paidCents: ledger.paidCents,
          owedCents: ledger.owedCents,
          currency: ledger.currency,
          payouts: (payoutsBy.get(user.id) ?? []).map((payout) => ({
            id: payout.id,
            amountCents: payout.amountCents,
            currency: payout.currency,
            note: payout.note,
            paidAt: payout.paidAt,
          })),
          joinedAt: user.createdAt,
        };
      })
      // Most owed first, then most productive: an admin opens this to see who to pay.
      .sort((a, b) => b.owedCents - a.owedCents || b.joinedCount - a.joinedCount || b.referredCount - a.referredCount);
  }

  /** Record money paid to an affiliate. Super Admin only (see the controller). */
  async recordPayout(userId: string, input: { amountCents?: number; note?: string }, recordedById?: string) {
    const amountCents = Math.round(Number(input.amountCents));
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      throw new BadRequestException('Enter the amount paid.');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException('Affiliate not found.');
    const reward = await this.reward();
    return this.prisma.affiliatePayout.create({
      data: {
        userId,
        amountCents,
        currency: reward.currency,
        note: input.note?.trim().slice(0, 200) || null,
        recordedById: recordedById ?? null,
      },
    });
  }

  /** Undo a payout recorded by mistake. */
  async removePayout(payoutId: string) {
    const payout = await this.prisma.affiliatePayout.findUnique({ where: { id: payoutId } });
    if (!payout) throw new NotFoundException('Payout not found.');
    await this.prisma.affiliatePayout.delete({ where: { id: payoutId } });
    return { deleted: true };
  }

  /** The current payout terms, as the public page and the member page quote them. */
  async reward() {
    const row = await this.prisma.globalSetting.findUnique({ where: { key: AFFILIATE_KEY } });
    return parseAffiliateReward(row?.value);
  }
}

const AFFILIATE_SELECT = {
  id: true,
  email: true,
  role: true,
  referralCode: true,
  signupSource: true,
  createdAt: true,
  profile: { select: { fullName: true, phone: true } },
} as const;
