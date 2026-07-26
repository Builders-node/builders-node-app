import { IsString, MaxLength, MinLength } from 'class-validator';

export class SubmitProofDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MaxLength(255)
  fileType!: string;

  // Base64 (optionally a data: URL). Size is enforced in the service.
  @IsString()
  @MinLength(1)
  dataBase64!: string;
}
