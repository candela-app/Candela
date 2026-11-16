import { PATIENT_TRIAL_DAYS } from './profile-options';
import type { PatientTrialStatus } from './profile-types';

export { PATIENT_TRIAL_DAYS };

export function toPatientTrialStatus(
  startedAt: Date | string | null | undefined,
  endsAt: Date | string | null | undefined,
  now = new Date(),
): PatientTrialStatus {
  const startIso =
    startedAt instanceof Date
      ? startedAt.toISOString()
      : startedAt
        ? String(startedAt)
        : null;
  const endIso =
    endsAt instanceof Date ? endsAt.toISOString() : endsAt ? String(endsAt) : null;
  if (!startIso || !endIso) {
    return { startedAt: null, endsAt: null, active: false, daysRemaining: null };
  }
  const endMs = new Date(endIso).getTime();
  const remainingMs = endMs - now.getTime();
  const active = remainingMs > 0;
  const daysRemaining = active ? Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000))) : 0;
  return {
    startedAt: startIso,
    endsAt: endIso,
    active,
    daysRemaining,
  };
}

export function computeTrialEnd(startedAt: Date, days = PATIENT_TRIAL_DAYS): Date {
  return new Date(startedAt.getTime() + days * 24 * 60 * 60 * 1000);
}
