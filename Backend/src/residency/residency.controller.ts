import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ResidencyService } from './residency.service';

@Controller('users/:userId/residency')
@UseGuards(JwtAuthGuard)
export class ResidencyController {
  constructor(private readonly residency: ResidencyService) {}

  @Get()
  getResidency(@Param('userId') userId: string) {
    return this.residency.getResidency(userId);
  }

  @Post('start-or-continue')
  startOrContinue(@Param('userId') userId: string) {
    return this.residency.startOrContinue(userId);
  }

  @Post('sync')
  sync(@Param('userId') userId: string) {
    return this.residency.sync(userId);
  }
}
