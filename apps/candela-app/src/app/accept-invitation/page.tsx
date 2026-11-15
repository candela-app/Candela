'use client';

import { AuthShell, PasswordField, PrimaryButton } from '@/components/auth/AuthForm';
import { ApiError, api } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';

function AcceptInvitationForm() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done && typeof window !== 'undefined') {
      router.replace('/accept-invitation');
    }
  }, [done, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!token) {
      setError('This invitation link is missing or incomplete. Ask your clinic to send a new invitation.');
      return;
    }
    setSubmitting(true);
    try {
      await api('/api/auth/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
      toast.success('Account activated. Sign in with your new password.');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not activate your account';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (!token && !done) {
    return (
      <AuthShell title="Activate account" subtitle="This invitation link is missing or incomplete.">
        <p className="text-sm text-gray-500 text-center">
          Ask your clinic to resend the invitation, or{' '}
          <Link href="/login" className="text-shell-blue font-semibold hover:underline">
            sign in
          </Link>{' '}
          if you already activated.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Activate your Kandela account"
      subtitle="Set a password to finish activating the account your clinician created for you."
    >
      {done ? (
        <p className="text-sm text-shell-muted text-center">
          Your account is ready.{' '}
          <Link href="/login" className="text-shell-blue font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      ) : (
        <form onSubmit={onSubmit}>
          <PasswordField
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
          />
          <PasswordField
            label="Confirm password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
          />
          {error ? <p className="text-sm text-red-600 font-medium mb-3">{error}</p> : null}
          <PrimaryButton disabled={submitting}>
            {submitting ? 'Activating…' : 'Activate account'}
          </PrimaryButton>
        </form>
      )}
    </AuthShell>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-page flex items-center justify-center">
          <p className="text-sm font-semibold text-shell-muted">Loading…</p>
        </div>
      }
    >
      <AcceptInvitationForm />
    </Suspense>
  );
}
