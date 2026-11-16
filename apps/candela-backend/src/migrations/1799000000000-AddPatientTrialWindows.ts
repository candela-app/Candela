import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seven-day patient trial foundation.
 * Trial starts at first successful login (application code), not at signup/invite.
 * Does not backfill existing patients — leave null until next login.
 */
export class AddPatientTrialWindows1799000000000 implements MigrationInterface {
  name = 'AddPatientTrialWindows1799000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE patients
        ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
        ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_patients_trial_ends_at
        ON patients (trial_ends_at)
        WHERE trial_ends_at IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_patients_trial_ends_at`);
    await queryRunner.query(`
      ALTER TABLE patients
        DROP COLUMN IF EXISTS trial_started_at,
        DROP COLUMN IF EXISTS trial_ends_at
    `);
  }
}
