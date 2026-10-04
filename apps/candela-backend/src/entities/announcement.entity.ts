import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AnnouncementPriority = 'info' | 'warning' | 'critical';
export type AnnouncementTargetType =
  | 'all'
  | 'homepage'
  | 'all_hospitals'
  | 'all_doctors'
  | 'all_patients'
  | 'selected_hospitals'
  | 'selected_users';

@Entity('announcements')
export class Announcement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({
    type: 'varchar',
    length: 32,
    default: 'info',
  })
  priority!: AnnouncementPriority;

  @Column({
    name: 'target_type',
    type: 'varchar',
    length: 32,
    default: 'all',
  })
  targetType!: AnnouncementTargetType;

  @Column({
    name: 'target_hospital_ids',
    type: 'text',
    nullable: true,
  })
  targetHospitalIds!: string | null;

  @Column({
    name: 'target_user_ids',
    type: 'text',
    nullable: true,
  })
  targetUserIds!: string | null;

  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
  })
  isActive!: boolean;

  @Column({
    name: 'created_by_user_id',
    type: 'uuid',
    nullable: true,
  })
  createdByUserId!: string | null;

  @Column({
    name: 'expires_at',
    type: 'timestamptz',
    nullable: true,
  })
  expiresAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
