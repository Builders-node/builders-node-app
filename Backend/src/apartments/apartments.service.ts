import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ApartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  listAvailable() {
    return this.prisma.apartment.findMany({
      where: { availability: { in: ['AVAILABLE', 'AVAILABLE_SOON'] } },
      orderBy: { priceCents: 'asc' },
    });
  }
}
