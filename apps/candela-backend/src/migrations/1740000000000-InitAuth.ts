import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitAuth1740000000000 implements MigrationInterface {
  name = 'InitAuth1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await queryRunner.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email varchar(255) NOT NULL UNIQUE,
        password_hash varchar(255) NOT NULL,
        name varchar(255) NOT NULL,
        phone varchar(32) NOT NULL,
        role varchar(16) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE doctors (
        user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        referral_code varchar(6) NOT NULL UNIQUE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE patients (
        user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        doctor_id uuid REFERENCES doctors(user_id) ON DELETE SET NULL,
        origin varchar(32) NOT NULL
      )
    `);
    await queryRunner.query(`
      CREATE TABLE prescriptions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id uuid NOT NULL REFERENCES patients(user_id) ON DELETE CASCADE,
        module_id varchar(64) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (patient_id, module_id)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE refresh_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash varchar(64) NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_patients_doctor_id ON patients (doctor_id)`);
    await queryRunner.query(`CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS refresh_tokens`);
    await queryRunner.query(`DROP TABLE IF EXISTS prescriptions`);
    await queryRunner.query(`DROP TABLE IF EXISTS patients`);
    await queryRunner.query(`DROP TABLE IF EXISTS doctors`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
  }
}
