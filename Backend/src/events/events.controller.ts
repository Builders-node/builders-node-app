import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AdminGuard } from '../admin/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EventsService, type EventInput } from './events.service';

type AuthedRequest = Request & { user?: { sub: string } };

@Controller()
export class EventsController {
  constructor(private readonly events: EventsService) {}

  // ── Members ────────────────────────────────────────────────────────────────

  /** Viewer comes from the token, so there's no id in the path to tamper with. */
  @UseGuards(JwtAuthGuard)
  @Get('events')
  list(@Req() req: AuthedRequest) {
    return this.events.listForMember(req.user!.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('events/:eventId/rsvp')
  rsvp(@Req() req: AuthedRequest, @Param('eventId') eventId: string, @Body() body: { status?: string }) {
    return this.events.rsvp(req.user!.sub, eventId, body?.status);
  }

  // ── Admin ──────────────────────────────────────────────────────────────────

  @UseGuards(AdminGuard)
  @Get('admin/events')
  adminList() {
    return this.events.adminList();
  }

  @UseGuards(AdminGuard)
  @Post('admin/events')
  adminCreate(@Body() body: EventInput) {
    return this.events.adminCreate(body);
  }

  @UseGuards(AdminGuard)
  @Patch('admin/events/:eventId')
  adminUpdate(@Param('eventId') eventId: string, @Body() body: EventInput) {
    return this.events.adminUpdate(eventId, body);
  }

  @UseGuards(AdminGuard)
  @Delete('admin/events/:eventId')
  adminDelete(@Param('eventId') eventId: string) {
    return this.events.adminDelete(eventId);
  }
}
