'use client';

import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { ApiError, api } from '@/lib/api';
import type { DocIdRequestResult } from '@candela/shared';
import { FloatingLabelInput } from '@/components/ui/FloatingLabelInput';
import { CopyButton } from '@/components/ui/CopyButton';
import { FormEvent, useState } from 'react';

export function DocIdRequestCard({ embedded = false }: { embedded?: boolean }) {
  const { session, refresh } = useAuth();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resending, setResending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');

  const patient = session?.patient;
  if (!patient) {
    return null;
  }

  const pending = patient.pendingDocIdRequest;
  const linked = Boolean(patient.doctorId && patient.referralCode);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await api<DocIdRequestResult>('/api/docid/requests', {
        method: 'POST',
        body: JSON.stringify({ referralCode: code.trim().toUpperCase() }),
      });
      setCode('');
      await refresh();
      if (result.recipientRole === 'doctor') {
        toast.success(
          result.emailSent
            ? `Request sent to the doctor for DocID ${result.targetReferralCode}.`
            : `Request saved for DocID ${result.targetReferralCode}. Ask the doctor to confirm in their dashboard if the email is delayed.`,
        );
      } else {
        toast.success(
          result.emailSent
            ? `Check your email to confirm the transfer to DocID ${result.targetReferralCode}.`
            : `Request saved. Confirm below if the email is delayed.`,
        );
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not submit DocID');
      setError(err instanceof ApiError ? err.message : 'Could not submit DocID');
    } finally {
      setSaving(false);
    }
  }

  async function resendRequest() {
    setResending(true);
    setError('');
    try {
      const result = await api<DocIdRequestResult>('/api/docid/requests/resend', {
        method: 'POST',
      });
      await refresh();
      toast.success(
        result.emailSent
          ? `Request email resent for DocID ${result.targetReferralCode}.`
          : `Request updated for DocID ${result.targetReferralCode}. The link is active.`,
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not resend DocID request');
      setError(err instanceof ApiError ? err.message : 'Could not resend DocID request');
    } finally {
      setResending(false);
    }
  }

  async function cancelRequest() {
    setCancelling(true);
    setError('');
    try {
      await api('/api/docid/requests/cancel', {
        method: 'POST',
      });
      await refresh();
      toast.success('DocID request cancelled.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not cancel DocID request');
      setError(err instanceof ApiError ? err.message : 'Could not cancel DocID request');
    } finally {
      setCancelling(false);
    }
  }

  async function settle(accept: boolean) {
    if (!pending) {
      return;
    }
    setResolving(true);
    setError('');
    try {
      await api(`/api/docid/requests/${pending.id}/${accept ? 'accept' : 'reject'}`, {
        method: 'POST',
      });
      await refresh();
      toast.success(accept ? 'Doctor link updated.' : 'Request rejected.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update request');
      setError(err instanceof ApiError ? err.message : 'Could not update request');
    } finally {
      setResolving(false);
    }
  }

  const pendingKind = pending?.source === 'self' ? 'attach' : pending?.source === 'change' ? 'reassignment' : 'transfer';
  const requestForm = pending ? (
    <div className="space-y-[13px]">
      <p className="text-[13px] leading-[21px] text-gray-600 text-pretty">
        Pending {pendingKind} to{' '}
        <span className="font-mono font-semibold tabular-nums text-gray-900">{pending.targetReferralCode}</span>
        {pending.targetDoctorName ? ` (Dr. ${pending.targetDoctorName})` : ''}.
      </p>
      {pending.recipientRole === 'doctor' ? (
        <>
          <p className="text-[13px] leading-[21px] text-gray-500 text-pretty">
            The doctor must confirm. If they didn&apos;t receive the email, you can resend or cancel.
          </p>
          <div className="flex flex-wrap gap-[13px]">
            <button
              type="button"
              disabled={resending || cancelling}
              onClick={() => void resendRequest()}
              className="rounded-[13px] bg-blue-600 px-[13px] py-[13px] text-[13px] font-semibold text-white disabled:opacity-60"
            >
              {resending ? 'Resending…' : 'Resend email'}
            </button>
            <button
              type="button"
              disabled={resending || cancelling}
              onClick={() => void cancelRequest()}
              className="rounded-[13px] border border-gray-200 bg-white px-[13px] py-[13px] text-[13px] font-semibold text-gray-900 disabled:opacity-60"
            >
              {cancelling ? 'Cancelling…' : 'Cancel request'}
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-[13px]">
          <button
            type="button"
            disabled={resolving}
            onClick={() => void settle(true)}
            className="rounded-[13px] bg-blue-600 px-[13px] py-[13px] text-[13px] font-semibold text-white disabled:opacity-60"
          >
            {resolving ? 'Saving…' : 'Confirm'}
          </button>
          <button
            type="button"
            disabled={resolving}
            onClick={() => void settle(false)}
            className="rounded-[13px] border border-gray-200 bg-white px-[13px] py-[13px] text-[13px] font-semibold text-gray-900 disabled:opacity-60"
          >
            Reject
          </button>
        </div>
      )}
      {error ? <p className="text-[13px] leading-[21px] font-medium text-red-600 text-pretty">{error}</p> : null}
    </div>
  ) : (
    <form onSubmit={onSubmit} className="flex flex-col gap-[13px] sm:flex-row sm:items-center">
      <FloatingLabelInput
        label="DocID"
        value={code}
        onChange={(v) => setCode(v.toUpperCase())}
        minLength={6}
        maxLength={6}
        required
        className="min-w-[10rem] flex-1 [&_input]:font-mono [&_input]:font-semibold [&_input]:uppercase"
      />
      <button
        type="submit"
        disabled={saving || code.trim().length !== 6}
        className="rounded-[13px] bg-blue-600 px-[13px] py-[13px] text-[13px] font-semibold text-white disabled:opacity-60"
      >
        {saving ? 'Sending…' : linked ? 'Request a change' : 'Request attach'}
      </button>
      {error ? <p className="text-[13px] leading-[21px] font-medium text-red-600 text-pretty sm:basis-full">{error}</p> : null}
    </form>
  );

  if (embedded) {
    return <div className="mt-[21px]">{requestForm}</div>;
  }

  return (
    <div className="rounded-[13px] border border-gray-200 bg-white p-[21px] shadow-[0_12px_32px_-14px_rgba(15,23,42,0.35)]">
      <p className="text-sm text-gray-500">DocID</p>
      {linked ? (
        <div className="mt-1 flex items-center gap-1.5">
          <p className="text-sm text-gray-700 text-pretty">
            Linked to{' '}
            {patient.doctorName ? <span className="font-semibold text-gray-900">Dr. {patient.doctorName}</span> : 'your doctor'}
            {' · '}
            <span className="font-mono font-semibold tabular-nums text-gray-900">{patient.referralCode}</span>
          </p>
          <CopyButton text={patient.referralCode} label="DocID" iconSize={13} />
        </div>
      ) : (
        <p className="mt-1 text-sm text-gray-700 text-pretty">
          You are not linked to a doctor yet. Enter a DocID to request an attach.
        </p>
      )}
      {patient.previousReferralCodes?.length > 0 ? (
        <p className="mt-1 text-xs text-gray-400 text-pretty">
          Previous: {patient.previousReferralCodes.join(', ')}
        </p>
      ) : null}

      {pending ? (
        <div className="mt-5 border-t border-gray-100 pt-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm text-gray-600 text-pretty">
              Pending {pending.source === 'self' ? 'attach' : pending.source === 'change' ? 'reassignment' : 'transfer'} to{' '}
              <span className="font-mono font-bold tabular-nums text-gray-900">{pending.targetReferralCode}</span>
              {pending.targetDoctorName ? ` (Dr. ${pending.targetDoctorName})` : ''}.
            </p>
            <CopyButton text={pending.targetReferralCode} label="Target DocID" iconSize={13} />
          </div>
          {pending.recipientRole === 'doctor' ? (
            <div className="mt-3">
              <p className="mb-2.5 text-xs text-gray-500 text-pretty">
                The doctor must confirm. If they didn&apos;t receive the email, you can resend or cancel to enter a new code.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={resending || cancelling}
                  onClick={() => void resendRequest()}
                  className="rounded-xl bg-blue-50 px-3.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                >
                  {resending ? 'Resending…' : 'Resend email'}
                </button>
                <button
                  type="button"
                  disabled={resending || cancelling}
                  onClick={() => void cancelRequest()}
                  className="rounded-xl bg-gray-100 px-3.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200 disabled:opacity-60"
                >
                  {cancelling ? 'Cancelling…' : 'Cancel request'}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={resolving}
                onClick={() => void settle(true)}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {resolving ? 'Saving…' : 'Confirm'}
              </button>
              <button
                type="button"
                disabled={resolving}
                onClick={() => void settle(false)}
                className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-60"
              >
                Reject
              </button>
            </div>
          )}
          {error ? <p className="mt-3 text-sm font-medium text-red-600 text-pretty">{error}</p> : null}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-5 border-t border-gray-100 pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <FloatingLabelInput
              label="DocID"
              value={code}
              onChange={(v) => setCode(v.toUpperCase())}
              minLength={6}
              maxLength={6}
              required
              className="flex-1 min-w-[10rem] [&_input]:font-mono [&_input]:font-bold [&_input]:uppercase"
            />
            <button
              type="submit"
              disabled={saving || code.trim().length !== 6}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Sending…' : linked ? 'Request change' : 'Request attach'}
            </button>
          </div>
          {error ? <p className="mt-3 text-sm font-medium text-red-600 text-pretty">{error}</p> : null}
        </form>
      )}
    </div>
  );
}
