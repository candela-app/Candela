'use client';

import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { ApiError, api } from '@/lib/api';
import type { DocIdRequestResult } from '@candela/shared';
import { FloatingLabelInput } from '@/components/ui/FloatingLabelInput';
import { CopyButton } from '@/components/ui/CopyButton';
import { FormEvent, useState } from 'react';

export function DocIdRequestCard() {
  const { session, refresh } = useAuth();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resending, setResending] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const patient = session?.patient;
  if (!patient) {
    return null;
  }

  const pending = patient.pendingDocIdRequest;
  const linked = Boolean(patient.doctorId && patient.referralCode);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
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
    } finally {
      setSaving(false);
    }
  }

  async function resendRequest() {
    setResending(true);
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
    } finally {
      setResending(false);
    }
  }

  async function cancelRequest() {
    setCancelling(true);
    try {
      await api('/api/docid/requests/cancel', {
        method: 'POST',
      });
      await refresh();
      toast.success('DocID request cancelled.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not cancel DocID request');
    } finally {
      setCancelling(false);
    }
  }

  async function settle(accept: boolean) {
    if (!pending) {
      return;
    }
    setResolving(true);
    try {
      await api(`/api/docid/requests/${pending.id}/${accept ? 'accept' : 'reject'}`, {
        method: 'POST',
      });
      await refresh();
      toast.success(accept ? 'Doctor link updated.' : 'Request rejected.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update request');
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-shell-blue">DocID</p>
            {linked ? (
              <div className="flex items-center gap-1.5 mt-1">
                <p className="text-sm text-gray-700">
                  Linked to <span className="font-mono font-bold text-blue-700">{patient.referralCode}</span>
                </p>
                <CopyButton text={patient.referralCode} label="DocID" iconSize={13} />
              </div>
            ) : (
              <p className="text-sm text-gray-700 mt-1">
                You are not linked to a doctor yet. Enter a DocID to request an attach.
              </p>
            )}
            {patient.previousReferralCodes?.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                Previous: {patient.previousReferralCodes.join(', ')}
              </p>
            )}
          </div>

          {pending ? (
            <div className="sm:max-w-md">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm text-gray-600">
                  Pending {pending.source === 'self' ? 'attach' : pending.source === 'change' ? 'reassignment' : 'transfer'} to{' '}
                  <span className="font-mono font-bold text-gray-900">{pending.targetReferralCode}</span>
                  {pending.targetDoctorName ? ` (Dr. ${pending.targetDoctorName})` : ''}.
                </p>
                <CopyButton text={pending.targetReferralCode} label="Target DocID" iconSize={13} />
              </div>
              {pending.recipientRole === 'doctor' ? (
                <div className="mt-3">
                  <p className="text-xs text-gray-500 mb-2.5">
                    The doctor must confirm. If they didn&apos;t receive the email, you can resend or cancel to enter a new code.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={resending || cancelling}
                      onClick={() => void resendRequest()}
                      className="px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-colors disabled:opacity-60"
                    >
                      {resending ? 'Resending…' : 'Resend Email'}
                    </button>
                    <button
                      type="button"
                      disabled={resending || cancelling}
                      onClick={() => void cancelRequest()}
                      className="px-3.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold transition-colors disabled:opacity-60"
                    >
                      {cancelling ? 'Cancelling…' : 'Cancel Request'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    disabled={resolving}
                    onClick={() => void settle(true)}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-60"
                  >
                    {resolving ? 'Saving…' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    disabled={resolving}
                    onClick={() => void settle(false)}
                    className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold disabled:opacity-60"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <FloatingLabelInput
                label="DocID"
                value={code}
                onChange={(v) => setCode(v.toUpperCase())}
                minLength={6}
                maxLength={6}
                required
                className="flex-1 min-w-[10rem] [&_input]:font-mono [&_input]:font-bold [&_input]:tracking-widest [&_input]:uppercase"
              />
              <button
                type="submit"
                disabled={saving || code.trim().length !== 6}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-60"
              >
                {saving ? 'Sending…' : linked ? 'Request change' : 'Request attach'}
              </button>
            </form>
          )}
        </div>
    </div>
  );
}
