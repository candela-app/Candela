import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { DoctorProfile } from './doctor-profile.entity';
import { PatientProfile } from './patient-profile.entity';

export interface StoredAssignment {
  moduleId: string;
  levels: string[];
}

@Entity('prescription_revisions')
@Index('uq_prescription_revisions_one_open', ['patientId'], { unique: true, where: '"effective_to" IS NULL' })
export class PrescriptionRevision {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => PatientProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: PatientProfile;

  @Column({ name: 'actor_doctor_id', type: 'uuid', nullable: true })
  actorDoctorId: string | null;

  @ManyToOne(() => DoctorProfile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_doctor_id' })
  actorDoctor: DoctorProfile | null;

  @Column({ name: 'effective_from', type: 'timestamptz' })
  effectiveFrom: Date;

  @Column({ name: 'effective_to', type: 'timestamptz', nullable: true })
  effectiveTo: Date | null;

  @Column({ type: 'jsonb' })
  assignments: StoredAssignment[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
