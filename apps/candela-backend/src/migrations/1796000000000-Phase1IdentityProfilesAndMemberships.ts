import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1 Wave 1 — schema only + membership backfill.
 * Does NOT set identity_profile_completed_at for existing users.
 * Does NOT modify patients.doctor_id, DocIDs, prescriptions, or game_sessions.
 *
 * users.organization_id is retained as a legacy/default reference; authoritative
 * multi-org authz will use doctor_organization_memberships after Wave 2 services.
 *
 * DO NOT apply until product owner approves. Prepare-only in Wave 1.
 */
export class Phase1IdentityProfilesAndMemberships1796000000000 implements MigrationInterface {
  name = 'Phase1IdentityProfilesAndMemberships1796000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Patient identity columns ---
    await queryRunner.query(`
      ALTER TABLE patients
        ADD COLUMN IF NOT EXISTS date_of_birth date,
        ADD COLUMN IF NOT EXISTS gender varchar(64),
        ADD COLUMN IF NOT EXISTS preferred_language varchar(32),
        ADD COLUMN IF NOT EXISTS city varchar(128),
        ADD COLUMN IF NOT EXISTS state varchar(128),
        ADD COLUMN IF NOT EXISTS country varchar(2),
        ADD COLUMN IF NOT EXISTS profile_photo_path varchar(512),
        ADD COLUMN IF NOT EXISTS guardian_name varchar(255),
        ADD COLUMN IF NOT EXISTS guardian_phone varchar(32),
        ADD COLUMN IF NOT EXISTS guardian_relationship varchar(64),
        ADD COLUMN IF NOT EXISTS identity_profile_completed_at timestamptz
    `);

    // --- Doctor professional profile columns ---
    await queryRunner.query(`
      ALTER TABLE doctors
        ADD COLUMN IF NOT EXISTS professional_title varchar(128),
        ADD COLUMN IF NOT EXISTS specialization varchar(255),
        ADD COLUMN IF NOT EXISTS qualifications jsonb,
        ADD COLUMN IF NOT EXISTS preferred_language varchar(32),
        ADD COLUMN IF NOT EXISTS years_experience int,
        ADD COLUMN IF NOT EXISTS external_registration_id varchar(128),
        ADD COLUMN IF NOT EXISTS profile_photo_path varchar(512),
        ADD COLUMN IF NOT EXISTS identity_profile_completed_at timestamptz
    `);

    // --- Organisation profile columns ---
    await queryRunner.query(`
      ALTER TABLE organizations
        ADD COLUMN IF NOT EXISTS organization_type varchar(64),
        ADD COLUMN IF NOT EXISTS contact_phone varchar(32),
        ADD COLUMN IF NOT EXISTS address_line1 varchar(255),
        ADD COLUMN IF NOT EXISTS address_line2 varchar(255),
        ADD COLUMN IF NOT EXISTS city varchar(128),
        ADD COLUMN IF NOT EXISTS state varchar(128),
        ADD COLUMN IF NOT EXISTS country varchar(2),
        ADD COLUMN IF NOT EXISTS website varchar(512),
        ADD COLUMN IF NOT EXISTS license_number varchar(128),
        ADD COLUMN IF NOT EXISTS logo_path varchar(512),
        ADD COLUMN IF NOT EXISTS identity_profile_completed_at timestamptz
    `);

    // --- Password token purpose (patient_invitation vs password_reset) ---
    await queryRunner.query(`
      ALTER TABLE password_reset_tokens
        ADD COLUMN IF NOT EXISTS purpose varchar(32) NOT NULL DEFAULT 'password_reset'
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_purpose
        ON password_reset_tokens (user_id, purpose)
        WHERE used_at IS NULL
    `);

    // --- Doctor ↔ organisation memberships ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS doctor_organization_memberships (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        doctor_id uuid NOT NULL REFERENCES doctors(user_id) ON DELETE CASCADE,
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        membership_status varchar(16) NOT NULL,
        is_primary boolean NOT NULL DEFAULT false,
        joined_at timestamptz NOT NULL DEFAULT now(),
        ended_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_dom_status CHECK (membership_status IN ('active', 'suspended', 'ended')),
        CONSTRAINT chk_dom_ended_at CHECK (
          (membership_status = 'ended' AND ended_at IS NOT NULL)
          OR (membership_status <> 'ended')
        )
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_dom_active_doctor_org
        ON doctor_organization_memberships (doctor_id, organization_id)
        WHERE membership_status = 'active'
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_dom_one_primary_per_doctor
        ON doctor_organization_memberships (doctor_id)
        WHERE is_primary = true AND membership_status = 'active'
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_dom_doctor_status
        ON doctor_organization_memberships (doctor_id, membership_status)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_dom_org_status
        ON doctor_organization_memberships (organization_id, membership_status)
    `);

    // --- Doctor organisation invitations ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS doctor_organization_invitations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        doctor_id uuid NOT NULL REFERENCES doctors(user_id) ON DELETE CASCADE,
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        invited_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        token_hash varchar(64) NOT NULL UNIQUE,
        status varchar(16) NOT NULL,
        expires_at timestamptz NOT NULL,
        resolved_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_doi_status CHECK (
          status IN ('pending', 'accepted', 'declined', 'expired', 'revoked')
        )
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_doi_pending_doctor_org
        ON doctor_organization_invitations (doctor_id, organization_id)
        WHERE status = 'pending'
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_doi_doctor_status
        ON doctor_organization_invitations (doctor_id, status)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_doi_org_status
        ON doctor_organization_invitations (organization_id, status)
    `);

    // --- Recreate indexes dropped in AddLevelsToPrescription (if still missing) ---
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_patients_doctor_id ON patients (doctor_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens (user_id)
    `);

    // --- Backfill: one active primary membership per doctor with users.organization_id ---
    // Preserves DocIDs and does not touch patients / prescriptions / sessions.
    await queryRunner.query(`
      INSERT INTO doctor_organization_memberships (
        doctor_id,
        organization_id,
        membership_status,
        is_primary,
        joined_at,
        ended_at,
        created_at,
        updated_at
      )
      SELECT
        d.user_id,
        u.organization_id,
        'active',
        true,
        COALESCE(u.created_at, now()),
        NULL,
        now(),
        now()
      FROM doctors d
      INNER JOIN users u ON u.id = d.user_id
      WHERE u.organization_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM doctor_organization_memberships m
          WHERE m.doctor_id = d.user_id
            AND m.organization_id = u.organization_id
            AND m.membership_status = 'active'
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop new tables first (FKs to doctors/organizations).
    await queryRunner.query(`DROP TABLE IF EXISTS doctor_organization_invitations`);
    await queryRunner.query(`DROP TABLE IF EXISTS doctor_organization_memberships`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_password_reset_tokens_user_purpose`);
    await queryRunner.query(`
      ALTER TABLE password_reset_tokens DROP COLUMN IF EXISTS purpose
    `);

    await queryRunner.query(`
      ALTER TABLE organizations
        DROP COLUMN IF EXISTS organization_type,
        DROP COLUMN IF EXISTS contact_phone,
        DROP COLUMN IF EXISTS address_line1,
        DROP COLUMN IF EXISTS address_line2,
        DROP COLUMN IF EXISTS city,
        DROP COLUMN IF EXISTS state,
        DROP COLUMN IF EXISTS country,
        DROP COLUMN IF EXISTS website,
        DROP COLUMN IF EXISTS license_number,
        DROP COLUMN IF EXISTS logo_path,
        DROP COLUMN IF EXISTS identity_profile_completed_at
    `);

    await queryRunner.query(`
      ALTER TABLE doctors
        DROP COLUMN IF EXISTS professional_title,
        DROP COLUMN IF EXISTS specialization,
        DROP COLUMN IF EXISTS qualifications,
        DROP COLUMN IF EXISTS preferred_language,
        DROP COLUMN IF EXISTS years_experience,
        DROP COLUMN IF EXISTS external_registration_id,
        DROP COLUMN IF EXISTS profile_photo_path,
        DROP COLUMN IF EXISTS identity_profile_completed_at
    `);

    await queryRunner.query(`
      ALTER TABLE patients
        DROP COLUMN IF EXISTS date_of_birth,
        DROP COLUMN IF EXISTS gender,
        DROP COLUMN IF EXISTS preferred_language,
        DROP COLUMN IF EXISTS city,
        DROP COLUMN IF EXISTS state,
        DROP COLUMN IF EXISTS country,
        DROP COLUMN IF EXISTS profile_photo_path,
        DROP COLUMN IF EXISTS guardian_name,
        DROP COLUMN IF EXISTS guardian_phone,
        DROP COLUMN IF EXISTS guardian_relationship,
        DROP COLUMN IF EXISTS identity_profile_completed_at
    `);

    // Leave idx_patients_doctor_id / idx_refresh_tokens_user_id in place on down —
    // they restore earlier accidental drops and are safe to keep.
  }
}
