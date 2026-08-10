import { BillingService, startOfUtcDay } from './billing.service';

/**
 * The daily billing pass.
 *
 * It writes to member records and sends real email, so what's pinned here is
 * mostly restraint: nobody gets told twice, a payment due today is not late,
 * and one broken row doesn't take the rest of the run with it.
 */
function makeService(rows: { overdue?: unknown[]; soon?: unknown[] } = {}) {
  const prisma = {
    payment: {
      findMany: jest
        .fn()
        // markOverdue runs first, remindBeforeDue second.
        .mockResolvedValueOnce(rows.overdue ?? [])
        .mockResolvedValueOnce(rows.soon ?? []),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const mail = { sendPaymentOverdue: jest.fn().mockResolvedValue(undefined) };
  return {
    service: new BillingService(prisma as never, notifications as never, mail as never),
    prisma,
    notifications,
    mail,
  };
}

function invoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pay-1',
    userId: 'user-1',
    description: 'Rent — August',
    amountCents: 195000,
    currency: 'USD',
    dueDate: new Date('2026-08-01T00:00:00.000Z'),
    payUrl: null,
    user: { id: 'user-1', email: 'ada@builders.test', profile: { fullName: 'Ada Lovelace' } },
    ...overrides,
  };
}

const NOW = new Date('2026-08-10T09:30:00.000Z');

describe('BillingService.runDaily — overdue', () => {
  it('moves a past-due invoice to OVERDUE and tells the member once', async () => {
    const { service, prisma, notifications, mail } = makeService({ overdue: [invoice()] });
    const result = await service.runDaily(NOW);

    expect(prisma.payment.update).toHaveBeenCalledWith({ where: { id: 'pay-1' }, data: { status: 'OVERDUE' } });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(mail.sendPaymentOverdue).toHaveBeenCalledTimes(1);
    expect(result.markedOverdue).toBe(1);
  });

  it('only looks at invoices still marked DUE, before the start of today', async () => {
    // An invoice due today is not late, and comparing against the current
    // moment instead of midnight would flag it from 00:00.
    const { service, prisma } = makeService();
    await service.runDaily(NOW);
    expect(prisma.payment.findMany.mock.calls[0][0].where).toEqual({
      status: 'DUE',
      dueDate: { lt: new Date('2026-08-10T00:00:00.000Z') },
    });
  });

  it('keeps going when one member fails', async () => {
    const { service, prisma, mail } = makeService({ overdue: [invoice(), invoice({ id: 'pay-2' })] });
    mail.sendPaymentOverdue.mockRejectedValueOnce(new Error('mail is down'));

    const result = await service.runDaily(NOW);

    expect(prisma.payment.update).toHaveBeenCalledTimes(2);
    expect(result.markedOverdue).toBe(2);
    expect(result.failures).toHaveLength(1);
  });

  it('marks the status before notifying, so a mail failure cannot repeat tomorrow', async () => {
    const { service, prisma, mail } = makeService({ overdue: [invoice()] });
    mail.sendPaymentOverdue.mockRejectedValueOnce(new Error('mail is down'));
    await service.runDaily(NOW);
    expect(prisma.payment.update).toHaveBeenCalledWith({ where: { id: 'pay-1' }, data: { status: 'OVERDUE' } });
  });
});

describe('BillingService.runDaily — the nudge before the due date', () => {
  it('asks only for unreminded invoices inside the window', async () => {
    const { service, prisma } = makeService();
    await service.runDaily(NOW);
    expect(prisma.payment.findMany.mock.calls[1][0].where).toEqual({
      status: 'DUE',
      reminderSentAt: null,
      dueDate: { gte: new Date('2026-08-10T00:00:00.000Z'), lte: new Date('2026-08-13T00:00:00.000Z') },
    });
  });

  it('notifies in-app and stamps the invoice so it does not repeat', async () => {
    const soon = [{ id: 'pay-9', userId: 'user-9', description: 'Rent — September', dueDate: new Date('2026-08-12T00:00:00.000Z') }];
    const { service, prisma, notifications, mail } = makeService({ soon });

    const result = await service.runDaily(NOW);

    expect(notifications.notify).toHaveBeenCalledWith('user-9', expect.objectContaining({ link: '/account' }));
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay-9' },
      data: { reminderSentAt: expect.any(Date) },
    });
    // Deliberately no email — a payment that isn't due yet isn't news.
    expect(mail.sendPaymentOverdue).not.toHaveBeenCalled();
    expect(result.remindersSent).toBe(1);
  });

  it('leaves the invoice unstamped when the notice fails, so it retries tomorrow', async () => {
    const soon = [{ id: 'pay-9', userId: 'user-9', description: 'Rent', dueDate: new Date('2026-08-12T00:00:00.000Z') }];
    const { service, prisma, notifications } = makeService({ soon });
    notifications.notify.mockRejectedValueOnce(new Error('down'));

    const result = await service.runDaily(NOW);

    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(result.remindersSent).toBe(0);
    expect(result.failures).toHaveLength(1);
  });
});

describe('startOfUtcDay', () => {
  it('is midnight UTC, whatever the time of day', () => {
    expect(startOfUtcDay(new Date('2026-08-10T23:59:59.000Z')).toISOString()).toBe('2026-08-10T00:00:00.000Z');
  });
});
