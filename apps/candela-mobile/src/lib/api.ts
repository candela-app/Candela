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

function defaultApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001';
  }
  return 'http://localhost:3001';
}

export const API_URL = defaultApiUrl();

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
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
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
  const accessToken = await getAccessToken();
  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  if (res.status === 401 && retry && path !== '/api/auth/refresh' && path !== '/api/auth/login') {
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

export function fetchSession() {
  return api<SessionUser>('/api/auth/me');
}
