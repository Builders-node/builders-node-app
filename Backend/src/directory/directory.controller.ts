import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DirectoryService, type DirectoryProfileInput } from './directory.service';

type AuthedRequest = Request & { user?: { sub: string } };

@Controller()
@UseGuards(JwtAuthGuard)
export class DirectoryController {
  constructor(private readonly directory: DirectoryService) {}

  /**
   * Browse the directory. The viewer comes from the token rather than the path
   * so there's no id to tamper with.
   */
  @Get('directory')
  list(@Req() req: AuthedRequest, @Query('search') search?: string, @Query('skill') skill?: string) {
    return this.directory.list(req.user!.sub, { search, skill });
  }

  /**
   * One member's profile.
   *
   * The param is deliberately `memberId`, not `userId` — JwtAuthGuard treats a
   * `:userId` param as "this must be your own account", which would make it
   * impossible to view anyone else.
   */
  @Get('directory/:memberId')
  detail(@Req() req: AuthedRequest, @Param('memberId') memberId: string) {
    return this.directory.detail(req.user!.sub, memberId);
  }

  /** The member's own directory record — visible to them even when hidden. */
  @Get('users/:userId/directory-profile')
  getMine(@Param('userId') userId: string) {
    return this.directory.getMine(userId);
  }

  @Patch('users/:userId/directory-profile')
  updateMine(@Param('userId') userId: string, @Body() body: DirectoryProfileInput) {
    return this.directory.updateMine(userId, body);
  }
}
