import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

export type RsvpStatus = 'GOING' | 'MAYBE' | 'DECLINED';
const RSVP_STATUSES: RsvpStatus[] = ['GOING', 'MAYBE', 'DECLINED'];

export type EventInput = {
  title?: string;
  description?: string;
  location?: string;
  startsAt?: string;
  endsAt?: string | null;
  capacity?: number | null;
  published?: boolean;
};

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Events are a members-only surface, same rule as the directory. */
  private async requireActiveMember(userId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId },
      select: { status: true },
    });
    if (membership?.status !== 'ACTIVE_MEMBER') {
      throw new ForbiddenException('Community events are available to active members.');
    }
  }

  /**
   * Published events split into upcoming and past, each carrying the caller's
   * own RSVP and the going-count so the list renders without N+1 lookups.
   */
  async listForMember(userId: string) {
    await this.requireActiveMember(userId);

    const now = new Date();
    const events = await this.prisma.event.findMany({
      where: { published: true },
      orderBy: { startsAt: 'asc' },
      include: {
        rsvps: { select: { userId: true, status: true } },
      },
    });

    const shape = (event: (typeof events)[number]) => {
      const going = event.rsvps.filter((r) => r.status === 'GOING').length;
      return {
        id: event.id,
        title: event.title,
        description: event.description,
        location: event.location,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        capacity: event.capacity,
        goingCount: going,
        spotsLeft: event.capacity === null ? null : Math.max(0, event.capacity - going),
        myRsvp: (event.rsvps.find((r) => r.userId === userId)?.status ?? null) as RsvpStatus | null,
      };
    };

    // An event that has started but not ended is still "upcoming" — you can
    // still walk into it.
    const isPast = (event: (typeof events)[number]) => (event.endsAt ?? event.startsAt) < now;

    return {
      upcoming: events.filter((e) => !isPast(e)).map(shape),
      past: events
        .filter(isPast)
        .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
        .slice(0, 20)
        .map(shape),
    };
  }

  /** Set (or change) the caller's RSVP. Capacity only limits GOING. */
  async rsvp(userId: string, eventId: string, status: string | undefined) {
    await this.requireActiveMember(userId);

    if (!status || !RSVP_STATUSES.includes(status as RsvpStatus)) {
      throw new BadRequestException('Status must be GOING, MAYBE or DECLINED.');
    }

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { rsvps: { select: { userId: true, status: true } } },
    });
    if (!event || !event.published) throw new NotFoundException('Event not found.');

    if (status === 'GOING' && event.capacity !== null) {
      const going = event.rsvps.filter((r) => r.status === 'GOING' && r.userId !== userId).length;
      if (going >= event.capacity) {
        throw new BadRequestException('This event is full.');
      }
    }

    await this.prisma.eventRsvp.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: { eventId, userId, status },
      update: { status },
    });

    return this.listForMember(userId);
  }

  // ── Admin ──────────────────────────────────────────────────────────────────

  /** Every event, draft included, with RSVP breakdown for the admin list. */
  async adminList() {
    const events = await this.prisma.event.findMany({
      orderBy: { startsAt: 'desc' },
      include: {
        rsvps: {
          select: {
            status: true,
            user: { select: { email: true, profile: { select: { fullName: true } } } },
          },
        },
      },
    });

    return events.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.location,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      capacity: event.capacity,
      published: event.published,
      goingCount: event.rsvps.filter((r) => r.status === 'GOING').length,
      maybeCount: event.rsvps.filter((r) => r.status === 'MAYBE').length,
      declinedCount: event.rsvps.filter((r) => r.status === 'DECLINED').length,
      attendees: event.rsvps
        .filter((r) => r.status !== 'DECLINED')
        .map((r) => ({
          name: r.user.profile?.fullName ?? r.user.email,
          email: r.user.email,
          status: r.status,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }

  private parseInput(input: EventInput, { requireTitle }: { requireTitle: boolean }) {
    const data: {
      title?: string;
      description?: string | null;
      location?: string | null;
      startsAt?: Date;
      endsAt?: Date | null;
      capacity?: number | null;
      published?: boolean;
    } = {};

    const title = input.title?.trim();
    if (requireTitle && !title) throw new BadRequestException('Title is required.');
    if (title !== undefined) data.title = title;

    if (input.description !== undefined) data.description = input.description.trim() || null;
    if (input.location !== undefined) data.location = input.location.trim() || null;

    if (input.startsAt !== undefined) {
      const startsAt = new Date(input.startsAt);
      if (Number.isNaN(startsAt.getTime())) throw new BadRequestException('Start time is not a valid date.');
      data.startsAt = startsAt;
    } else if (requireTitle) {
      throw new BadRequestException('Start time is required.');
    }

    if (input.endsAt !== undefined) {
      if (input.endsAt === null || input.endsAt === '') {
        data.endsAt = null;
      } else {
        const endsAt = new Date(input.endsAt);
        if (Number.isNaN(endsAt.getTime())) throw new BadRequestException('End time is not a valid date.');
        data.endsAt = endsAt;
      }
    }

    const start = data.startsAt;
    if (start && data.endsAt && data.endsAt <= start) {
      throw new BadRequestException('End time must be after the start time.');
    }

    if (input.capacity !== undefined) {
      if (input.capacity === null || (input.capacity as unknown) === '') {
        data.capacity = null;
      } else {
        const capacity = Number(input.capacity);
        if (!Number.isFinite(capacity) || capacity < 1) {
          throw new BadRequestException('Capacity must be at least 1, or empty for unlimited.');
        }
        data.capacity = Math.floor(capacity);
      }
    }

    if (input.published !== undefined) data.published = Boolean(input.published);

    return data;
  }

  async adminCreate(input: EventInput) {
    const data = this.parseInput(input, { requireTitle: true });
    const event = await this.prisma.event.create({
      data: {
        title: data.title!,
        startsAt: data.startsAt!,
        description: data.description ?? null,
        location: data.location ?? null,
        endsAt: data.endsAt ?? null,
        capacity: data.capacity ?? null,
        published: data.published ?? false,
      },
    });
    if (event.published) await this.announce(event);
    return this.adminList();
  }

  async adminUpdate(eventId: string, input: EventInput) {
    const existing = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!existing) throw new NotFoundException('Event not found.');

    const data = this.parseInput(input, { requireTitle: false });
    // Guard the combination too — a new end time has to clear the stored start.
    const start = data.startsAt ?? existing.startsAt;
    const end = data.endsAt !== undefined ? data.endsAt : existing.endsAt;
    if (end && end <= start) throw new BadRequestException('End time must be after the start time.');

    const updated = await this.prisma.event.update({ where: { id: eventId }, data });
    // Announce only on the draft → published transition, so edits stay quiet.
    if (!existing.published && updated.published) await this.announce(updated);
    return this.adminList();
  }

  async adminDelete(eventId: string) {
    const existing = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!existing) throw new NotFoundException('Event not found.');
    await this.prisma.event.delete({ where: { id: eventId } });
    return this.adminList();
  }

  /** Tell every active member about a newly published event. Best-effort. */
  private async announce(event: { id: string; title: string; startsAt: Date }) {
    try {
      const when = event.startsAt.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      await this.notifications.broadcast({
        type: 'info',
        title: `New event: ${event.title}`,
        body: `${when} — open Community to RSVP.`,
        link: '/community',
      });
    } catch {
      /* a failed announcement must not fail the publish */
    }
  }
}
