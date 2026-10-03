import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AdminGuard } from '../admin/admin.guard';
import { ActiveMemberGuard } from '../auth/active-member.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VehiclesService } from './vehicles.service';

const SAFE_IMAGE_TYPE = /^image\/(png|jpe?g|webp|gif|avif)$/i;

type BookBody = { vehicleId?: string; startDate?: string; endDate?: string; note?: string };
type VehicleBody = { name?: string; description?: string; active?: boolean; photoFileName?: string; photoFileType?: string; photoBase64?: string };

@Controller()
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  // ── Members ────────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('vehicles')
  list() {
    return this.vehicles.listAvailable();
  }

  /**
   * The car's photo, as actual image bytes.
   *
   * Public and binary on purpose. It's rendered with a plain `<img src>`, which
   * can neither send an Authorization header nor decode a JSON envelope — the
   * old authenticated route returned `{ dataBase64 }` and so every car in the
   * picker silently fell back to a blank thumbnail. A photo of a shared
   * community car isn't sensitive; the id is a uuid, so this leaks nothing.
   */
  @Get('public/vehicles/:id/photo')
  @Header('Cache-Control', 'public, max-age=86400')
  async photo(@Param('id') id: string, @Res() res: Response) {
    const photo = await this.vehicles.getVehiclePhoto(id);
    // Served as whatever type was stored, from the API's own origin — so only
    // raster image types go out as themselves. Anything else (HTML, SVG with a
    // script in it) would run as a page on this origin; it goes out as bytes.
    res.type(SAFE_IMAGE_TYPE.test(photo.fileType) ? photo.fileType : 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(Buffer.from(photo.dataBase64, 'base64'));
  }

  @UseGuards(JwtAuthGuard)
  @Get('users/:userId/vehicle-bookings')
  myBookings(@Param('userId') userId: string) {
    return this.vehicles.listMyBookings(userId);
  }

  @UseGuards(JwtAuthGuard, ActiveMemberGuard)
  @Post('users/:userId/vehicle-bookings')
  book(@Param('userId') userId: string, @Body() body: BookBody) {
    return this.vehicles.book(userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('users/:userId/vehicle-bookings/:bookingId')
  cancelMine(@Param('userId') userId: string, @Param('bookingId') bookingId: string) {
    return this.vehicles.cancelMyBooking(userId, bookingId);
  }

  // ── Admin ──────────────────────────────────────────────────────────────────

  @UseGuards(AdminGuard)
  @Get('admin/vehicles')
  adminList() {
    return this.vehicles.adminListVehicles();
  }

  @UseGuards(AdminGuard)
  @Post('admin/vehicles')
  adminCreate(@Body() body: VehicleBody) {
    return this.vehicles.adminCreate(body);
  }

  @UseGuards(AdminGuard)
  @Patch('admin/vehicles/:id')
  adminUpdate(@Param('id') id: string, @Body() body: VehicleBody) {
    return this.vehicles.adminUpdate(id, body);
  }

  @UseGuards(AdminGuard)
  @Delete('admin/vehicles/:id')
  adminDelete(@Param('id') id: string) {
    return this.vehicles.adminDelete(id);
  }

  @UseGuards(AdminGuard)
  @Get('admin/vehicle-bookings')
  adminListBookings() {
    return this.vehicles.adminListBookings();
  }

  @UseGuards(AdminGuard)
  @Delete('admin/vehicle-bookings/:bookingId')
  adminCancel(@Param('bookingId') bookingId: string) {
    return this.vehicles.adminCancelBooking(bookingId);
  }
}
