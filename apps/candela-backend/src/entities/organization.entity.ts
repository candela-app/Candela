import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DoctorOrganizationMembership } from './doctor-organization-membership.entity';
import { User } from './user.entity';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  code: string;

  @Column({ name: 'contact_email', type: 'varchar', length: 255, nullable: true })
  contactEmail: string | null;

  /** Extensible organisation type string — no fixed product catalogue in Phase 1. */
  @Column({ name: 'organization_type', type: 'varchar', length: 64, nullable: true })
  organizationType: string | null;

  @Column({ name: 'contact_phone', type: 'varchar', length: 32, nullable: true })
  contactPhone: string | null;

  @Column({ name: 'address_line1', type: 'varchar', length: 255, nullable: true })
  addressLine1: string | null;

  @Column({ name: 'address_line2', type: 'varchar', length: 255, nullable: true })
  addressLine2: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  state: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  country: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  website: string | null;

  @Column({ name: 'license_number', type: 'varchar', length: 128, nullable: true })
  licenseNumber: string | null;

  @Column({ name: 'logo_path', type: 'varchar', length: 512, nullable: true })
  logoPath: string | null;

  @Column({ name: 'identity_profile_completed_at', type: 'timestamptz', nullable: true })
  identityProfileCompletedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => User, (user) => user.organization)
  users?: User[];

  @OneToMany(() => DoctorOrganizationMembership, (membership) => membership.organization)
  doctorMemberships?: DoctorOrganizationMembership[];
}
