import { Controller, Get, Param, UseGuards } from '@nestjs/common';
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
   * Public digital member pass — no auth. Keyed on the ProsperaSub external
   * member id (unguessable UUID) so a QR-code scan at a venue can render
   * the member's active perks without a login. Returns 404 if the id
   * doesn't match anyone.
   */
  @Get('public/pass/:memberId')
  getPass(@Param('memberId') memberId: string) {
    return this.home.getPass(memberId);
  }
}
