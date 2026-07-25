import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResidencySnapshot } from './residency-status';

@Injectable()
export class ProsperaResidencyClient {
  constructor(private readonly config: ConfigService) {}

  async startApplication(user: { id: string; email: string; fullName?: string | null }) {
    const baseUrl = this.config.get<string>('PROSPERA_API_BASE_URL');
    if (!this.config.get<string>('PROSPERA_API_KEY')) {
      return {
        externalApplicationId: `mock-prospera-${user.id}`,
        continueUrl: `${baseUrl ?? 'https://prospera.co'}/e-residency/apply`,
      };
    }

    throw new Error('Real prospera.co startApplication integration is not configured in this scaffold.');
  }

  async fetchStatus(externalApplicationId: string): Promise<ResidencySnapshot> {
    if (!this.config.get<string>('PROSPERA_API_KEY')) {
      return {
        status: 'IN_PROGRESS',
        stage: 'Identity verification',
        requiredNextSteps: ['Continue identity verification on prospera.co'],
        lastSyncedAt: new Date(),
      };
    }

    throw new Error(`Real prospera.co status sync is not configured for ${externalApplicationId}.`);
  }
}
