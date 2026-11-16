/**
 * Read-only post-migration verification for Phase 1 Wave 1.
 */
import { AppDataSource } from '../data-source';

async function main() {
  await AppDataSource.initialize();
  try {
    const memberships = await AppDataSource.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE membership_status = 'active')::int AS active,
        COUNT(*) FILTER (WHERE is_primary AND membership_status = 'active')::int AS active_primary
      FROM doctor_organization_memberships
    `);
    const doctors = await AppDataSource.query(`
      SELECT
        COUNT(*)::int AS doctor_count,
        COUNT(u.organization_id)::int AS doctors_with_org,
        COUNT(DISTINCT referral_code)::int AS distinct_docids
      FROM doctors d
      JOIN users u ON u.id = d.user_id
    `);
    const patients = await AppDataSource.query(`
      SELECT
        COUNT(*)::int AS patient_count,
        COUNT(doctor_id)::int AS linked_patients
      FROM patients
    `);
    const prescriptions = await AppDataSource.query(`SELECT COUNT(*)::int AS n FROM prescriptions`);
    const sessions = await AppDataSource.query(`SELECT COUNT(*)::int AS n FROM game_sessions`);
    const completion = await AppDataSource.query(`
      SELECT
        (SELECT COUNT(*)::int FROM patients WHERE identity_profile_completed_at IS NOT NULL) AS patients_completed,
        (SELECT COUNT(*)::int FROM doctors WHERE identity_profile_completed_at IS NOT NULL) AS doctors_completed,
        (SELECT COUNT(*)::int FROM organizations WHERE identity_profile_completed_at IS NOT NULL) AS orgs_completed
    `);
    const indexes = await AppDataSource.query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'idx_patients_doctor_id',
          'idx_refresh_tokens_user_id',
          'uq_dom_active_doctor_org',
          'uq_dom_one_primary_per_doctor',
          'uq_doi_pending_doctor_org'
        )
      ORDER BY indexname
    `);
    const purpose = await AppDataSource.query(`
      SELECT COUNT(*)::int AS n
      FROM information_schema.columns
      WHERE table_name = 'password_reset_tokens' AND column_name = 'purpose'
    `);
    const migrationRows = await AppDataSource.query(`
      SELECT name FROM migrations
      WHERE name LIKE '%Phase1IdentityProfilesAndMemberships%'
    `);

    process.stdout.write(
      `${JSON.stringify(
        {
          memberships: memberships[0],
          doctors: doctors[0],
          patients: patients[0],
          prescriptionCount: prescriptions[0].n,
          gameSessionCount: sessions[0].n,
          identityCompletionsSet: completion[0],
          indexes: indexes.map((r: { indexname: string }) => r.indexname),
          passwordTokenPurposeColumn: purpose[0].n === 1,
          migrationRecorded: migrationRows.map((r: { name: string }) => r.name),
          checks: {
            backfillMatchesDoctorsWithOrg:
              memberships[0].active === doctors[0].doctors_with_org &&
              memberships[0].active_primary === doctors[0].doctors_with_org,
            noAutoCompletions:
              completion[0].patients_completed === 0 &&
              completion[0].doctors_completed === 0 &&
              completion[0].orgs_completed === 0,
            countsUnchangedVsPreflight:
              doctors[0].doctor_count === 7 &&
              doctors[0].distinct_docids === 7 &&
              patients[0].patient_count === 18 &&
              patients[0].linked_patients === 9 &&
              prescriptions[0].n === 51 &&
              sessions[0].n === 238,
          },
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
