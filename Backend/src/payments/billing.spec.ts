import { addOneMonth, anchorDayFor, BillingService, billingPeriodOf, forEachBounded, startOfUtcDay } from './billing.service';

/**
 * The daily billing pass.
 *
 * It writes to member records and sends real email, so what's pinned here is
 * mostly restraint: nobody gets told twice, a payment due today is not late,
 * and one broken row doesn't take the rest of the run with it.
 */
function makeService(rows: { overdue?: unknown[]; soon?: unknown[] } = {}) {
  const prisma = {
    // No memberships to bill: these cases are about the two later passes.
    membership: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    payment: {
      findMany: jest
        .fn()
        // markOverdue runs first, remindBeforeDue second.
        .mockResolvedValueOnce(rows.overdue ?? [])
        .mockResolvedValueOnce(rows.soon ?? []),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      // The DUE → OVERDUE flip; count 1 = this run won it.
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const mail = { sendPaymentOverdue: jest.fn().mockResolvedValue(undefined), sendInvoiceIssued: jest.fn().mockResolvedValue(undefined) };
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

    expect(prisma.payment.updateMany).toHaveBeenCalledWith({ where: { id: 'pay-1', status: 'DUE' }, data: { status: 'OVERDUE' } });
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
      // An erased member's invoice stays for the books but has nobody to tell.
      userId: { not: null },
    });
  });

  it('keeps going when one member fails', async () => {
    const { service, prisma, mail } = makeService({ overdue: [invoice(), invoice({ id: 'pay-2' })] });
    mail.sendPaymentOverdue.mockRejectedValueOnce(new Error('mail is down'));

    const result = await service.runDaily(NOW);

    expect(prisma.payment.updateMany).toHaveBeenCalledTimes(2);
    expect(result.markedOverdue).toBe(2);
    expect(result.failures).toHaveLength(1);
  });

  it('marks the status before notifying, so a mail failure cannot repeat tomorrow', async () => {
    const { service, prisma, mail } = makeService({ overdue: [invoice()] });
    mail.sendPaymentOverdue.mockRejectedValueOnce(new Error('mail is down'));
    await service.runDaily(NOW);
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({ where: { id: 'pay-1', status: 'DUE' }, data: { status: 'OVERDUE' } });
  });
});

describe('BillingService.runDaily — overlapping runs', () => {
  it('sends nothing when another run already flipped the invoice', async () => {
    // Both runs read the row as DUE; only the one whose conditional update
    // matched gets to tell the member.
    const { service, prisma, notifications, mail } = makeService({ overdue: [invoice()] });
    prisma.payment.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await service.runDaily(NOW);

    expect(notifications.notify).not.toHaveBeenCalled();
    expect(mail.sendPaymentOverdue).not.toHaveBeenCalled();
    expect(result.markedOverdue).toBe(0);
  });
});

describe('BillingService.runDaily — time budget', () => {
  it('starts nothing once the deadline has passed and reports what is left', async () => {
    const { service, prisma, mail } = makeService({ overdue: [invoice(), invoice({ id: 'pay-2' })] });
    // A deadline already behind us: every pass finds its rows but starts none.
    const result = await service.runDaily(NOW, Date.now() - 1);

    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    expect(mail.sendPaymentOverdue).not.toHaveBeenCalled();
    expect(result.deferred).toBe(2);
  });
});

describe('forEachBounded', () => {
  it('never runs more than the limit at once, and runs everything in time', async () => {
    let inFlight = 0;
    let peak = 0;
    const seen: number[] = [];
    const left = await forEachBounded([1, 2, 3, 4, 5, 6, 7], Date.now() + 10_000, async (n) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      seen.push(n);
      inFlight -= 1;
    }, 3);
    expect(peak).toBe(3);
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(left).toBe(0);
  });

  it('keeps going past an item that throws', async () => {
    const seen: number[] = [];
    await forEachBounded([1, 2, 3], Date.now() + 10_000, async (n) => {
      if (n === 1) throw new Error('boom');
      seen.push(n);
    });
    expect(seen.sort()).toEqual([2, 3]);
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
      userId: { not: null },
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

/**
 * Monthly invoice generation.
 *
 * The property that matters is that nobody is billed twice for the same month.
 * A duplicate invoice is money a member is asked for and didn't owe, and it
 * survives every retry the job might make.
 */
function makeMonthlyService(memberships: unknown[] = [], createBehaviour?: () => never) {
  const prisma = {
    membership: {
      findMany: jest.fn().mockResolvedValue(memberships),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    payment: {
      // issueMonthly runs first; the two later passes find nothing.
      findMany: jest.fn().mockResolvedValue([]),
      create: createBehaviour ? jest.fn().mockImplementation(createBehaviour) : jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const mail = { sendInvoiceIssued: jest.fn().mockResolvedValue(undefined), sendPaymentOverdue: jest.fn().mockResolvedValue(undefined) };
  return {
    service: new BillingService(prisma as never, notifications as never, mail as never),
    prisma,
    notifications,
    mail,
  };
}

function membership(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mem-1',
    userId: 'user-1',
    monthlyAmountCents: 195000,
    currency: 'USD',
    dueDate: new Date('2026-09-01T00:00:00.000Z'),
    billingDay: null,
    finishDate: null,
    user: { id: 'user-1', email: 'ada@builders.test', profile: { fullName: 'Ada Lovelace' } },
    ...overrides,
  };
}

describe('BillingService.runDaily — monthly invoices', () => {
  it('raises the invoice and rolls the due date forward a month', async () => {
    const { service, prisma, mail } = makeMonthlyService([membership()]);
    const result = await service.runDaily(NOW);

    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amountCents: 195000, billingPeriod: '2026-09', status: 'DUE' }),
      }),
    );
    // Conditional on the date just billed, so an overlapping run can't move
    // it on a second time; the anchor day is recorded on the way.
    expect(prisma.membership.updateMany).toHaveBeenCalledWith({
      where: { id: 'mem-1', dueDate: new Date('2026-09-01T00:00:00.000Z') },
      data: { dueDate: new Date('2026-10-01T00:00:00.000Z'), billingDay: 1 },
    });
    expect(mail.sendInvoiceIssued).toHaveBeenCalledTimes(1);
    expect(result.invoicesIssued).toBe(1);
  });

  it('only bills active memberships that have an amount, a week ahead', async () => {
    const { service, prisma } = makeMonthlyService();
    await service.runDaily(NOW);
    expect(prisma.membership.findMany.mock.calls[0][0].where).toEqual({
      status: 'ACTIVE_MEMBER',
      monthlyAmountCents: { not: null },
      dueDate: { not: null, lte: new Date('2026-08-17T00:00:00.000Z') },
    });
  });

  it('does not bill the same month twice, and still moves the date on', async () => {
    // Second run of the day: the unique constraint rejects the insert. That is
    // the expected outcome, not a failure — but the due date must advance or
    // the job would retry this month forever.
    const duplicate = () => { throw Object.assign(new Error('unique'), { code: 'P2002' }); };
    const { service, prisma, mail, notifications } = makeMonthlyService([membership()], duplicate);

    const result = await service.runDaily(NOW);

    expect(result.invoicesIssued).toBe(0);
    expect(result.failures).toHaveLength(0);
    expect(mail.sendInvoiceIssued).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(prisma.membership.updateMany).toHaveBeenCalled();
  });

  it('leaves the due date alone when the insert fails for a real reason', async () => {
    // Otherwise a database blip would skip somebody's rent for a whole month.
    const broken = () => { throw new Error('database is down'); };
    const { service, prisma } = makeMonthlyService([membership()], broken);
    const run = await service.runDaily(NOW);

    expect(run.invoicesIssued).toBe(0);
    expect(run.failures).toHaveLength(1);
    expect(prisma.membership.updateMany).not.toHaveBeenCalled();
  });

  it('rolls a clamped date back out to the anchor day', async () => {
    // Billed on Feb 28 for a member anchored on the 31st: March is the 31st,
    // not the 28th the date alone would suggest.
    const { service, prisma } = makeMonthlyService([
      membership({ dueDate: new Date('2027-02-28T00:00:00.000Z'), billingDay: 31 }),
    ]);
    await service.runDaily(new Date('2027-02-25T09:00:00.000Z'));
    expect(prisma.membership.updateMany.mock.calls[0][0].data).toEqual({
      dueDate: new Date('2027-03-31T00:00:00.000Z'),
      billingDay: 31,
    });
  });

  it('stops billing once the stay has finished', async () => {
    const { service, prisma } = makeMonthlyService([
      membership({ finishDate: new Date('2026-08-31T00:00:00.000Z') }),
    ]);
    const result = await service.runDaily(NOW);
    expect(result.invoicesIssued).toBe(0);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });
});

describe('addOneMonth', () => {
  it('keeps the same day of the month', () => {
    expect(addOneMonth(new Date('2026-09-15T00:00:00.000Z')).toISOString()).toBe('2026-10-15T00:00:00.000Z');
  });

  it('clamps a 31st to the last day of a shorter month', () => {
    // Otherwise it rolls into the 1st and every later invoice lands on a
    // different day than the member agreed to.
    expect(addOneMonth(new Date('2026-01-31T00:00:00.000Z')).toISOString()).toBe('2026-02-28T00:00:00.000Z');
  });

  it('crosses the year end', () => {
    expect(addOneMonth(new Date('2026-12-01T00:00:00.000Z')).toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('returns to the anchor day after a short month instead of drifting', () => {
    // The bug: Jan 31 → Feb 28 → Mar 28 → the 28th forever.
    const jan = new Date('2026-01-31T00:00:00.000Z');
    const feb = addOneMonth(jan, anchorDayFor(jan, null));
    const mar = addOneMonth(feb, anchorDayFor(feb, 31));
    const apr = addOneMonth(mar, anchorDayFor(mar, 31));
    expect(feb.toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(mar.toISOString()).toBe('2026-03-31T00:00:00.000Z');
    expect(apr.toISOString()).toBe('2026-04-30T00:00:00.000Z');
  });

  it('lands on Feb 29 in a leap year', () => {
    expect(addOneMonth(new Date('2028-01-30T00:00:00.000Z'), 30).toISOString()).toBe('2028-02-29T00:00:00.000Z');
  });
});

describe('anchorDayFor', () => {
  it('starts from the due date when nothing is stored', () => {
    expect(anchorDayFor(new Date('2026-05-17T00:00:00.000Z'), null)).toBe(17);
  });

  it('keeps the stored day while the date is that day clamped', () => {
    expect(anchorDayFor(new Date('2026-02-28T00:00:00.000Z'), 31)).toBe(31);
    expect(anchorDayFor(new Date('2026-04-30T00:00:00.000Z'), 31)).toBe(31);
  });

  it('follows an admin who moved the due date to another day', () => {
    expect(anchorDayFor(new Date('2026-03-15T00:00:00.000Z'), 31)).toBe(15);
  });
});

describe('billingPeriodOf', () => {
  it('is the year and month of the due date, zero-padded', () => {
    expect(billingPeriodOf(new Date('2026-09-01T00:00:00.000Z'))).toBe('2026-09');
  });
});
