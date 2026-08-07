import { IsArray, IsEmail, IsOptional, IsString, Length, MinLength } from 'class-validator';

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

  /**
   * "Tell us about yourself", kept as its own field rather than only inside the
   * flattened `note` blob — it becomes the member's profile bio once they have
   * an account, so it has to survive as structured data.
   */
  @IsOptional()
  @IsString()
  about?: string;

  /**
   * The move-in month the applicant picked, as YYYY-MM-DD.
   *
   * The form has always asked this and flattened it into `note` as prose
   * ("Move-in: January 1, 2027"). Kept structured as well because an admin
   * schedules meal deliveries from it, and re-parsing an English date label is
   * no way to decide when someone's food starts arriving.
   */
  @IsOptional()
  @IsString()
  moveInDate?: string;

  /** The social links from the form; mapped onto profile links by hostname. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  socials?: string[];

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

export class CreateAccountDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
