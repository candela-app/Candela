import { Column, Entity, JoinColumn, OneToMany, OneToOne, PrimaryColumn } from 'typeorm';
import { DoctorOrganizationMembership } from './doctor-organization-membership.entity';
import { PatientProfile } from './patient-profile.entity';
import { User } from './user.entity';

@Entity('doctors')
export class DoctorProfile {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @OneToOne(() => User, (user) => user.doctorProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** System DocID — immutable via profile editing. */
  @Column({ name: 'referral_code', type: 'varchar', length: 6, unique: true })
  referralCode: string;

  @Column({ name: 'professional_title', type: 'varchar', length: 128, nullable: true })
  professionalTitle: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  specialization: string | null;

  /** JSON array of qualification strings, e.g. ["MBBS","MD"]. */
  @Column({ type: 'jsonb', nullable: true })
  qualifications: string[] | null;

  @Column({ name: 'preferred_language', type: 'varchar', length: 32, nullable: true })
  preferredLanguage: string | null;

  @Column({ name: 'years_experience', type: 'int', nullable: true })
  yearsExperience: number | null;

  /** Optional external professional registration — never replaces DocID. */
  @Column({ name: 'external_registration_id', type: 'varchar', length: 128, nullable: true })
  externalRegistrationId: string | null;

  @Column({ name: 'profile_photo_path', type: 'varchar', length: 512, nullable: true })
  profilePhotoPath: string | null;

  /** Null = identity profile not marked complete. */
  @Column({ name: 'identity_profile_completed_at', type: 'timestamptz', nullable: true })
  identityProfileCompletedAt: Date | null;

  @OneToMany(() => PatientProfile, (patient) => patient.doctor)
  patients: PatientProfile[];

  @OneToMany(() => DoctorOrganizationMembership, (membership) => membership.doctor)
  organizationMemberships?: DoctorOrganizationMembership[];
}
