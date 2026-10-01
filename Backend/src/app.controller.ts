import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';
import { AFFILIATE_KEY, BATCH_KEY, parseAffiliateReward, parseBatch } from './admin/global-settings';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'builders-node-backend',
      database: this.prisma.isConnected() ? 'connected' : 'unavailable',
    };
  }

  /** Public site config (read by the landing page — no auth). */
  @Get('public/settings')
  async publicSettings() {
    const [batchRow, affiliateRow] = await Promise.all([
      this.prisma.globalSetting.findUnique({ where: { key: BATCH_KEY } }),
      this.prisma.globalSetting.findUnique({ where: { key: AFFILIATE_KEY } }),
    ]);
    return {
      batch: parseBatch(batchRow?.value),
      // The affiliate page quotes this instead of naming its own figure.
      affiliate: parseAffiliateReward(affiliateRow?.value),
    };
  }
}
