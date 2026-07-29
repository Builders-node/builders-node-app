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
    const base = this.resolveFrontendBase();
    try {
      if (!code || !state) throw new Error('missing code/state');
      await this.discord.handleCallback(code, state);
      res.redirect(`${base}/account?discord=connected`);
    } catch {
      res.redirect(`${base}/account?discord=error`);
    }
  }

  /**
   * Picks the public frontend base URL. Prefers the custom domain over any
   * *.vercel.app in FRONTEND_URL (comma-separated), so post-OAuth redirects
   * always land on the branded domain when it's configured; the vercel URL
   * remains a backup only if no custom domain is set.
   */
  private resolveFrontendBase(): string {
    const urls = (this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const preferred = urls.find((url) => !/\.vercel\.app(?:\/|$)/.test(url)) ?? urls[0];
    return preferred.replace(/\/+$/, '');
  }
}
