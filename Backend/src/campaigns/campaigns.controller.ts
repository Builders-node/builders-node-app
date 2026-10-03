import { Body, Controller, Query, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AdminGuard } from '../admin/admin.guard';
import { CampaignsService, type CampaignInput } from './campaigns.service';

/**
 * The public half: a visitor arriving through a tracked link.
 *
 * Unauthenticated by necessity — the whole point is counting people who have
 * no account and may never get one. Rate-limited so the numbers can't be run up
 * from a loop, and it answers the same way whatever happens, so the endpoint
 * can't be used to find out which codes exist.
 */
@Controller('public/campaigns')
export class PublicCampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':code/visit')
  async visit(@Param('code') code: string, @Body() body: { visitorKey?: string }) {
    await this.campaigns.recordVisit(code, body?.visitorKey);
    return { ok: true };
  }
}

@Controller('admin/campaigns')
@UseGuards(AdminGuard)
export class AdminCampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  /** `?from=YYYY-MM-DD&to=YYYY-MM-DD` (to is exclusive); both optional. */
  @Get()
  list(@Query('from') from?: string, @Query('to') to?: string) {
    const day = (value?: string) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : undefined);
    return this.campaigns.list({ from: day(from), to: day(to) });
  }

  @Post()
  create(
    @Body() body: CampaignInput,
    @Req() request: Request & { adminAccess?: { userId?: string } },
  ) {
    return this.campaigns.create(body, request.adminAccess?.userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: CampaignInput) {
    return this.campaigns.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.campaigns.remove(id);
  }
}
