import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { HomeService } from './home.service';

@Controller()
export class HomeController {
  constructor(private readonly home: HomeService) {}

  @UseGuards(JwtAuthGuard)
  @Get('users/:userId/home')
  getHome(@Param('userId') userId: string) {
    return this.home.getHome(userId);
  }

  /**
   * Public member pass — no auth, resolved from the opaque QR token so staff
   * can scan with a plain phone camera. Always 200: an unknown or revoked
   * token comes back as { valid: false } rather than a 404, so the endpoint
   * can't be used to probe which tokens exist.
   */
  @Get('public/pass/:token')
  getPass(@Param('token') token: string) {
    return this.home.getPassByToken(token);
  }

  /** The member's own pass — mints the token on first call. */
  @UseGuards(JwtAuthGuard)
  @Get('users/:userId/pass')
  getMyPass(@Param('userId') userId: string) {
    return this.home.getMyPass(userId);
  }

  /** Issue a fresh token (lost phone) — the previous QR stops working. */
  @UseGuards(JwtAuthGuard)
  @Post('users/:userId/pass/rotate')
  rotatePass(@Param('userId') userId: string) {
    return this.home.rotatePass(userId);
  }

  /**
   * Available cleaning time slots for the current global cleaning package.
   * Read from ProsperaSub's cleaning_packages.time_slots; falls back to a
   * sensible default set so the "Book a cleaning slot" modal never breaks.
   * Public because the modal is member-facing and does not need auth to
   * discover slot options.
   */
  @Get('public/cleaning-slots')
  getCleaningSlots() {
    return this.home.getCleaningSlots();
  }

  /** The member's standing weekly cleaning slot, plus the slots on offer. */
  @UseGuards(JwtAuthGuard)
  @Get('users/:userId/cleaning')
  getMyCleaning(@Param('userId') userId: string) {
    return this.home.getMyCleaning(userId);
  }

  /**
   * Set or move the weekly slot. PUT, not POST: there is exactly one slot per
   * member and booking again replaces it — it isn't a queue of requests.
   */
  @UseGuards(JwtAuthGuard)
  @Put('users/:userId/cleaning')
  setMyCleaning(
    @Param('userId') userId: string,
    @Body() body: { weekday?: unknown; timeSlot?: unknown; memberNote?: unknown },
  ) {
    return this.home.setMyCleaning(userId, body);
  }
}
