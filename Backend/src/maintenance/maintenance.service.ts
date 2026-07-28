import { BadRequestException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const MAX_PHOTO_BASE64_LENGTH = 3_500_000; // ~2.5 MB file
const STATUSES = new Set(['OPEN', 'IN_PROGRESS', 'RESOLVED']);

type CreateInput = {
  category?: string;
  title?: string;
  description?: string;
  photoFileName?: string;
  photoFileType?: string;
  photoBase64?: string;
};

const publicSelect = {
  id: true,
  category: true,
  title: true,
  description: true,
  status: true,
  adminNote: true,
  photoFileName: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
} as const;

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(userId: string, input: CreateInput) {
    const title = input.title?.trim();
    const description = input.description?.trim();
    if (!title || !description) {
      throw new BadRequestException('Title and description are required.');
    }

    let photoData: string | undefined;
    if (input.photoBase64) {
      photoData = input.photoBase64.split(',').pop() ?? '';
      if (photoData.length > MAX_PHOTO_BASE64_LENGTH) {
        throw new PayloadTooLargeException('Photo is too large (max ~3 MB).');
      }
    }

    const request = await this.prisma.maintenanceRequest.create({
      data: {
        userId,
        category: input.category?.trim() || 'General',
        title,
        description,
        photoFileName: photoData ? input.photoFileName ?? 'photo' : null,
        photoFileType: photoData ? input.photoFileType ?? 'application/octet-stream' : null,
        photoData: photoData || null,
      },
      select: publicSelect,
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    await this.notifications.notifyAdmins({
      type: 'warning',
      title: 'New maintenance request',
      body: `${user?.email ?? 'A member'}: ${title}`,
      link: '/admin',
    });

    return request;
  }

  listForUser(userId: string) {
    return this.prisma.maintenanceRequest.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, select: publicSelect });
  }

  // ── Admin ──────────────────────────────────────────────────────────────────

  async adminList() {
    const items = await this.prisma.maintenanceRequest.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      select: { ...publicSelect, userId: true, user: { select: { email: true, profile: { select: { fullName: true } } } } },
    });
    return items.map((item) => ({
      ...item,
      requesterName: item.user.profile?.fullName ?? item.user.email,
      requesterEmail: item.user.email,
      hasPhoto: Boolean(item.photoFileName),
    }));
  }

  async adminUpdate(id: string, input: { status?: string; adminNote?: string }) {
    const existing = await this.prisma.maintenanceRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Maintenance request not found.');
    if (input.status && !STATUSES.has(input.status)) {
      throw new BadRequestException('Invalid status.');
    }

    const statusChanged = Boolean(input.status && input.status !== existing.status);
    const updated = await this.prisma.maintenanceRequest.update({
      where: { id },
      data: {
        status: input.status ?? undefined,
        adminNote: input.adminNote !== undefined ? input.adminNote.trim() || null : undefined,
        resolvedAt: input.status === 'RESOLVED' ? new Date() : input.status ? null : undefined,
      },
      select: publicSelect,
    });

    if (statusChanged) {
      const label = input.status === 'RESOLVED' ? 'resolved' : input.status === 'IN_PROGRESS' ? 'in progress' : 'reopened';
      await this.notifications.notify(existing.userId, {
        type: input.status === 'RESOLVED' ? 'success' : 'info',
        title: `Maintenance request ${label}`,
        body: `"${existing.title}" is now ${label}.`,
        link: '/account',
      });
    }

    return updated;
  }

  async getPhoto(id: string) {
    const request = await this.prisma.maintenanceRequest.findUnique({ where: { id } });
    if (!request?.photoData) throw new NotFoundException('No photo attached.');
    return {
      fileName: request.photoFileName ?? 'photo',
      fileType: request.photoFileType ?? 'application/octet-stream',
      dataBase64: request.photoData,
    };
  }
}
