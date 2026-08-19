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
