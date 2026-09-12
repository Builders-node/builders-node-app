import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { AFFILIATE_KEY, parseAffiliateReward } from '../admin/global-settings';

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
    // Applications that got in. Counted per referrer in one grouped query
    // rather than once per row: this screen exists to compare them.
    const joined = await this.prisma.application.groupBy({
      by: ['referredByUserId'],
      where: { referredByUserId: { in: ids }, status: { in: JOINED_APPLICATION_STATUSES } },
      _count: { _all: true },
    });

    const appliedBy = new Map(referrers.map((row) => [row.referredByUserId ?? '', row._count._all]));
    const joinedBy = new Map(joined.map((row) => [row.referredByUserId ?? '', row._count._all]));
    const baseUrl = this.mail.frontendBaseUrl();

    return users
      .map((user) => {
        const joinedCount = joinedBy.get(user.id) ?? 0;
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
          referredCount: appliedBy.get(user.id) ?? 0,
          joinedCount,
          /** What they have earned. Counted on people who got in, never on applications. */
          owedCents: joinedCount * reward.rewardCents,
          currency: reward.currency,
          joinedAt: user.createdAt,
        };
      })
      // Most productive first: an admin opens this to see who to pay.
      .sort((a, b) => b.joinedCount - a.joinedCount || b.referredCount - a.referredCount);
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

/**
 * An application that made it in — the same two statuses the member's own
 * affiliate page counts, so the two screens can never quote different numbers.
 */
const JOINED_APPLICATION_STATUSES = ['APPROVED', 'CREDENTIALS_SENT'];
