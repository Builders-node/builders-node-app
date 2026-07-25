import { BadGatewayException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ProsperaResidencyClient } from './prospera-residency.client';
import { residencyCallToAction } from './residency-status';

@Injectable()
export class ResidencyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prospera: ProsperaResidencyClient,
  ) {}

  async getResidency(userId: string) {
    const application = await this.prisma.residencyApplication.findUnique({ where: { userId } });
    if (!application) {
      return {
        status: 'NOT_STARTED',
        stage: 'Not started',
        requiredNextSteps: ['Start your Prospera E-Residency application.'],
        action: 'Start your Prospera E-Residency application.',
      };
    }

    return {
      ...application,
      requiredNextSteps: this.parseNextSteps(application.requiredNextStepsJson),
      action: residencyCallToAction({
        status: application.status as never,
        stage: application.stage,
        requiredNextSteps: this.parseNextSteps(application.requiredNextStepsJson),
        lastSyncedAt: application.lastSyncedAt ?? undefined,
        lastError: application.lastError,
      }),
    };
  }

  async startOrContinue(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const existing = await this.prisma.residencyApplication.findUnique({ where: { userId } });
    if (existing?.continueUrl) {
      return existing;
    }

    const started = await this.prospera.startApplication({
      id: user.id,
      email: user.email,
      fullName: user.profile?.fullName,
    });

    return this.prisma.residencyApplication.upsert({
      where: { userId },
      create: {
        userId,
        externalApplicationId: started.externalApplicationId,
        continueUrl: started.continueUrl,
        status: 'IN_PROGRESS',
        stage: 'Started',
        requiredNextStepsJson: JSON.stringify(['Continue application on prospera.co']),
      },
      update: {
        externalApplicationId: started.externalApplicationId,
        continueUrl: started.continueUrl,
      },
    });
  }

  async sync(userId: string) {
    const application = await this.prisma.residencyApplication.findUnique({ where: { userId } });
    if (!application) {
      throw new NotFoundException('No E-Residency application exists for this user.');
    }

    try {
      const snapshot = await this.prospera.fetchStatus(application.externalApplicationId);
      return this.prisma.residencyApplication.update({
        where: { userId },
        data: {
          status: snapshot.status,
          stage: snapshot.stage,
          requiredNextStepsJson: JSON.stringify(snapshot.requiredNextSteps),
          lastSyncedAt: snapshot.lastSyncedAt ?? new Date(),
          lastError: null,
        },
      });
    } catch (error) {
      await this.prisma.residencyApplication.update({
        where: { userId },
        data: { lastError: error instanceof Error ? error.message : 'Unknown Prospera API error' },
      });
      throw new BadGatewayException('Could not sync E-Residency status from prospera.co.');
    }
  }

  private parseNextSteps(value: string): string[] {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
      return [];
    }
  }
}
