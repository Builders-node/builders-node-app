import { NotificationsService } from './notifications.service';

/**
 * The admin delivery log, one page at a time.
 *
 * It reads straight off a query string, so the bounds matter as much as the
 * paging: `?limit=abc` used to reach Prisma as `take: NaN`.
 */
function makeService(total = 95) {
  const prisma = {
    notification: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(total),
    },
  };
  return { service: new NotificationsService(prisma as never), prisma };
}

/** The paging args Prisma was actually asked for. */
function pageArgs(prisma: { notification: { findMany: jest.Mock } }) {
  const { take, skip } = prisma.notification.findMany.mock.calls[0][0];
  return { take, skip };
}

describe('NotificationsService.listRecent', () => {
  it('returns the first page and the total, so a caller can say "of N"', async () => {
    const { service, prisma } = makeService(95);
    const result = await service.listRecent(10, 0);
    expect(pageArgs(prisma)).toEqual({ take: 10, skip: 0 });
    expect(result.total).toBe(95);
  });

  it('walks past the first page', async () => {
    const { service, prisma } = makeService();
    await service.listRecent(10, 30);
    expect(pageArgs(prisma)).toEqual({ take: 10, skip: 30 });
  });

  it('counts every row, not just the page', async () => {
    // Otherwise the last page — always short — would report itself as the only
    // page there is.
    const { service, prisma } = makeService(95);
    await service.listRecent(10, 90);
    expect(prisma.notification.count).toHaveBeenCalledWith();
  });

  it('falls back to defaults on values that are not numbers', async () => {
    const { service, prisma } = makeService();
    await service.listRecent(Number('abc'), Number('abc'));
    expect(pageArgs(prisma)).toEqual({ take: 30, skip: 0 });
  });

  it('refuses to fetch the whole table because a URL asked nicely', async () => {
    const { service, prisma } = makeService();
    await service.listRecent(100000, 0);
    expect(pageArgs(prisma).take).toBe(100);
  });

  it('clamps nonsense bounds instead of handing them to the database', async () => {
    const { service, prisma } = makeService();
    await service.listRecent(0, -50);
    expect(pageArgs(prisma)).toEqual({ take: 1, skip: 0 });
  });

  it('takes whole rows only', async () => {
    const { service, prisma } = makeService();
    await service.listRecent(10.7, 20.9);
    expect(pageArgs(prisma)).toEqual({ take: 10, skip: 20 });
  });

  it('still returns newest first', async () => {
    const { service, prisma } = makeService();
    await service.listRecent(10, 0);
    expect(prisma.notification.findMany.mock.calls[0][0].orderBy).toEqual({ createdAt: 'desc' });
  });
});
