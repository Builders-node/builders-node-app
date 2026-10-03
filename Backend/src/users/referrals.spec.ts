import { UsersService } from './users.service';

/**
 * The two numbers behind an affiliate's payout.
 *
 * `referredCount` is everyone who filled the application form in with the link;
 * `joinedCount` is the subset who got in. Money is owed on the second one, so
 * the difference between them is the whole point of returning both.
 */
function makeService(applications: Array<{ status: string; referralRewardCents?: number | null }>) {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ referralCode: 'BUILDERS-AB12CD' }) },
    application: {
      findMany: jest.fn().mockResolvedValue(applications.map((app) => ({ referredByUserId: 'user-1', referralRewardCents: null, ...app }))),
    },
    affiliatePayout: { groupBy: jest.fn().mockResolvedValue([{ userId: 'user-1', _sum: { amountCents: 20_000 } }]) },
    globalSetting: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const discord = { isEnabled: () => false };
  return { service: new UsersService(prisma as never, discord as never), prisma };
}

const statuses = (...list: string[]) => list.map((status) => ({ status }));

describe('UsersService.findReferrals', () => {
  it('reports applications and joins separately, with what is earned, paid and owed', async () => {
    const { service } = makeService(statuses('SUBMITTED', 'SUBMITTED', 'FIRST_APPROVED', 'CREDENTIALS_SENT', 'APPROVED'));

    const result = await service.findReferrals('user-1');

    expect(result).toEqual({
      referralCode: 'BUILDERS-AB12CD',
      referredCount: 5,
      joinedCount: 2,
      earnedCents: 40_000,
      paidCents: 20_000,
      owedCents: 20_000,
      currency: 'USD',
    });
  });

  it('counts a join only from a status that means they got in', async () => {
    // A rejection is terminal too, so "reached a terminal status" would have
    // paid out on people who were turned away.
    const { service } = makeService(statuses('FIRST_REJECTED', 'MEETING_REJECTED'));

    const result = await service.findReferrals('user-1');

    expect(result.joinedCount).toBe(0);
  });

  it('refuses a user that does not exist rather than reporting zero referrals', async () => {
    const { service, prisma } = makeService([]);
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.findReferrals('ghost')).rejects.toThrow();
  });
});
