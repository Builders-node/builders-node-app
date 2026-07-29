import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../admin/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VehiclesService } from './vehicles.service';

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

  @UseGuards(JwtAuthGuard)
  @Get('vehicles/:id/photo')
  photo(@Param('id') id: string) {
    return this.vehicles.getVehiclePhoto(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('users/:userId/vehicle-bookings')
  myBookings(@Param('userId') userId: string) {
    return this.vehicles.listMyBookings(userId);
  }

  @UseGuards(JwtAuthGuard)
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
