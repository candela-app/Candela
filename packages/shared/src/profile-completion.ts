import type {
  DoctorIdentityFields,
  OrganizationIdentityFields,
  PatientIdentityFields,
  ProfileCompletionStatus,
} from './profile-types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDateString(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isFutureIsoDate(value: string, now = new Date()): boolean {
  if (!isIsoDateString(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dob = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return dob > today;
}

/** Whole years completed as of `now` (UTC calendar). */
export function ageFromIsoDate(dateOfBirth: string, now = new Date()): number | null {
  if (!isIsoDateString(dateOfBirth)) return null;
  const [y, m, d] = dateOfBirth.split('-').map(Number);
  let age = now.getUTCFullYear() - y;
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();
  if (month < m || (month === m && day < d)) {
    age -= 1;
  }
  return age;
}

export function isBlank(value: string | null | undefined): boolean {
  return value == null || value.trim() === '';
}

function present(value: string | null | undefined): boolean {
  return !isBlank(value);
}

export function missingPatientIdentityFields(
  fields: PatientIdentityFields,
  now = new Date(),
): string[] {
  const missing: string[] = [];
  if (!present(fields.name)) missing.push('name');
  if (!present(fields.phone)) missing.push('phone');
  if (!present(fields.dateOfBirth)) {
    missing.push('dateOfBirth');
  } else if (!isIsoDateString(fields.dateOfBirth!) || isFutureIsoDate(fields.dateOfBirth!, now)) {
    missing.push('dateOfBirth');
  }
  if (!present(fields.preferredLanguage)) missing.push('preferredLanguage');
  if (!present(fields.city)) missing.push('city');
  if (!present(fields.state)) missing.push('state');
  if (!present(fields.country) || (fields.country?.trim().length ?? 0) !== 2) {
    missing.push('country');
  }

  const age = fields.dateOfBirth ? ageFromIsoDate(fields.dateOfBirth, now) : null;
  if (age != null && age < 18) {
    if (!present(fields.guardianName)) missing.push('guardianName');
    if (!present(fields.guardianPhone)) missing.push('guardianPhone');
    if (!present(fields.guardianRelationship)) missing.push('guardianRelationship');
  }
  return missing;
}

export function missingDoctorIdentityFields(fields: DoctorIdentityFields): string[] {
  const missing: string[] = [];
  if (!present(fields.name)) missing.push('name');
  if (!present(fields.phone)) missing.push('phone');
  if (!present(fields.professionalTitle)) missing.push('professionalTitle');
  if (!present(fields.specialization)) missing.push('specialization');
  if (!present(fields.preferredLanguage)) missing.push('preferredLanguage');
  const quals = fields.qualifications;
  if (!Array.isArray(quals) || quals.length === 0 || quals.every((q) => isBlank(q))) {
    missing.push('qualifications');
  }
  return missing;
}

export function missingOrganizationIdentityFields(fields: OrganizationIdentityFields): string[] {
  const missing: string[] = [];
  if (!present(fields.name)) missing.push('name');
  if (!present(fields.contactEmail)) missing.push('contactEmail');
  if (!present(fields.organizationType)) missing.push('organizationType');
  if (!present(fields.contactPhone)) missing.push('contactPhone');
  if (!present(fields.addressLine1)) missing.push('addressLine1');
  if (!present(fields.city)) missing.push('city');
  if (!present(fields.state)) missing.push('state');
  if (!present(fields.country) || (fields.country?.trim().length ?? 0) !== 2) {
    missing.push('country');
  }
  return missing;
}

export function toCompletionStatus(
  missingFields: string[],
  completedAt: Date | string | null | undefined,
): ProfileCompletionStatus {
  const iso =
    completedAt instanceof Date
      ? completedAt.toISOString()
      : completedAt
        ? String(completedAt)
        : null;
  const complete = missingFields.length === 0 && iso != null;
  return {
    profileComplete: complete,
    completedAt: complete ? iso : null,
    missingFields,
  };
}

/** Empty strings become null for optional/nullable storage. */
export function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}
