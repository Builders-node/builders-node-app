import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SupportService } from './support.service';

@Controller('users/:userId/support')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get('tickets')
  listTickets(@Param('userId') userId: string) {
    return this.support.listTickets(userId);
  }

  @Post('tickets')
  createTicket(
    @Param('userId') userId: string,
    @Body() body: { subject: string; message: string },
  ) {
    return this.support.createTicket(userId, body);
  }
}
