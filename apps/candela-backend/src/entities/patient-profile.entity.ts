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

  @OneToMany(() => Prescription, (prescription) => prescription.patient)
  prescriptions: Prescription[];
}
