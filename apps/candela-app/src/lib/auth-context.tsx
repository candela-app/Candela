'use client';

import type { SessionUser } from '@candela/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, fetchSession } from './api';

type AuthContextValue = {
  session: SessionUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  applySession: (next: SessionUser | null) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchSession();
      setSession(next);
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const applySession = useCallback((next: SessionUser | null) => {
    setSession(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } finally {
      setSession(null);
    }
  }, []);

  const value = useMemo(
    () => ({ session, loading, refresh, applySession, logout }),
    [session, loading, refresh, applySession, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

/** Prefer the signed-in user's display name for clinical patient profile fields. */
export function sessionDisplayName(session: SessionUser | null | undefined): string {
  const name = session?.user?.name?.trim();
  return name && name.length > 0 ? name : 'Demo Patient';
}

export function roleHomePath(role: string): string {
  if (role === 'admin') {
    return '/admin';
  }
  if (role === 'doctor') {
    return '/doctor';
  }
  return '/dashboard';
}
