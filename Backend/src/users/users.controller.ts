import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService, type ProfileUpdateInput } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get(':userId/profile')
  getProfile(@Param('userId') userId: string) {
    return this.users.findProfile(userId);
  }

  @Get(':userId/referrals')
  getReferrals(@Param('userId') userId: string) {
    return this.users.findReferrals(userId);
  }

  /** Single write path for the whole profile page — see ProfileUpdateInput. */
  @Patch(':userId/profile')
  updateProfile(@Param('userId') userId: string, @Body() body: ProfileUpdateInput) {
    return this.users.updateProfile(userId, body);
  }


  // GDPR data portability. The guard already restricts :userId to the owner
  // (admins may also access it).
  @Get(':userId/export')
  exportData(@Param('userId') userId: string) {
    return this.users.exportData(userId);
  }

  // GDPR right to erasure — a member deletes their OWN account only. The guard's
  // admin bypass allows admins to reach any :userId, so we additionally require
  // self-ownership here; admin-initiated deletion goes through the (SUPER_ADMIN-
  // only) admin endpoint instead, never this one.
  @Delete(':userId')
  deleteOwnAccount(@Param('userId') userId: string, @Req() req: Request & { user?: { sub: string } }) {
    if (req.user?.sub !== userId) {
      throw new ForbiddenException('You can only delete your own account here.');
    }
    return this.users.deleteOwnAccount(userId);
  }
}
