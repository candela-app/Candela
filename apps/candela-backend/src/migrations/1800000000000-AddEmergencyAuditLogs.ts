import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Append-only audit trail for Super Admin emergency-sensitive operations.
 * Does not alter patient ownership, trials, or profile completion data.
 */
export class AddEmergencyAuditLogs1800000000000 implements MigrationInterface {
  name = 'AddEmergencyAuditLogs1800000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS emergency_audit_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_user_id uuid NOT NULL,
        actor_role varchar(32) NOT NULL,
        organization_id uuid NULL,
        resource_type varchar(64) NOT NULL,
        resource_id varchar(128) NULL,
        action varchar(96) NOT NULL,
        reason text NOT NULL,
        outcome varchar(32) NOT NULL,
        correlation_id varchar(64) NULL,
        error_message text NULL,
        before_json jsonb NULL,
        after_json jsonb NULL,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_emergency_audit_actor_created
        ON emergency_audit_logs (actor_user_id, created_at)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_emergency_audit_org_created
        ON emergency_audit_logs (organization_id, created_at)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_emergency_audit_action_created
        ON emergency_audit_logs (action, created_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_emergency_audit_action_created`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_emergency_audit_org_created`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_emergency_audit_actor_created`);
    await queryRunner.query(`DROP TABLE IF EXISTS emergency_audit_logs`);
  }
}
