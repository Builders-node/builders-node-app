import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SubscriptionsService } from './subscriptions.service';

@Controller('users/:userId/subscription')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  getPlan(@Param('userId') userId: string) {
    return this.subscriptions.getPlan(userId);
  }

  @Get('meals')
  getMeals(@Param('userId') userId: string) {
    return this.subscriptions.getMealsMenu(userId);
  }

  @Get('cleaning')
  getCleaning(@Param('userId') userId: string) {
    return this.subscriptions.getCleaningSchedule(userId);
  }

  @Post('activate')
  activate(@Param('userId') userId: string) {
    return this.subscriptions.activate(userId);
  }
}
