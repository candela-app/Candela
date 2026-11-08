import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGameSessionDetail1794000000000 implements MigrationInterface {
  name = 'AddGameSessionDetail1794000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS detail jsonb`);
    await queryRunner.query(`ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS detail_version int`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE game_sessions DROP COLUMN IF EXISTS detail_version`);
    await queryRunner.query(`ALTER TABLE game_sessions DROP COLUMN IF EXISTS detail`);
  }
}
