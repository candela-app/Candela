import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PatientProfile } from './patient-profile.entity';

@Entity('game_sessions')
@Index('uq_game_sessions_patient_event', ['patientId', 'clientEventId'], { unique: true })
@Index('uq_game_sessions_patient_number', ['patientId', 'sessionNumber'], { unique: true })
@Index('idx_game_sessions_patient_game_time', ['patientId', 'gameId', 'recordedAt'])
export class GameSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => PatientProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: PatientProfile;

  /** Sequential 1… per patient; survives doctor transfer. */
  @Column({ name: 'session_number', type: 'int' })
  sessionNumber: number;

  @Column({ name: 'client_event_id', type: 'varchar', length: 80 })
  clientEventId: string;

  @Column({ name: 'game_id', type: 'varchar', length: 64 })
  gameId: string;

  @Column({ name: 'level_id', type: 'varchar', length: 64, nullable: true })
  levelId: string | null;

  @Column({ name: 'device_tier', type: 'varchar', length: 32, nullable: true })
  deviceTier: string | null;

  @Column({ name: 'recorded_at', type: 'timestamptz' })
  recordedAt: Date;

  @Column({ name: 'duration_sec', type: 'int' })
  durationSec: number;

  @Column({ type: 'int' })
  correct: number;

  @Column({ name: 'wrong_taps', type: 'int' })
  wrongTaps: number;

  @Column({ type: 'int' })
  misses: number;

  @Column({ type: 'int' })
  timeouts: number;

  @Column({ type: 'float' })
  accuracy: number;

  @Column({ name: 'avg_reaction_sec', type: 'float' })
  avgReactionSec: number;

  @Column({ name: 'median_reaction_sec', type: 'float' })
  medianReactionSec: number;

  @Column({ name: 'efficiency_index', type: 'float' })
  efficiencyIndex: number;

  @Column({ name: 'reaction_ms', type: 'jsonb', default: [] })
  reactionMs: number[];

  @Column({ name: 'stimuli_count', type: 'int' })
  stimuliCount: number;

  @Column({ name: 'game_name', type: 'varchar', length: 160 })
  gameName: string;

  @Column({ name: 'bg_color', type: 'varchar', length: 16, nullable: true })
  bgColor: string | null;

  @Column({ name: 'stimulus_color', type: 'varchar', length: 16, nullable: true })
  stimulusColor: string | null;

  @Column({ name: 'contrast_percent', type: 'int', nullable: true })
  contrastPercent: number | null;

  @Column({ name: 'metrics_version', type: 'int', default: 1 })
  metricsVersion: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
