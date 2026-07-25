import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { HomeService } from './home.service';

@Controller('users/:userId/home')
@UseGuards(JwtAuthGuard)
export class HomeController {
  constructor(private readonly home: HomeService) {}

  @Get()
  getHome(@Param('userId') userId: string) {
    return this.home.getHome(userId);
  }
}
