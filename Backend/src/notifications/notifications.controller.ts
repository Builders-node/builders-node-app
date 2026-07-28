import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('users/:userId/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Param('userId') userId: string) {
    return this.notifications.list(userId);
  }

  // Mark all read, or just the ids in the body.
  @Post('read')
  markRead(@Param('userId') userId: string, @Body() body: { ids?: string[] }) {
    return this.notifications.markRead(userId, body?.ids);
  }
}
