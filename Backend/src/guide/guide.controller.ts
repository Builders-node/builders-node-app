import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminGuard } from '../admin/admin.guard';
import { GuideService } from './guide.service';
import { GuideRequestDto } from './dto';

/**
 * The public half: the form on ca.buildersnode.com.
 *
 * Unauthenticated by necessity, and rate-limited at the same rate as the apply
 * form — it sends an email per call, so an unthrottled one is a way to post
 * mail from our domain to anybody.
 */
@Controller('public/guide')
export class PublicGuideController {
  constructor(private readonly guide: GuideService) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('request')
  request(@Body() dto: GuideRequestDto) {
    return this.guide.request(dto);
  }

  /**
   * Check a key and hand back where the guide lives.
   *
   * Throttled harder than the request above: this one takes a guess, and the
   * limit is what stops the single shared key being found by brute force.
   */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('unlock')
  unlock(@Body() body: { key?: string }) {
    return this.guide.unlock(body?.key);
  }
}

@Controller('admin/guide-requests')
@UseGuards(AdminGuard)
export class AdminGuideController {
  constructor(private readonly guide: GuideService) {}

  @Get()
  list() {
    return this.guide.list();
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.guide.remove(id);
  }
}
