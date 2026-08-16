'use client';

import { useAuth, roleHomePath } from '@/lib/auth-context';
import { ApiError, api } from '@/lib/api';
import { AuthShell, Field, PasswordField, PrimaryButton } from '@/components/auth/AuthForm';
import type { SessionUser } from '@candela/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const { session, loading, applySession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      setRedirecting(true);
      router.replace(roleHomePath(session.user.role));
    }
  }, [loading, session, router]);

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
      router.replace(roleHomePath(next.user.role));
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof ApiError ? err.message : 'Could not sign in');
    }
  }

  if (loading || session || redirecting) {
    return (
      <div className="min-h-screen bg-[#F4F7FC] flex items-center justify-center">
        <p className="text-sm font-semibold text-gray-500">Loading…</p>
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
        {error && <p className="text-sm text-red-600 font-medium mb-3">{error}</p>}
        <PrimaryButton disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</PrimaryButton>
      </form>
      <p className="text-sm text-gray-500 mt-6 text-center">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-blue-600 font-semibold hover:underline">
          Sign up
        </Link>
      </p>
    </AuthShell>
  );
}
