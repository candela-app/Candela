import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DoctorProfile } from './doctor-profile.entity';
import { PatientProfile } from './patient-profile.entity';
import { Organization } from './organization.entity';

export type UserRole = 'super_admin' | 'admin' | 'doctor' | 'patient';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId: string | null;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
  passwordHash: string | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone: string | null;

  @Column({ name: 'google_id', type: 'varchar', length: 64, nullable: true, unique: true })
  googleId: string | null;

  @Column({ type: 'varchar', length: 16 })
  role: UserRole;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Organization, (org) => org.users, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'organization_id' })
  organization?: Organization;

  @OneToOne(() => DoctorProfile, (profile) => profile.user)
  doctorProfile?: DoctorProfile;

  @OneToOne(() => PatientProfile, (profile) => profile.user)
  patientProfile?: PatientProfile;
}

