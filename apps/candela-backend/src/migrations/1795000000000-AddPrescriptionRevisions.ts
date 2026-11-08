import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Additive assignment history. Existing game_sessions rows are not stamped.
 * The partial unique index allows one open revision per patient.
 */
export class AddPrescriptionRevisions1795000000000 implements MigrationInterface {
  name = 'AddPrescriptionRevisions1795000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE prescription_revisions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id uuid NOT NULL REFERENCES patients(user_id) ON DELETE CASCADE,
        actor_doctor_id uuid REFERENCES doctors(user_id) ON DELETE SET NULL,
        effective_from timestamptz NOT NULL,
        effective_to timestamptz,
        assignments jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT prescription_revisions_window_check CHECK (effective_to IS NULL OR effective_to > effective_from)
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_prescription_revisions_one_open
      ON prescription_revisions (patient_id)
      WHERE effective_to IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX idx_prescription_revisions_patient_from
      ON prescription_revisions (patient_id, effective_from)
    `);
    await queryRunner.query(`
      ALTER TABLE game_sessions
      ADD COLUMN prescription_revision_id uuid REFERENCES prescription_revisions(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      INSERT INTO prescription_revisions (patient_id, actor_doctor_id, effective_from, effective_to, assignments)
      SELECT
        patient.user_id,
        patient.doctor_id,
        now(),
        NULL,
        (
          SELECT jsonb_agg(jsonb_build_object('moduleId', prescription.module_id, 'levels', prescription.levels) ORDER BY prescription.module_id)
          FROM prescriptions prescription
          WHERE prescription.patient_id = patient.user_id
        )
      FROM patients patient
      WHERE EXISTS (
        SELECT 1 FROM prescriptions prescription WHERE prescription.patient_id = patient.user_id
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE game_sessions DROP COLUMN IF EXISTS prescription_revision_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS prescription_revisions`);
  }
}
