import { Controller, Delete, Get, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DiscordService } from './discord.service';

@Controller()
export class DiscordController {
  constructor(
    private readonly discord: DiscordService,
    private readonly config: ConfigService,
  ) {}

  // Start linking: returns the Discord OAuth URL for the current user.
  @UseGuards(JwtAuthGuard)
  @Get('users/:userId/discord/authorize-url')
  authorizeUrl(@Param('userId') userId: string) {
    return { url: this.discord.getAuthorizeUrl(userId) };
  }

  // Unlink the Discord account (and strip the granted roles).
  @UseGuards(JwtAuthGuard)
  @Delete('users/:userId/discord')
  unlink(@Param('userId') userId: string, @Req() req: Request & { user?: { sub: string } }) {
    // Self-only (the guard's admin bypass allows any :userId, so pin to the owner).
    const target = req.user?.sub === userId ? userId : req.user!.sub;
    return this.discord.unlink(target);
  }

  // OAuth redirect target — links + assigns role, then bounces back to the app.
  @Get('auth/discord/callback')
  async callback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    const base = (this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173').split(',')[0].trim().replace(/\/+$/, '');
    try {
      if (!code || !state) throw new Error('missing code/state');
      await this.discord.handleCallback(code, state);
      res.redirect(`${base}/account?discord=connected`);
    } catch {
      res.redirect(`${base}/account?discord=error`);
    }
  }
}
