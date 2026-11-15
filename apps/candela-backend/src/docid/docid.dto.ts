import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class RequestDocIdDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Length(6, 6)
  referralCode: string;

  /**
   * Required when the patient has no owning organisation and the target doctor
   * has more than one active membership, or for patient-initiated cross-org transfer.
   * Never defaults to doctor primary.
   */
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}

/** Hospital admin internal reassignment — organisation is preserved from the patient. */
export class TransferDocIdDto {
  @IsUUID()
  patientId: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Length(6, 6)
  referralCode: string;
}

/** Super-admin cross-organisation transfer — explicit target organisation required. */
export class CrossOrganizationTransferDocIdDto {
  @IsUUID()
  patientId: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Length(6, 6)
  referralCode: string;

  @IsUUID()
  organizationId: string;
}

/** Administrative ownership repair — no primary-membership fallback. */
export class RepairPatientOrganizationDto {
  @IsUUID()
  organizationId: string;
}
