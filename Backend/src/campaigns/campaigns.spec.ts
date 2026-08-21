import { CampaignsService, normalizeCode, slugify } from './campaigns.service';

/**
 * Tracked links for the channels we post on.
 *
 * The numbers are the product here, so what's pinned is how they're counted —
 * views against people, applications against the link that actually brought
 * them — plus the two rules that keep the report honest: a visit is only
 * counted for a live link, and only codes an admin created can be credited.
 */
function makeService(options: { link?: Record<string, unknown> | null } = {}) {
  const { link = { id: 'link-1', code: 'twitter-launch', active: true } } = options;

  const prisma = {
    campaignLink: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'link-1', code: 'twitter-launch', label: 'Launch thread', channel: 'Twitter', active: true, createdAt: new Date('2026-08-01') },
        { id: 'link-2', code: 'tg-post', label: 'Telegram post', channel: 'Telegram', active: true, createdAt: new Date('2026-08-02') },
      ]),
      findUnique: jest.fn().mockResolvedValue(link),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new-link', ...data })),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'link-1', ...data })),
      delete: jest.fn().mockResolvedValue({}),
    },
    campaignVisit: {
      groupBy: jest.fn().mockResolvedValue([
        { linkId: 'link-1', _count: { _all: 10 } },
        { linkId: 'link-2', _count: { _all: 3 } },
      ]),
      // Four distinct people on link-1, three on link-2.
      findMany: jest.fn().mockResolvedValue([
        { linkId: 'link-1', visitorKey: 'a' },
        { linkId: 'link-1', visitorKey: 'b' },
        { linkId: 'link-1', visitorKey: 'c' },
        { linkId: 'link-1', visitorKey: 'd' },
        { linkId: 'link-2', visitorKey: 'e' },
        { linkId: 'link-2', visitorKey: 'f' },
        { linkId: 'link-2', visitorKey: 'g' },
      ]),
      create: jest.fn().mockResolvedValue({}),
    },
    application: {
      groupBy: jest.fn().mockResolvedValue([{ campaignCode: 'twitter-launch', _count: { _all: 1 } }]),
    },
  };

  return { service: new CampaignsService(prisma as never), prisma };
}

describe('CampaignsService.list — the report', () => {
  it('separates views from people', async () => {
    // Ten arrivals from four people is the difference between a channel that
    // reaches four and one that reaches ten.
    const [twitter] = await makeService().service.list();

    expect(twitter.views).toBe(10);
    expect(twitter.people).toBe(4);
  });

  it('counts applications against the link that brought them', async () => {
    const [twitter, telegram] = await makeService().service.list();

    expect(twitter.applications).toBe(1);
    expect(telegram.applications).toBe(0);
  });

  it('rates conversion against people, not views', async () => {
    // One application from four people is 25%. Against ten views it would read
    // as 10% and punish the channel whose readers came back twice.
    const [twitter] = await makeService().service.list();

    expect(twitter.conversionRate).toBe(25);
  });

  it('reports zero rather than dividing by nobody', async () => {
    const { service, prisma } = makeService();
    prisma.campaignVisit.groupBy.mockResolvedValue([]);
    prisma.campaignVisit.findMany.mockResolvedValue([]);

    const [twitter] = await service.list();

    expect(twitter.views).toBe(0);
    expect(twitter.conversionRate).toBe(0);
  });
});

describe('CampaignsService.create', () => {
  it('derives the code from the name when none is given', async () => {
    const { service, prisma } = makeService({ link: null });

    await service.create({ label: "Ivan's launch thread!", channel: 'Twitter' });

    expect(prisma.campaignLink.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ code: 'ivans-launch-thread' }) }),
    );
  });

  it('refuses a code that is already taken', async () => {
    // Two links sharing a code would pool their numbers and neither would mean
    // anything.
    const { service } = makeService();

    await expect(service.create({ label: 'Another', channel: 'Twitter', code: 'twitter-launch' })).rejects.toThrow(
      /already in use/i,
    );
  });

  it('insists on a name and a channel', async () => {
    const { service } = makeService({ link: null });

    await expect(service.create({ channel: 'Twitter' })).rejects.toThrow(/name/i);
    await expect(service.create({ label: 'No channel' })).rejects.toThrow(/channel/i);
  });
});

describe('CampaignsService.update', () => {
  it('renames without touching the code', async () => {
    // The code is already printed in somebody's post.
    const { service, prisma } = makeService();

    await service.update('link-1', { label: 'Renamed', code: 'something-else' });

    const data = prisma.campaignLink.update.mock.calls[0][0].data;
    expect(data.label).toBe('Renamed');
    expect(data.code).toBeUndefined();
  });

  it('retires a link', async () => {
    const { service, prisma } = makeService();

    await service.update('link-1', { active: false });

    expect(prisma.campaignLink.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ active: false }) }),
    );
  });
});

describe('CampaignsService.recordVisit', () => {
  it('counts an arrival on a live link', async () => {
    const { service, prisma } = makeService();

    await expect(service.recordVisit('twitter-launch', 'visitor-1')).resolves.toEqual({ counted: true });
    expect(prisma.campaignVisit.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { linkId: 'link-1', visitorKey: 'visitor-1' } }),
    );
  });

  it('ignores a code nobody created', async () => {
    const { service, prisma } = makeService({ link: null });

    await expect(service.recordVisit('made-up', 'visitor-1')).resolves.toEqual({ counted: false });
    expect(prisma.campaignVisit.create).not.toHaveBeenCalled();
  });

  it('ignores a retired link', async () => {
    const { service, prisma } = makeService({ link: { id: 'link-1', code: 'old', active: false } });

    await expect(service.recordVisit('old', 'visitor-1')).resolves.toEqual({ counted: false });
    expect(prisma.campaignVisit.create).not.toHaveBeenCalled();
  });

  it('never throws at the visitor', async () => {
    // This runs on someone's first paint. A database hiccup must not turn the
    // landing page into an error.
    const { service, prisma } = makeService();
    prisma.campaignLink.findUnique.mockRejectedValue(new Error('database down'));

    await expect(service.recordVisit('twitter-launch', 'visitor-1')).resolves.toEqual({ counted: false });
  });

  it('needs both a code and a visitor key', async () => {
    const { service, prisma } = makeService();

    await expect(service.recordVisit(undefined, 'visitor-1')).resolves.toEqual({ counted: false });
    await expect(service.recordVisit('twitter-launch', '')).resolves.toEqual({ counted: false });
    expect(prisma.campaignVisit.create).not.toHaveBeenCalled();
  });
});

describe('code handling', () => {
  it('accepts codes as typed in a URL, whatever the case', () => {
    expect(normalizeCode('  Twitter-Launch  ')).toBe('twitter-launch');
  });

  it('rejects anything that would not survive a URL', () => {
    for (const bad of ['', '  ', 'has spaces', 'sym$bols', '-leading', 'x'.repeat(41)]) {
      expect(normalizeCode(bad)).toBeNull();
    }
  });

  it('slugifies accents rather than dropping the word', () => {
    expect(slugify('Próspera launch')).toBe('prospera-launch');
  });
});
