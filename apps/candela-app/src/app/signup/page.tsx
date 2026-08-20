'use client';

import { useAuth, roleHomePath } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { ApiError, api } from '@/lib/api';
import { AuthShell, Field, PrimaryButton } from '@/components/auth/AuthForm';
import { AuthDivider, GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import type { SessionUser } from '@candela/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

export default function SignupPage() {
  const router = useRouter();
  const { session, loading, applySession } = useAuth();
  const toast = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
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
      const next = await api<SessionUser>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ name, phone, email, password }),
      });
      setRedirecting(true);
      applySession(next);
      toast.success('Account created successfully! Welcome to Kandela.');
      router.replace(roleHomePath(next.user.role));
    } catch (err) {
      setSubmitting(false);
      const msg = err instanceof ApiError ? err.message : 'Could not create account';
      setError(msg);
      toast.error(msg);
    }
  }

  async function onGoogle(accessToken: string) {
    setError('');
    setGoogleBusy(true);
    try {
      const next = await api<SessionUser>('/api/auth/google', {
        method: 'POST',
        body: JSON.stringify({ accessToken }),
      });
      setRedirecting(true);
      applySession(next);
      toast.success('Account created successfully! Welcome to Kandela.');
      router.replace(roleHomePath(next.user.role));
    } catch (err) {
      setGoogleBusy(false);
      const msg = err instanceof ApiError ? err.message : 'Could not continue with Google';
      setError(msg);
      toast.error(msg);
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
    <AuthShell title="User registration">
      <form onSubmit={onSubmit}>
        <Field label="Name" value={name} onChange={setName} autoComplete="name" />
        <Field label="Phone" type="tel" value={phone} onChange={setPhone} autoComplete="tel" />
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />
        {error && <p className="text-sm text-red-600 font-medium mb-3">{error}</p>}
        <PrimaryButton disabled={submitting || googleBusy}>{submitting ? 'Creating…' : 'Create account'}</PrimaryButton>
      </form>
      <AuthDivider />
      <GoogleSignInButton disabled={submitting} busy={googleBusy} onAccessToken={onGoogle} />
      <p className="text-sm text-gray-500 mt-6 text-center">
        Already have an account?{' '}
        <Link href="/login" className="text-blue-600 font-semibold hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
