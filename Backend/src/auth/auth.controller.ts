import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ChangePasswordDto, GoogleLoginDto, LoginDto, PasswordResetDto, PasswordResetRequestDto, SignUpDto } from './dto';

// Credential endpoints are the prime brute-force / abuse target, so they get a
// much tighter limit than the global default (120/min).
const STRICT = { default: { limit: 8, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Throttle(STRICT)
  @Post('signup')
  signUp(@Body() dto: SignUpDto) {
    return this.auth.signUp(dto);
  }

  @Throttle(STRICT)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Throttle(STRICT)
  @Post('google')
  googleLogin(@Body() dto: GoogleLoginDto) {
    return this.auth.googleLogin(dto);
  }

  @Post('verify-email/:token')
  verifyEmail(@Param('token') token: string) {
    return this.auth.verifyEmail(token);
  }

  @Throttle(STRICT)
  @Post('password-reset')
  requestPasswordReset(@Body() dto: PasswordResetRequestDto) {
    return this.auth.requestPasswordReset(dto);
  }

  @Throttle(STRICT)
  @Post('password-reset/confirm')
  resetPassword(@Body() dto: PasswordResetDto) {
    return this.auth.resetPassword(dto);
  }

  // Must be authenticated; the account to change is taken from the token, never
  // from the request body (previously any actor could target any userId).
  @Throttle(STRICT)
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(@Req() req: Request & { user?: { sub: string } }, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(req.user!.sub, dto);
  }
}
