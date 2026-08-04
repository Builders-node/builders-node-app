import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DirectoryService } from './directory.service';

type PrismaStub = {
  membership: { findUnique: jest.Mock };
  profile: { findMany: jest.Mock; findUnique: jest.Mock; upsert: jest.Mock };
};

function makeService(overrides: Partial<PrismaStub> = {}) {
  const prisma: PrismaStub = {
    membership: { findUnique: jest.fn().mockResolvedValue({ status: 'ACTIVE_MEMBER' }) },
    profile: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
    },
    ...overrides,
  };
  return { service: new DirectoryService(prisma as never), prisma };
}

const listedProfile = (over: Record<string, unknown> = {}) => ({
  userId: 'u-listed',
  fullName: 'Ada Lovelace',
  location: 'Próspera',
  avatarUrl: null,
  headline: 'Building an analytical engine',
  skillsJson: JSON.stringify(['Rust', 'Math']),
  user: { membership: { activatedAt: new Date('2026-01-01') } },
  ...over,
});

describe('DirectoryService — access control', () => {
  it('refuses non-active members', async () => {
    const { service } = makeService({
      membership: { findUnique: jest.fn().mockResolvedValue({ status: 'APPLICANT' }) },
    });
    await expect(service.list('applicant')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.detail('applicant', 'someone')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses members with no membership row at all', async () => {
    const { service } = makeService({
      membership: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    await expect(service.list('nobody')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('only queries profiles that opted in AND are still active', async () => {
    const { service, prisma } = makeService();
    await service.list('viewer');
    expect(prisma.profile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          directoryOptIn: true,
          user: { membership: { status: 'ACTIVE_MEMBER' } },
        },
      }),
    );
  });

  it('hides a profile that exists but has not opted in', async () => {
    const { service } = makeService({
      profile: {
        findMany: jest.fn(),
        upsert: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({
          ...listedProfile(),
          directoryOptIn: false,
          bio: null,
          linksJson: null,
          user: { email: 'a@b.test', discordUsername: null, membership: { status: 'ACTIVE_MEMBER' } },
        }),
      },
    });
    // Same 404 as "no such member" — browsing can't reveal who opted out.
    await expect(service.detail('viewer', 'u-listed')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('hides a listed profile once the member is no longer active', async () => {
    const { service } = makeService({
      profile: {
        findMany: jest.fn(),
        upsert: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({
          ...listedProfile(),
          directoryOptIn: true,
          bio: null,
          linksJson: null,
          user: { email: 'a@b.test', discordUsername: null, membership: { status: 'PAST_MEMBER' } },
        }),
      },
    });
    await expect(service.detail('viewer', 'u-listed')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('never returns email or phone in the listing', async () => {
    const { service } = makeService({
      profile: {
        findMany: jest.fn().mockResolvedValue([listedProfile()]),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    });
    const result = await service.list('viewer');
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/@/);
    expect(result.items[0]).not.toHaveProperty('phone');
  });
});

describe('DirectoryService — listing behaviour', () => {
  it('matches search across name, headline, location and skills', async () => {
    const { service } = makeService({
      profile: {
        findMany: jest.fn().mockResolvedValue([
          listedProfile(),
          listedProfile({
            userId: 'u2',
            fullName: 'Grace Hopper',
            headline: 'Compilers',
            location: 'Roatán',
            skillsJson: '["COBOL"]',
          }),
        ]),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    });
    expect((await service.list('v', { search: 'rust' })).items).toHaveLength(1);
    expect((await service.list('v', { search: 'compilers' })).items[0].fullName).toBe('Grace Hopper');
    expect((await service.list('v', { search: 'próspera' })).items).toHaveLength(1);
  });

  it('filters by exact skill and reports skill counts', async () => {
    const { service } = makeService({
      profile: {
        findMany: jest.fn().mockResolvedValue([
          listedProfile(),
          listedProfile({ userId: 'u2', fullName: 'Grace Hopper', skillsJson: '["Rust"]' }),
        ]),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    });
    const all = await service.list('v');
    expect(all.skills[0]).toEqual({ name: 'rust', count: 2 });
    expect((await service.list('v', { skill: 'math' })).items).toHaveLength(1);
  });

  it('survives malformed skills JSON instead of throwing', async () => {
    const { service } = makeService({
      profile: {
        findMany: jest.fn().mockResolvedValue([listedProfile({ skillsJson: 'not json' })]),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    });
    expect((await service.list('v')).items[0].skills).toEqual([]);
  });
});

describe('DirectoryService — updating your own profile', () => {
  it('trims, dedupes case-insensitively and caps skills at 12', async () => {
    const { service, prisma } = makeService();
    prisma.profile.findUnique.mockResolvedValue(null);
    await service.updateMine('me', {
      skills: ['  Rust ', 'rust', 'RUST', ...Array.from({ length: 20 }, (_, i) => `skill-${i}`)],
    });
    const written = JSON.parse(prisma.profile.upsert.mock.calls[0][0].update.skillsJson);
    expect(written[0]).toBe('Rust');
    expect(written.filter((s: string) => s.toLowerCase() === 'rust')).toHaveLength(1);
    expect(written).toHaveLength(12);
  });

  it('keeps only known link keys', async () => {
    const { service, prisma } = makeService();
    prisma.profile.findUnique.mockResolvedValue(null);
    await service.updateMine('me', {
      links: { website: 'https://x.dev', evil: 'javascript:alert(1)' } as never,
    });
    const written = JSON.parse(prisma.profile.upsert.mock.calls[0][0].update.linksJson);
    expect(written).toEqual({ website: 'https://x.dev' });
  });

  it('creates the profile row when the member never had one', async () => {
    const { service, prisma } = makeService();
    prisma.profile.findUnique.mockResolvedValue(null);
    await service.updateMine('me', { directoryOptIn: true });
    expect(prisma.profile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'me' }, create: { userId: 'me', directoryOptIn: true } }),
    );
  });

  it('lets the member read their own record while still hidden', async () => {
    const { service, prisma } = makeService();
    prisma.profile.findUnique.mockResolvedValue({
      fullName: 'Ada', location: null, avatarUrl: null, headline: null,
      bio: null, skillsJson: null, linksJson: null, directoryOptIn: false,
    });
    // No membership check here — you can always see your own draft.
    const mine = await service.getMine('me');
    expect(mine.directoryOptIn).toBe(false);
    expect(mine.fullName).toBe('Ada');
  });
});
