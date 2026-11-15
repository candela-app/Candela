/**
 * Phase 1 identity profile contracts.
 * Gender and organisation-type are extensible strings — no final product catalogues here.
 */

export type DoctorMembershipStatus = 'active' | 'suspended' | 'ended';

export type DoctorOrganizationInvitationStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'revoked';

export interface ProfileCompletionStatus {
  profileComplete: boolean;
  completedAt: string | null;
  missingFields: string[];
}

/** Seven-day patient trial (independent of identity completion / activation). */
export interface PatientTrialStatus {
  startedAt: string | null;
  endsAt: string | null;
  active: boolean;
  daysRemaining: number | null;
}

/** Patient identity fields stored on patients (+ name/phone on users). */
export interface PatientIdentityFields {
  name: string;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  preferredLanguage: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  profilePhotoPath: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianRelationship: string | null;
}

export interface PatientIdentityProfile extends PatientIdentityFields {
  userId: string;
  email: string;
  origin: 'doctor_created' | 'self_signup';
  doctorId: string | null;
  /** Authoritative owning organisation; independent of doctor primary membership. */
  organizationId: string | null;
  /** Signed URL for display when a photo path exists; null if missing. */
  profilePhotoUrl: string | null;
  completion: ProfileCompletionStatus;
  trial: PatientTrialStatus;
}

/** Fields a patient may PATCH. Email / doctorId / origin are not writable here. */
export interface PatientIdentityProfilePatch {
  name?: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  preferredLanguage?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  profilePhotoPath?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  guardianRelationship?: string | null;
}

export interface DoctorIdentityFields {
  name: string;
  phone: string | null;
  professionalTitle: string | null;
  specialization: string | null;
  qualifications: string[] | null;
  preferredLanguage: string | null;
  yearsExperience: number | null;
  externalRegistrationId: string | null;
  profilePhotoPath: string | null;
}

export interface DoctorIdentityProfile extends DoctorIdentityFields {
  userId: string;
  email: string;
  referralCode: string;
  profilePhotoUrl: string | null;
  completion: ProfileCompletionStatus;
}

export interface DoctorIdentityProfilePatch {
  name?: string;
  phone?: string | null;
  professionalTitle?: string | null;
  specialization?: string | null;
  qualifications?: string[] | null;
  preferredLanguage?: string | null;
  yearsExperience?: number | null;
  externalRegistrationId?: string | null;
  profilePhotoPath?: string | null;
}

export interface OrganizationIdentityFields {
  name: string;
  contactEmail: string | null;
  organizationType: string | null;
  contactPhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  website: string | null;
  licenseNumber: string | null;
  logoPath: string | null;
}

export interface OrganizationIdentityProfile extends OrganizationIdentityFields {
  id: string;
  code: string;
  logoUrl: string | null;
  completion: ProfileCompletionStatus;
}

export interface ProfileMediaUploadResult {
  path: string;
  url: string;
}

export interface OrganizationIdentityProfilePatch {
  name?: string;
  contactEmail?: string | null;
  organizationType?: string | null;
  contactPhone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  website?: string | null;
  licenseNumber?: string | null;
  logoPath?: string | null;
}

export type MeProfileResponse =
  | { role: 'patient'; profile: PatientIdentityProfile }
  | { role: 'doctor'; profile: DoctorIdentityProfile }
  | { role: 'admin'; profile: OrganizationIdentityProfile | null; organizationId: string | null }
  | { role: 'super_admin'; profile: null };

export interface DoctorOrganizationMembershipView {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationCode: string;
  membershipStatus: DoctorMembershipStatus;
  isPrimary: boolean;
  joinedAt: string;
  endedAt: string | null;
}

export interface SetPrimaryOrganizationBody {
  organizationId: string;
}

export interface EndMembershipBody {
  reason?: string;
}

export interface InviteDoctorToOrganizationBody {
  /** Existing doctor user id. */
  doctorId: string;
}

export interface DoctorOrganizationInvitationView {
  id: string;
  doctorId: string;
  doctorName: string;
  organizationId: string;
  organizationName: string;
  status: DoctorOrganizationInvitationStatus;
  expiresAt: string;
  createdAt: string;
}

/** HTTP header for organisation-scoped doctor requests. */
export const ORGANIZATION_SCOPE_HEADER = 'x-organization-id';

/** HTTP header for Super Admin emergency intervention justification. */
export const EMERGENCY_REASON_HEADER = 'x-emergency-reason';
