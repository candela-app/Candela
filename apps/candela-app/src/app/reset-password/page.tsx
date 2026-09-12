'use client';

import { AuthShell, PasswordField, PrimaryButton } from '@/components/auth/AuthForm';
import { ApiError, api } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';

function ResetPasswordForm() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

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
      setError('This reset link is invalid or has expired');
      return;
    }
    setSubmitting(true);
    try {
      await api('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
      toast.success('Password updated. Sign in with your new password.');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not reset password';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <AuthShell title="Reset password" subtitle="This reset link is missing or incomplete.">
        <p className="text-sm text-gray-500 text-center">
          <Link href="/forgot-password" className="text-shell-blue font-semibold hover:underline">
            Request a new link
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Reset password" subtitle="Choose a new password for your account.">
      {done ? (
        <p className="text-sm text-shell-muted text-center">
          Your password is updated.{' '}
          <Link href="/login" className="text-shell-blue font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      ) : (
        <form onSubmit={onSubmit}>
          <PasswordField
            label="New password"
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
          <PrimaryButton disabled={submitting}>{submitting ? 'Saving…' : 'Update password'}</PrimaryButton>
        </form>
      )}
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-page flex items-center justify-center">
          <p className="text-sm font-semibold text-shell-muted">Loading…</p>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
