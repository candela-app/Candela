'use client';

import { AuthShell, Field, PrimaryButton } from '@/components/auth/AuthForm';
import { ApiError, api } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import Link from 'next/link';
import { FormEvent, useState } from 'react';

export default function ForgotPasswordPage() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setDone(true);
      toast.success('If an account exists for that email, we sent a reset link.');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not send a reset link';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Forgot password"
      subtitle="Enter the email on your account. If it uses a password, we will send a reset link."
    >
      {done ? (
        <p className="text-sm text-shell-muted">
          If an account exists for that email, we sent a reset link. Check your inbox (and spam). Google
          Sign-In accounts keep using Google — they do not get a password reset.
        </p>
      ) : (
        <form onSubmit={onSubmit}>
          <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
          {error ? <p className="text-sm text-red-600 font-medium mb-3">{error}</p> : null}
          <PrimaryButton disabled={submitting}>{submitting ? 'Sending…' : 'Send reset link'}</PrimaryButton>
        </form>
      )}
      <p className="text-sm text-gray-500 mt-6 text-center">
        <Link href="/login" className="text-shell-blue font-semibold hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
