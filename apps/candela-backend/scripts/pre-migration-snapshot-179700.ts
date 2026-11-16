/**
 * Logical pre-migration snapshot (pg_dump not available on this host).
 * Captures counts + patient/doctor keys needed to verify no data loss.
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { AppDataSource } from '../src/data-source';

async function main() {
  await AppDataSource.initialize();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = join(__dirname, '..', 'backups');
  mkdirSync(dir, { recursive: true });

  const counts = (
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

  const patients = await AppDataSource.query(`
    SELECT user_id, doctor_id, origin
    FROM patients
    ORDER BY user_id
  `);

  const memberships = await AppDataSource.query(`
    SELECT id, doctor_id, organization_id, membership_status, is_primary
    FROM doctor_organization_memberships
    ORDER BY doctor_id, organization_id
  `);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    purpose: 'Pre-apply snapshot for AddPatientOrganizationId1797000000000',
    note: 'Logical snapshot only — host has no pg_dump. Prefer Supabase PITR/dashboard backup for physical restore.',
    counts,
    patients,
    memberships,
  };

  const out = join(dir, `pre-179700-${stamp}.json`);
  writeFileSync(out, JSON.stringify(snapshot, null, 2));
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ out, counts }, null, 2));
  await AppDataSource.destroy();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
