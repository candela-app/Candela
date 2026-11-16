'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { MeProfileResponse, ProfileCompletionStatus } from '@candela/shared';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { dismissProfilePrompt, isProfilePromptDismissed } from '@/lib/profile-prompt';

function profileHref(role: string): string {
  if (role === 'doctor') return '/doctor/profile';
  if (role === 'admin') return '/admin/organization-profile';
  return '/profile';
}

function labelFor(role: string): string {
  if (role === 'doctor') return 'professional profile';
  if (role === 'admin') return 'organisation profile';
  return 'identity profile';
}

export function ProfileCompletionBanner() {
  const { session, loading } = useAuth();
  const [completion, setCompletion] = useState<ProfileCompletionStatus | null>(null);
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (loading || !session) {
      setVisible(false);
      setCompletion(null);
      return;
    }
    const role = session.user.role;
    if (role === 'super_admin') {
      setVisible(false);
      return;
    }
    if (isProfilePromptDismissed(session.user.id)) {
      setVisible(false);
      return;
    }

    let cancelled = false;
    setChecking(true);
    void (async () => {
      try {
        const me = await api<MeProfileResponse>('/api/me/profile');
        if (cancelled) return;
        const status =
          me.role === 'patient' || me.role === 'doctor'
            ? me.profile.completion
            : me.role === 'admin'
              ? me.profile?.completion ?? null
              : null;
        setCompletion(status);
        setVisible(Boolean(status && !status.profileComplete));
      } catch {
        if (!cancelled) {
          setVisible(false);
          setCompletion(null);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, session]);

  if (!session || checking || !visible || !completion || completion.profileComplete) {
    return null;
  }

  const role = session.user.role;
  const missing = completion.missingFields.slice(0, 4).join(', ');
  const more = completion.missingFields.length > 4 ? ` +${completion.missingFields.length - 4} more` : '';

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm leading-5">
          <p className="font-semibold">Complete your {labelFor(role)}</p>
          <p className="mt-0.5 text-amber-900/80">
            Still needed: {missing || 'required fields'}
            {more}. You can keep using Kandela meanwhile.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={profileHref(role)}
            className="rounded-xl bg-amber-900 px-3 py-2 text-sm font-semibold text-white"
          >
            Complete profile
          </Link>
          <button
            type="button"
            className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-950"
            onClick={() => {
              dismissProfilePrompt(session.user.id);
              setVisible(false);
            }}
          >
            Remind me later
          </button>
        </div>
      </div>
    </div>
  );
}
