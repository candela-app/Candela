import { writeFileSync } from 'fs';
import { join } from 'path';
import { AppDataSource } from '../src/data-source';

async function main() {
  await AppDataSource.initialize();

  const patientOrg = (
    await AppDataSource.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE organization_id IS NOT NULL)::int AS with_org,
      COUNT(*) FILTER (WHERE doctor_id IS NULL)::int AS unassigned,
      COUNT(*) FILTER (WHERE doctor_id IS NOT NULL AND organization_id IS NULL)::int AS assigned_missing_org,
      COUNT(*) FILTER (WHERE doctor_id IS NOT NULL AND organization_id IS NOT NULL)::int AS assigned_with_org
    FROM patients
  `)
  )[0];

  const integrity = (
    await AppDataSource.query(`
    SELECT
      (SELECT COUNT(*)::int FROM patients) AS patients,
      (SELECT COUNT(*)::int FROM doctors) AS doctors,
      (SELECT COUNT(*)::int FROM organizations) AS organizations,
      (SELECT COUNT(*)::int FROM doctor_organization_memberships) AS memberships,
      (SELECT COUNT(*)::int FROM docid_requests) AS docid_requests,
      (SELECT COUNT(*)::int FROM patient_docid_history) AS docid_history,
      (SELECT COUNT(*)::int FROM prescriptions) AS prescriptions,
      (SELECT COUNT(*)::int FROM prescription_revisions) AS prescription_revisions,
      (SELECT COUNT(*)::int FROM game_sessions) AS game_sessions,
      (SELECT COUNT(*)::int FROM users) AS users
  `)
  )[0];

  const schema = (
    await AppDataSource.query(`
    SELECT
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'patients' AND column_name = 'organization_id'
      ) AS patients_org,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'docid_requests' AND column_name = 'target_organization_id'
      ) AS docid_target_org,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'patient_docid_history' AND column_name = 'organization_id'
      ) AS history_org,
      EXISTS (
        SELECT 1 FROM migrations WHERE name = 'AddPatientOrganizationId1797000000000'
      ) AS migration_recorded
  `)
  )[0];

  const historyNullOrg = (
    await AppDataSource.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE organization_id IS NULL)::int AS null_org
    FROM patient_docid_history
  `)
  )[0];

  const orphanOrg = (
    await AppDataSource.query(`
    SELECT COUNT(*)::int AS n
    FROM patients p
    WHERE p.organization_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = p.organization_id)
  `)
  )[0];

  const baseline = {
    patients: 18,
    doctors: 7,
    organizations: 1,
    memberships: 7,
    docid_requests: 12,
    docid_history: 0,
    prescriptions: 51,
    prescription_revisions: 6,
    game_sessions: 238,
    users: 29,
  };

  const integrityMatch = Object.entries(baseline).every(
    ([k, v]) => Number((integrity as Record<string, number>)[k]) === v,
  );

  const pass =
    schema.patients_org === true &&
    schema.docid_target_org === true &&
    schema.history_org === true &&
    schema.migration_recorded === true &&
    Number(patientOrg.total) === 18 &&
    Number(patientOrg.with_org) === 9 &&
    Number(patientOrg.unassigned) === 9 &&
    Number(patientOrg.assigned_missing_org) === 0 &&
    Number(patientOrg.assigned_with_org) === 9 &&
    Number(orphanOrg.n) === 0 &&
    integrityMatch;

  const report = {
    generatedAt: new Date().toISOString(),
    migration: 'AddPatientOrganizationId1797000000000',
    pass,
    patientOrg,
    integrity,
    integrityMatch,
    baseline,
    schema,
    historyNullOrg,
    orphanOrgFk: orphanOrg.n,
  };

  writeFileSync(join(__dirname, '..', 'post-migration-verify-179700.json'), JSON.stringify(report, null, 2));
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(report, null, 2));
  await AppDataSource.destroy();
  if (!pass) process.exit(2);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
