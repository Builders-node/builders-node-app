import { IsEmail, IsOptional, IsString } from 'class-validator';

/**
 * Asking for the guide. One required field on purpose.
 *
 * This is the cheapest thing anybody does on that landing — they are giving an
 * address to read something, not asking to be reviewed. Every extra required
 * box here is somebody deciding it isn't worth it.
 */
export class GuideRequestDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  name?: string;

  /** Which site asked — "main" or "ca". Also picks the guide the email opens. */
  @IsOptional()
  @IsString()
  source?: string;

  /** The `?src=` marketing link they arrived through, if any. */
  @IsOptional()
  @IsString()
  campaignCode?: string;
}
