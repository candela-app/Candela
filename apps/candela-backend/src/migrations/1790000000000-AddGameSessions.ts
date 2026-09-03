import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGameSessions1790000000000 implements MigrationInterface {
  name = 'AddGameSessions1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE game_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id uuid NOT NULL REFERENCES patients(user_id) ON DELETE CASCADE,
        session_number int NOT NULL,
        client_event_id varchar(80) NOT NULL,
        game_id varchar(64) NOT NULL,
        level_id varchar(64),
        device_tier varchar(32),
        recorded_at timestamptz NOT NULL,
        duration_sec int NOT NULL,
        correct int NOT NULL,
        wrong_taps int NOT NULL,
        misses int NOT NULL,
        timeouts int NOT NULL,
        accuracy float NOT NULL,
        avg_reaction_sec float NOT NULL,
        median_reaction_sec float NOT NULL,
        efficiency_index float NOT NULL,
        reaction_ms jsonb NOT NULL DEFAULT '[]'::jsonb,
        stimuli_count int NOT NULL,
        game_name varchar(160) NOT NULL,
        bg_color varchar(16),
        stimulus_color varchar(16),
        contrast_percent int,
        metrics_version int NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_game_sessions_patient_event ON game_sessions (patient_id, client_event_id)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_game_sessions_patient_number ON game_sessions (patient_id, session_number)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_game_sessions_patient_game_time ON game_sessions (patient_id, game_id, recorded_at)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS game_sessions`);
  }
}
