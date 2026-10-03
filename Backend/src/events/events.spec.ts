import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventsService } from './events.service';

function makeService(over: Record<string, unknown> = {}, goingOthers = 0, lockedCapacity: number | null = null) {
  const prisma: Record<string, unknown> = {
    membership: { findUnique: jest.fn().mockResolvedValue({ status: 'ACTIVE_MEMBER' }) },
    event: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'e1', title: 'T', startsAt: new Date(), published: false }),
      update: jest.fn().mockResolvedValue({ id: 'e1', title: 'T', startsAt: new Date(), published: false }),
      delete: jest.fn().mockResolvedValue({}),
    },
    eventRsvp: { upsert: jest.fn().mockResolvedValue({}), count: jest.fn().mockResolvedValue(goingOthers) },
    // The row lock on the event: hands back the capacity as read under it.
    $queryRaw: jest.fn().mockResolvedValue([{ capacity: lockedCapacity }]),
    ...over,
  };
  // Interactive transaction: run the callback against the same mock.
  prisma.$transaction = jest.fn((cb: (tx: unknown) => unknown) => cb(prisma));
  const notifications = { broadcast: jest.fn().mockResolvedValue({ sent: 0 }) };
  return { service: new EventsService(prisma as never, notifications as never), prisma: prisma as any, notifications };
}

const HOUR = 3600_000;
const future = (h: number) => new Date(Date.now() + h * HOUR);
const past = (h: number) => new Date(Date.now() - h * HOUR);

describe('EventsService — access', () => {
  it('refuses non-active members', async () => {
    const { service } = makeService({
      membership: { findUnique: jest.fn().mockResolvedValue({ status: 'APPLICANT' }) },
    });
    await expect(service.listForMember('u')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.rsvp('u', 'e1', 'GOING')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('only lists published events to members', async () => {
    const { service, prisma } = makeService();
    await service.listForMember('u');
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { published: true } }),
    );
  });
});

describe('EventsService — upcoming vs past', () => {
  it('treats an in-progress event as upcoming, not past', async () => {
    const { service } = makeService({
      event: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'live', title: 'Running now', description: null, location: null,
            startsAt: past(1), endsAt: future(1), capacity: null, rsvps: [] },
        ]),
        findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(),
      },
    });
    const result = await service.listForMember('u');
    expect(result.upcoming.map((e) => e.id)).toEqual(['live']);
    expect(result.past).toHaveLength(0);
  });

  it('reports my own rsvp and the going count', async () => {
    const { service } = makeService({
      event: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'e1', title: 'Dinner', description: null, location: null,
            startsAt: future(24), endsAt: null, capacity: 10,
            rsvps: [
              { userId: 'me', status: 'MAYBE' },
              { userId: 'other', status: 'GOING' },
              { userId: 'third', status: 'DECLINED' },
            ] },
        ]),
        findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(),
      },
    });
    const [event] = (await service.listForMember('me')).upcoming;
    expect(event.myRsvp).toBe('MAYBE');
    expect(event.goingCount).toBe(1);
    expect(event.spotsLeft).toBe(9);
  });

  it('reports unlimited capacity as null spots left', async () => {
    const { service } = makeService({
      event: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'e1', title: 'Open', description: null, location: null,
            startsAt: future(2), endsAt: null, capacity: null, rsvps: [] },
        ]),
        findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(),
      },
    });
    expect((await service.listForMember('me')).upcoming[0].spotsLeft).toBeNull();
  });
});

describe('EventsService — rsvp', () => {
  const fullEvent = {
    id: 'e1', published: true, capacity: 2,
    rsvps: [{ userId: 'a', status: 'GOING' }, { userId: 'b', status: 'GOING' }],
  };

  it('rejects an unknown status', async () => {
    const { service } = makeService();
    await expect(service.rsvp('me', 'e1', 'PERHAPS')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses GOING when the event is full', async () => {
    const { service, prisma } = makeService({
      event: { findUnique: jest.fn().mockResolvedValue(fullEvent), findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    }, 2, 2);
    await expect(service.rsvp('me', 'e1', 'GOING')).rejects.toThrow('This event is full.');
    expect(prisma.eventRsvp.upsert).not.toHaveBeenCalled();
  });

  it('counts the seats only after locking the event row', async () => {
    // Two members racing for the last seat: the lock is what makes the second
    // one wait and then see a full house, so it must come before the count.
    const { service, prisma } = makeService({
      event: { findUnique: jest.fn().mockResolvedValue(fullEvent), findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    }, 1, 2);
    await service.rsvp('me', 'e1', 'GOING');
    expect(prisma.$transaction).toHaveBeenCalled();
    const lockOrder = prisma.$queryRaw.mock.invocationCallOrder[0];
    const countOrder = prisma.eventRsvp.count.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(countOrder);
    expect(String(prisma.$queryRaw.mock.calls[0][0].join(''))).toMatch(/FOR UPDATE/);
    expect(prisma.eventRsvp.upsert).toHaveBeenCalled();
  });

  it('still allows MAYBE / DECLINED on a full event', async () => {
    const { service, prisma } = makeService({
      event: { findUnique: jest.fn().mockResolvedValue(fullEvent), findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    });
    await service.rsvp('me', 'e1', 'MAYBE');
    expect(prisma.eventRsvp.upsert).toHaveBeenCalled();
  });

  it("lets someone already GOING keep their spot when re-confirming", async () => {
    // Their own row must not count against the capacity check.
    const { service, prisma } = makeService({
      event: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'e1', published: true, capacity: 2,
          rsvps: [{ userId: 'me', status: 'GOING' }, { userId: 'b', status: 'GOING' }],
        }),
        findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn(), delete: jest.fn(),
      },
    }, 1, 2);
    await service.rsvp('me', 'e1', 'GOING');
    expect(prisma.eventRsvp.count.mock.calls[0][0].where.userId).toEqual({ not: 'me' });
    expect(prisma.eventRsvp.upsert).toHaveBeenCalled();
  });

  it('hides unpublished events from rsvp', async () => {
    const { service } = makeService({
      event: { findUnique: jest.fn().mockResolvedValue({ id: 'e1', published: false, capacity: null, rsvps: [] }),
        findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    });
    await expect(service.rsvp('me', 'e1', 'GOING')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('EventsService — admin validation', () => {
  it('requires a title and start time on create', async () => {
    const { service } = makeService();
    await expect(service.adminCreate({ startsAt: future(1).toISOString() })).rejects.toThrow('Title is required.');
    await expect(service.adminCreate({ title: 'X' })).rejects.toThrow('Start time is required.');
  });

  it('rejects an end time at or before the start', async () => {
    const { service } = makeService();
    await expect(
      service.adminCreate({ title: 'X', startsAt: future(4).toISOString(), endsAt: future(2).toISOString() }),
    ).rejects.toThrow('End time must be after the start time.');
  });

  it('validates a new end time against the STORED start on update', async () => {
    const { service } = makeService({
      event: {
        findUnique: jest.fn().mockResolvedValue({ id: 'e1', startsAt: future(10), endsAt: null, published: true }),
        findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn(), delete: jest.fn(),
      },
    });
    await expect(service.adminUpdate('e1', { endsAt: future(5).toISOString() }))
      .rejects.toThrow('End time must be after the start time.');
  });

  it('treats capacity 0 or negative as invalid, empty as unlimited', async () => {
    const { service, prisma } = makeService();
    await expect(service.adminCreate({ title: 'X', startsAt: future(1).toISOString(), capacity: 0 }))
      .rejects.toThrow('Capacity must be at least 1');
    await service.adminCreate({ title: 'X', startsAt: future(1).toISOString(), capacity: null });
    expect(prisma.event.create.mock.calls[0][0].data.capacity).toBeNull();
  });
});

describe('EventsService — announcements', () => {
  it('announces when an event is created already published', async () => {
    const { service, notifications } = makeService({
      event: {
        create: jest.fn().mockResolvedValue({ id: 'e1', title: 'Party', startsAt: future(24), published: true }),
        findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn(),
      },
    });
    await service.adminCreate({ title: 'Party', startsAt: future(24).toISOString(), published: true });
    expect(notifications.broadcast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'New event: Party', link: '/community' }),
    );
  });

  it('stays quiet when a draft is created', async () => {
    const { service, notifications } = makeService();
    await service.adminCreate({ title: 'Draft', startsAt: future(24).toISOString() });
    expect(notifications.broadcast).not.toHaveBeenCalled();
  });

  it('announces on the draft → published transition only', async () => {
    const { service, notifications } = makeService({
      event: {
        findUnique: jest.fn().mockResolvedValue({ id: 'e1', startsAt: future(24), endsAt: null, published: false }),
        update: jest.fn().mockResolvedValue({ id: 'e1', title: 'Party', startsAt: future(24), published: true }),
        findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), delete: jest.fn(),
      },
    });
    await service.adminUpdate('e1', { published: true });
    expect(notifications.broadcast).toHaveBeenCalledTimes(1);
  });

  it('does not re-announce when editing an already published event', async () => {
    const { service, notifications } = makeService({
      event: {
        findUnique: jest.fn().mockResolvedValue({ id: 'e1', startsAt: future(24), endsAt: null, published: true }),
        update: jest.fn().mockResolvedValue({ id: 'e1', title: 'Party (moved)', startsAt: future(24), published: true }),
        findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), delete: jest.fn(),
      },
    });
    await service.adminUpdate('e1', { title: 'Party (moved)' });
    expect(notifications.broadcast).not.toHaveBeenCalled();
  });

  it('does not fail the publish when the announcement throws', async () => {
    const { service } = makeService({
      event: {
        create: jest.fn().mockResolvedValue({ id: 'e1', title: 'P', startsAt: future(1), published: true }),
        findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn(),
      },
    });
    // Swap in a broadcast that rejects.
    (service as unknown as { notifications: { broadcast: jest.Mock } }).notifications = {
      broadcast: jest.fn().mockRejectedValue(new Error('smtp down')),
    };
    await expect(service.adminCreate({ title: 'P', startsAt: future(1).toISOString(), published: true }))
      .resolves.toBeDefined();
  });
});
