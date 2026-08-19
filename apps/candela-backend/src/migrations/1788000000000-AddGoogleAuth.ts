import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGoogleAuth1788000000000 implements MigrationInterface {
  name = 'AddGoogleAuth1788000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE users ALTER COLUMN phone DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN google_id varchar(64)`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX idx_users_google_id ON users (google_id) WHERE google_id IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_google_id`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS google_id`);
    await queryRunner.query(`UPDATE users SET phone = '' WHERE phone IS NULL`);
    await queryRunner.query(`UPDATE users SET password_hash = '' WHERE password_hash IS NULL`);
    await queryRunner.query(`ALTER TABLE users ALTER COLUMN phone SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL`);
  }
}
