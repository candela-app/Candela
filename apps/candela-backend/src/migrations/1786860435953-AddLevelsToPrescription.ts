import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLevelsToPrescription1786860435953 implements MigrationInterface {
    name = 'AddLevelsToPrescription1786860435953'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "prescriptions" DROP CONSTRAINT "prescriptions_patient_id_fkey"`);
        await queryRunner.query(`ALTER TABLE "patients" DROP CONSTRAINT "patients_user_id_fkey"`);
        await queryRunner.query(`ALTER TABLE "patients" DROP CONSTRAINT "patients_doctor_id_fkey"`);
        await queryRunner.query(`ALTER TABLE "doctors" DROP CONSTRAINT "doctors_user_id_fkey"`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP CONSTRAINT "refresh_tokens_user_id_fkey"`);
        await queryRunner.query(`DROP INDEX "public"."idx_patients_doctor_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_refresh_tokens_user_id"`);
        await queryRunner.query(`ALTER TABLE "prescriptions" DROP CONSTRAINT "prescriptions_patient_id_module_id_key"`);
        await queryRunner.query(`ALTER TABLE "prescriptions" ADD "levels" jsonb NOT NULL DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "prescriptions" ADD CONSTRAINT "UQ_99e5a43b6e5c36af020fae73282" UNIQUE ("patient_id", "module_id")`);
        await queryRunner.query(`ALTER TABLE "prescriptions" ADD CONSTRAINT "FK_9389db557647131856661f7d7b5" FOREIGN KEY ("patient_id") REFERENCES "patients"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "patients" ADD CONSTRAINT "FK_7fe1518dc780fd777669b5cb7a0" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "patients" ADD CONSTRAINT "FK_3b760bf1c51d45a47fe2b64074b" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("user_id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "doctors" ADD CONSTRAINT "FK_653c27d1b10652eb0c7bbbc4427" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4"`);
        await queryRunner.query(`ALTER TABLE "doctors" DROP CONSTRAINT "FK_653c27d1b10652eb0c7bbbc4427"`);
        await queryRunner.query(`ALTER TABLE "patients" DROP CONSTRAINT "FK_3b760bf1c51d45a47fe2b64074b"`);
        await queryRunner.query(`ALTER TABLE "patients" DROP CONSTRAINT "FK_7fe1518dc780fd777669b5cb7a0"`);
        await queryRunner.query(`ALTER TABLE "prescriptions" DROP CONSTRAINT "FK_9389db557647131856661f7d7b5"`);
        await queryRunner.query(`ALTER TABLE "prescriptions" DROP CONSTRAINT "UQ_99e5a43b6e5c36af020fae73282"`);
        await queryRunner.query(`ALTER TABLE "prescriptions" DROP COLUMN "levels"`);
        await queryRunner.query(`ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patient_id_module_id_key" UNIQUE ("patient_id", "module_id")`);
        await queryRunner.query(`CREATE INDEX "idx_refresh_tokens_user_id" ON "refresh_tokens" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "idx_patients_doctor_id" ON "patients" ("doctor_id") `);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "doctors" ADD CONSTRAINT "doctors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "patients" ADD CONSTRAINT "patients_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("user_id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "patients" ADD CONSTRAINT "patients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
