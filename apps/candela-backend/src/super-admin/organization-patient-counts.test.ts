import { describe, expect, it } from 'vitest';

/**
 * Super-admin reporting must count patients by patients.organization_id,
 * not by assigned doctor's legacy users.organization_id.
 */
function countPatientsForOrganization(
  patients: Array<{ organizationId: string | null; doctorId: string | null }>,
  organizationId: string,
): number {
  return patients.filter((p) => p.organizationId === organizationId).length;
}

function listPatientsForOrganization(
  patients: Array<{ userId: string; organizationId: string | null; doctorId: string | null }>,
  organizationId: string,
) {
  return patients.filter((p) => p.organizationId === organizationId);
}

describe('super-admin organisation patient reporting', () => {
  const patients = [
    { userId: 'p1', organizationId: 'org-a', doctorId: 'doctor-multi' },
    { userId: 'p2', organizationId: 'org-b', doctorId: 'doctor-multi' },
    { userId: 'p3', organizationId: null, doctorId: null },
  ];

  it('counts only patients with matching organization_id', () => {
    expect(countPatientsForOrganization(patients, 'org-a')).toBe(1);
    expect(countPatientsForOrganization(patients, 'org-b')).toBe(1);
  });

  it('does not attribute org-b patient to org-a via shared multi-org doctor', () => {
    const orgA = listPatientsForOrganization(patients, 'org-a');
    expect(orgA.map((p) => p.userId)).toEqual(['p1']);
    expect(orgA.some((p) => p.userId === 'p2')).toBe(false);
  });
});
