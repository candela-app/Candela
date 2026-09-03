import type { SessionUser } from '@candela/shared';

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
  return fallback;
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

  if (res.status === 401 && retry && path !== '/api/auth/refresh' && path !== '/api/auth/login' && path !== '/api/auth/google') {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return api<T>(path, init, false);
    }
  }

  const body = await parseBody(res);
  if (!res.ok) {
    throw new ApiError(res.status, errorMessage(body, res.statusText));
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

  const body = await parseBody(res);
  if (!res.ok) {
    throw new ApiError(res.status, errorMessage(body, res.statusText));
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
