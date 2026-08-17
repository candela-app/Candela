import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDocIdRequestsAndHistory1787000000001 implements MigrationInterface {
  name = 'AddDocIdRequestsAndHistory1787000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE docid_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id uuid NOT NULL REFERENCES patients(user_id) ON DELETE CASCADE,
        from_doctor_id uuid REFERENCES doctors(user_id) ON DELETE SET NULL,
        from_referral_code varchar(6),
        to_doctor_id uuid NOT NULL REFERENCES doctors(user_id) ON DELETE CASCADE,
        source varchar(16) NOT NULL,
        status varchar(16) NOT NULL,
        token_hash varchar(64) NOT NULL UNIQUE,
        recipient_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at timestamptz NOT NULL,
        resolved_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_docid_requests_patient_status ON docid_requests (patient_id, status)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_docid_requests_recipient_status ON docid_requests (recipient_user_id, status)`,
    );
    await queryRunner.query(`
      CREATE TABLE patient_docid_history (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id uuid NOT NULL REFERENCES patients(user_id) ON DELETE CASCADE,
        referral_code varchar(6) NOT NULL,
        doctor_id uuid REFERENCES doctors(user_id) ON DELETE SET NULL,
        source varchar(16) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_patient_docid_history_patient ON patient_docid_history (patient_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_patient_docid_history_code ON patient_docid_history (referral_code)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS patient_docid_history`);
    await queryRunner.query(`DROP TABLE IF EXISTS docid_requests`);
  }
}
