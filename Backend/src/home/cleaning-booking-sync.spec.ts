import { HomeService } from './home.service';

/**
 * Booking a cleaning slot has to reach ProsperaSub.
 *
 * It did not: picking a weekday and a time wrote a row in our own database and
 * stopped there, so the member saw "booked" and no cleaner was ever told. These
 * pin the part that crosses the boundary — that visits are created, that a
 * reschedule retracts the old ones, and that a failure is recorded instead of
 * being dressed up as a confirmed booking.
 */
const SLOTS = [
  // Mondays and Tuesdays at 10:00 across three weeks. 2026-08-17 is a Monday.
  { id: 'slot-mon-1', date: '2026-08-17', startTime: '10:00', maxBookings: 2, currentBookings: 0 },
  // The same Monday window published by a second provider — booking both would
  // send two cleaners to one apartment.
  { id: 'slot-mon-1-other-provider', date: '2026-08-17', startTime: '10:00', maxBookings: 2, currentBookings: 1 },
  { id: 'slot-tue-1', date: '2026-08-18', startTime: '10:00', maxBookings: 2, currentBookings: 0 },
  { id: 'slot-mon-2', date: '2026-08-24', startTime: '10:00', maxBookings: 2, currentBookings: 0 },
  { id: 'slot-mon-3', date: '2026-08-31', startTime: '10:00', maxBookings: 2, currentBookings: 2 },
];

function makeService(options: { externalMemberId?: string | null; previousBookings?: string[] } = {}) {
  const { externalMemberId = 'ps-user-1', previousBookings = [] } = options;

  const schedule = {
    id: 'sched-1',
    userId: 'user-1',
    weekday: 1, // Monday
    timeSlot: '10:00',
    memberNote: 'Apartment 207, keys with reception',
    externalSubscriptionId: 'sub-clean-1',
    externalBookingIdsJson: previousBookings.length ? JSON.stringify(previousBookings) : null,
  };

  const prisma = {
    cleaningSchedule: {
      findFirst: jest.fn().mockResolvedValue(schedule),
      findUnique: jest.fn().mockResolvedValue(schedule),
      create: jest.fn().mockResolvedValue(schedule),
      update: jest.fn().mockResolvedValue(schedule),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ externalMemberId }) },
    globalSetting: { findUnique: jest.fn().mockResolvedValue(null) },
  };

  const prosperaSub = {
    getCleaningTimeSlots: jest.fn().mockResolvedValue([{ startTime: '10:00', endTime: '11:45' }]),
    listDatedCleaningSlots: jest.fn().mockResolvedValue(SLOTS),
    createCleaningBooking: jest.fn().mockImplementation(({ slotId }) => Promise.resolve({ id: `booking-${slotId}` })),
    deleteCleaningBooking: jest.fn().mockResolvedValue(undefined),
  };

  const service = new HomeService(prisma as never, prosperaSub as never);
  return { service, prisma, prosperaSub };
}

const BOOKING = { weekday: 1, timeSlot: '10:00' };

describe('HomeService.setMyCleaning — reaching ProsperaSub', () => {
  it('books a visit on ProsperaSub for every matching date', async () => {
    const { service, prosperaSub } = makeService();

    await service.setMyCleaning('user-1', BOOKING);

    // Mondays only, and not the one that is already full.
    const booked = prosperaSub.createCleaningBooking.mock.calls.map((call) => call[0].slotId);
    expect(booked).toEqual(['slot-mon-1', 'slot-mon-2']);
  });

  it('sends the member note — that is what the cleaner needs to get in', async () => {
    const { service, prosperaSub } = makeService();

    await service.setMyCleaning('user-1', { ...BOOKING, memberNote: 'Apartment 207, keys with reception' });

    expect(prosperaSub.createCleaningBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        prosperaSubUserId: 'ps-user-1',
        cleaningSubscriptionId: 'sub-clean-1',
        notes: 'Apartment 207, keys with reception',
      }),
    );
  });

  it('books one cleaner per date, not one per provider', async () => {
    // The same window is published once per provider; each extra booking is a
    // second cleaner at the door and a second charge.
    const { service, prosperaSub } = makeService();

    await service.setMyCleaning('user-1', BOOKING);

    const dates = prosperaSub.createCleaningBooking.mock.calls.map((call) => call[0].slotId);
    expect(dates).not.toContain('slot-mon-1-other-provider');
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('skips a slot that is already full', async () => {
    const { service, prosperaSub } = makeService();

    await service.setMyCleaning('user-1', BOOKING);

    const booked = prosperaSub.createCleaningBooking.mock.calls.map((call) => call[0].slotId);
    expect(booked).not.toContain('slot-mon-3');
  });

  it('retracts the visits the previous slot booked', async () => {
    // Otherwise moving from Monday to Tuesday leaves a cleaner turning up on
    // both days.
    const { service, prosperaSub } = makeService({ previousBookings: ['old-1', 'old-2'] });

    await service.setMyCleaning('user-1', BOOKING);

    expect(prosperaSub.deleteCleaningBooking).toHaveBeenCalledWith('old-1');
    expect(prosperaSub.deleteCleaningBooking).toHaveBeenCalledWith('old-2');
  });

  it('records the ids it created, so the next reschedule can retract them', async () => {
    const { service, prisma } = makeService();

    await service.setMyCleaning('user-1', BOOKING);

    const write = prisma.cleaningSchedule.update.mock.calls
      .map((call) => call[0].data)
      .find((data: { externalBookingIdsJson?: string }) => data.externalBookingIdsJson !== undefined);
    expect(JSON.parse(write.externalBookingIdsJson)).toEqual(['booking-slot-mon-1', 'booking-slot-mon-2']);
  });

  it('records why nothing was booked when the member has no ProsperaSub account', async () => {
    const { service, prisma, prosperaSub } = makeService({ externalMemberId: null });

    await service.setMyCleaning('user-1', BOOKING);

    expect(prosperaSub.createCleaningBooking).not.toHaveBeenCalled();
    const write = prisma.cleaningSchedule.update.mock.calls
      .map((call) => call[0].data)
      .find((data: { bookingSyncError?: string }) => data.bookingSyncError);
    expect(write.bookingSyncError).toMatch(/ProsperaSub account/i);
  });

  it('keeps the member’s choice when the provider is down', async () => {
    // Their slot is theirs. A provider outage is our problem to retry, not a
    // reason to throw away what they picked.
    const { service, prisma, prosperaSub } = makeService();
    prosperaSub.listDatedCleaningSlots.mockRejectedValue(new Error('provider unreachable'));

    await expect(service.setMyCleaning('user-1', BOOKING)).resolves.toBeDefined();

    const write = prisma.cleaningSchedule.update.mock.calls
      .map((call) => call[0].data)
      .find((data: { bookingSyncError?: string }) => data.bookingSyncError);
    expect(write.bookingSyncError).toMatch(/provider unreachable/);
  });
});
