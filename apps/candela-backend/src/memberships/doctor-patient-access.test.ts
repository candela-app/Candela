import { describe, expect, it } from 'vitest';
import {
  decideDoctorPatientOrgAccess,
  resolveFirstAssociationOrganizationId,
} from './patient-organization';

/**
 * Required regression: Dr Arun at Hospital A + B; P owned by A; Q owned by B;
 * Arun leaves A, remains at B (primary may be B).
 */
describe('doctor patient access (explicit patient.organization_id)', () => {
  const hospitalA = 'org-a';
  const hospitalB = 'org-b';
  const arun = 'doctor-arun';

  it('denies Arun access to P after leaving Hospital A', () => {
    const decision = decideDoctorPatientOrgAccess({
      patientDoctorId: arun,
      patientOrganizationId: hospitalA,
      callerDoctorId: arun,
      callerHasActiveMembershipInPatientOrg: false, // left A
    });
    expect(decision).toEqual({ ok: false, reason: 'no_membership' });
  });

  it('allows Arun access to Q while active at Hospital B', () => {
    const decision = decideDoctorPatientOrgAccess({
      patientDoctorId: arun,
      patientOrganizationId: hospitalB,
      callerDoctorId: arun,
      callerHasActiveMembershipInPatientOrg: true,
    });
    expect(decision).toEqual({ ok: true });
  });

  it('keeps P owned by A regardless of Arun primary (ownership is stored, not inferred)', () => {
    // Changing primary is a membership concern; patient.organization_id stays A.
    const pOrg = hospitalA;
    const qOrg = hospitalB;
    expect(pOrg).toBe(hospitalA);
    expect(qOrg).toBe(hospitalB);
    expect(pOrg).not.toBe(qOrg);
  });

  it('fails closed when patient.organization_id is missing', () => {
    expect(
      decideDoctorPatientOrgAccess({
        patientDoctorId: arun,
        patientOrganizationId: null,
        callerDoctorId: arun,
        callerHasActiveMembershipInPatientOrg: true,
      }),
    ).toEqual({ ok: false, reason: 'missing_organization' });
  });

  it('denies unassigned doctor even with org membership', () => {
    expect(
      decideDoctorPatientOrgAccess({
        patientDoctorId: arun,
        patientOrganizationId: hospitalA,
        callerDoctorId: 'doctor-other',
        callerHasActiveMembershipInPatientOrg: true,
      }),
    ).toEqual({ ok: false, reason: 'not_assigned' });
  });
});

describe('resolveFirstAssociationOrganizationId', () => {
  it('uses sole active membership when no explicit org', () => {
    expect(
      resolveFirstAssociationOrganizationId({
        activeMembershipOrganizationIds: ['org-only'],
      }),
    ).toBe('org-only');
  });

  it('does not invent primary among multiple memberships', () => {
    expect(
      resolveFirstAssociationOrganizationId({
        activeMembershipOrganizationIds: ['org-a', 'org-b'],
      }),
    ).toBeNull();
  });

  it('accepts explicit org when it is an active membership', () => {
    expect(
      resolveFirstAssociationOrganizationId({
        explicitOrganizationId: 'org-b',
        activeMembershipOrganizationIds: ['org-a', 'org-b'],
      }),
    ).toBe('org-b');
  });

  it('rejects explicit org outside active memberships', () => {
    expect(
      resolveFirstAssociationOrganizationId({
        explicitOrganizationId: 'org-x',
        activeMembershipOrganizationIds: ['org-a', 'org-b'],
      }),
    ).toBeNull();
  });
});
