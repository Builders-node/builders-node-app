import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { paymentSeverity } from './payment-status';

/** Still open, in the order someone would want to deal with them. */
const OPEN_STATUSES = ['OVERDUE', 'DUE'];

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * A member's invoices.
   *
   * This existed and returned a hardcoded `monthlyDueAmountCents: 25000` that
   * no screen ever read — the whole endpoint was unreachable, so admins could
   * issue invoices nobody could see. Now it answers the two questions a member
   * actually has: what do I owe, and what have I already paid.
   */
  async getDues(userId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { userId },
      orderBy: { dueDate: 'desc' },
    });

    const open = payments
      .filter((payment) => OPEN_STATUSES.includes(payment.status))
      // Overdue first, then by how soon it's due.
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'OVERDUE' ? -1 : 1;
        return a.dueDate.getTime() - b.dueDate.getTime();
      });

    return {
      openTotalCents: open.reduce((sum, payment) => sum + payment.amountCents, 0),
      currency: open[0]?.currency ?? payments[0]?.currency ?? 'USD',
      open: open.map(shape),
      history: payments.filter((payment) => !OPEN_STATUSES.includes(payment.status)).map(shape),
    };
  }
}

function shape(payment: {
  id: string;
  amountCents: number;
  currency: string;
  status: string;
  dueDate: Date;
  paidAt: Date | null;
  description: string;
  payUrl: string | null;
  receiptUrl: string | null;
}) {
  return {
    id: payment.id,
    amountCents: payment.amountCents,
    currency: payment.currency,
    status: payment.status,
    severity: paymentSeverity(payment.status),
    dueDate: payment.dueDate,
    paidAt: payment.paidAt,
    description: payment.description,
    payUrl: payment.payUrl,
    receiptUrl: payment.receiptUrl,
  };
}
