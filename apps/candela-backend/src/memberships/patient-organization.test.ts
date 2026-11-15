import { describe, expect, it } from 'vitest';
import {
  decideDoctorPatientOrgAccess,
  resolveFirstAssociationOrganizationId,
  resolveOwningOrganizationId,
} from './patient-organization';

describe('decideDoctorPatientOrgAccess', () => {
  it('requires assignment, non-null org, and active membership', () => {
    expect(
      decideDoctorPatientOrgAccess({
        patientDoctorId: 'd1',
        patientOrganizationId: 'org-a',
        callerDoctorId: 'd1',
        callerHasActiveMembershipInPatientOrg: true,
      }),
    ).toEqual({ ok: true });
  });
});

describe('resolveFirstAssociationOrganizationId', () => {
  it('prefers validated explicit organisation', () => {
    expect(
      resolveFirstAssociationOrganizationId({
        explicitOrganizationId: 'org-a',
        activeMembershipOrganizationIds: ['org-a', 'org-b'],
      }),
    ).toBe('org-a');
  });
});

describe('resolveOwningOrganizationId (deprecated inference — not for access)', () => {
  it('still documents historical primary preference (must not drive access)', () => {
    expect(
      resolveOwningOrganizationId({
        legacyOrganizationId: 'legacy',
        activeMemberships: [
          { organizationId: 'org-a', isPrimary: false },
          { organizationId: 'org-b', isPrimary: true },
        ],
      }),
    ).toBe('org-b');
  });
});
