'use client';

import { AuthShell } from '@/components/auth/AuthForm';
import { useAuth, roleHomePath } from '@/lib/auth-context';
import { ApiError, api } from '@/lib/api';
import {
  clearOrgInvitationToken,
  readOrgInvitationToken,
  storeOrgInvitationToken,
} from '@/lib/org-invitation';
import { useToast } from '@/lib/toast-context';
import type { DoctorOrganizationInvitationView, DoctorOrganizationMembershipView } from '@candela/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

function OrgInvitationInner() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, loading } = useAuth();
  const queryToken = searchParams.get('token')?.trim() ?? '';
  const [token, setToken] = useState('');
  const [preview, setPreview] = useState<DoctorOrganizationInvitationView | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<'accepted' | 'declined' | null>(null);

  useEffect(() => {
    if (queryToken) {
      storeOrgInvitationToken(queryToken);
      setToken(queryToken);
      router.replace('/org-invitation');
      return;
    }
    setToken(readOrgInvitationToken() ?? '');
  }, [queryToken, router]);

  const loadPreview = useCallback(async (raw: string) => {
    if (!raw) {
      setError('This invitation link is missing or incomplete.');
      return;
    }
    setError('');
    try {
      const data = await api<DoctorOrganizationInvitationView>(
        `/api/doctor-organization-invitations/${encodeURIComponent(raw)}/preview`,
      );
      setPreview(data);
    } catch (err) {
      setPreview(null);
      setError(err instanceof ApiError ? err.message : 'Could not load this invitation');
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    void loadPreview(token);
  }, [token, loadPreview]);

  useEffect(() => {
    if (loading || !token) return;
    if (!session) {
      router.replace(`/login?next=${encodeURIComponent('/org-invitation')}`);
    }
  }, [loading, session, token, router]);

  async function onAccept() {
    if (!token || !session) return;
    setBusy(true);
    setError('');
    try {
      await api<DoctorOrganizationMembershipView>(
        `/api/doctor-organization-invitations/${encodeURIComponent(token)}/accept`,
        { method: 'POST' },
      );
      clearOrgInvitationToken();
      setDone('accepted');
      toast.success('Organisation membership activated.');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not accept invitation';
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function onDecline() {
    if (!token || !session) return;
    setBusy(true);
    setError('');
    try {
      await api(`/api/doctor-organization-invitations/${encodeURIComponent(token)}/decline`, {
        method: 'POST',
      });
      clearOrgInvitationToken();
      setDone('declined');
      toast.success('Invitation declined.');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not decline invitation';
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  if (loading || (!session && token)) {
    return (
      <AuthShell title="Organisation invitation" subtitle="Checking your session…">
        <p className="text-center text-sm text-shell-muted">Loading…</p>
      </AuthShell>
    );
  }

  if (!token) {
    return (
      <AuthShell title="Organisation invitation" subtitle="This invitation link is incomplete.">
        <p className="text-center text-sm text-gray-500">
          Ask your hospital administrator to resend the invitation, or{' '}
          <Link href="/login" className="font-semibold text-shell-blue hover:underline">
            sign in
          </Link>
          .
        </p>
      </AuthShell>
    );
  }

  if (session && session.user.role !== 'doctor') {
    return (
      <AuthShell title="Organisation invitation" subtitle="Wrong account type">
        <p className="text-center text-sm text-gray-500">
          Sign in with the invited doctor account to respond to this invitation.
        </p>
        <Link href={roleHomePath(session.user.role)} className="mt-4 block text-center text-sm font-semibold text-shell-blue">
          Go to your dashboard
        </Link>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell
        title={done === 'accepted' ? 'Membership activated' : 'Invitation declined'}
        subtitle={
          done === 'accepted'
            ? 'You can now work in this organisation from your doctor workspace.'
            : 'No membership was created.'
        }
      >
        <button
          type="button"
          onClick={() => router.replace('/doctor')}
          className="w-full rounded-xl bg-shell-blue px-4 py-3 text-sm font-semibold text-white"
        >
          Open doctor workspace
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Organisation invitation"
      subtitle={
        preview
          ? `${preview.organizationName} invited you to join as a doctor.`
          : 'Review and respond to this invitation.'
      }
    >
      {preview ? (
        <div className="mb-4 space-y-2 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          <p>
            <span className="font-semibold text-gray-900">Organisation:</span> {preview.organizationName}
          </p>
          <p>
            <span className="font-semibold text-gray-900">Status:</span> {preview.status}
          </p>
          <p>
            <span className="font-semibold text-gray-900">Expires:</span>{' '}
            {new Date(preview.expiresAt).toLocaleString()}
          </p>
        </div>
      ) : null}

      {error ? <p className="mb-3 text-center text-sm font-medium text-red-600">{error}</p> : null}

      {preview?.status === 'pending' ? (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={busy || !session}
            onClick={() => void onAccept()}
            className="w-full rounded-xl bg-shell-blue px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? 'Working…' : 'Accept invitation'}
          </button>
          <button
            type="button"
            disabled={busy || !session}
            onClick={() => void onDecline()}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:border-gray-300 disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      ) : preview ? (
        <p className="text-center text-sm text-gray-500">
          This invitation is already {preview.status}.{' '}
          <Link href="/doctor" className="font-semibold text-shell-blue hover:underline">
            Open doctor workspace
          </Link>
        </p>
      ) : null}
    </AuthShell>
  );
}

export default function OrgInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-page">
          <p className="text-sm font-semibold text-shell-muted">Loading…</p>
        </div>
      }
    >
      <OrgInvitationInner />
    </Suspense>
  );
}
