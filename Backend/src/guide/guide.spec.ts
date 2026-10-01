import { GuideService } from './guide.service';

/**
 * The guide lead magnet, with a key per reader.
 *
 * What's pinned: a returning reader keeps the key already in their inbox, a
 * key belongs to exactly one person, a lead is never lost to a mail failure,
 * and the guide's location never leaves the server without a key that resolves.
 */
function makeService(options: { lead?: Record<string, unknown> | null; campaignLink?: { code: string } | null } = {}) {
  const { lead = null, campaignLink = null } = options;

  const prisma = {
    guideRequest: {
      upsert: jest.fn().mockImplementation(({ create, where }) =>
        Promise.resolve({ id: 'lead-1', email: where.email, name: create.name ?? null, accessKey: create.accessKey }),
      ),
      update: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(lead),
      delete: jest.fn().mockResolvedValue({}),
    },
    campaignLink: { findUnique: jest.fn().mockResolvedValue(campaignLink) },
  };
  // Resolves true: the service only records a send that actually happened.
  const mail = { sendGuideKey: jest.fn().mockResolvedValue(true) };

  return { service: new GuideService(prisma as never, mail as never), prisma, mail };
}

describe('GuideService.request', () => {
  it('mints a key of its own for a new reader and emails it with a one-tap link', async () => {
    const { service, prisma, mail } = makeService();

    const result = await service.request({ email: 'Nina@Example.com ', name: 'Nina Alvarez', source: 'ca' });

    expect(result).toEqual({ sent: true, email: 'nina@example.com' });
    const minted = prisma.guideRequest.upsert.mock.calls[0][0].create.accessKey;
    expect(minted).toMatch(/^BN-[BCDFGHJKLMNPQRSTVWXZ2-9]{4}-[BCDFGHJKLMNPQRSTVWXZ2-9]{4}$/);

    const [to, name, key, url] = mail.sendGuideKey.mock.calls[0];
    expect([to, name, key]).toEqual(['nina@example.com', 'Nina Alvarez', minted]);
    expect(url).toContain(`/guide?key=${minted}`);
  });

  it('gives two readers different keys', async () => {
    // The whole point of the column: a key says who is reading.
    const { service, prisma } = makeService();

    await service.request({ email: 'nina@example.com' });
    await service.request({ email: 'sam@example.com' });

    const [first, second] = prisma.guideRequest.upsert.mock.calls.map((call) => call[0].create.accessKey);
    expect(first).not.toBe(second);
  });

  it('never rotates the key of a reader who asks twice', async () => {
    // Their first key is already in their inbox; a new one would stop it
    // working the moment they went back to the old email.
    const { service, prisma } = makeService();

    await service.request({ email: 'nina@example.com' });

    expect(prisma.guideRequest.upsert.mock.calls[0][0].update.accessKey).toBeUndefined();
  });

  it('marks the lead as served once the send goes through', async () => {
    // sentAt is the difference between a lead we owe something to and one we
    // have already served; MailService never throws, so nothing else says it.
    const { service, prisma } = makeService();

    await service.request({ email: 'nina@example.com' });

    expect(prisma.guideRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sentAt: expect.any(Date) }) }),
    );
  });

  it('keeps what it already knew when a blank second request comes in', async () => {
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
});

describe('GuideService.unlock', () => {
  const lead = { id: 'lead-1', email: 'nina@example.com', accessKey: 'BN-7K2M-QX94', openedAt: null };

  it('opens the guide for a key that belongs to somebody', async () => {
    const { service } = makeService({ lead });

    const result = await service.unlock('BN-7K2M-QX94');

    expect(result.guideUrl).toContain('/g/winter-2026-k7m2qx/');
  });

  it('accepts a key typed in lower case', async () => {
    // People retype these off a phone screen.
    const { service, prisma } = makeService({ lead });

    await service.unlock('bn-7k2m-qx94');

    expect(prisma.guideRequest.findUnique).toHaveBeenCalledWith({ where: { accessKey: 'BN-7K2M-QX94' } });
  });

  it('records the first open, and only the first', async () => {
    // "Who read it" is the question; overwriting on every visit would turn it
    // into "who read it most recently".
    const { service, prisma } = makeService({ lead: { ...lead, openedAt: new Date('2026-09-01') } });

    await service.unlock('BN-7K2M-QX94');

    expect(prisma.guideRequest.update).not.toHaveBeenCalled();
  });

  it('refuses a key nobody holds, and a blank one', async () => {
    const { service } = makeService({ lead: null });

    await expect(service.unlock('BN-0000-0000')).rejects.toThrow(/not right/);
    await expect(service.unlock('')).rejects.toThrow(/not right/);
    await expect(service.unlock(undefined)).rejects.toThrow(/not right/);
  });

  it('never reveals the guide location when the key fails', async () => {
    // The whole point of checking server-side: the address is not in the
    // bundle, so a failed unlock has to leave with nothing.
    const { service } = makeService({ lead: null });

    await expect(service.unlock('nope')).rejects.not.toHaveProperty('response.guideUrl');
  });
});
