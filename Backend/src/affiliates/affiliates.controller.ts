import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SuperAdminOnly } from '../admin/super-admin.decorator';
import { AdminGuard } from '../admin/admin.guard';
import { AffiliatesService } from './affiliates.service';

/**
 * The public half is one read: what the programme pays.
 *
 * There is no apply endpoint any more — joining is registering, which goes
 * through /auth/signup like every other account and carries a `source` so an
 * affiliate can be told apart from anyone else afterwards.
 */
@Controller('public/affiliates')
export class PublicAffiliatesController {
  constructor(private readonly affiliates: AffiliatesService) {}

  @Get('reward')
  reward() {
    return this.affiliates.reward();
  }
}

@Controller('admin/affiliates')
@UseGuards(AdminGuard)
export class AdminAffiliatesController {
  constructor(private readonly affiliates: AffiliatesService) {}

  @Get()
  list() {
    return this.affiliates.list();
  }

  /** Money paid out is money: Super Admin only, like invoices. */
  @SuperAdminOnly()
  @Post(':userId/payouts')
  recordPayout(
    @Param('userId') userId: string,
    @Body() body: { amountCents?: number; note?: string },
    @Req() request: Request & { adminAccess?: { userId?: string } },
  ) {
    return this.affiliates.recordPayout(userId, body ?? {}, request.adminAccess?.userId);
  }

  @SuperAdminOnly()
  @Delete('payouts/:payoutId')
  removePayout(@Param('payoutId') payoutId: string) {
    return this.affiliates.removePayout(payoutId);
  }
}
