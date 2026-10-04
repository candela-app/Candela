import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAnnouncements1793000000000 implements MigrationInterface {
  name = 'AddAnnouncements1793000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        title varchar(255) NOT NULL,
        content text NOT NULL,
        priority varchar(32) NOT NULL DEFAULT 'info',
        target_type varchar(32) NOT NULL DEFAULT 'all',
        target_hospital_ids text,
        target_user_ids text,
        is_active boolean NOT NULL DEFAULT true,
        created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        expires_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_announcement_reads (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
        read_at timestamptz NOT NULL DEFAULT now(),
        dismissed_at timestamptz,
        CONSTRAINT uq_user_announcement UNIQUE (user_id, announcement_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements (is_active)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_announcements_target_type ON announcements (target_type)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_announcement_reads_user ON user_announcement_reads (user_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS user_announcement_reads`);
    await queryRunner.query(`DROP TABLE IF EXISTS announcements`);
  }
}
