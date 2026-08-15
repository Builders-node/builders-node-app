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
  const mail = { sendPaymentLink: jest.fn().mockResolvedValue(undefined) };
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

describe('AdminService.sendPaymentLink — without the apartment stage', () => {
  it('goes out after the call, with no apartment confirmation', async () => {
    // This used to refuse until apartmentAvailable was set, which is now a step
    // that no longer exists on the board — the link would have been unreachable.
    const { service, prisma } = makeService({ status: 'MEETING_APPROVED', apartmentAvailable: null });

    await service.sendPaymentLink('app-1');

    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PAYMENT_LINK_SENT' }) }),
    );
  });

  it('still carries applications left on the old apartment statuses', async () => {
    for (const status of ['APARTMENT_AVAILABLE', 'NO_APARTMENT_AVAILABLE']) {
      const { service, mail } = makeService({ status });
      await service.sendPaymentLink('app-1');
      expect(mail.sendPaymentLink).toHaveBeenCalled();
    }
  });

  it('refuses before the call has been held', async () => {
    for (const status of ['SUBMITTED', 'FIRST_APPROVED', 'MEETING_SCHEDULED']) {
      const { service, mail } = makeService({ status });
      await expect(service.sendPaymentLink('app-1')).rejects.toThrow(/call/i);
      expect(mail.sendPaymentLink).not.toHaveBeenCalled();
    }
  });
});
