import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ProsperaSubClient } from './prospera-sub.client';
import { planWarning } from './subscription-status';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prosperaSub: ProsperaSubClient,
  ) {}

  async getPlan(userId: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { userId } });
    if (!plan) {
      return {
        status: 'PENDING',
        planName: 'Builders Node Community Plan',
        warning: 'Activate a ProsperaSub.com plan to keep membership active.',
      };
    }

    return { ...plan, warning: planWarning(plan.status) };
  }

  getMealsMenu(userId: string) {
    return this.prosperaSub.getMealsMenu(userId);
  }

  getCleaningSchedule(userId: string) {
    return this.prosperaSub.getCleaningSchedule(userId);
  }

  async activate(userId: string) {
    const activation = await this.prosperaSub.activationLink(userId);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.subscriptionPlan.upsert({
        where: { userId },
        create: {
          userId,
          planName: 'Builders Node Community Plan',
          status: 'PENDING',
          externalSubscriptionId: activation.externalSubscriptionId,
          paymentUrl: activation.paymentUrl,
        },
        update: {
          status: 'PENDING',
          externalSubscriptionId: activation.externalSubscriptionId,
          paymentUrl: activation.paymentUrl,
        },
      });

      await tx.communityPlanPurchase.create({
        data: {
          userId,
          externalSubscriptionId: activation.externalSubscriptionId,
          planName: 'Builders Node Community Plan',
          status: 'PENDING',
          purchasedAt: now,
          paymentUrl: activation.paymentUrl,
        },
      });

      return plan;
    });
  }
}
