import { ALL_MODULE_IDS } from './game-registry';
import type { PatientTrialStatus } from './profile-types';

export type UserRole = 'super_admin' | 'admin' | 'doctor' | 'patient';
export type PatientOrigin = 'doctor_created' | 'self_signup';
export type DocIdRequestSource = 'self' | 'change' | 'internal';
export type DocIdRequestStatus = 'pending' | 'accepted' | 'rejected';

export interface PendingDocIdRequest {
  id: string;
  source: DocIdRequestSource;
  targetReferralCode: string;
  targetDoctorName: string;
  fromReferralCode: string | null;
  recipientRole: 'doctor' | 'patient';
  expiresAt: string;
}

export interface DocIdRequestPreview extends PendingDocIdRequest {
  patientName: string;
  status: DocIdRequestStatus;
}

export interface IncomingDocIdRequest {
  id: string;
  source: 'self' | 'change';
  patientName: string;
  patientEmail: string;
  targetReferralCode: string;
  createdAt: string;
  expiresAt: string;
}

export interface DoctorDashboardSummary {
  timeZone: string;
  dateKey: string;
  assignedPatientCount: number;
  patientsWithActivePlansCount: number;
  pendingTransferCount: number;
  sessionsTodayCount: number;
  transfersReviewedTodayCount: number;
  prescriptionsUpdatedTodayCount: number;
  lastSessionAtByPatientId: Record<string, string | null>;
}

export interface CaseloadReviewPatient {
  patientId: string;
  name: string;
  lastSessionAt: string | null;
}

export interface DoctorCaseloadAnalytics {
  from: string;
  to: string;
  timeZone: string;
  startInclusive: string;
  endExclusive: string;
  authorizedPatientCount: number;
  patientsWithCompletedSessionsCount: number;
  patientsWithNoCompletedSessionsCount: number;
  totalCompletedSessionsCount: number;
  patientsToReview: CaseloadReviewPatient[];
}

export interface PatientAssignmentItem {
  moduleId: string;
  levels: string[];
}

export interface PatientAssignmentRevision {
  id: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  actorDoctorId: string | null;
  actorLabel: string;
  assignments: PatientAssignmentItem[];
}

export interface PatientAssignmentsHistory {
  current: PatientAssignmentItem[];
  revisions: PatientAssignmentRevision[];
}

export interface DocIdRequestResult {
  emailSent: boolean;
  recipientRole: 'doctor' | 'patient';
  targetReferralCode: string;
  expiresAt: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  organizationId?: string | null;
}

export interface DoctorSummary extends PublicUser {
  role: 'doctor';
  referralCode: string;
  organizationName?: string | null;
}

export interface PatientSummary extends PublicUser {
  role: 'patient';
  origin: PatientOrigin;
  doctorId: string | null;
  doctorName: string | null;
  referralCode: string | null;
  prescribedModuleIds: string[];
  prescribedLevels: Record<string, string[]>;
  previousReferralCodes: string[];
  /** Owning organisation (patients.organization_id), not the user's legacy field alone. */
  organizationId?: string | null;
  organizationName?: string | null;
}

/** Wave 3/4 — doctor create-patient invitation delivery (null when activated with password). */
export interface PatientInvitationDelivery {
  emailSent: boolean;
  expiresAt: string;
}

export interface CreateDoctorPatientResponse {
  patient: PatientSummary;
  /** Present when an invitation was issued; null when the account was activated with a password. */
  invitation: PatientInvitationDelivery | null;
  /** True when the doctor supplied a password and the patient can log in immediately. */
  activated: boolean;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  code: string;
  contactEmail: string | null;
  adminName: string | null;
  adminEmail: string | null;
  doctorCount: number;
  patientCount: number;
  createdAt: string;
}

export interface OrganizationDoctorSummary {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  referralCode: string;
  patientCount: number;
  createdAt: string;
}

export interface OrganizationPatientSummary {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  doctorId: string | null;
  doctorName: string | null;
  doctorReferralCode: string | null;
  sessionCount: number;
  createdAt: string;
}

export interface OrganizationDetail {
  id: string;
  name: string;
  code: string;
  contactEmail: string | null;
  adminName: string | null;
  adminEmail: string | null;
  adminPhone: string | null;
  doctorCount: number;
  patientCount: number;
  sessionCount: number;
  createdAt: string;
  doctors: OrganizationDoctorSummary[];
  patients: OrganizationPatientSummary[];
}

export interface SelfUserSummary {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  sessionCount: number;
}

export interface SuperAdminMetrics {
  totalOrganizations: number;
  totalDoctors: number;
  totalOrgPatients: number;
  totalSelfPatients: number;
}

export type AnnouncementPriority = 'info' | 'warning' | 'critical';

export type AnnouncementTargetType =
  | 'all'
  | 'homepage'
  | 'all_hospitals'
  | 'all_doctors'
  | 'all_patients'
  | 'selected_hospitals'
  | 'selected_users';

export interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  priority: AnnouncementPriority;
  targetType: AnnouncementTargetType;
  targetHospitalIds: string[] | null;
  targetUserIds: string[] | null;
  targetHospitalNames?: string[];
  targetUserNames?: string[];
  isActive: boolean;
  createdByUserId: string | null;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  readCount?: number;
  dismissedCount?: number;
  isRead?: boolean;
  isDismissed?: boolean;
}

export interface CreateAnnouncementDto {
  title: string;
  content: string;
  priority?: AnnouncementPriority;
  targetType: AnnouncementTargetType;
  targetHospitalIds?: string[];
  targetUserIds?: string[];
  isActive?: boolean;
  expiresAt?: string | null;
}

export interface RecipientSearchItem {
  id: string;
  label: string;
  sublabel: string;
  type: 'hospital' | 'user';
  role?: UserRole;
}

export interface SessionUser {
  user: PublicUser;
  organization?: {
    id: string;
    name: string;
    code: string;
  } | null;
  doctor: { referralCode: string } | null;
  patient: {
    origin: PatientOrigin;
    doctorId: string | null;
    doctorName: string | null;
    referralCode: string | null;
    prescribedModuleIds: string[];
    prescribedLevels: Record<string, string[]>;
    pendingDocIdRequest: PendingDocIdRequest | null;
    previousReferralCodes: string[];
    trial: PatientTrialStatus;
  } | null;
  allowedModuleIds: string[];
  accessToken?: string;
  refreshToken?: string;
  isNewUser?: boolean;
}

/** H2 Option C — Google authenticated but invitation not yet accepted (no Candela session). */
export type GoogleAuthInvitationRequiredStatus = 'invitation_acceptance_required';

export interface GoogleInvitationAcceptancePreview {
  email: string;
  patientName: string;
  doctorName: string | null;
  organizationName: string | null;
  invitationExpiresAt: string;
}

export interface GoogleAuthInvitationRequiredResponse {
  status: GoogleAuthInvitationRequiredStatus;
  /** Short-lived single-use acceptance challenge (not a session token). */
  acceptanceToken: string;
  invitation: GoogleInvitationAcceptancePreview;
  message: string;
}

export function isGoogleAuthInvitationRequired(
  body: unknown,
): body is GoogleAuthInvitationRequiredResponse {
  return (
    !!body &&
    typeof body === 'object' &&
    (body as { status?: string }).status === 'invitation_acceptance_required' &&
    typeof (body as { acceptanceToken?: string }).acceptanceToken === 'string'
  );
}

/** UI picker ids in candela-app mapped to catalog module ids. */
export const UI_MODULE_TO_CATALOG: Record<string, string> = {
  wheel: 'rotatory',
  sorting: 'sorting',
  tracing: 'bee_tracing',
  pursuit: 'pursuit',
  mobile_target: 'mobile_target',
  geoboard: 'geoboard',
  peripheral: 'peripheral_view',
  number_search: 'number_search',
  pattern_match: 'pattern_match',
  location_memory: 'location_memory',
  direction_sense: 'direction_sense',
  computer_vision: 'computer_vision',
  familiar_faces: 'familiar_faces',
};

export const CATALOG_TO_UI_MODULE: Record<string, string> = {
  rotatory: 'wheel',
  sorting: 'sorting',
  bee_tracing: 'tracing',
  pursuit: 'pursuit',
  mobile_target: 'mobile_target',
  geoboard: 'geoboard',
  peripheral_view: 'peripheral',
  number_search: 'number_search',
  pattern_match: 'pattern_match',
  location_memory: 'location_memory',
  direction_sense: 'direction_sense',
  computer_vision: 'computer_vision',
  familiar_faces: 'familiar_faces',
};

export function resolveAllowedModuleIds(session: {
  user: { role: string };
  allowedModuleIds?: string[];
  patient?: { origin?: string; doctorId?: string | null } | null;
} | null | undefined): string[] {
  const fromApi = session?.allowedModuleIds ?? [];
  if (!session || session.user.role !== 'patient') {
    return fromApi;
  }
  if (session.patient?.origin === 'self_signup' || !session.patient?.doctorId) {
    return Array.from(new Set([...fromApi, ...ALL_MODULE_IDS]));
  }
  return fromApi;
}
