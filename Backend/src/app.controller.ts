import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';
import { BATCH_KEY, parseBatch } from './admin/global-settings';

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
    const row = await this.prisma.globalSetting.findUnique({ where: { key: BATCH_KEY } });
    return { batch: parseBatch(row?.value) };
  }
}
