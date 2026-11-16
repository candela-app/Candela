import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { UserRole } from './user.entity';

/**
 * Append-only Super Admin emergency-access audit trail.
 * No application update/delete APIs — records are insert-only.
 */
@Entity('emergency_audit_logs')
@Index('idx_emergency_audit_actor_created', ['actorUserId', 'createdAt'])
@Index('idx_emergency_audit_org_created', ['organizationId', 'createdAt'])
@Index('idx_emergency_audit_action_created', ['action', 'createdAt'])
export class EmergencyAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'actor_user_id', type: 'uuid' })
  actorUserId: string;

  @Column({ name: 'actor_role', type: 'varchar', length: 32 })
  actorRole: UserRole;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId: string | null;

  @Column({ name: 'resource_type', type: 'varchar', length: 64 })
  resourceType: string;

  @Column({ name: 'resource_id', type: 'varchar', length: 128, nullable: true })
  resourceId: string | null;

  @Column({ type: 'varchar', length: 96 })
  action: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'varchar', length: 32 })
  outcome: 'success' | 'failure';

  @Column({ name: 'correlation_id', type: 'varchar', length: 64, nullable: true })
  correlationId: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  /** Sanitised before/after snapshots — never secrets or clinical payloads. */
  @Column({ name: 'before_json', type: 'jsonb', nullable: true })
  beforeJson: Record<string, unknown> | null;

  @Column({ name: 'after_json', type: 'jsonb', nullable: true })
  afterJson: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
