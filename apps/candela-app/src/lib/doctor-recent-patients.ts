export interface RecentPatientEntry {
  patientId: string;
  viewedAt: string;
}

const RECENT_STORAGE_PREFIX = 'candela.doctor.recentPatients.';
const MAX_STORED_ENTRIES = 12;

function storageKey(doctorUserId: string): string {
  return `${RECENT_STORAGE_PREFIX}${doctorUserId}`;
}

/**
 * Reads user-scoped recently viewed patient IDs from localStorage.
 * Only patientId and viewedAt are ever stored (never names, emails, or clinical data).
 */
export function readRecentlyViewedPatients(doctorUserId: string): RecentPatientEntry[] {
  if (typeof window === 'undefined' || !doctorUserId) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(doctorUserId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is RecentPatientEntry =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as RecentPatientEntry).patientId === 'string' &&
        (item as RecentPatientEntry).patientId.length > 0 &&
        typeof (item as RecentPatientEntry).viewedAt === 'string' &&
        !Number.isNaN(Date.parse((item as RecentPatientEntry).viewedAt)),
    );
  } catch {
    return [];
  }
}

export function recordRecentlyViewedPatient(doctorUserId: string, patientId: string): void {
  if (typeof window === 'undefined' || !doctorUserId || !patientId) return;
  try {
    const existing = readRecentlyViewedPatients(doctorUserId).filter(
      (entry) => entry.patientId !== patientId,
    );
    const next: RecentPatientEntry[] = [
      { patientId, viewedAt: new Date().toISOString() },
      ...existing,
    ].slice(0, MAX_STORED_ENTRIES);
    window.localStorage.setItem(storageKey(doctorUserId), JSON.stringify(next));
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

export function clearRecentlyViewedPatients(doctorUserId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (doctorUserId) {
      window.localStorage.removeItem(storageKey(doctorUserId));
      return;
    }
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(RECENT_STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage errors on logout
  }
}
