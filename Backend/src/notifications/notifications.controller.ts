import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('users/:userId/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    // Parsed loosely and clamped in the service — a junk query string should
    // give the first page, not a 500.
    return this.notifications.list(
      userId,
      limit ? Number(limit) : undefined,
      offset ? Number(offset) : undefined,
    );
  }

  // Mark all read, or just the ids in the body.
  @Post('read')
  markRead(@Param('userId') userId: string, @Body() body: { ids?: string[] }) {
    return this.notifications.markRead(userId, body?.ids);
  }
}
