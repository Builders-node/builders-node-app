import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get(':userId/profile')
  getProfile(@Param('userId') userId: string) {
    return this.users.findProfile(userId);
  }

  @Patch(':userId/profile')
  updateProfile(
    @Param('userId') userId: string,
    @Body() body: { fullName?: string; phone?: string; location?: string },
  ) {
    return this.users.updateProfile(userId, body);
  }
}
