import { IsEmail, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

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

  @IsString()
  @MinLength(6)
  phone: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

export class CreateAccountDto extends SignupDto {}

export class UpdateDoctorDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
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
