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
function makeService(options: {
  sourced?: Array<Record<string, unknown>>;
  applied?: Array<{ referredByUserId: string | null; _count: { _all: number } }>;
  joined?: Array<{ referredByUserId: string | null; _count: { _all: number } }>;
  extra?: Array<Record<string, unknown>>;
} = {}) {
  const {
    sourced = [user('u1', 'nina@example.com', 'Nina Alvarez', 'affiliate-page')],
    applied = [],
    joined = [],
    extra = [],
  } = options;

  const groupBy = jest
    .fn()
    // First call is "who has been credited at all", second is "who got in".
    .mockResolvedValueOnce(applied)
    .mockResolvedValueOnce(joined);

  const prisma = {
    user: {
      findMany: jest.fn().mockResolvedValueOnce(sourced).mockResolvedValueOnce(extra),
    },
    application: { groupBy },
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
      applied: [{ referredByUserId: 'u2', _count: { _all: 4 } }],
      joined: [{ referredByUserId: 'u2', _count: { _all: 1 } }],
      extra: [user('u2', 'sam@example.com', 'Sam Reed', null)],
    });

    const [sam] = await service.list();

    expect(sam.fromAffiliatePage).toBe(false);
    expect(sam.referredCount).toBe(4);
    expect(sam.joinedCount).toBe(1);
  });

  it('does not load an affiliate twice when they are on both lists', async () => {
    const { service, prisma } = makeService({
      applied: [{ referredByUserId: 'u1', _count: { _all: 3 } }],
      joined: [{ referredByUserId: 'u1', _count: { _all: 2 } }],
    });

    const rows = await service.list();

    expect(rows).toHaveLength(1);
    // The second findMany is for referrers we don't already hold; u1 is one of
    // them, so there is nothing left to fetch.
    expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
  });

  it('owes money per person who got in, not per application', async () => {
    const { service } = makeService({
      applied: [{ referredByUserId: 'u1', _count: { _all: 9 } }],
      joined: [{ referredByUserId: 'u1', _count: { _all: 2 } }],
    });

    const [nina] = await service.list();

    // Nine forms, two arrivals — at the $200 default that is $400, not $1,800.
    expect(nina.owedCents).toBe(40_000);
  });

  it('puts the most productive affiliate first', async () => {
    const { service } = makeService({
      sourced: [
        user('u1', 'nina@example.com', 'Nina Alvarez', 'affiliate-page'),
        user('u3', 'lee@example.com', 'Lee Park', 'affiliate-page'),
      ],
      applied: [
        { referredByUserId: 'u1', _count: { _all: 1 } },
        { referredByUserId: 'u3', _count: { _all: 5 } },
      ],
      joined: [{ referredByUserId: 'u3', _count: { _all: 3 } }],
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
