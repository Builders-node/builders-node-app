import { AdminService } from './admin.service';

/**
 * The shape of the pipeline after the call was split into three stages —
 * Conversation (talking to them), Meeting (booked), Past meeting (held) — and
 * the Apartment stage was dropped.
 */
function makeService(application: Record<string, unknown> = {}) {
  const app = {
    id: 'app-1',
    email: 'ada@builders.test',
    fullName: 'Ada Lovelace',
    status: 'FIRST_APPROVED',
    apartmentAvailable: null,
    approvedAt: null,
    paymentStatus: 'NOT_SENT',
    ...application,
  };
  const prisma = {
    application: {
      findUnique: jest.fn().mockResolvedValue(app),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...app, ...data })),
    },
  };
  const mail = { sendPaymentLink: jest.fn().mockResolvedValue(true) };
  return { service: new AdminService(prisma as never, {} as never, mail as never, {} as never), prisma, mail, app };
}

describe('AdminService.markMeetingScheduled — Conversation → Meeting', () => {
  it('moves them to Meeting', async () => {
    const { service, prisma } = makeService();

    await service.markMeetingScheduled('app-1');

    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'MEETING_SCHEDULED' } }),
    );
  });

  it('sends nothing — booking is something they already did', async () => {
    const { service, mail } = makeService();

    await service.markMeetingScheduled('app-1');

    expect(mail.sendPaymentLink).not.toHaveBeenCalled();
  });

  it('refuses from any stage other than Conversation', async () => {
    for (const status of ['SUBMITTED', 'MEETING_SCHEDULED', 'MEETING_APPROVED', 'CREDENTIALS_SENT']) {
      const { service, prisma } = makeService({ status });
      await expect(service.markMeetingScheduled('app-1')).rejects.toThrow(/Conversation/i);
      expect(prisma.application.update).not.toHaveBeenCalled();
    }
  });
});

const LINK = { paymentLink: 'https://prosperasub.com/pay/abc', amountCents: 195000 };

describe('AdminService.sendPaymentLink — without the apartment stage', () => {
  it('goes out after the call, with no apartment confirmation', async () => {
    // This used to refuse until apartmentAvailable was set, which is now a step
    // that no longer exists on the board — the link would have been unreachable.
    const { service, prisma } = makeService({ status: 'MEETING_APPROVED', apartmentAvailable: null });

    await service.sendPaymentLink('app-1', LINK);

    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PAYMENT_LINK_SENT' }) }),
    );
  });

  it('still carries applications left on the old apartment statuses', async () => {
    for (const status of ['APARTMENT_AVAILABLE', 'NO_APARTMENT_AVAILABLE']) {
      const { service, mail } = makeService({ status });
      await service.sendPaymentLink('app-1', LINK);
      expect(mail.sendPaymentLink).toHaveBeenCalled();
    }
  });

  it('refuses before the call has been held', async () => {
    for (const status of ['SUBMITTED', 'FIRST_APPROVED', 'MEETING_SCHEDULED']) {
      const { service, mail } = makeService({ status });
      await expect(service.sendPaymentLink('app-1', LINK)).rejects.toThrow(/call/i);
      expect(mail.sendPaymentLink).not.toHaveBeenCalled();
    }
  });
});

describe('AdminService.sendPaymentLink — the link and the amount', () => {
  it('states the amount in the email and remembers both for a resend', async () => {
    const { service, prisma, mail } = makeService({ status: 'MEETING_APPROVED', paymentCurrency: 'USD' });
    await service.sendPaymentLink('app-1', LINK);
    expect(mail.sendPaymentLink).toHaveBeenCalledWith('ada@builders.test', 'Ada Lovelace', LINK.paymentLink, {
      cents: 195000,
      currency: 'USD',
    });
    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ paymentLink: LINK.paymentLink, paymentAmountCents: 195000 }) }),
    );
  });

  it('refuses without a link instead of sending a placeholder', async () => {
    const { service, mail } = makeService({ status: 'MEETING_APPROVED' });
    await expect(service.sendPaymentLink('app-1', { amountCents: 195000 })).rejects.toThrow(/Paste the payment link/);
    expect(mail.sendPaymentLink).not.toHaveBeenCalled();
  });

  it('refuses plain http and, for non-Super Admins, unknown hosts', async () => {
    const { service } = makeService({ status: 'MEETING_APPROVED' });
    await expect(
      service.sendPaymentLink('app-1', { paymentLink: 'http://prosperasub.com/pay', amountCents: 1 }, { role: 'MODERATOR' }),
    ).rejects.toThrow(/https/);
    await expect(
      service.sendPaymentLink('app-1', { paymentLink: 'https://evil.example/pay', amountCents: 1 }, { role: 'MODERATOR' }),
    ).rejects.toThrow(/must be on/);
  });

  it('lets a Super Admin send a link on any https host', async () => {
    const { service, mail } = makeService({ status: 'MEETING_APPROVED' });
    await service.sendPaymentLink('app-1', { paymentLink: 'https://pay.example.org/x', amountCents: 100 }, { role: 'SUPER_ADMIN' });
    expect(mail.sendPaymentLink).toHaveBeenCalled();
  });
});
