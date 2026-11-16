/**
 * Read-only preflight for Phase 1 Wave 1. Does not run migrations.
 */
import { AppDataSource } from '../data-source';

async function main() {
  await AppDataSource.initialize();
  try {
    const doctors = await AppDataSource.query(`
      SELECT
        COUNT(*)::int AS doctor_count,
        COUNT(u.organization_id)::int AS doctors_with_org,
        COUNT(*) FILTER (WHERE u.organization_id IS NULL)::int AS doctors_without_org
      FROM doctors d
      JOIN users u ON u.id = d.user_id
    `);
    const orgs = await AppDataSource.query(`SELECT COUNT(*)::int AS org_count FROM organizations`);
    const patients = await AppDataSource.query(`
      SELECT
        COUNT(*)::int AS patient_count,
        COUNT(doctor_id)::int AS linked_patients,
        COUNT(*) FILTER (WHERE doctor_id IS NULL)::int AS unlinked_patients
      FROM patients
    `);
    const prescriptions = await AppDataSource.query(`SELECT COUNT(*)::int AS n FROM prescriptions`);
    const sessions = await AppDataSource.query(`SELECT COUNT(*)::int AS n FROM game_sessions`);
    const docids = await AppDataSource.query(`SELECT COUNT(DISTINCT referral_code)::int AS n FROM doctors`);
    const indexes = await AppDataSource.query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'idx_patients_doctor_id',
          'idx_refresh_tokens_user_id',
          'idx_users_organization_id',
          'uq_dom_active_doctor_org',
          'uq_dom_one_primary_per_doctor'
        )
      ORDER BY indexname
    `);
    const tables = await AppDataSource.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN (
          'doctor_organization_memberships',
          'doctor_organization_invitations'
        )
      ORDER BY tablename
    `);
    const cols = await AppDataSource.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'patients' AND column_name = 'identity_profile_completed_at')
          OR (table_name = 'password_reset_tokens' AND column_name = 'purpose')
          OR (table_name = 'doctors' AND column_name = 'qualifications')
          OR (table_name = 'organizations' AND column_name = 'organization_type')
        )
      ORDER BY table_name, column_name
    `);
    const migrationRows = await AppDataSource.query(`
      SELECT id, name, timestamp
      FROM migrations
      WHERE name LIKE '%Phase1%' OR name LIKE '%1796000000000%'
      ORDER BY id
    `).catch(() => []);

    const expectedBackfill = doctors[0].doctors_with_org as number;
    const result = {
      doctors: doctors[0],
      organizations: orgs[0],
      patients: patients[0],
      prescriptionCount: prescriptions[0].n,
      gameSessionCount: sessions[0].n,
      distinctDocIds: docids[0].n,
      existingIndexes: indexes.map((r: { indexname: string }) => r.indexname),
      phase1TablesPresent: tables.map((r: { tablename: string }) => r.tablename),
      phase1ColumnsPresent: cols.map(
        (r: { table_name: string; column_name: string }) => `${r.table_name}.${r.column_name}`,
      ),
      expectedMembershipBackfillCount: expectedBackfill,
      phase1MigrationRows: migrationRows,
      migrationAppearsApplied: tables.length > 0 || cols.length > 0 || migrationRows.length > 0,
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
