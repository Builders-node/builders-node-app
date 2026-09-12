import { IsArray, IsEmail, IsOptional, IsString } from 'class-validator';

/**
 * The affiliate application form.
 *
 * Shorter than the member one on purpose. We are not deciding whether someone
 * can live here — only whether their audience is real and the way they would
 * talk about Builders Node is one we want our name attached to. Everything
 * beyond that can be asked in the reply.
 */
export class AffiliateApplyDto {
  @IsString()
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  telegram?: string;

  @IsOptional()
  @IsString()
  country?: string;

  /** Where they'd promote — "YouTube, startup interviews". */
  @IsOptional()
  @IsString()
  audience?: string;

  /** Their reach, in their own words. */
  @IsOptional()
  @IsString()
  audienceSize?: string;

  /** Channel URLs. Mapped onto labelled links by hostname, as profiles are. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  links?: string[];

  @IsOptional()
  @IsString()
  about?: string;

  /** The `?src=` code of the marketing link they arrived through, if any. */
  @IsOptional()
  @IsString()
  campaignCode?: string;
}

/** An admin's decision on one application. */
export class ReviewAffiliateDto {
  @IsOptional()
  @IsString()
  adminNote?: string;
}
