import { Injectable, NotFoundException } from '@nestjs/common';
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

  async requestRental(userId: string, apartmentId: string, message?: string) {
    const apartment = await this.prisma.apartment.findUnique({ where: { id: apartmentId } });
    if (!apartment) {
      throw new NotFoundException('Apartment not found.');
    }

    return this.prisma.rentalRequest.create({
      data: {
        userId,
        apartmentId,
        status: 'REQUESTED',
        message,
      },
    });
  }

  currentRentalStatus(userId: string) {
    return this.prisma.rentalRequest.findFirst({
      where: { userId },
      include: { apartment: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
