import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

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
}
