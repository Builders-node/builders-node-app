import { UsersService } from './users.service';

describe('UsersService findProfile', () => {
  it('includes all community plan purchases on the member profile', async () => {
    const communityPlans = [
      {
        id: 'community-plan-1',
        planName: 'Builders Node Community Plan',
        status: 'ACTIVE',
        purchasedAt: new Date('2026-05-01T00:00:00.000Z'),
      },
      {
        id: 'community-plan-2',
        planName: 'Builders Node Community Plan',
        status: 'ACTIVE',
        purchasedAt: new Date('2026-06-01T00:00:00.000Z'),
      },
    ];
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'member@terminus.test',
          role: 'MEMBER',
          mustChangePassword: false,
          emailVerifiedAt: null,
          createdAt: new Date('2026-05-01T00:00:00.000Z'),
          updatedAt: new Date('2026-05-01T00:00:00.000Z'),
          profile: null,
          membership: null,
          communityPlans,
        }),
      },
    };
    const service = new UsersService(prisma as never);

    const profile = (await service.findProfile('user-1')) as { communityPlans?: typeof communityPlans };

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          communityPlans: { orderBy: { purchasedAt: 'desc' } },
        }),
      }),
    );
    expect(profile.communityPlans).toEqual(communityPlans);
  });

  it('returns the member referral code on the profile', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'member@terminus.test',
          referralCode: 'BUILDERS-AB12CD',
          role: 'MEMBER',
          mustChangePassword: false,
          emailVerifiedAt: null,
          createdAt: new Date('2026-05-01T00:00:00.000Z'),
          updatedAt: new Date('2026-05-01T00:00:00.000Z'),
          profile: null,
          membership: null,
          communityPlans: [],
        }),
      },
    };
    const service = new UsersService(prisma as never);

    const profile = (await service.findProfile('user-1')) as { referralCode?: string };

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          referralCode: true,
        }),
      }),
    );
    expect(profile.referralCode).toBe('BUILDERS-AB12CD');
  });
});
