import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  createTicket(userId: string, data: { subject: string; message: string }) {
    return this.prisma.supportTicket.create({
      data: {
        userId,
        subject: data.subject,
        message: data.message,
        status: 'OPEN',
      },
    });
  }

  listTickets(userId: string) {
    return this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
