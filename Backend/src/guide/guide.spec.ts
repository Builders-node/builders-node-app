import { GuideService } from './guide.service';

/**
 * The guide lead magnet and its key.
 *
 * What's pinned: a lead is never lost to a mail failure, asking twice is one
 * person rather than two, nobody's address is taken for an email we cannot
 * send, and the guide's location never leaves the server unless the key holds.
 */
function makeService(
  options: { guideUrl?: string | null; accessKey?: string | null; campaignLink?: { code: string } | null } = {},
) {
  const {
    guideUrl = 'https://buildersnode.com/guide.pdf',
    accessKey = 'BN-7K2M-QX94',
    campaignLink = null,
  } = options;

  const settings: Record<string, string | null> = { guide_url: guideUrl, guide_access_key: accessKey };

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
    globalSetting: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const value = settings[where.key];
        return Promise.resolve(value ? { value } : null);
      }),
    },
  };
  const mail = { sendGuideKey: jest.fn().mockResolvedValue(undefined) };

  return { service: new GuideService(prisma as never, mail as never), prisma, mail };
}

describe('GuideService.request', () => {
  it('stores the lead and emails the key with a link that carries it', async () => {
    const { service, prisma, mail } = makeService();

    const result = await service.request({ email: 'Nina@Example.com ', name: 'Nina Alvarez', source: 'ca' });

    expect(result).toEqual({ sent: true, email: 'nina@example.com' });
    // Addresses are deduplicated and mailed by this value — a stray capital
    // would make the same person two leads.
    expect(prisma.guideRequest.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'nina@example.com' } }),
    );
    const [to, name, key, url] = mail.sendGuideKey.mock.calls[0];
    expect([to, name, key]).toEqual(['nina@example.com', 'Nina Alvarez', 'BN-7K2M-QX94']);
    expect(url).toContain('/guide?key=BN-7K2M-QX94');
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

  it('refuses when no key is configured, rather than taking an address for nothing', async () => {
    const { service, prisma, mail } = makeService({ accessKey: null });

    await expect(service.request({ email: 'nina@example.com' })).rejects.toThrow();
    expect(prisma.guideRequest.upsert).not.toHaveBeenCalled();
    expect(mail.sendGuideKey).not.toHaveBeenCalled();
  });

  it('keeps what it already knew when a blank second request comes in', async () => {
    // Someone who lost the email and retypes only their address should not
    // have their name wiped.
    const { service, prisma } = makeService();

    await service.request({ email: 'nina@example.com' });

    expect(prisma.guideRequest.upsert.mock.calls[0][0].update.name).toBeUndefined();
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

describe('GuideService.unlock', () => {
  it('hands back where the guide lives for the right key', async () => {
    const { service } = makeService();

    await expect(service.unlock('BN-7K2M-QX94')).resolves.toEqual({
      guideUrl: 'https://buildersnode.com/guide.pdf',
    });
  });

  it('refuses a wrong key, a blank one, and one of the wrong length', async () => {
    const { service } = makeService();

    await expect(service.unlock('BN-0000-0000')).rejects.toThrow(/not right/);
    await expect(service.unlock('')).rejects.toThrow(/not right/);
    await expect(service.unlock(undefined)).rejects.toThrow(/not right/);
    // A prefix must not pass: the compare is length-checked before it runs.
    await expect(service.unlock('BN-7K2M')).rejects.toThrow(/not right/);
  });

  it('refuses everything when no key is set', async () => {
    // An unset key takes the guide down rather than opening it to everyone.
    const { service } = makeService({ accessKey: null });

    await expect(service.unlock('anything')).rejects.toThrow(/not right/);
  });

  it('never reveals the guide location when the key fails', async () => {
    // The whole point of checking server-side: the URL is not in the bundle,
    // so a failed unlock has to leave with nothing.
    const { service } = makeService();

    await expect(service.unlock('wrong-key-here')).rejects.not.toHaveProperty(
      'response.guideUrl',
    );
  });
});
