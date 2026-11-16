'use client';

import { useAuth, roleHomePath } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { ApiError, api } from '@/lib/api';
import { AuthShell, Field, PasswordField, PrimaryButton } from '@/components/auth/AuthForm';
import { AuthDivider, GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import type { SessionUser } from '@candela/shared';
import { isGoogleAuthInvitationRequired } from '@candela/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { returnToMobileApp } from '@/lib/mobile-google-return';
import { storeGoogleInvitationAcceptance } from '@/lib/google-invitation';
import { FormEvent, Suspense, useEffect, useState } from 'react';

function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get('next'));
  const { session, loading, applySession } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  function postLoginPath(role: SessionUser['user']['role']): string {
    if (nextPath && role === 'doctor' && nextPath.startsWith('/org-invitation')) {
      return nextPath;
    }
    return roleHomePath(role);
  }

  useEffect(() => {
    if (returnToMobileApp()) {
      return;
    }
    if (!loading && session) {
      setRedirecting(true);
      router.replace(postLoginPath(session.user.role));
    }
  }, [loading, session, router, nextPath]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const next = await api<SessionUser>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setRedirecting(true);
      applySession(next);
      toast.success(`Welcome back, ${next.user.name}!`);
      router.replace(postLoginPath(next.user.role));
    } catch (err) {
      setSubmitting(false);
      const msg = err instanceof ApiError ? err.message : 'Could not sign in';
      setError(msg);
      toast.error(msg);
    }
  }

  async function onGoogle(accessToken: string) {
    setError('');
    setGoogleBusy(true);
    try {
      const next = await api<SessionUser | import('@candela/shared').GoogleAuthInvitationRequiredResponse>(
        '/api/auth/google',
        {
          method: 'POST',
          body: JSON.stringify({ accessToken }),
        },
      );
      if (isGoogleAuthInvitationRequired(next)) {
        storeGoogleInvitationAcceptance({
          acceptanceToken: next.acceptanceToken,
          invitation: next.invitation,
          message: next.message,
        });
        toast.success(next.message);
        router.replace('/accept-google-invitation');
        return;
      }
      setRedirecting(true);
      applySession(next);
      toast.success(`Welcome back, ${next.user.name}!`);
      if (next.isNewUser && next.user.role === 'patient') {
        router.replace('/dashboard?welcome=1');
      } else {
        router.replace(postLoginPath(next.user.role));
      }
    } catch (err) {
      setGoogleBusy(false);
      const msg = err instanceof ApiError ? err.message : 'Could not sign in with Google';
      setError(msg);
      toast.error(msg);
    }
  }

  if (loading || session || redirecting) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <p className="text-sm font-semibold text-shell-muted">Loading…</p>
      </div>
    );
  }

  return (
    <AuthShell title="Sign in">
      <form onSubmit={onSubmit}>
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        <div className="flex justify-end -mt-2 mb-4">
          <Link href="/forgot-password" className="text-sm text-shell-blue font-semibold hover:underline">
            Forgot password?
          </Link>
        </div>
        {error && <p className="text-sm text-red-600 font-medium mb-3">{error}</p>}
        <PrimaryButton disabled={submitting || googleBusy}>{submitting ? 'Signing in…' : 'Sign in'}</PrimaryButton>
      </form>
      <AuthDivider />
      <GoogleSignInButton disabled={submitting} busy={googleBusy} onAccessToken={onGoogle} />
      <p className="text-sm text-gray-500 mt-6 text-center">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-shell-blue font-semibold hover:underline">
          Sign up
        </Link>
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-page">
          <p className="text-sm font-semibold text-shell-muted">Loading…</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
