import { IsString, MaxLength, MinLength } from 'class-validator';

export class UploadFamiliarFaceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  relationLabel: string;
}

export class UpdateFamiliarFaceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  relationLabel: string;
}
