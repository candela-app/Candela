/**
 * Preflight for AddPatientOrganizationId1797000000000 — read-only.
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { AppDataSource } from '../src/data-source';

async function main() {
  await AppDataSource.initialize();

  const baseline = (
    await AppDataSource.query(`
    SELECT
      (SELECT COUNT(*)::int FROM patients) AS patients,
      (SELECT COUNT(*)::int FROM patients WHERE doctor_id IS NULL) AS unassigned,
      (SELECT COUNT(*)::int FROM patients WHERE doctor_id IS NOT NULL) AS assigned,
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

  const simulation = (
    await AppDataSource.query(`
    WITH sole AS (
      SELECT doctor_id, MIN(organization_id::text)::uuid AS organization_id
      FROM doctor_organization_memberships
      WHERE membership_status = 'active'
      GROUP BY doctor_id
      HAVING COUNT(*) = 1
    ),
    sole_fill AS (
      SELECT p.user_id
      FROM patients p
      JOIN sole s ON p.doctor_id = s.doctor_id
      JOIN users u ON u.id = s.doctor_id
      WHERE (u.organization_id IS NULL OR u.organization_id = s.organization_id)
    ),
    legacy_fill AS (
      SELECT p.user_id
      FROM patients p
      JOIN users u ON u.id = p.doctor_id
      WHERE u.organization_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM organizations o WHERE o.id = u.organization_id)
        AND NOT EXISTS (
          SELECT 1 FROM doctor_organization_memberships m
          WHERE m.doctor_id = p.doctor_id AND m.membership_status = 'active'
        )
        AND p.user_id NOT IN (SELECT user_id FROM sole_fill)
    )
    SELECT
      (SELECT COUNT(*)::int FROM sole_fill) AS sole_fill,
      (SELECT COUNT(*)::int FROM legacy_fill) AS legacy_fill,
      ((SELECT COUNT(*)::int FROM sole_fill) + (SELECT COUNT(*)::int FROM legacy_fill)) AS confident_total,
      (SELECT COUNT(*)::int FROM patients p
        WHERE p.doctor_id IS NOT NULL
          AND p.user_id NOT IN (SELECT user_id FROM sole_fill)
          AND p.user_id NOT IN (SELECT user_id FROM legacy_fill)
      ) AS assigned_still_null_after_sim,
      (SELECT COUNT(*)::int FROM patients WHERE doctor_id IS NULL) AS unassigned_unchanged
  `)
  )[0];

  const schema = (
    await AppDataSource.query(`
    SELECT
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'patients' AND column_name = 'organization_id'
      ) AS patients_org_exists,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'docid_requests' AND column_name = 'target_organization_id'
      ) AS docid_target_org_exists,
      EXISTS (
        SELECT 1 FROM migrations WHERE name = 'AddPatientOrganizationId1797000000000'
      ) AS migration_already_recorded
  `)
  )[0];

  const pass =
    Number(baseline.unassigned) === 9 &&
    Number(simulation.confident_total) === 9 &&
    Number(simulation.assigned_still_null_after_sim) === 0 &&
    Number(simulation.unassigned_unchanged) === 9 &&
    schema.patients_org_exists === false &&
    schema.migration_already_recorded === false;

  const report = {
    generatedAt: new Date().toISOString(),
    pass,
    gates: {
      unassignedIs9: Number(baseline.unassigned) === 9,
      confidentBackfillIs9: Number(simulation.confident_total) === 9,
      assignedStillNullIs0: Number(simulation.assigned_still_null_after_sim) === 0,
      migrationNotYetApplied: schema.migration_already_recorded === false,
      columnNotYetPresent: schema.patients_org_exists === false,
    },
    baseline,
    simulation,
    schema,
  };

  const out = join(__dirname, '..', 'preflight-migration-179700.json');
  writeFileSync(out, JSON.stringify(report, null, 2));
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
