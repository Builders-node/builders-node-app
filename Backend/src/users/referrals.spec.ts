import { UsersService } from './users.service';

/**
 * The two numbers behind an affiliate's payout.
 *
 * `referredCount` is everyone who filled the application form in with the link;
 * `joinedCount` is the subset who got in. Money is owed on the second one, so
 * the difference between them is the whole point of returning both.
 */
function makeService(applicationCounts: number[]) {
  const counts = [...applicationCounts];
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ referralCode: 'BUILDERS-AB12CD' }) },
    application: { count: jest.fn().mockImplementation(() => Promise.resolve(counts.shift() ?? 0)) },
  };
  const discord = { isEnabled: () => false };
  return { service: new UsersService(prisma as never, discord as never), prisma };
}

describe('UsersService.findReferrals', () => {
  it('reports applications and joins separately', async () => {
    const { service } = makeService([7, 2]);

    const result = await service.findReferrals('user-1');

    expect(result).toEqual({ referralCode: 'BUILDERS-AB12CD', referredCount: 7, joinedCount: 2 });
  });

  it('counts a join only from a status that means they got in', async () => {
    // A rejection is terminal too, so "reached a terminal status" would have
    // paid out on people who were turned away.
    const { service, prisma } = makeService([7, 2]);

    await service.findReferrals('user-1');

    const joinedQuery = prisma.application.count.mock.calls[1][0];
    expect(joinedQuery.where.status.in).toEqual(['APPROVED', 'CREDENTIALS_SENT']);
    expect(joinedQuery.where.status.in).not.toContain('FIRST_REJECTED');
  });

  it('refuses a user that does not exist rather than reporting zero referrals', async () => {
    const { service, prisma } = makeService([0, 0]);
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.findReferrals('ghost')).rejects.toThrow();
  });
});
