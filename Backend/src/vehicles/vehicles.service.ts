import { BadRequestException, ForbiddenException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const MAX_PHOTO_BASE64_LENGTH = 3_500_000; // ~2.5 MB
const MAX_BOOKING_DAYS = 30;

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
 * Parse a YYYY-MM-DD (or ISO) string as a UTC midnight so bookings compare
 * cleanly regardless of the server timezone.
 */
function parseDay(value: string | undefined, label: string): Date {
  if (!value) throw new BadRequestException(`${label} is required.`);
  const trimmed = String(value).slice(0, 10);
  const date = new Date(`${trimmed}T00:00:00.000Z`);
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
    const start = parseDay(input.startDate, 'Start date');
    const end = parseDay(input.endDate, 'End date');
    if (end.getTime() < start.getTime()) {
      throw new BadRequestException('End date must be on or after the start date.');
    }
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (start.getTime() < today.getTime()) {
      throw new BadRequestException('Start date cannot be in the past.');
    }
    const days = Math.round((end.getTime() - start.getTime()) / (24 * 3600 * 1000)) + 1;
    if (days > MAX_BOOKING_DAYS) {
      throw new BadRequestException(`Bookings can span at most ${MAX_BOOKING_DAYS} days.`);
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

    const booking = await this.prisma.vehicleBooking.create({
      data: { vehicleId, userId, startDate: start, endDate: end, note: input.note?.trim() || null },
      select: publicBookingSelect,
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, profile: { select: { fullName: true } } } });
    const label = user?.profile?.fullName ?? user?.email ?? 'A member';
    await this.notifications.notifyAdmins({
      type: 'info',
      title: 'New vehicle booking',
      body: `${label} booked ${vehicle.name} (${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)}).`,
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
