import { BadRequestException } from '@nestjs/common';
import { MAX_BOOKING_HOURS, VehiclesService } from './vehicles.service';

/**
 * The daily quota. A per-booking cap alone let a member chain 16:00-19:00 and
 * 19:00-22:00 into six hours, which is the case these tests pin down.
 */
function makeService(existingSameDay: Array<{ startDate: Date; endDate: Date }> = []) {
  const prisma = {
    vehicle: { findUnique: jest.fn().mockResolvedValue({ id: 'v1', active: true, name: 'Jeep' }) },
    vehicleBooking: {
      // No clash on the car itself — these tests are about the member's quota.
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue(existingSameDay),
      create: jest.fn().mockResolvedValue({ id: 'b1' }),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ email: 'a@b.test', profile: null }) },
  };
  const notifications = { notifyAdmins: jest.fn().mockResolvedValue(undefined) };
  return { service: new VehiclesService(prisma as never, notifications as never), prisma };
}

/**
 * Próspera is UTC-6, so its day boundary sits at 06:00 UTC. Times here are
 * built in UTC deliberately: the rule is about the residence's day, not the
 * day of whoever happens to be making the request.
 */
function onDay(dayUtc: string, hourUtc: number): string {
  return new Date(`${dayUtc}T${String(hourUtc).padStart(2, '0')}:00:00.000Z`).toISOString();
}

// Far enough ahead that the "start cannot be in the past" guard never fires.
const DAY = new Date(Date.now() + 30 * 24 * 3600_000).toISOString().slice(0, 10);
const NEXT_DAY = new Date(Date.now() + 31 * 24 * 3600_000).toISOString().slice(0, 10);

function book(service: VehiclesService, startHourUtc: number, hours: number, day = DAY) {
  return service.book('u1', {
    vehicleId: 'v1',
    startDate: onDay(day, startHourUtc),
    endDate: onDay(day, startHourUtc + hours),
  });
}

describe('VehiclesService — daily booking quota', () => {
  it('allows a booking up to the cap when nothing else is held that day', async () => {
    const { service, prisma } = makeService([]);
    await expect(book(service, 14, MAX_BOOKING_HOURS)).resolves.toBeDefined();
    expect(prisma.vehicleBooking.create).toHaveBeenCalled();
  });

  it('refuses a second booking once the day is already spent', async () => {
    const { service, prisma } = makeService([
      { startDate: new Date(onDay(DAY, 14)), endDate: new Date(onDay(DAY, 17)) },
    ]);
    await expect(book(service, 17, 3)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.vehicleBooking.create).not.toHaveBeenCalled();
  });

  it('says how much of the day is left rather than only refusing', async () => {
    const { service } = makeService([
      { startDate: new Date(onDay(DAY, 14)), endDate: new Date(onDay(DAY, 16)) },
    ]);
    await expect(book(service, 17, 2)).rejects.toThrow(/1h left/);
  });

  it('still allows the remainder that does fit', async () => {
    const { service, prisma } = makeService([
      { startDate: new Date(onDay(DAY, 14)), endDate: new Date(onDay(DAY, 16)) },
    ]);
    await expect(book(service, 17, 1)).resolves.toBeDefined();
    expect(prisma.vehicleBooking.create).toHaveBeenCalled();
  });

  it('is a per-day budget, so the next day starts fresh', async () => {
    // findMany is scoped to the requested day by the query, so an empty result
    // is what a fresh day looks like from the service's point of view.
    const { service, prisma } = makeService([]);
    await expect(book(service, 14, MAX_BOOKING_HOURS, NEXT_DAY)).resolves.toBeDefined();
    const where = prisma.vehicleBooking.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe('u1');
    expect(where.status).toBe('ACTIVE');
  });

  it('counts hours across every car, not per car', async () => {
    const { service, prisma } = makeService([
      { startDate: new Date(onDay(DAY, 14)), endDate: new Date(onDay(DAY, 17)) },
    ]);
    await expect(book(service, 18, 1)).rejects.toBeInstanceOf(BadRequestException);
    // The quota query must not be narrowed to one vehicle.
    expect(prisma.vehicleBooking.findMany.mock.calls[0][0].where.vehicleId).toBeUndefined();
  });

  it('still rejects a single booking longer than the cap', async () => {
    const { service } = makeService([]);
    await expect(book(service, 14, 4)).rejects.toThrow(/at most 3 hours/);
  });
});
