import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrganizationsAndSuperAdmin1792000000000 implements MigrationInterface {
  name = 'AddOrganizationsAndSuperAdmin1792000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(255) NOT NULL,
        code varchar(64) NOT NULL UNIQUE,
        contact_email varchar(255),
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users (organization_id)
    `);

    // Promote existing admins to super_admin
    await queryRunner.query(`
      UPDATE users SET role = 'super_admin' WHERE role = 'admin'
    `);

    // Ensure Test Hospital exists
    await queryRunner.query(`
      INSERT INTO organizations (name, code, contact_email)
      VALUES ('Test Hospital', 'TEST_HOSPITAL', 'testHospital@candela.com')
      ON CONFLICT (code) DO NOTHING
    `);

    // Assign all existing doctors to Test Hospital
    await queryRunner.query(`
      UPDATE users
      SET organization_id = (SELECT id FROM organizations WHERE code = 'TEST_HOSPITAL' LIMIT 1)
      WHERE role = 'doctor' AND organization_id IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_organization_id`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS organization_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS organizations`);
  }
}
