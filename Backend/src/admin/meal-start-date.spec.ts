import { AdminService } from './admin.service';

/**
 * When meal deliveries begin.
 *
 * A plan is assigned as soon as the admin knows which one it is — often weeks
 * before the member lands — so the start date is asked for separately. Getting
 * it wrong means food arriving at an empty apartment, or not arriving at all.
 */
function makeService() {
  const user = { id: 'user-1', email: 'ada@builders.test', profile: { fullName: 'Ada Lovelace', phone: null } };
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(user), update: jest.fn().mockResolvedValue({}) },
    // findFirst: the plan being replaced is read before the row is deleted, so
    // the subscription it mirrors can be cancelled instead of orphaned.
    mealMenuItem: { findFirst: jest.fn().mockResolvedValue(null), deleteMany: jest.fn().mockResolvedValue({}), create: jest.fn().mockResolvedValue({ id: 'meal-1' }), update: jest.fn().mockResolvedValue({}) },
    cleaningSchedule: { findFirst: jest.fn().mockResolvedValue(null), deleteMany: jest.fn().mockResolvedValue({}), create: jest.fn().mockResolvedValue({ id: 'clean-1' }) },
    auditEvent: { create: jest.fn().mockResolvedValue({}) },
  };
  const prosperaSub = {
    provisionMember: jest.fn().mockResolvedValue({
      status: 'ACTIVE', externalMemberId: null, externalFoodSubscriptionId: null,
      externalCleaningSubscriptionId: null, externalBeachClubSubscriptionId: null,
      externalAccountId: null, warnings: [], message: '',
    }),
  };
  return { service: new AdminService(prisma as never, prosperaSub as never, {} as never, {} as never), prisma, prosperaSub };
}

const PLAN = { mealPlan: 'Standard Plan', mealPlanId: '11111111-2222-3333-4444-555555555555' };

describe('AdminService.designateUser — meal start date', () => {
  it('stores the date the admin picked on the local plan', async () => {
    const { service, prisma } = makeService();
    await service.designateUser('user-1', { ...PLAN, mealStartDate: '2027-01-15' });
    expect(prisma.mealMenuItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ startsAt: new Date('2027-01-15T00:00:00.000Z') }) }),
    );
  });

  it('passes it to the provider so deliveries do not start today', async () => {
    const { service, prosperaSub } = makeService();
    await service.designateUser('user-1', { ...PLAN, mealStartDate: '2027-01-15' });
    expect(prosperaSub.provisionMember).toHaveBeenCalledWith(
      expect.objectContaining({ foodStartDate: new Date('2027-01-15T00:00:00.000Z') }),
    );
  });

  it('pins the date to UTC midnight, so it cannot slip a day west of UTC', async () => {
    const { service, prisma } = makeService();
    await service.designateUser('user-1', { ...PLAN, mealStartDate: '2027-01-15' });
    const stored = prisma.mealMenuItem.create.mock.calls[0][0].data.startsAt as Date;
    expect(stored.toISOString()).toBe('2027-01-15T00:00:00.000Z');
  });

  it('leaves the date unset when the admin gives none — deliveries start now', async () => {
    const { service, prisma, prosperaSub } = makeService();
    await service.designateUser('user-1', PLAN);
    expect(prisma.mealMenuItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ startsAt: null }) }),
    );
    expect(prosperaSub.provisionMember).toHaveBeenCalledWith(expect.objectContaining({ foodStartDate: null }));
  });

  it('refuses a date it cannot read rather than quietly starting today', async () => {
    // Silently falling back would start a month of deliveries early, at an
    // apartment nobody has moved into.
    const { service, prisma } = makeService();
    await expect(service.designateUser('user-1', { ...PLAN, mealStartDate: '15/01/2027' })).rejects.toThrow(/calendar date/);
    expect(prisma.mealMenuItem.create).not.toHaveBeenCalled();
  });

  it('refuses a date that looks right but is not real', async () => {
    const { service } = makeService();
    await expect(service.designateUser('user-1', { ...PLAN, mealStartDate: '2027-13-45' })).rejects.toThrow(/not a real date/);
  });
});
