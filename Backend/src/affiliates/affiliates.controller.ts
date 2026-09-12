import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminGuard } from '../admin/admin.guard';
import { AffiliatesService } from './affiliates.service';
import { AffiliateApplyDto, ReviewAffiliateDto } from './dto';

/**
 * The public half: the affiliate page and its form.
 *
 * Unauthenticated by necessity — almost nobody applying to promote Builders
 * Node has an account here yet. Rate-limited at the same rate as the member
 * application form, which this sits beside in the same funnel.
 */
@Controller('public/affiliates')
export class PublicAffiliatesController {
  constructor(private readonly affiliates: AffiliatesService) {}

  /** The payout terms the page quotes. Also on /public/settings. */
  @Get('reward')
  reward() {
    return this.affiliates.reward();
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('apply')
  apply(@Body() dto: AffiliateApplyDto) {
    return this.affiliates.apply(dto);
  }
}

@Controller('admin/affiliates')
@UseGuards(AdminGuard)
export class AdminAffiliatesController {
  constructor(private readonly affiliates: AffiliatesService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.affiliates.list(status);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Body() body: ReviewAffiliateDto) {
    return this.affiliates.approve(id, body?.adminNote);
  }

  @Post(':id/decline')
  decline(@Param('id') id: string, @Body() body: ReviewAffiliateDto) {
    return this.affiliates.decline(id, body?.adminNote);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.affiliates.remove(id);
  }
}
