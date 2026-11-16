import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Patient owning organisation — authoritative `patients.organization_id`.
 *
 * Architecture (independent):
 * 1) patients.organization_id — owning organisation
 * 2) patients.doctor_id — assigned doctor
 * 3) doctor_organization_memberships — doctor memberships
 *
 * Backfill is conservative: never uses the doctor's current primary among
 * multiple active memberships. Ambiguous rows stay NULL for manual review.
 *
 * Also adds:
 * - docid_requests.target_organization_id (explicit association / transfer target)
 * - patient_docid_history.organization_id (nullable; new rows only — no invented backfill)
 */
export class AddPatientOrganizationId1797000000000 implements MigrationInterface {
  name = 'AddPatientOrganizationId1797000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE patients
        ADD COLUMN IF NOT EXISTS organization_id uuid NULL
          REFERENCES organizations(id) ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_patients_organization_id
        ON patients (organization_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_patients_org_doctor
        ON patients (organization_id, doctor_id)
    `);

    await queryRunner.query(`
      ALTER TABLE docid_requests
        ADD COLUMN IF NOT EXISTS target_organization_id uuid NULL
          REFERENCES organizations(id) ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_docid_requests_target_organization_id
        ON docid_requests (target_organization_id)
    `);

    await queryRunner.query(`
      ALTER TABLE patient_docid_history
        ADD COLUMN IF NOT EXISTS organization_id uuid NULL
          REFERENCES organizations(id) ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_patient_docid_history_organization_id
        ON patient_docid_history (organization_id)
    `);

    // --- Conservative backfill (same rules as dry-run) ---
    await queryRunner.query(`
      WITH sole AS (
        SELECT
          doctor_id,
          MIN(organization_id::text)::uuid AS organization_id
        FROM doctor_organization_memberships
        WHERE membership_status = 'active'
        GROUP BY doctor_id
        HAVING COUNT(*) = 1
      )
      UPDATE patients p
      SET organization_id = s.organization_id
      FROM sole s
      JOIN users u ON u.id = s.doctor_id
      WHERE p.doctor_id = s.doctor_id
        AND p.organization_id IS NULL
        AND (u.organization_id IS NULL OR u.organization_id = s.organization_id)
    `);

    await queryRunner.query(`
      UPDATE patients p
      SET organization_id = u.organization_id
      FROM users u
      WHERE p.doctor_id = u.id
        AND p.organization_id IS NULL
        AND u.organization_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM organizations o WHERE o.id = u.organization_id)
        AND NOT EXISTS (
          SELECT 1
          FROM doctor_organization_memberships m
          WHERE m.doctor_id = p.doctor_id
            AND m.membership_status = 'active'
        )
    `);

    // Unassigned / multi-org / conflicts: leave organization_id NULL.
    // Historical patient_docid_history.organization_id left NULL (do not invent).
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_patient_docid_history_organization_id`);
    await queryRunner.query(`
      ALTER TABLE patient_docid_history
        DROP COLUMN IF EXISTS organization_id
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_docid_requests_target_organization_id`);
    await queryRunner.query(`
      ALTER TABLE docid_requests
        DROP COLUMN IF EXISTS target_organization_id
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_patients_org_doctor`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_patients_organization_id`);
    await queryRunner.query(`
      ALTER TABLE patients
        DROP COLUMN IF EXISTS organization_id
    `);
  }
}
