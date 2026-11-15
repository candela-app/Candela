import { describe, expect, it } from 'vitest';
import { decideDoctorPatientOrgAccess } from '../memberships/patient-organization';

/**
 * Mirrors the transactional `owns` check inside AuthService.changePrescription.
 */
function transactionalOwns(input: {
  patientDoctorId: string | null;
  patientOrganizationId: string | null;
  callerDoctorId: string;
  hasActiveMembership: boolean;
}): boolean {
  return (
    decideDoctorPatientOrgAccess({
      patientDoctorId: input.patientDoctorId,
      patientOrganizationId: input.patientOrganizationId,
      callerDoctorId: input.callerDoctorId,
      callerHasActiveMembershipInPatientOrg: input.hasActiveMembership,
    }).ok === true
  );
}

describe('changePrescription transactional ownership re-check', () => {
  it('allows when assignment, org ownership, and active membership all hold', () => {
    expect(
      transactionalOwns({
        patientDoctorId: 'doctor-1',
        patientOrganizationId: 'org-a',
        callerDoctorId: 'doctor-1',
        hasActiveMembership: true,
      }),
    ).toBe(true);
  });

  it('denies when membership ended even if doctor_id still matches', () => {
    expect(
      transactionalOwns({
        patientDoctorId: 'doctor-1',
        patientOrganizationId: 'org-a',
        callerDoctorId: 'doctor-1',
        hasActiveMembership: false,
      }),
    ).toBe(false);
  });

  it('denies when patient organisation ownership is null', () => {
    expect(
      transactionalOwns({
        patientDoctorId: 'doctor-1',
        patientOrganizationId: null,
        callerDoctorId: 'doctor-1',
        hasActiveMembership: true,
      }),
    ).toBe(false);
  });

  it('denies when doctor assignment does not match', () => {
    expect(
      transactionalOwns({
        patientDoctorId: 'doctor-1',
        patientOrganizationId: 'org-a',
        callerDoctorId: 'doctor-2',
        hasActiveMembership: true,
      }),
    ).toBe(false);
  });
});
