import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DoctorProfile } from './doctor-profile.entity';
import { PatientProfile } from './patient-profile.entity';
import { User } from './user.entity';

export type DocIdRequestSource = 'self' | 'change' | 'internal';
export type DocIdRequestStatus = 'pending' | 'accepted' | 'rejected';

@Entity('docid_requests')
export class DocIdRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => PatientProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: PatientProfile;

  @Column({ name: 'from_doctor_id', type: 'uuid', nullable: true })
  fromDoctorId: string | null;

  @ManyToOne(() => DoctorProfile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'from_doctor_id' })
  fromDoctor: DoctorProfile | null;

  @Column({ name: 'from_referral_code', type: 'varchar', length: 6, nullable: true })
  fromReferralCode: string | null;

  @Column({ name: 'to_doctor_id', type: 'uuid' })
  toDoctorId: string;

  @ManyToOne(() => DoctorProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'to_doctor_id' })
  toDoctor: DoctorProfile;

  @Column({ type: 'varchar', length: 16 })
  source: DocIdRequestSource;

  @Column({ type: 'varchar', length: 16 })
  status: DocIdRequestStatus;

  @Column({ name: 'token_hash', type: 'varchar', length: 64, unique: true })
  tokenHash: string;

  @Column({ name: 'recipient_user_id', type: 'uuid' })
  recipientUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipient_user_id' })
  recipient: User;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
