import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class SignUpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  fullName!: string;

  /**
   * Which of our pages sent them here — "affiliate-page" for someone who came
   * to promote us. Checked against an allowlist before it is stored.
   */
  @IsOptional()
  @IsString()
  source?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class GoogleLoginDto {
  /** The ID token (JWT credential) returned by Google Identity Services. */
  @IsString()
  credential!: string;

  /**
   * Same as SignUpDto.source. Google sign-in is a signup for anyone without an
   * account yet, and leaving it off here would lose every affiliate who used
   * the Google button.
   */
  @IsOptional()
  @IsString()
  source?: string;
}

export class PasswordResetRequestDto {
  @IsEmail()
  email!: string;
}

export class PasswordResetDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
