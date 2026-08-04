import { BadRequestException, ForbiddenException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const MAX_PHOTO_BASE64_LENGTH = 3_500_000; // ~2.5 MB

/**
 * Three hours per member per day, across every car.
 *
 * A per-booking cap alone did nothing: you booked 16:00-19:00, then 19:00-22:00,
 * and had the car for six hours anyway. There are a handful of shared cars and a
 * residence full of people, so the limit has to be on the person's day, not on
 * one row.
 *
 * Enforced here as well as in the UI — the UI stops offering slots once you're
 * out of hours, but the endpoint is what actually protects the rule.
 */
export const MAX_BOOKING_HOURS = 3;

/**
 * Próspera does not observe DST, so a fixed offset is exact rather than an
 * approximation. The day that matters is the day where the car physically is:
 * a member booking from another timezone still gets the residence's day.
 */
const RESIDENCE_UTC_OFFSET_HOURS = -6;

/** Start of the residence-local day containing `instant`, as a UTC instant. */
function residenceDayStart(instant: Date): Date {
  const offsetMs = RESIDENCE_UTC_OFFSET_HOURS * 3600 * 1000;
  const shifted = new Date(instant.getTime() + offsetMs);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - offsetMs);
}

/** Milliseconds of [aStart,aEnd] that fall inside [bStart,bEnd]. */
function overlapMs(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  return Math.max(0, end - start);
}

type VehicleInput = {
  name?: string;
  description?: string;
  active?: boolean;
  photoFileName?: string;
  photoFileType?: string;
  photoBase64?: string;
};

type BookingInput = {
  vehicleId?: string;
  startDate?: string;
  endDate?: string;
  note?: string;
};

/**
 * Accept either a YYYY-MM-DD date (treated as UTC midnight) or a full ISO
 * datetime string. Bookings are hourly now, so the client always sends the
 * latter; the bare-date form is kept so older payloads still parse rather than
 * failing obscurely — they'll be rejected by the duration cap instead.
 */
function parseBookingInstant(value: string | undefined, label: string): Date {
  if (!value) throw new BadRequestException(`${label} is required.`);
  const trimmed = String(value).trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  const date = dateOnly ? new Date(`${trimmed}T00:00:00.000Z`) : new Date(trimmed);
  if (Number.isNaN(date.getTime())) throw new BadRequestException(`${label} is not a valid date.`);
  return date;
}

const publicVehicleSelect = {
  id: true,
  name: true,
  description: true,
  active: true,
  photoFileName: true,
  createdAt: true,
  updatedAt: true,
} as const;

const publicBookingSelect = {
  id: true,
  vehicleId: true,
  userId: true,
  startDate: true,
  endDate: true,
  status: true,
  note: true,
  createdAt: true,
} as const;

@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Member-facing ──────────────────────────────────────────────────────────

  /** Active vehicles with their currently-booked date ranges (for the calendar). */
  async listAvailable() {
    const [vehicles, bookings] = await Promise.all([
      this.prisma.vehicle.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
        select: { ...publicVehicleSelect, photoData: false },
      }),
      this.prisma.vehicleBooking.findMany({
        where: { status: 'ACTIVE', endDate: { gte: new Date() } },
        select: { vehicleId: true, startDate: true, endDate: true },
        orderBy: { startDate: 'asc' },
      }),
    ]);

    const bookingsByVehicle: Record<string, Array<{ startDate: Date; endDate: Date }>> = {};
    for (const booking of bookings) {
      const list = bookingsByVehicle[booking.vehicleId] ?? [];
      list.push({ startDate: booking.startDate, endDate: booking.endDate });
      bookingsByVehicle[booking.vehicleId] = list;
    }

    return vehicles.map((vehicle) => ({
      ...vehicle,
      hasPhoto: Boolean(vehicle.photoFileName),
      bookedRanges: bookingsByVehicle[vehicle.id] ?? [],
    }));
  }

  listMyBookings(userId: string) {
    return this.prisma.vehicleBooking.findMany({
      where: { userId },
      orderBy: { startDate: 'desc' },
      select: {
        ...publicBookingSelect,
        vehicle: { select: { id: true, name: true } },
      },
    });
  }

  async book(userId: string, input: BookingInput) {
    const vehicleId = input.vehicleId?.trim();
    if (!vehicleId) throw new BadRequestException('Pick a vehicle.');
    const start = parseBookingInstant(input.startDate, 'Start');
    // A bare YYYY-MM-DD end date means "through the end of that day", so bump
    // it to 23:59:59.999 UTC — this keeps single-day bookings valid (end > start).
    const endIsDateOnly = typeof input.endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.endDate.trim());
    const end = parseBookingInstant(input.endDate, 'End');
    if (endIsDateOnly) end.setUTCHours(23, 59, 59, 999);
    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException('End must be after the start.');
    }
    // Allow up to 5 min of clock skew so a "book from now" click doesn't fail.
    const nowMinusSkew = Date.now() - 5 * 60 * 1000;
    if (start.getTime() < nowMinusSkew) {
      throw new BadRequestException('Start cannot be in the past.');
    }
    const spanHours = (end.getTime() - start.getTime()) / (3600 * 1000);
    if (spanHours > MAX_BOOKING_HOURS) {
      throw new BadRequestException(`Bookings can run at most ${MAX_BOOKING_HOURS} hours.`);
    }

    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle || !vehicle.active) throw new NotFoundException('Vehicle not found.');

    // Overlap check: any active booking whose [start,end] intersects [start,end].
    const overlap = await this.prisma.vehicleBooking.findFirst({
      where: {
        vehicleId,
        status: 'ACTIVE',
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: { id: true, startDate: true, endDate: true },
    });
    if (overlap) {
      throw new BadRequestException("Those dates overlap another booking. Please pick a different range.");
    }

    // Daily quota, counted across every car: two back-to-back three-hour
    // bookings are the exact thing this stops.
    const dayStart = residenceDayStart(start);
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
    const sameDay = await this.prisma.vehicleBooking.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        startDate: { lt: dayEnd },
        endDate: { gt: dayStart },
      },
      select: { startDate: true, endDate: true },
    });
    // Clipped to the day, so a booking that straddles midnight only spends the
    // hours it actually uses on each side.
    const usedMs = sameDay.reduce((sum, b) => sum + overlapMs(b.startDate, b.endDate, dayStart, dayEnd), 0);
    const requestedMs = overlapMs(start, end, dayStart, dayEnd);
    const limitMs = MAX_BOOKING_HOURS * 3600 * 1000;
    if (usedMs + requestedMs > limitMs) {
      const remainingHours = Math.max(0, (limitMs - usedMs) / (3600 * 1000));
      throw new BadRequestException(
        remainingHours === 0
          ? `You've already used your ${MAX_BOOKING_HOURS} hours for that day.`
          : `That would put you over ${MAX_BOOKING_HOURS} hours for the day — you have ${remainingHours}h left.`,
      );
    }

    const booking = await this.prisma.vehicleBooking.create({
      data: { vehicleId, userId, startDate: start, endDate: end, note: input.note?.trim() || null },
      select: publicBookingSelect,
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, profile: { select: { fullName: true } } } });
    const label = user?.profile?.fullName ?? user?.email ?? 'A member';
    await this.notifications.notifyAdmins({
      type: 'info',
      title: 'New vehicle booking',
      body: `${label} booked ${vehicle.name} (${start.toISOString().slice(0, 16).replace('T', ' ')} → ${end.toISOString().slice(0, 16).replace('T', ' ')} UTC).`,
      link: '/admin',
    });

    return booking;
  }

  async cancelMyBooking(userId: string, bookingId: string) {
    const booking = await this.prisma.vehicleBooking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.userId !== userId) {
      throw new NotFoundException('Booking not found.');
    }
    if (booking.status === 'CANCELLED') return { cancelled: true };
    await this.prisma.vehicleBooking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } });
    return { cancelled: true };
  }

  async getVehiclePhoto(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle?.photoData) throw new NotFoundException('No photo for this vehicle.');
    return {
      fileName: vehicle.photoFileName ?? 'photo',
      fileType: vehicle.photoFileType ?? 'application/octet-stream',
      dataBase64: vehicle.photoData,
    };
  }

  // ── Admin CRUD ─────────────────────────────────────────────────────────────

  adminListVehicles() {
    return this.prisma.vehicle.findMany({
      orderBy: { name: 'asc' },
      select: { ...publicVehicleSelect, _count: { select: { bookings: true } } },
    });
  }

  async adminCreate(input: VehicleInput) {
    const name = input.name?.trim();
    if (!name) throw new BadRequestException('Name is required.');
    const photo = this.extractPhoto(input);
    return this.prisma.vehicle.create({
      data: {
        name,
        description: input.description?.trim() || null,
        active: input.active ?? true,
        photoFileName: photo ? input.photoFileName ?? 'photo' : null,
        photoFileType: photo ? input.photoFileType ?? 'application/octet-stream' : null,
        photoData: photo ?? null,
      },
      select: publicVehicleSelect,
    });
  }

  async adminUpdate(vehicleId: string, input: VehicleInput) {
    const existing = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!existing) throw new NotFoundException('Vehicle not found.');
    const photo = this.extractPhoto(input);
    return this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        name: input.name?.trim() || undefined,
        description: input.description !== undefined ? input.description.trim() || null : undefined,
        active: input.active,
        ...(photo
          ? {
              photoFileName: input.photoFileName ?? 'photo',
              photoFileType: input.photoFileType ?? 'application/octet-stream',
              photoData: photo,
            }
          : {}),
      },
      select: publicVehicleSelect,
    });
  }

  async adminDelete(vehicleId: string) {
    const existing = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!existing) throw new NotFoundException('Vehicle not found.');
    await this.prisma.vehicle.delete({ where: { id: vehicleId } });
    return { deleted: true, id: vehicleId };
  }

  async adminListBookings() {
    const bookings = await this.prisma.vehicleBooking.findMany({
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
      select: {
        ...publicBookingSelect,
        vehicle: { select: { id: true, name: true } },
        user: { select: { id: true, email: true, profile: { select: { fullName: true } } } },
      },
    });
    return bookings.map((booking) => ({
      ...booking,
      renterName: booking.user.profile?.fullName ?? booking.user.email,
      renterEmail: booking.user.email,
    }));
  }

  async adminCancelBooking(bookingId: string, actorId?: string) {
    const booking = await this.prisma.vehicleBooking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found.');
    if (booking.status === 'CANCELLED') return { cancelled: true };
    await this.prisma.vehicleBooking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } });
    // Let the renter know the cancellation isn't their doing.
    if (actorId !== booking.userId) {
      await this.notifications.notify(booking.userId, {
        type: 'warning',
        title: 'Your vehicle booking was cancelled',
        body: 'The team cancelled your booking. Please book again or contact support.',
        link: '/account',
      });
    }
    return { cancelled: true };
  }

  private extractPhoto(input: VehicleInput): string | undefined {
    if (!input.photoBase64) return undefined;
    const data = input.photoBase64.split(',').pop() ?? '';
    if (data.length > MAX_PHOTO_BASE64_LENGTH) {
      throw new PayloadTooLargeException('Photo is too large (max ~3 MB).');
    }
    return data;
  }

  // Kept for symmetry with maintenance's guard style; not currently used but here
  // so a future "only-your-own" endpoint can call it without new plumbing.
  requireOwn(booking: { userId: string }, actorId: string) {
    if (booking.userId !== actorId) throw new ForbiddenException('Not your booking.');
  }
}
