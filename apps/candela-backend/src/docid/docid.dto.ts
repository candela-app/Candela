import { Transform } from 'class-transformer';
import { IsString, IsUUID, Length } from 'class-validator';

export class RequestDocIdDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Length(6, 6)
  referralCode: string;
}

export class TransferDocIdDto {
  @IsUUID()
  patientId: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Length(6, 6)
  referralCode: string;
}
