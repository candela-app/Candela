export type UserRole = 'admin' | 'doctor' | 'patient';
export type PatientOrigin = 'doctor_created' | 'self_signup';

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
}

export interface SessionUser {
  user: PublicUser;
  doctor: { referralCode: string } | null;
  patient: {
    origin: PatientOrigin;
    doctorId: string | null;
    referralCode: string | null;
    prescribedModuleIds: string[];
  } | null;
  allowedModuleIds: string[];
}

/** UI picker ids in candela-app mapped to catalog module ids. */
export const UI_MODULE_TO_CATALOG: Record<string, string> = {
  wheel: 'rotatory',
  sorting: 'sorting',
  tracing: 'bee_tracing',
  pursuit: 'pursuit',
  mobile_target: 'mobile_target',
};

export const CATALOG_TO_UI_MODULE: Record<string, string> = {
  rotatory: 'wheel',
  sorting: 'sorting',
  bee_tracing: 'tracing',
  pursuit: 'pursuit',
  mobile_target: 'mobile_target',
};
