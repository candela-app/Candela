import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFamiliarFaces1789000000000 implements MigrationInterface {
  name = 'AddFamiliarFaces1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE familiar_faces (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id uuid NOT NULL REFERENCES patients(user_id) ON DELETE CASCADE,
        relation_label varchar(64) NOT NULL,
        storage_path varchar(512) NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_familiar_faces_patient_id ON familiar_faces (patient_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_familiar_faces_patient_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS familiar_faces`);
  }
}
