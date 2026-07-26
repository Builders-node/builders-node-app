import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SubmitProofDto } from './dto';
import { ResidencyService } from './residency.service';

@Controller('users/:userId/residency')
@UseGuards(JwtAuthGuard)
export class ResidencyController {
  constructor(private readonly residency: ResidencyService) {}

  @Get()
  getResidency(@Param('userId') userId: string) {
    return this.residency.getResidency(userId);
  }

  @Post('proof')
  submitProof(@Param('userId') userId: string, @Body() dto: SubmitProofDto) {
    return this.residency.submitProof(userId, dto);
  }

  @Get('proof')
  getProof(@Param('userId') userId: string) {
    return this.residency.getProof(userId);
  }
}
