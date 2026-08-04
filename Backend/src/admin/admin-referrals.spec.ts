import { AdminService } from './admin.service';

/**
 * The referrals report. Referral data existed but only one member at a time —
 * these pin down the grouping and the bucketing that make the whole picture
 * readable.
 */
function makeService(applications: unknown[], users: unknown[] = []) {
  const prisma = {
    application: { findMany: jest.fn().mockResolvedValue(applications) },
    user: { findMany: jest.fn().mockResolvedValue(users) },
  };
  return {
    service: new AdminService(prisma as never, {} as never, {} as never, {} as never),
    prisma,
  };
}

const app = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  fullName: 'Applicant',
  email: 'a@b.test',
  status: 'SUBMITTED',
  createdAt: new Date('2026-01-01'),
  referralCode: 'BUILDERS-AAA111',
  referredByUserId: 'u1',
  ...over,
});

const member = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  email: 'ref@b.test',
  referralCode: 'BUILDERS-AAA111',
  profile: { fullName: 'Referring Member' },
  ...over,
});

describe('AdminService.referrals', () => {
  it('groups applicants under the member who referred them, by name', async () => {
    const { service } = makeService(
      [app({ id: 'a1', fullName: 'First' }), app({ id: 'a2', fullName: 'Second' })],
      [member()],
    );

    const report = await service.referrals();

    expect(report.referrers).toHaveLength(1);
    expect(report.referrers[0].name).toBe('Referring Member');
    expect(report.referrers[0].total).toBe(2);
    expect(report.referrers[0].people.map((p) => p.fullName)).toEqual(['First', 'Second']);
  });

  it('splits each referrer’s applicants into onboarded, in progress and rejected', async () => {
    const { service } = makeService(
      [
        app({ id: 'a1', status: 'CREDENTIALS_SENT' }),
        app({ id: 'a2', status: 'APPROVED' }),
        app({ id: 'a3', status: 'PAYMENT_LINK_SENT' }),
        app({ id: 'a4', status: 'FIRST_REJECTED' }),
      ],
      [member()],
    );

    const [row] = (await service.referrals()).referrers;

    expect(row.onboarded).toBe(2);
    expect(row.inProgress).toBe(1);
    expect(row.rejected).toBe(1);
    expect(row.total).toBe(4);
  });

  it('counts applications that arrived without a referral', async () => {
    const { service } = makeService(
      [app({ id: 'a1' }), app({ id: 'a2', referredByUserId: null }), app({ id: 'a3', referredByUserId: null })],
      [member()],
    );

    const report = await service.referrals();

    expect(report.totals).toMatchObject({ applications: 3, withReferral: 1, withoutReferral: 2, referrers: 1 });
  });

  it('ranks by people actually onboarded, not by raw applications', async () => {
    const { service } = makeService(
      [
        // u1 sent four people, none of whom made it.
        app({ id: 'a1', referredByUserId: 'u1', status: 'FIRST_REJECTED' }),
        app({ id: 'a2', referredByUserId: 'u1', status: 'FIRST_REJECTED' }),
        app({ id: 'a3', referredByUserId: 'u1', status: 'MEETING_REJECTED' }),
        app({ id: 'a4', referredByUserId: 'u1', status: 'SUBMITTED' }),
        // u2 sent one who joined.
        app({ id: 'a5', referredByUserId: 'u2', status: 'CREDENTIALS_SENT' }),
      ],
      [member({ id: 'u1', profile: { fullName: 'Wide Sharer' } }), member({ id: 'u2', profile: { fullName: 'Real Recruiter' } })],
    );

    const report = await service.referrals();

    expect(report.referrers.map((r) => r.name)).toEqual(['Real Recruiter', 'Wide Sharer']);
  });

  it('still attributes an application whose referrer account is gone', async () => {
    // No matching user row — the count must not silently drop the application.
    const { service } = makeService([app({ referredByUserId: 'deleted-user' })], []);

    const report = await service.referrals();

    expect(report.totals.withReferral).toBe(1);
    expect(report.referrers).toHaveLength(0);
  });

  it('does not query for referrers when nothing was referred', async () => {
    const { service, prisma } = makeService([app({ referredByUserId: null })]);

    const report = await service.referrals();

    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(report.referrers).toEqual([]);
  });

  it('falls back to the email when a referrer has no profile name', async () => {
    const { service } = makeService([app()], [member({ profile: null })]);

    expect((await service.referrals()).referrers[0].name).toBe('ref@b.test');
  });
});
