import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * H2 Option C — account activation independent of password_hash (Google-only
 * patients may have null password). Restricted Google invitation challenges.
 *
 * Backfill: doctor-created / self-signup patients who already authenticated
 * (password or linked Google) are marked activated. Unactivated invited
 * patients (null password, null google_id) stay null — expected.
 *
 * H1 note: self_signup with doctor_id/organization_id null is legitimate;
 * this migration does not assign organisations.
 */
export class AddAccountActivationAndGoogleInviteChallenge1798000000000
  implements MigrationInterface
{
  name = 'AddAccountActivationAndGoogleInviteChallenge1798000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE patients
        ADD COLUMN IF NOT EXISTS account_activated_at timestamptz NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_patients_account_activated_at
        ON patients (account_activated_at)
    `);

    // Already usable accounts: password login and/or Google already linked.
    await queryRunner.query(`
      UPDATE patients p
      SET account_activated_at = COALESCE(u.created_at, NOW())
      FROM users u
      WHERE u.id = p.user_id
        AND p.account_activated_at IS NULL
        AND (u.password_hash IS NOT NULL OR u.google_id IS NOT NULL)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS google_invitation_challenges (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        token_hash varchar(64) NOT NULL UNIQUE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        invitation_token_id uuid NOT NULL REFERENCES password_reset_tokens(id) ON DELETE CASCADE,
        google_sub varchar(255) NOT NULL,
        google_email varchar(255) NOT NULL,
        expires_at timestamptz NOT NULL,
        used_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_gic_user_unused
        ON google_invitation_challenges (user_id)
        WHERE used_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_gic_user_unused`);
    await queryRunner.query(`DROP TABLE IF EXISTS google_invitation_challenges`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_patients_account_activated_at`);
    await queryRunner.query(`
      ALTER TABLE patients DROP COLUMN IF EXISTS account_activated_at
    `);
  }
}
