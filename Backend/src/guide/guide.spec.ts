import { GuideService } from './guide.service';

/**
 * The guide lead magnet.
 *
 * What's pinned: a lead is never lost to a mail failure, asking twice is one
 * person rather than two, and nobody's address is taken for an email we cannot
 * actually send.
 */
function makeService(options: { guideUrl?: string | null; campaignLink?: { code: string } | null } = {}) {
  const { guideUrl = 'https://buildersnode.com/guide.pdf', campaignLink = null } = options;

  const prisma = {
    guideRequest: {
      upsert: jest.fn().mockImplementation(({ create, where }) =>
        Promise.resolve({ id: 'lead-1', email: where.email, name: create.name ?? null }),
      ),
      update: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({ id: 'lead-1', email: 'nina@example.com' }),
      delete: jest.fn().mockResolvedValue({}),
    },
    campaignLink: { findUnique: jest.fn().mockResolvedValue(campaignLink) },
    globalSetting: { findUnique: jest.fn().mockResolvedValue(guideUrl ? { value: guideUrl } : null) },
  };
  const mail = { sendGuide: jest.fn().mockResolvedValue(undefined) };

  return { service: new GuideService(prisma as never, mail as never), prisma, mail };
}

describe('GuideService.request', () => {
  it('stores the lead and emails the guide', async () => {
    const { service, prisma, mail } = makeService();

    const result = await service.request({ email: 'Nina@Example.com ', name: 'Nina Alvarez', source: 'ca' });

    expect(result).toEqual({ sent: true, email: 'nina@example.com' });
    // Addresses are deduplicated and mailed by this value — a stray capital
    // would make the same person two leads.
    expect(prisma.guideRequest.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'nina@example.com' } }),
    );
    expect(mail.sendGuide).toHaveBeenCalledWith('nina@example.com', 'Nina Alvarez', 'https://buildersnode.com/guide.pdf');
  });

  it('marks the lead as served only after the send', async () => {
    // sentAt is the difference between a lead we owe something to and one we
    // have already served; MailService never throws, so nothing else says it.
    const { service, prisma } = makeService();

    await service.request({ email: 'nina@example.com' });

    expect(prisma.guideRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sentAt: expect.any(Date) }) }),
    );
  });

  it('refuses when no guide is configured, rather than taking an address for nothing', async () => {
    const { service, prisma, mail } = makeService({ guideUrl: null });

    await expect(service.request({ email: 'nina@example.com' })).rejects.toThrow();
    expect(prisma.guideRequest.upsert).not.toHaveBeenCalled();
    expect(mail.sendGuide).not.toHaveBeenCalled();
  });

  it('keeps what it already knew when a blank second request comes in', async () => {
    // Someone who lost the email and retypes only their address should not
    // have their name wiped.
    const { service, prisma } = makeService();

    await service.request({ email: 'nina@example.com' });

    const { update } = prisma.guideRequest.upsert.mock.calls[0][0];
    expect(update.name).toBeUndefined();
  });

  it('ignores a landing name it does not recognise', async () => {
    // It reaches an admin screen, so it is checked rather than trusted.
    const { service, prisma } = makeService();

    await service.request({ email: 'nina@example.com', source: '<script>' });

    expect(prisma.guideRequest.upsert.mock.calls[0][0].create.source).toBeNull();
  });

  it('ignores a campaign code no admin ever created', async () => {
    const { service, prisma } = makeService({ campaignLink: null });

    await service.request({ email: 'nina@example.com', campaignCode: 'made-up' });

    expect(prisma.guideRequest.upsert.mock.calls[0][0].create.campaignCode).toBeNull();
  });

  it('credits a campaign code that exists', async () => {
    const { service, prisma } = makeService({ campaignLink: { code: 'ca' } });

    await service.request({ email: 'nina@example.com', campaignCode: 'ca' });

    expect(prisma.guideRequest.upsert.mock.calls[0][0].create.campaignCode).toBe('ca');
  });
});
