import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isBookingOverlapViolation, VehiclesService } from './vehicles.service';

/**
 * The race the exclusion constraint closes: two requests both pass the
 * service's overlap check, and the second insert is refused by Postgres. That
 * refusal has to read like the check's own answer, not a 500.
 */
function makeService(createError: unknown) {
  const prisma = {
    vehicle: { findUnique: jest.fn().mockResolvedValue({ id: 'v1', active: true, name: 'Jeep' }) },
    vehicleBooking: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockRejectedValue(createError),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ email: 'a@b.test', profile: null }) },
  };
  const notifications = { notifyAdmins: jest.fn().mockResolvedValue(undefined) };
  return { service: new VehiclesService(prisma as never, notifications as never), notifications };
}

const START = new Date(Date.now() + 30 * 24 * 3600_000);
START.setUTCHours(14, 0, 0, 0);
const END = new Date(START.getTime() + 2 * 3600_000);

const book = (service: VehiclesService) =>
  service.book('u1', { vehicleId: 'v1', startDate: START.toISOString(), endDate: END.toISOString() });

const exclusionAsUnknown = new Prisma.PrismaClientUnknownRequestError(
  'Error occurred during query execution: ConnectorError(... code: "23P01", message: "conflicting key value violates exclusion constraint \\"VehicleBooking_no_overlap\\"" ...)',
  { clientVersion: 'test' },
);

describe('VehiclesService — overlap lost to a concurrent booking', () => {
  it('turns the exclusion violation into the same 400 the overlap check gives', async () => {
    const { service, notifications } = makeService(exclusionAsUnknown);
    await expect(book(service)).rejects.toThrow(BadRequestException);
    await expect(book(service)).rejects.toThrow(/overlap another booking/);
    // Nobody is told about a booking that doesn't exist.
    expect(notifications.notifyAdmins).not.toHaveBeenCalled();
  });

  it('lets any other database failure through untouched', async () => {
    const boom = new Error('connection reset');
    const { service } = makeService(boom);
    await expect(book(service)).rejects.toBe(boom);
  });
});

describe('isBookingOverlapViolation', () => {
  it('recognises the SQLSTATE in a known-request error', () => {
    const known = new Prisma.PrismaClientKnownRequestError('Raw query failed', {
      code: 'P2010',
      clientVersion: 'test',
      meta: { code: '23P01' },
    });
    expect(isBookingOverlapViolation(known)).toBe(true);
  });

  it('recognises the constraint quoted in an unknown-request error', () => {
    expect(isBookingOverlapViolation(exclusionAsUnknown)).toBe(true);
  });

  it('ignores unrelated errors', () => {
    const unique = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['email'] },
    });
    expect(isBookingOverlapViolation(unique)).toBe(false);
    expect(isBookingOverlapViolation(new Error('nope'))).toBe(false);
    expect(isBookingOverlapViolation(null)).toBe(false);
  });
});
