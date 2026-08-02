import { AdminService } from './admin.service';

describe('AdminService userDetail', () => {
  it('returns every community plan purchase for the selected user', async () => {
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
          residencyApplication: null,
          subscriptionPlan: null,
          communityPlans,
          assignedApartment: null,
          mealMenuItems: [],
          cleaningSchedules: [],
          payments: [],
          supportTickets: [],
        }),
      },
      application: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never);

    const detail = (await service.userDetail('user-1')) as { communityPlans?: typeof communityPlans };

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          communityPlans: { orderBy: { purchasedAt: 'desc' } },
        }),
      }),
    );
    expect(detail.communityPlans).toEqual(communityPlans);
  });

  it('returns the user referral code for admins', async () => {
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
          residencyApplication: null,
          subscriptionPlan: null,
          communityPlans: [],
          assignedApartment: null,
          mealMenuItems: [],
          cleaningSchedules: [],
          payments: [],
          supportTickets: [],
        }),
      },
      application: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never);

    const detail = (await service.userDetail('user-1')) as { referralCode?: string };

    expect(detail.referralCode).toBe('BUILDERS-AB12CD');
  });

  it('returns applications referred by the selected user', async () => {
    const referredApplications = [
      {
        id: 'application-1',
        fullName: 'Invited Applicant',
        email: 'invited@terminus.test',
        referralCode: 'BUILDERS-AB12CD',
        status: 'SUBMITTED',
        createdAt: new Date('2026-05-12T00:00:00.000Z'),
      },
    ];
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
          residencyApplication: null,
          subscriptionPlan: null,
          communityPlans: [],
          assignedApartment: null,
          mealMenuItems: [],
          cleaningSchedules: [],
          payments: [],
          supportTickets: [],
        }),
      },
      application: {
        findMany: jest.fn().mockResolvedValue(referredApplications),
      },
    };
    const service = new AdminService(prisma as never, {} as never, {} as never, {} as never);

    const detail = (await service.userDetail('user-1')) as { referredApplications?: typeof referredApplications };

    expect(prisma.application.findMany).toHaveBeenCalledWith({
      where: { referredByUserId: 'user-1' },
      orderBy: { createdAt: 'desc' },
    });
    expect(detail.referredApplications).toEqual(referredApplications);
  });
});
