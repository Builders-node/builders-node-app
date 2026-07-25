import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { paymentSeverity } from './payment-status';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDues(userId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { userId },
      orderBy: { dueDate: 'desc' },
    });
    const upcoming = payments.find((payment) => payment.status === 'DUE' || payment.status === 'OVERDUE');

    return {
      monthlyDueAmountCents: 25000,
      upcomingPayment: upcoming ? { ...upcoming, severity: paymentSeverity(upcoming.status) } : null,
      history: payments.map((payment) => ({ ...payment, severity: paymentSeverity(payment.status) })),
    };
  }
}
