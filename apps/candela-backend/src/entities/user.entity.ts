import {
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DoctorProfile } from './doctor-profile.entity';
import { PatientProfile } from './patient-profile.entity';

export type UserRole = 'admin' | 'doctor' | 'patient';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 32 })
  phone: string;

  @Column({ type: 'varchar', length: 16 })
  role: UserRole;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToOne(() => DoctorProfile, (profile) => profile.user)
  doctorProfile?: DoctorProfile;

  @OneToOne(() => PatientProfile, (profile) => profile.user)
  patientProfile?: PatientProfile;
}
