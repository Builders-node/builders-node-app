import { AffiliatesService } from './affiliates.service';
import { normalizeSignupSource } from '../auth/signup-source';

/**
 * The affiliate programme, after the application form was dropped.
 *
 * Nothing is stored about "being an affiliate" — the list is derived from how
 * someone signed up and what their link has done. What's pinned here is that
 * the derivation catches both kinds of affiliate, and that the money is counted
 * on people who got in rather than on forms submitted.
 */
type App = { referredByUserId: string; status: string; referralRewardCents?: number | null };

/** n applications by `referrer`, `joined` of them got in. */
function apps(referrer: string, n: number, joined = 0, rewardCents: number | null = null): App[] {
  return Array.from({ length: n }, (_, i) => ({
    referredByUserId: referrer,
    status: i < joined ? 'CREDENTIALS_SENT' : 'SUBMITTED',
    referralRewardCents: i < joined ? rewardCents : null,
  }));
}

function makeService(options: {
  sourced?: Array<Record<string, unknown>>;
  applications?: App[];
  payouts?: Array<{ userId: string; amountCents: number }>;
  extra?: Array<Record<string, unknown>>;
} = {}) {
  const {
    sourced = [user('u1', 'nina@example.com', 'Nina Alvarez', 'affiliate-page')],
    applications = [],
    payouts = [],
    extra = [],
  } = options;

  // "Who has been credited at all", grouped from the same rows.
  const credited = new Map<string, number>();
  for (const app of applications) credited.set(app.referredByUserId, (credited.get(app.referredByUserId) ?? 0) + 1);
  const paidBy = new Map<string, number>();
  for (const payout of payouts) paidBy.set(payout.userId, (paidBy.get(payout.userId) ?? 0) + payout.amountCents);

  const prisma = {
    user: {
      findMany: jest.fn().mockResolvedValueOnce(sourced).mockResolvedValueOnce(extra),
    },
    application: {
      groupBy: jest.fn().mockResolvedValue([...credited].map(([referredByUserId, n]) => ({ referredByUserId, _count: { _all: n } }))),
      findMany: jest.fn().mockResolvedValue(applications),
    },
    affiliatePayout: {
      groupBy: jest.fn().mockResolvedValue([...paidBy].map(([userId, sum]) => ({ userId, _sum: { amountCents: sum } }))),
      findMany: jest.fn().mockResolvedValue([]),
    },
    globalSetting: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const mail = { frontendBaseUrl: jest.fn().mockReturnValue('https://buildersnode.com') };

  return { service: new AffiliatesService(prisma as never, mail as never), prisma };
}

function user(id: string, email: string, fullName: string, signupSource: string | null) {
  return {
    id,
    email,
    role: 'MEMBER',
    referralCode: `BUILDERS-${id.toUpperCase()}`,
    signupSource,
    createdAt: new Date('2026-09-01'),
    profile: { fullName, phone: null },
  };
}

describe('AffiliatesService.list', () => {
  it('includes someone who signed up through the affiliate page but has sent nobody yet', async () => {
    const { service } = makeService();

    const [nina] = await service.list();

    expect(nina.fromAffiliatePage).toBe(true);
    expect(nina.referredCount).toBe(0);
    expect(nina.owedCents).toBe(0);
    expect(nina.inviteLink).toBe('https://buildersnode.com/?ref=BUILDERS-U1');
  });

  it('includes a member whose link brought people in, however they signed up', async () => {
    // Someone who never saw the affiliate page but has four applications to
    // their name is plainly an affiliate, and leaving them off means not paying
    // them.
    const { service } = makeService({
      sourced: [],
      applications: apps('u2', 4, 1),
      extra: [user('u2', 'sam@example.com', 'Sam Reed', null)],
    });

    const [sam] = await service.list();

    expect(sam.fromAffiliatePage).toBe(false);
    expect(sam.referredCount).toBe(4);
    expect(sam.joinedCount).toBe(1);
  });

  it('does not load an affiliate twice when they are on both lists', async () => {
    const { service, prisma } = makeService({ applications: apps('u1', 3, 2) });

    const rows = await service.list();

    expect(rows).toHaveLength(1);
    // The second findMany is for referrers we don't already hold; u1 is one of
    // them, so there is nothing left to fetch.
    expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
  });

  it('owes money per person who got in, not per application', async () => {
    const { service } = makeService({ applications: apps('u1', 9, 2) });

    const [nina] = await service.list();

    // Nine forms, two arrivals — at the $200 default that is $400, not $1,800.
    expect(nina.owedCents).toBe(40_000);
  });

  it('pays each referral at the reward fixed when it joined, not today\'s', async () => {
    // Two joined while the reward was $150; the setting is $200 now.
    const { service } = makeService({ applications: apps('u1', 2, 2, 15_000) });

    const [nina] = await service.list();

    expect(nina.earnedCents).toBe(30_000);
  });

  it('takes recorded payouts off what is owed', async () => {
    const { service } = makeService({
      applications: apps('u1', 3, 3),
      payouts: [{ userId: 'u1', amountCents: 40_000 }],
    });

    const [nina] = await service.list();

    expect(nina).toMatchObject({ earnedCents: 60_000, paidCents: 40_000, owedCents: 20_000 });
  });

  it('puts the most productive affiliate first', async () => {
    const { service } = makeService({
      sourced: [
        user('u1', 'nina@example.com', 'Nina Alvarez', 'affiliate-page'),
        user('u3', 'lee@example.com', 'Lee Park', 'affiliate-page'),
      ],
      applications: [...apps('u1', 1), ...apps('u3', 5, 3)],
    });

    const rows = await service.list();

    expect(rows.map((row) => row.id)).toEqual(['u3', 'u1']);
  });
});

describe('normalizeSignupSource', () => {
  it('keeps a source the app knows how to render', () => {
    expect(normalizeSignupSource('affiliate-page')).toBe('affiliate-page');
    expect(normalizeSignupSource(' Affiliate-Page ')).toBe('affiliate-page');
  });

  it('drops anything else', () => {
    // It arrives from the browser on an unauthenticated endpoint and is read
    // back into an admin screen.
    expect(normalizeSignupSource('<script>')).toBeNull();
    expect(normalizeSignupSource('made-up')).toBeNull();
    expect(normalizeSignupSource(undefined)).toBeNull();
  });
});
