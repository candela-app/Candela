import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import { DoctorProfile } from './doctor-profile.entity';
import { Organization } from './organization.entity';
import { Prescription } from './prescription.entity';
import { User } from './user.entity';

export type PatientOrigin = 'doctor_created' | 'self_signup';

@Entity('patients')
export class PatientProfile {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @OneToOne(() => User, (user) => user.patientProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /**
   * Authoritative owning organisation. Independent of patients.doctor_id and of
   * the assigned doctor's primary membership. Null until explicitly associated
   * (self-signup) or backfilled / set at doctor-create time.
   */
  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId: string | null;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization | null;

  @Column({ name: 'doctor_id', type: 'uuid', nullable: true })
  doctorId: string | null;

  @ManyToOne(() => DoctorProfile, (doctor) => doctor.patients, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'doctor_id' })
  doctor: DoctorProfile | null;

  @Column({ type: 'varchar', length: 32 })
  origin: PatientOrigin;

  /** Phase 1 identity — all nullable at DB; requiredness enforced on profile complete. */
  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  gender: string | null;

  @Column({ name: 'preferred_language', type: 'varchar', length: 32, nullable: true })
  preferredLanguage: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  state: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  country: string | null;

  @Column({ name: 'profile_photo_path', type: 'varchar', length: 512, nullable: true })
  profilePhotoPath: string | null;

  @Column({ name: 'guardian_name', type: 'varchar', length: 255, nullable: true })
  guardianName: string | null;

  @Column({ name: 'guardian_phone', type: 'varchar', length: 32, nullable: true })
  guardianPhone: string | null;

  @Column({ name: 'guardian_relationship', type: 'varchar', length: 64, nullable: true })
  guardianRelationship: string | null;

  /** Null = identity profile not marked complete. Independent of clinical / trial / DocID. */
  @Column({ name: 'identity_profile_completed_at', type: 'timestamptz', nullable: true })
  identityProfileCompletedAt: Date | null;

  /**
   * Account activation (H2). Independent of password_hash — Google-only patients
   * may activate with null password. Independent of identity_profile_completed_at.
   * Null = awaiting invitation acceptance (typical doctor_created).
   */
  @Column({ name: 'account_activated_at', type: 'timestamptz', nullable: true })
  accountActivatedAt: Date | null;

  /**
   * Product trial (independent of identity profile / activation / subscription).
   * Set once at first successful login; never reset by later logins.
   */
  @Column({ name: 'trial_started_at', type: 'timestamptz', nullable: true })
  trialStartedAt: Date | null;

  @Column({ name: 'trial_ends_at', type: 'timestamptz', nullable: true })
  trialEndsAt: Date | null;

  @OneToMany(() => Prescription, (prescription) => prescription.patient)
  prescriptions: Prescription[];
}
