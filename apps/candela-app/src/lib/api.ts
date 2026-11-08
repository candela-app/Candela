import type { SavedPracticeSummary, SessionUser } from '@candela/shared';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message: unknown }).message;
    if (Array.isArray(message)) {
      return message.join(', ');
    }
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  if (typeof body === 'string' && body.trim().length > 0) {
    return body.trim();
  }
  return fallback;
}

const AUTH_PUBLIC_PATHS = new Set([
  '/api/auth/refresh',
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/google',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
]);

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    })
      .then((res) => res.ok)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(path, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (res.status === 401 && retry && !AUTH_PUBLIC_PATHS.has(path)) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return api<T>(path, init, false);
    }
  }

  // Gracefully retry on 429 once after 2 seconds (gives sleeping container time to finish booting)
  if (res.status === 429 && retry) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return api<T>(path, init, false);
  }

  const body = await parseBody(res);
  if (!res.ok) {
    const defaultFallback =
      res.status === 429
        ? 'Server is busy or waking up. Please wait a moment and try again.'
        : res.statusText || `Request failed (${res.status})`;
    throw new ApiError(res.status, errorMessage(body, defaultFallback));
  }
  return body as T;
}

export function fetchSession() {
  return api<SessionUser>('/api/auth/me');
}

export type FamiliarFaceRecord = {
  id: string;
  relationLabel: string;
  imageUrl: string;
  createdAt: string;
};

async function apiForm<T>(path: string, form: FormData, retry = true): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    body: form,
    credentials: 'include',
  });

  if (res.status === 401 && retry) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return apiForm<T>(path, form, false);
    }
  }

  if (res.status === 429 && retry) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return apiForm<T>(path, form, false);
  }

  const body = await parseBody(res);
  if (!res.ok) {
    const defaultFallback =
      res.status === 429
        ? 'Server is busy or waking up. Please wait a moment and try again.'
        : res.statusText || `Request failed (${res.status})`;
    throw new ApiError(res.status, errorMessage(body, defaultFallback));
  }
  return body as T;
}

export function listFamiliarFaces() {
  return api<FamiliarFaceRecord[]>('/api/familiar-faces');
}

export function uploadFamiliarFace(file: File, relationLabel: string) {
  const form = new FormData();
  form.append('file', file);
  form.append('relationLabel', relationLabel);
  return apiForm<FamiliarFaceRecord>('/api/familiar-faces', form);
}

export function updateFamiliarFaceLabel(id: string, relationLabel: string) {
  return api<FamiliarFaceRecord>(`/api/familiar-faces/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ relationLabel }),
  });
}

export function deleteFamiliarFace(id: string) {
  return api<{ ok?: boolean }>(`/api/familiar-faces/${id}`, { method: 'DELETE' });
}

export type StoredGameSessionRecord = {
  id: string;
  sessionNumber: number;
  gameId: string;
  levelId: string | null;
  deviceTier: string | null;
  recordedAt: string;
  durationSec: number;
  correct: number;
  wrongTaps: number;
  misses: number;
  timeouts: number;
  accuracy: number;
  avgReactionSec: number;
  medianReactionSec: number;
  efficiencyIndex: number;
  reactionMs: number[];
  stimuliCount: number;
  gameName: string;
  bgColor?: string | null;
  stimulusColor?: string | null;
  contrastPercent?: number | null;
  metricsVersion: number;
  detail?: import('@candela/shared').SessionDetail | null;
  detailVersion?: number | null;
};

export type GameSessionListQuery = {
  gameId?: string;
  levelId?: string;
  deviceTier?: string;
  from?: string;
  to?: string;
};

function sessionQuery(params: GameSessionListQuery): string {
  const q = new URLSearchParams();
  if (params.gameId) q.set('gameId', params.gameId);
  if (params.levelId) q.set('levelId', params.levelId);
  if (params.deviceTier) q.set('deviceTier', params.deviceTier);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function persistGameSession(body: unknown) {
  return api<StoredGameSessionRecord>('/api/game-sessions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function listMyGameSessions(params: GameSessionListQuery = {}) {
  return api<StoredGameSessionRecord[]>(`/api/game-sessions${sessionQuery(params)}`);
}

export function listPatientGameSessions(patientId: string, params: GameSessionListQuery = {}) {
  return api<StoredGameSessionRecord[]>(
    `/api/doctors/me/patients/${patientId}/game-sessions${sessionQuery(params)}`,
  );
}

export function getMyPracticeSummary() {
  return api<SavedPracticeSummary>('/api/game-sessions/summary');
}

export function getPatientPracticeSummary(patientId: string) {
  return api<SavedPracticeSummary>(`/api/doctors/me/patients/${patientId}/game-sessions/summary`);
}

export type SessionOverviewResponse = {
  sessions: StoredGameSessionRecord[];
  truncated: boolean;
  omitted: 'older' | null;
  cap: number;
};

function overviewQuery(params: GameSessionListQuery): string {
  const q = new URLSearchParams();
  q.set('coverage', 'newest');
  if (params.gameId) q.set('gameId', params.gameId);
  if (params.levelId) q.set('levelId', params.levelId);
  if (params.deviceTier) q.set('deviceTier', params.deviceTier);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  return `?${q.toString()}`;
}

export function listMyGameSessionOverview(params: GameSessionListQuery = {}) {
  return api<SessionOverviewResponse>(`/api/game-sessions${overviewQuery(params)}`);
}

export function listPatientGameSessionOverview(patientId: string, params: GameSessionListQuery = {}) {
  return api<SessionOverviewResponse>(
    `/api/doctors/me/patients/${patientId}/game-sessions${overviewQuery(params)}`,
  );
}

export type PrescriptionRangeQuery = { from?: string; to?: string; timeZone?: string };

function prescriptionQuery(params?: PrescriptionRangeQuery): string {
  if (!params?.from || !params?.to || !params?.timeZone) return '';
  const q = new URLSearchParams();
  q.set('from', params.from);
  q.set('to', params.to);
  q.set('timeZone', params.timeZone);
  return `?${q.toString()}`;
}

export function getMyPrescriptionPractice(params?: PrescriptionRangeQuery) {
  return api<
    import('@candela/shared').PatientPrescriptionPractice & {
      period?: import('@candela/shared').PatientPrescriptionPeriod;
    }
  >(`/api/me/prescription-practice${prescriptionQuery(params)}`);
}

export function getPatientPrescriptionAnalytics(patientId: string, params?: PrescriptionRangeQuery) {
  return api<
    import('@candela/shared').DoctorPrescriptionAnalytics & {
      period?: import('@candela/shared').PrescriptionPeriod;
    }
  >(`/api/doctors/me/patients/${patientId}/prescription-analytics${prescriptionQuery(params)}`);
}
