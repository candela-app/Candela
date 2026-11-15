import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { IsE164Phone } from '../common/is-e164.decorator';
import { IsHttpsUrl } from '../common/is-https-url.decorator';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const COUNTRY = /^[A-Za-z]{2}$/;

export class PatchMeProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsE164Phone()
  phone?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @Matches(ISO_DATE)
  dateOfBirth?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(64)
  gender?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(32)
  preferredLanguage?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(128)
  city?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(128)
  state?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(COUNTRY)
  country?: string | null;

  /** Rejected by service — uploads are server-assigned only. */
  @IsOptional()
  profilePhotoPath?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(255)
  guardianName?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsE164Phone()
  guardianPhone?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(64)
  guardianRelationship?: string | null;

  // Doctor-only fields (ignored for patients)
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(128)
  professionalTitle?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(255)
  specialization?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  qualifications?: string[] | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(80)
  yearsExperience?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(128)
  externalRegistrationId?: string | null;

  // Organisation fields (hospital admin using /api/me/profile)
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsEmail()
  contactEmail?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(64)
  organizationType?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsE164Phone()
  contactPhone?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(255)
  addressLine1?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(255)
  addressLine2?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsHttpsUrl()
  website?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(128)
  licenseNumber?: string | null;

  /** Rejected by service — uploads are server-assigned only. */
  @IsOptional()
  logoPath?: string | null;
}

export class PatchOrganizationProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsEmail()
  contactEmail?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(64)
  organizationType?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsE164Phone()
  contactPhone?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(255)
  addressLine1?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(255)
  addressLine2?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(128)
  city?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(128)
  state?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(COUNTRY)
  country?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsHttpsUrl()
  website?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(128)
  licenseNumber?: string | null;

  /** Rejected by service — uploads are server-assigned only. */
  @IsOptional()
  logoPath?: string | null;
}
