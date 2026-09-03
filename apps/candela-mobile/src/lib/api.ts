import { Platform } from 'react-native';
import type { SessionUser } from '@candela/shared/rn';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from './tokens';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const PRODUCTION_API_URL = 'https://candela-backend-gbdz.onrender.com';
const REQUEST_TIMEOUT_MS = 10_000;
const AUTH_ANON_PATHS = new Set(['/api/auth/login', '/api/auth/signup', '/api/auth/refresh']);

function defaultApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }
  if (typeof __DEV__ !== 'undefined' && !__DEV__) {
    return PRODUCTION_API_URL;
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001';
  }
  return 'http://localhost:3001';
}

export const API_URL = defaultApiUrl();

async function request(url: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    throw new ApiError(
      0,
      `Can't reach the server. Is the backend running, and is this device on the same Wi‑Fi?`,
    );
  } finally {
    clearTimeout(timer);
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

async function persistSessionTokens(body: unknown): Promise<void> {
  if (!body || typeof body !== 'object') {
    return;
  }
  const session = body as SessionUser;
  if (session.accessToken || session.refreshToken) {
    await saveTokens(session.accessToken, session.refreshToken);
  }
}

async function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        return false;
      }
      const res = await request(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        credentials: 'omit',
      });
      if (!res.ok) {
        await clearTokens();
        return false;
      }
      const body = await parseBody(res);
      await persistSessionTokens(body);
      return true;
    })().finally(() => {
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
  if (!AUTH_ANON_PATHS.has(path)) {
    const accessToken = await getAccessToken();
    if (accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
  }

  const res = await request(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: 'omit',
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
  await persistSessionTokens(body);
  return body as T;
}

export async function fetchSession(): Promise<SessionUser | null> {
  const accessToken = await getAccessToken();
  const refreshToken = await getRefreshToken();
  if (!accessToken && !refreshToken) {
    return null;
  }
  return api<SessionUser>('/api/auth/me');
}

export type FamiliarFaceRecord = {
  id: string;
  relationLabel: string;
  imageUrl: string;
  createdAt?: string;
};

async function apiForm<T>(path: string, form: FormData, retry = true): Promise<T> {
  const headers = new Headers();
  const accessToken = await getAccessToken();
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  const res = await request(
    `${API_URL}${path}`,
    {
      method: 'POST',
      body: form,
      headers,
      credentials: 'omit',
    },
    60_000,
  );

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

export function uploadFamiliarFace(uri: string, relationLabel: string, mimeType?: string, fileName?: string) {
  const form = new FormData();
  form.append('file', {
    uri,
    name: fileName || 'photo.jpg',
    type: mimeType || 'image/jpeg',
  } as unknown as Blob);
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
