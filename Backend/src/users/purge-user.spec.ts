import { purgeUser } from './purge-user';

/**
 * Erasure. What's pinned: everything personal goes, including the rows that
 * only know the person by email, and the money records stay — detached.
 */
function makeTx(email: string | null = 'Ana@Example.com') {
  const model = () => ({
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  });
  const tx = {
    user: {
      findUnique: jest.fn().mockResolvedValue(email === null ? null : { email }),
      delete: jest.fn().mockResolvedValue({}),
    },
    auditEvent: model(),
    payment: model(),
    notification: model(),
    maintenanceRequest: model(),
    vehicleBooking: model(),
    eventRsvp: model(),
    mealMenuItem: model(),
    cleaningSchedule: model(),
    supportTicket: model(),
    communityPlanPurchase: model(),
    assignedApartment: model(),
    subscriptionPlan: model(),
    residencyApplication: model(),
    emailVerificationToken: model(),
    passwordResetToken: model(),
    membership: model(),
    profile: model(),
    application: model(),
    applicationVerification: model(),
    guideRequest: model(),
  };
  return tx;
}

describe('purgeUser', () => {
  it('keeps payments for the books, detached from the person', async () => {
    const tx = makeTx();
    await purgeUser(tx as never, 'u1');
    expect(tx.payment.updateMany).toHaveBeenCalledWith({ where: { userId: 'u1' }, data: { userId: null } });
    expect(tx.payment.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes the application, any pending verification and the guide lead, by email in any case', async () => {
    const tx = makeTx();
    await purgeUser(tx as never, 'u1');
    const byEmail = { where: { email: { equals: 'Ana@Example.com', mode: 'insensitive' } } };
    expect(tx.application.deleteMany).toHaveBeenCalledWith(byEmail);
    expect(tx.applicationVerification.deleteMany).toHaveBeenCalledWith(byEmail);
    expect(tx.guideRequest.deleteMany).toHaveBeenCalledWith(byEmail);
  });

  it('removes the user row last, after everything that pointed at it', async () => {
    const tx = makeTx();
    await purgeUser(tx as never, 'u1');
    const userDelete = tx.user.delete.mock.invocationCallOrder[0];
    for (const call of [tx.profile.deleteMany, tx.application.deleteMany, tx.payment.updateMany]) {
      expect(call.mock.invocationCallOrder[0]).toBeLessThan(userDelete);
    }
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });

  it('does not go hunting by email when there is no user to read one from', async () => {
    const tx = makeTx(null);
    await purgeUser(tx as never, 'u1').catch(() => undefined);
    expect(tx.application.deleteMany).not.toHaveBeenCalled();
  });
});
