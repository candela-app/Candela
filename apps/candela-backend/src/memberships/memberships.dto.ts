import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class InviteDoctorDto {
  @IsUUID()
  doctorId: string;
}

export class SetPrimaryOrganizationDto {
  @IsUUID()
  organizationId: string;
}

export class UpdateMembershipStatusDto {
  @IsIn(['suspended', 'ended', 'active'])
  status: 'suspended' | 'ended' | 'active';

  @IsOptional()
  @IsString()
  @MinLength(1)
  reason?: string;
}
