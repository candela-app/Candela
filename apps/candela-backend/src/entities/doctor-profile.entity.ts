import { Column, Entity, JoinColumn, OneToMany, OneToOne, PrimaryColumn } from 'typeorm';
import { PatientProfile } from './patient-profile.entity';
import { User } from './user.entity';

@Entity('doctors')
export class DoctorProfile {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @OneToOne(() => User, (user) => user.doctorProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'referral_code', type: 'varchar', length: 6, unique: true })
  referralCode: string;

  @OneToMany(() => PatientProfile, (patient) => patient.doctor)
  patients: PatientProfile[];
}
