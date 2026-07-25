import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApartmentsService } from './apartments.service';

@Controller()
export class ApartmentsController {
  constructor(private readonly apartments: ApartmentsService) {}

  @Get('apartments')
  listAvailable() {
    return this.apartments.listAvailable();
  }

  @Get('users/:userId/rental')
  @UseGuards(JwtAuthGuard)
  currentRentalStatus(@Param('userId') userId: string) {
    return this.apartments.currentRentalStatus(userId);
  }

  @Post('users/:userId/rental-requests')
  @UseGuards(JwtAuthGuard)
  requestRental(
    @Param('userId') userId: string,
    @Body() body: { apartmentId: string; message?: string },
  ) {
    return this.apartments.requestRental(userId, body.apartmentId, body.message);
  }
}
