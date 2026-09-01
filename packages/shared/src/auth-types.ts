import { ALL_MODULE_IDS } from './game-registry';

export type UserRole = 'admin' | 'doctor' | 'patient';
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
  expiresAt: string;
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
}

export interface DoctorSummary extends PublicUser {
  role: 'doctor';
  referralCode: string;
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
}

export interface SessionUser {
  user: PublicUser;
  doctor: { referralCode: string } | null;
  patient: {
    origin: PatientOrigin;
    doctorId: string | null;
    referralCode: string | null;
    prescribedModuleIds: string[];
    prescribedLevels: Record<string, string[]>;
    pendingDocIdRequest: PendingDocIdRequest | null;
    previousReferralCodes: string[];
  } | null;
  allowedModuleIds: string[];
  accessToken?: string;
  refreshToken?: string;
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
