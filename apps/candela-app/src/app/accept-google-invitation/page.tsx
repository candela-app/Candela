'use client';

import { AuthShell, PrimaryButton } from '@/components/auth/AuthForm';
import { ApiError, api } from '@/lib/api';
import { useAuth, roleHomePath } from '@/lib/auth-context';
import {
  clearGoogleInvitationAcceptance,
  readGoogleInvitationAcceptance,
  type StoredGoogleInvitationAcceptance,
} from '@/lib/google-invitation';
import { useToast } from '@/lib/toast-context';
import type { SessionUser } from '@candela/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';

function AcceptGoogleInvitationForm() {
  const toast = useToast();
  const router = useRouter();
  const { applySession } = useAuth();
  const [stored, setStored] = useState<StoredGoogleInvitationAcceptance | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setStored(readGoogleInvitationAcceptance());
    setReady(true);
  }, []);

  async function onAccept(e: FormEvent) {
    e.preventDefault();
    if (!stored?.acceptanceToken) {
      setError('Your Google confirmation expired. Sign in with Google again.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const next = await api<SessionUser>('/api/auth/invitations/accept-google', {
        method: 'POST',
        body: JSON.stringify({ acceptanceToken: stored.acceptanceToken }),
      });
      clearGoogleInvitationAcceptance();
      applySession(next);
      toast.success('Welcome to Kandela. Your account is ready.');
      router.replace(roleHomePath(next.user.role));
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Could not activate your account. Sign in with Google again, or ask your clinic for a new invitation.';
      setError(msg);
      toast.error(msg);
      setSubmitting(false);
    }
  }

  function onDecline() {
    clearGoogleInvitationAcceptance();
    router.replace('/login');
  }

  if (!ready) {
    return (
      <AuthShell title="Confirm invitation">
        <p className="text-sm text-shell-muted text-center">Loading…</p>
      </AuthShell>
    );
  }

  if (!stored) {
    return (
      <AuthShell
        title="Invitation confirmation expired"
        subtitle="Please sign in with Google again to continue activating your clinic invitation."
      >
        <p className="text-sm text-gray-500 text-center mb-4">
          For your security, Google invitation confirmations expire quickly and are not kept in the address bar.
        </p>
        <Link
          href="/login"
          className="block w-full text-center rounded-xl bg-shell-blue text-white font-bold py-3"
        >
          Back to sign in
        </Link>
      </AuthShell>
    );
  }

  const invite = stored.invitation;

  return (
    <AuthShell
      title="Accept your clinic invitation"
      subtitle={
        stored.message ||
        'Your clinic invited you to Kandela. Confirm to finish activating your account with Google.'
      }
    >
      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 mb-5 text-sm text-gray-700 space-y-2">
        <p>
          <span className="font-semibold text-gray-900">Account:</span> {invite.patientName}
        </p>
        <p>
          <span className="font-semibold text-gray-900">Email:</span> {invite.email}
        </p>
        {invite.doctorName ? (
          <p>
            <span className="font-semibold text-gray-900">Clinician:</span> {invite.doctorName}
          </p>
        ) : null}
        {invite.organizationName ? (
          <p>
            <span className="font-semibold text-gray-900">Organisation:</span> {invite.organizationName}
          </p>
        ) : null}
        <p className="text-xs text-gray-500">
          Invitation expires {new Date(invite.invitationExpiresAt).toLocaleString('en-GB')}
        </p>
      </div>
      <form onSubmit={(e) => void onAccept(e)}>
        {error ? <p className="text-sm text-red-600 font-medium mb-3">{error}</p> : null}
        <PrimaryButton disabled={submitting}>
          {submitting ? 'Activating…' : 'Accept invitation'}
        </PrimaryButton>
      </form>
      <button
        type="button"
        onClick={onDecline}
        disabled={submitting}
        className="mt-3 w-full text-sm font-semibold text-gray-500 hover:text-gray-800"
      >
        Not now
      </button>
    </AuthShell>
  );
}

export default function AcceptGoogleInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-page flex items-center justify-center">
          <p className="text-sm font-semibold text-shell-muted">Loading…</p>
        </div>
      }
    >
      <AcceptGoogleInvitationForm />
    </Suspense>
  );
}
