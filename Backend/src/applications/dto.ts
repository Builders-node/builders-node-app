import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

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

export class ConfirmApplicationDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}
