import { Body, Controller, Param, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ChangePasswordDto, GoogleLoginDto, LoginDto, PasswordResetDto, PasswordResetRequestDto, SignUpDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('signup')
  signUp(@Body() dto: SignUpDto) {
    return this.auth.signUp(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('google')
  googleLogin(@Body() dto: GoogleLoginDto) {
    return this.auth.googleLogin(dto);
  }

  @Post('verify-email/:token')
  verifyEmail(@Param('token') token: string) {
    return this.auth.verifyEmail(token);
  }

  @Post('password-reset')
  requestPasswordReset(@Body() dto: PasswordResetRequestDto) {
    return this.auth.requestPasswordReset(dto);
  }

  @Post('password-reset/confirm')
  resetPassword(@Body() dto: PasswordResetDto) {
    return this.auth.resetPassword(dto);
  }

  @Post('change-password')
  changePassword(@Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(dto);
  }
}
