import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

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
