import { IsEmail, IsOptional, IsString } from 'class-validator';

export class ApplyDto {
  @IsString()
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  referralCode?: string;
}

export class SendCredentialsDto {
  @IsEmail()
  email!: string;
}
