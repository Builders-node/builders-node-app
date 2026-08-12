import { AdminService } from './admin.service';

/**
 * Changing a member's plan must retire the one it replaces.
 *
 * The grant path replaced the local row before reading it, so the id of the
 * subscription ProsperaSub was billing went with it. The provider then created
 * a second subscription and the first kept charging, unreferenced and
 * uncancellable — the removal path had always got this right, only the change
 * path threw the id away.
 */
const MEAL_PLAN = { mealPlan: 'Standard Plan', mealPlanId: '11111111-2222-3333-4444-555555555555' };

function makeService(options: { previousFoodId?: string | null; newFoodId?: string | null } = {}) {
  const { previousFoodId = 'sub_food_OLD', newFoodId = 'sub_food_NEW' } = options;

  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'ada@builders.test',
        profile: { fullName: 'Ada Lovelace', phone: null },
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    mealMenuItem: {
      findFirst: jest.fn().mockResolvedValue(
        previousFoodId === null ? null : { externalSubscriptionId: previousFoodId },
      ),
      deleteMany: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({ id: 'meal-row-new' }),
      update: jest.fn().mockResolvedValue({}),
    },
    cleaningSchedule: {
      findFirst: jest.fn().mockResolvedValue(null),
      deleteMany: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({ id: 'clean-row' }),
      update: jest.fn().mockResolvedValue({}),
    },
    auditEvent: { create: jest.fn().mockResolvedValue({}) },
  };

  const prosperaSub = {
    provisionMember: jest.fn().mockResolvedValue({
      status: 'ACTIVE',
      externalMemberId: null,
      externalFoodSubscriptionId: newFoodId,
      externalCleaningSubscriptionId: null,
      externalBeachClubSubscriptionId: null,
      externalAccountId: null,
      warnings: [],
      message: '',
    }),
    cancelSubscription: jest.fn().mockResolvedValue({ ok: true, status: 200, message: 'Cancelled.' }),
  };

  const service = new AdminService(prisma as never, prosperaSub as never, {} as never, {} as never);
  return { service, prisma, prosperaSub };
}

describe('AdminService.designateUser — replacing a mirrored plan', () => {
  it('cancels the subscription the new plan replaces', async () => {
    const { service, prosperaSub } = makeService();

    await service.designateUser('user-1', MEAL_PLAN);

    expect(prosperaSub.cancelSubscription).toHaveBeenCalledWith('sub_food_OLD');
  });

  it('reads the old id before the local row is replaced', async () => {
    // The whole bug was ordering: deleteMany ran first and took the id with it.
    const { service, prisma } = makeService();

    await service.designateUser('user-1', MEAL_PLAN);

    const readAt = prisma.mealMenuItem.findFirst.mock.invocationCallOrder[0];
    const deletedAt = prisma.mealMenuItem.deleteMany.mock.invocationCallOrder[0];
    expect(readAt).toBeLessThan(deletedAt);
  });

  it('cancels only after the replacement exists', async () => {
    // Cancelling first would leave the member with nothing if provisioning failed.
    const { service, prosperaSub } = makeService();

    await service.designateUser('user-1', MEAL_PLAN);

    const provisionedAt = prosperaSub.provisionMember.mock.invocationCallOrder[0];
    const cancelledAt = prosperaSub.cancelSubscription.mock.invocationCallOrder[0];
    expect(provisionedAt).toBeLessThan(cancelledAt);
  });

  it('keeps the old subscription when provisioning produced no replacement', async () => {
    const { service, prosperaSub } = makeService({ newFoodId: null });

    await service.designateUser('user-1', MEAL_PLAN);

    expect(prosperaSub.cancelSubscription).not.toHaveBeenCalled();
  });

  it('does nothing when the member had no mirrored plan yet', async () => {
    const { service, prosperaSub } = makeService({ previousFoodId: null });

    await service.designateUser('user-1', MEAL_PLAN);

    expect(prosperaSub.cancelSubscription).not.toHaveBeenCalled();
  });

  it('leaves a reused subscription alone', async () => {
    // Same id back means ProsperaSub updated the subscription in place.
    const { service, prosperaSub } = makeService({ previousFoodId: 'sub_same', newFoodId: 'sub_same' });

    await service.designateUser('user-1', MEAL_PLAN);

    expect(prosperaSub.cancelSubscription).not.toHaveBeenCalled();
  });

  it('records the cancel so a failed one can be finished by hand', async () => {
    const { service, prisma, prosperaSub } = makeService();
    prosperaSub.cancelSubscription.mockResolvedValue({ ok: false, status: 502, message: 'provider down' });

    await service.designateUser('user-1', MEAL_PLAN);

    const audits = prisma.auditEvent.create.mock.calls.map((call) => call[0].data);
    const cancelAudit = audits.find((a: { action: string }) => a.action === 'prospera_sub_cancel');
    expect(cancelAudit).toBeDefined();
    expect(JSON.parse(cancelAudit.metadataJson)).toMatchObject({
      subscriptionId: 'sub_food_OLD',
      replacedBy: 'sub_food_NEW',
      ok: false,
    });
  });

  it('does not let a thrown cancel break the designation', async () => {
    const { service, prosperaSub } = makeService();
    prosperaSub.cancelSubscription.mockRejectedValue(new Error('network down'));

    await expect(service.designateUser('user-1', MEAL_PLAN)).resolves.toBeDefined();
  });
});
