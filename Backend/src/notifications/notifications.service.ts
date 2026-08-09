import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ADMIN_ROLES } from '../users/roles';

export type NewNotification = {
  type?: 'info' | 'success' | 'warning';
  title: string;
  body?: string;
  link?: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a notification for a user. Best-effort: never throws into the caller,
   * so a notification failure can't break the surrounding action.
   */
  async notify(userId: string, input: NewNotification): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: { userId, type: input.type ?? 'info', title: input.title, body: input.body, link: input.link },
      });
    } catch (error) {
      this.logger.warn(`Failed to create notification for ${userId}: ${(error as Error).message}`);
    }
  }

  /** Notify every admin (SUPER_ADMIN / MODERATOR / COMMUNITY_LEADER). Best-effort. */
  async notifyAdmins(input: NewNotification): Promise<void> {
    try {
      const admins = await this.prisma.user.findMany({ where: { role: { in: ADMIN_ROLES } }, select: { id: true } });
      if (admins.length === 0) return;
      await this.prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          type: input.type ?? 'info',
          title: input.title,
          body: input.body,
          link: input.link,
        })),
      });
    } catch (error) {
      this.logger.warn(`Failed to notify admins: ${(error as Error).message}`);
    }
  }

  async list(userId: string, limit = 30) {
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: limit }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items, unread };
  }

  /** Marks notifications read: all of the user's, or just the given ids. */
  async markRead(userId: string, ids?: string[]) {
    const where =
      ids && ids.length > 0
        ? { userId, id: { in: ids }, readAt: null }
        : { userId, readAt: null };
    await this.prisma.notification.updateMany({ where, data: { readAt: new Date() } });
    return { ok: true };
  }

  /**
   * Broadcast a notification to every active member. Returns { sent } — the
   * number of rows created. Not best-effort: throws so the composer can show
   * a real error instead of silently claiming success.
   */
  async broadcast(input: NewNotification & { audienceRoles?: string[] }): Promise<{ sent: number }> {
    const roles = input.audienceRoles && input.audienceRoles.length ? input.audienceRoles : ['MEMBER'];
    const audience = await this.prisma.user.findMany({ where: { role: { in: roles } }, select: { id: true } });
    if (audience.length === 0) return { sent: 0 };
    const result = await this.prisma.notification.createMany({
      data: audience.map((u) => ({
        userId: u.id,
        type: input.type ?? 'info',
        title: input.title,
        body: input.body,
        link: input.link,
      })),
    });
    return { sent: result.count };
  }

  /** Send one notification to one member. Throws if the create fails. */
  async sendToMember(userId: string, input: NewNotification): Promise<{ id: string }> {
    const created = await this.prisma.notification.create({
      data: { userId, type: input.type ?? 'info', title: input.title, body: input.body, link: input.link },
    });
    return { id: created.id };
  }

  /**
   * One page of the delivery log, newest first, plus the total so the caller can
   * say "page 2 of 9".
   *
   * Paged rather than a fixed "last N": this table only ever grows, and a cap
   * meant everything older than the cutoff simply could not be looked at.
   *
   * The bounds are clamped here rather than trusted from the query string — a
   * missing or junk value used to reach Prisma as `take: NaN`.
   */
  async listRecent(limit = 30, offset = 0) {
    const take = clampInt(limit, 1, 100, 30);
    const skip = clampInt(offset, 0, Number.MAX_SAFE_INTEGER, 0);

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: { user: { select: { email: true, profile: { select: { fullName: true } } } } },
      }),
      this.prisma.notification.count(),
    ]);

    return {
      total,
      items: items.map((n) => ({
        id: n.id,
        recipient: n.user?.profile?.fullName ?? n.user?.email ?? '—',
        recipientEmail: n.user?.email ?? '—',
        type: n.type,
        title: n.title,
        body: n.body,
        link: n.link,
        readAt: n.readAt,
        createdAt: n.createdAt,
      })),
    };
  }
}

/** A whole number inside [min, max], or the fallback when it isn't one. */
function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}
