/**
 * Authoritative patient owning organisation is `patients.organization_id`.
 * Doctor primary membership must never be used as a substitute.
 *
 * Access (fail closed):
 * 1) patient.doctor_id === caller doctor
 * 2) patient.organization_id is non-null
 * 3) caller has active membership in patient.organization_id
 */

export type PatientOrgAccessInput = {
  patientDoctorId: string | null | undefined;
  patientOrganizationId: string | null | undefined;
  callerDoctorId: string;
  callerHasActiveMembershipInPatientOrg: boolean;
};

export type PatientOrgAccessDecision =
  | { ok: true }
  | { ok: false; reason: 'not_assigned' | 'missing_organization' | 'no_membership' };

/** Pure decision helper for tests and services. */
export function decideDoctorPatientOrgAccess(input: PatientOrgAccessInput): PatientOrgAccessDecision {
  if (!input.patientDoctorId || input.patientDoctorId !== input.callerDoctorId) {
    return { ok: false, reason: 'not_assigned' };
  }
  if (!input.patientOrganizationId) {
    return { ok: false, reason: 'missing_organization' };
  }
  if (!input.callerHasActiveMembershipInPatientOrg) {
    return { ok: false, reason: 'no_membership' };
  }
  return { ok: true };
}

/**
 * Resolve organisation for a *first* patient↔doctor association only.
 * Never uses primary among multiple memberships.
 * - explicitOrganizationId if provided and in active set
 * - else sole active membership
 * - else null (caller must fail closed / require explicit org)
 */
export function resolveFirstAssociationOrganizationId(input: {
  explicitOrganizationId?: string | null;
  activeMembershipOrganizationIds: string[];
}): string | null {
  const active = [...new Set(input.activeMembershipOrganizationIds.filter(Boolean))];
  const explicit = input.explicitOrganizationId?.trim() || null;
  if (explicit) {
    return active.includes(explicit) ? explicit : null;
  }
  if (active.length === 1) {
    return active[0]!;
  }
  return null;
}

/**
 * @deprecated Inference from doctor memberships is incorrect for multi-org doctors.
 * Kept only for dry-run / historical comparison tests — do not use for access control.
 */
export function resolveOwningOrganizationId(input: {
  legacyOrganizationId: string | null | undefined;
  activeMemberships: Array<{ organizationId: string; isPrimary: boolean }>;
}): string | null {
  const active = input.activeMemberships;
  const primary = active.find((m) => m.isPrimary);
  if (primary) return primary.organizationId;

  const legacy = input.legacyOrganizationId ?? null;
  if (legacy && active.some((m) => m.organizationId === legacy)) {
    return legacy;
  }
  if (active.length === 1) {
    return active[0]!.organizationId;
  }
  if (active.length === 0 && legacy) {
    return legacy;
  }
  return null;
}
