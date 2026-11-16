import { IsEmail, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';
import { IsE164Phone } from '../common/is-e164.decorator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class SignupDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsE164Phone()
  phone: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

export class CreateAccountDto extends SignupDto {}

/** Doctor-created patient — no password; activation via invitation email. */
export class CreatePatientDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsE164Phone()
  phone: string;

  @IsEmail()
  email: string;
}

export class AcceptPatientInvitationDto {
  @IsString()
  @MinLength(20)
  token: string;

  @IsString()
  @MinLength(8)
  password: string;
}

/** H2 Option C — explicit accept after Google auth (uses server-issued challenge). */
export class AcceptGooglePatientInvitationDto {
  @IsString()
  @MinLength(20)
  acceptanceToken: string;
}

export class UpdateDoctorDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsE164Phone()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}

export class AddPrescriptionDto {
  @IsString()
  moduleId: string;

  @IsOptional()
  @IsString({ each: true })
  levels?: string[];
}

export class RefreshDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(20)
  token: string;

  @IsString()
  @MinLength(8)
  password: string;
}

export class GoogleAuthDto {
  @ValidateIf((dto: GoogleAuthDto) => !dto.accessToken)
  @IsString()
  @MinLength(10)
  idToken?: string;

  @ValidateIf((dto: GoogleAuthDto) => !dto.idToken)
  @IsString()
  @MinLength(10)
  accessToken?: string;
}

export class UpdateProfileDto {
  @IsString()
  @MinLength(1)
  name: string;
}

export class CreateOrganizationDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(2)
  code: string;

  @IsEmail()
  contactEmail: string;

  @IsString()
  @MinLength(1)
  adminName: string;

  @IsString()
  @MinLength(8)
  adminPassword: string;

  @IsOptional()
  @IsE164Phone()
  adminPhone?: string;
}


