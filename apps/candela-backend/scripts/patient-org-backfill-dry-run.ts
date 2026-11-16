/**
 * Read-only classification for patients.organization_id backfill.
 * Does not mutate data. Does not use doctor primary as confident evidence.
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { AppDataSource } from '../src/data-source';

async function main() {
  await AppDataSource.initialize();

  const total = await AppDataSource.query(`SELECT COUNT(*)::int AS n FROM patients`);
  const unassigned = await AppDataSource.query(
    `SELECT COUNT(*)::int AS n FROM patients WHERE doctor_id IS NULL`,
  );
  const missingDoctor = await AppDataSource.query(`
    SELECT COUNT(*)::int AS n FROM patients p
    WHERE p.doctor_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM doctors d WHERE d.user_id = p.doctor_id)
  `);
  const multiOrgDoctors = await AppDataSource.query(`
    SELECT
      m.doctor_id,
      u.email AS doctor_email,
      u.organization_id::text AS legacy_org,
      COUNT(*)::int AS active_count,
      COUNT(*) FILTER (WHERE m.is_primary)::int AS primary_count,
      array_agg(m.organization_id::text ORDER BY m.organization_id) AS org_ids
    FROM doctor_organization_memberships m
    JOIN users u ON u.id = m.doctor_id
    WHERE m.membership_status = 'active'
    GROUP BY m.doctor_id, u.email, u.organization_id
    HAVING COUNT(*) > 1
    ORDER BY active_count DESC
  `);

  const classified = await AppDataSource.query(`
    WITH doctor_active AS (
      SELECT
        doctor_id,
        COUNT(*)::int AS active_count,
        COUNT(*) FILTER (WHERE is_primary)::int AS primary_count,
        array_agg(organization_id::text ORDER BY organization_id) AS org_ids,
        MIN(organization_id::text) AS sole_org
      FROM doctor_organization_memberships
      WHERE membership_status = 'active'
      GROUP BY doctor_id
    ),
    classified AS (
      SELECT
        p.user_id AS patient_id,
        p.doctor_id,
        p.origin,
        d.user_id AS doctor_exists,
        u.organization_id::text AS doctor_legacy_org,
        COALESCE(da.active_count, 0)::int AS active_count,
        COALESCE(da.primary_count, 0)::int AS primary_count,
        da.org_ids,
        da.sole_org,
        CASE
          WHEN p.doctor_id IS NULL THEN 'unassigned'
          WHEN d.user_id IS NULL THEN 'missing_doctor_ref'
          WHEN COALESCE(da.active_count, 0) = 1
               AND (u.organization_id IS NULL OR u.organization_id::text = da.sole_org)
            THEN 'confident_sole_active'
          WHEN COALESCE(da.active_count, 0) = 1
               AND u.organization_id IS NOT NULL
               AND u.organization_id::text <> da.sole_org
            THEN 'manual_sole_vs_legacy_conflict'
          WHEN COALESCE(da.active_count, 0) = 0
               AND u.organization_id IS NOT NULL
               AND EXISTS (SELECT 1 FROM organizations o WHERE o.id = u.organization_id)
            THEN 'confident_legacy_only'
          WHEN COALESCE(da.active_count, 0) = 0
               AND u.organization_id IS NOT NULL
            THEN 'manual_legacy_org_missing'
          WHEN COALESCE(da.active_count, 0) > 1 THEN 'manual_multi_org_ambiguous'
          WHEN COALESCE(da.active_count, 0) = 0 AND u.organization_id IS NULL
            THEN 'manual_no_evidence'
          ELSE 'manual_review'
        END AS classification,
        CASE
          WHEN p.doctor_id IS NULL THEN NULL
          WHEN d.user_id IS NULL THEN NULL
          WHEN COALESCE(da.active_count, 0) = 1
               AND (u.organization_id IS NULL OR u.organization_id::text = da.sole_org)
            THEN da.sole_org
          WHEN COALESCE(da.active_count, 0) = 0
               AND u.organization_id IS NOT NULL
               AND EXISTS (SELECT 1 FROM organizations o WHERE o.id = u.organization_id)
            THEN u.organization_id::text
          ELSE NULL
        END AS proposed_organization_id,
        CASE
          WHEN p.doctor_id IS NULL THEN 'self-signup / unlinked — leave null until association'
          WHEN d.user_id IS NULL THEN 'doctor_id points to missing doctors row'
          WHEN COALESCE(da.active_count, 0) = 1
               AND (u.organization_id IS NULL OR u.organization_id::text = da.sole_org)
            THEN 'sole active membership (legacy matches or absent)'
          WHEN COALESCE(da.active_count, 0) = 1
            THEN 'sole active membership conflicts with users.organization_id'
          WHEN COALESCE(da.active_count, 0) = 0 AND u.organization_id IS NOT NULL
            THEN 'no active membership; users.organization_id only (transitional)'
          WHEN COALESCE(da.active_count, 0) > 1
            THEN 'doctor has multiple active memberships — primary NOT used'
          ELSE 'insufficient organisation evidence'
        END AS evidence
      FROM patients p
      LEFT JOIN doctors d ON d.user_id = p.doctor_id
      LEFT JOIN users u ON u.id = p.doctor_id
      LEFT JOIN doctor_active da ON da.doctor_id = p.doctor_id
    )
    SELECT * FROM classified
    ORDER BY classification, patient_id
  `);

  const byClass: Record<string, number> = {};
  for (const row of classified as Array<{ classification: string }>) {
    byClass[row.classification] = (byClass[row.classification] ?? 0) + 1;
  }

  const confidentKeys = new Set(['confident_sole_active', 'confident_legacy_only']);
  const manualKeys = new Set([
    'manual_multi_org_ambiguous',
    'manual_sole_vs_legacy_conflict',
    'manual_no_evidence',
    'manual_legacy_org_missing',
    'manual_review',
    'missing_doctor_ref',
  ]);

  let confident = 0;
  let manual = 0;
  for (const [k, n] of Object.entries(byClass)) {
    if (confidentKeys.has(k)) confident += n;
    else if (manualKeys.has(k)) manual += n;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    note:
      'Conservative dry-run. Doctor primary membership is never treated as confident backfill evidence.',
    summary: {
      totalPatients: total[0].n as number,
      unassigned: unassigned[0].n as number,
      missingDoctorRef: missingDoctor[0].n as number,
      multiOrgDoctorCount: multiOrgDoctors.length,
      eligibleConfidentAutomaticBackfill: confident,
      requiringManualReview: manual,
      classificationCounts: byClass,
    },
    multiOrgDoctors,
    patients: classified,
  };

  const outPath = join(__dirname, '..', 'backfill-dry-run-report.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  // Also print summary only (no PII dump to console beyond counts).
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ outPath, summary: report.summary }, null, 2));

  await AppDataSource.destroy();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
