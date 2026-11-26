import type { SavedPracticeSummary, SessionUser } from '@candela/shared';
import { EMERGENCY_REASON_HEADER, ORGANIZATION_SCOPE_HEADER } from '@candela/shared';

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

function isHtml(text: string): boolean {
  const trimmed = text.trim();
  return (
    trimmed.startsWith('<') ||
    /<(?:!doctype|html|head|body|div|p|script|style)[\s>]/i.test(trimmed)
  );
}

function statusFallback(status: number, statusText?: string): string {
  if (status === 429) {
    return 'Server is busy or waking up. Please wait a moment and try again.';
  }
  if (status === 502 || status === 503 || status === 504) {
    return 'Server is temporarily unavailable. Please wait a moment and try again.';
  }
  if (status === 401) {
    return 'Invalid email or password';
  }
  if (status === 404) {
    return 'Requested service was not found.';
  }
  return statusText || `Request failed (${status})`;
}

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message: unknown }).message;
    if (Array.isArray(message)) {
      return message.join(', ');
    }
    if (typeof message === 'string' && message.length > 0 && !isHtml(message)) {
      return message;
    }
  }
  if (typeof body === 'string' && body.trim().length > 0 && !isHtml(body)) {
    const trimmed = body.trim();
    if (trimmed.toLowerCase() !== 'too many requests') {
      return trimmed;
    }
  }
  return fallback;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

const AUTH_PUBLIC_PATHS = new Set([
  '/api/auth/refresh',
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/google',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/invitations/accept',
  '/api/auth/invitations/accept-google',
]);

/** Attach validated organisation scope for doctor-scoped writes. */
export function withOrganizationId(organizationId: string, init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set(ORGANIZATION_SCOPE_HEADER, organizationId);
  return { ...init, headers };
}

/** Attach Super Admin emergency justification (server-enforced). */
export function withEmergencyReason(reason: string, init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set(EMERGENCY_REASON_HEADER, reason.trim());
  return { ...init, headers };
}

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

export async function api<T>(path: string, init: RequestInit = {}, retries: boolean | number = 2): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(path, {
    ...init,
    headers,
    credentials: 'include',
  });

  const retriesLeft = typeof retries === 'number' ? retries : retries ? 1 : 0;

  if (res.status === 401 && retriesLeft > 0 && !AUTH_PUBLIC_PATHS.has(path)) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return api<T>(path, init, 0);
    }
  }

  // Gracefully retry on 429 / 502 / 503 / 504 (gives sleeping container time to finish booting)
  if (isRetryableStatus(res.status) && retriesLeft > 0) {
    const delay = retriesLeft === 2 ? 2500 : 3500;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return api<T>(path, init, retriesLeft - 1);
  }

  const body = await parseBody(res);
  if (!res.ok) {
    throw new ApiError(res.status, errorMessage(body, statusFallback(res.status, res.statusText)));
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

async function apiForm<T>(path: string, form: FormData, retries: boolean | number = 2): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    body: form,
    credentials: 'include',
  });

  const retriesLeft = typeof retries === 'number' ? retries : retries ? 1 : 0;

  if (res.status === 401 && retriesLeft > 0) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return apiForm<T>(path, form, 0);
    }
  }

  if (isRetryableStatus(res.status) && retriesLeft > 0) {
    const delay = retriesLeft === 2 ? 2500 : 3500;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return apiForm<T>(path, form, retriesLeft - 1);
  }

  const body = await parseBody(res);
  if (!res.ok) {
    throw new ApiError(res.status, errorMessage(body, statusFallback(res.status, res.statusText)));
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

export function uploadProfilePhoto(file: File) {
  const form = new FormData();
  form.append('file', file);
  return apiForm<{ path: string; url: string }>('/api/me/profile/photo', form);
}

export function deleteProfilePhoto() {
  return api<{ ok: true }>('/api/me/profile/photo', { method: 'DELETE' });
}

export function uploadOrganizationLogo(organizationId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return apiForm<{ path: string; url: string }>(`/api/organizations/${organizationId}/profile/logo`, form);
}

export function deleteOrganizationLogo(organizationId: string) {
  return api<{ ok: true }>(`/api/organizations/${organizationId}/profile/logo`, { method: 'DELETE' });
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

export function getDoctorDashboardSummary(timeZone?: string) {
  let resolved = timeZone?.trim() ?? '';
  if (!resolved && typeof Intl !== 'undefined') {
    try {
      resolved = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch {
      resolved = '';
    }
  }
  const query = resolved ? `?${new URLSearchParams({ timeZone: resolved }).toString()}` : '';
  return api<import('@candela/shared').DoctorDashboardSummary>(
    `/api/doctors/me/dashboard-summary${query}`,
  );
}
