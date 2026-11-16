'use client';

import { FormEvent, useEffect, useId, useState } from 'react';
import {
  DEFAULT_PHONE_COUNTRY_CODE,
  PROFILE_LANGUAGE_OPTIONS,
  type DoctorIdentityProfile,
  type MeProfileResponse,
} from '@candela/shared';
import { ApiError, api, deleteProfilePhoto, uploadProfilePhoto } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import { clearProfilePromptDismiss } from '@/lib/profile-prompt';
import { useAuth } from '@/lib/auth-context';
import { CameraIcon, TrashIcon } from '@/components/icons/VectorIcons';
import { CopyButton } from '@/components/ui/CopyButton';

const CARD =
  'rounded-[13px] border border-gray-100 bg-white p-[21px] shadow-[0_12px_32px_-14px_rgba(15,23,42,0.35)]';
const LABEL = 'mb-[8px] block text-[13px] font-semibold text-gray-700';
const FIELD =
  'w-full min-h-[55px] rounded-[13px] border border-shell-border bg-white px-[13px] py-[13px] text-[13px] font-semibold text-shell-text outline-none transition focus:border-shell-blue focus:ring-2 focus:ring-shell-blue/20 disabled:opacity-60';
const BTN_PRIMARY =
  'rounded-[13px] bg-blue-600 px-[21px] py-[13px] text-[13px] font-semibold text-white disabled:opacity-60';
const BTN_SECONDARY =
  'rounded-[13px] border border-gray-200 bg-white px-[21px] py-[13px] text-[13px] font-semibold text-gray-900 disabled:opacity-60';

type Draft = {
  name: string;
  phoneNational: string;
  professionalTitle: string;
  specialization: string;
  preferredLanguage: string;
  yearsExperience: string;
  externalRegistrationId: string;
  qualifications: string[];
};

function nationalFromE164(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length > 10) return digits.slice(2);
  return digits;
}

function e164FromNational(national: string): string | null {
  const digits = national.replace(/\D/g, '');
  if (!digits) return null;
  return `${DEFAULT_PHONE_COUNTRY_CODE}${digits}`;
}

function fromProfile(p: DoctorIdentityProfile): Draft {
  return {
    name: p.name || '',
    phoneNational: nationalFromE164(p.phone),
    professionalTitle: p.professionalTitle || '',
    specialization: p.specialization || '',
    preferredLanguage: p.preferredLanguage || '',
    yearsExperience: p.yearsExperience != null ? String(p.yearsExperience) : '',
    externalRegistrationId: p.externalRegistrationId || '',
    qualifications: p.qualifications?.length ? [...p.qualifications] : [''],
  };
}

function FieldLabel({ label, required = false, htmlFor }: { label: string; required?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className={LABEL}>
      {label}
      {required ? <span className="text-red-600"> *</span> : null}
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <FieldLabel label={label} required={required} htmlFor={id} />
      <input
        id={id}
        type="text"
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className={FIELD}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <FieldLabel label={label} required={required} htmlFor={id} />
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className={FIELD}
      >
        <option value="">Select…</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function PhoneField({
  label,
  national,
  onChange,
  required = false,
}: {
  label: string;
  national: string;
  onChange: (national: string) => void;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <FieldLabel label={label} required={required} htmlFor={id} />
      <div className="flex min-h-[55px] overflow-hidden rounded-[13px] border border-shell-border bg-white focus-within:border-shell-blue focus-within:ring-2 focus-within:ring-shell-blue/20">
        <span className="flex items-center border-r border-shell-border bg-gray-50 px-[13px] text-[13px] font-semibold text-gray-700">
          {DEFAULT_PHONE_COUNTRY_CODE}
        </span>
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={national}
          required={required}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
          className="w-full bg-transparent px-[13px] py-[13px] text-[13px] font-semibold text-shell-text outline-none"
          placeholder="9876543210"
        />
      </div>
    </div>
  );
}

function SkeletonBar({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-[13px] bg-slate-200/80 ${className}`} />;
}

export function DoctorProfileFormSkeleton() {
  return (
    <div className="space-y-[21px]" aria-busy="true" aria-label="Loading profile">
      <div className={CARD}>
        <div className="flex flex-wrap items-start justify-between gap-[21px]">
          <div className="min-w-0 flex-1 space-y-[13px]">
            <div className="space-y-[8px]">
              <SkeletonBar className="h-[13px] w-[120px]" />
              <SkeletonBar className="h-[13px] w-[180px]" />
            </div>
            <SkeletonBar className="h-[34px] w-[140px] rounded-full" />
          </div>
          <SkeletonBar className="size-[89px] rounded-full" />
        </div>
      </div>
      <div className="grid gap-[21px] sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-[8px]">
            <SkeletonBar className="h-[13px] w-[88px]" />
            <SkeletonBar className="h-[55px] w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DoctorProfileForm() {
  const toast = useToast();
  const { session } = useAuth();
  const [profile, setProfile] = useState<DoctorIdentityProfile | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoLoaded, setPhotoLoaded] = useState(false);

  async function reload() {
    const me = await api<MeProfileResponse>('/api/me/profile');
    if (me.role !== 'doctor') throw new Error('Not a doctor profile');
    setProfile(me.profile);
    setDraft(fromProfile(me.profile));
  }

  useEffect(() => {
    void (async () => {
      try {
        await reload();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not load profile');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const photoUrl = profile?.profilePhotoUrl ?? null;
  useEffect(() => {
    setPhotoLoaded(false);
  }, [photoUrl]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError('');
    try {
      const years =
        draft.yearsExperience.trim() === ''
          ? null
          : Number.parseInt(draft.yearsExperience, 10);
      if (years != null && (!Number.isFinite(years) || years < 0)) {
        throw new Error('Years of experience must be a non-negative integer');
      }
      const quals = draft.qualifications.map((q) => q.trim()).filter(Boolean);
      const me = await api<MeProfileResponse>('/api/me/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name: draft.name.trim(),
          phone: e164FromNational(draft.phoneNational),
          professionalTitle: draft.professionalTitle.trim() || null,
          specialization: draft.specialization.trim() || null,
          preferredLanguage: draft.preferredLanguage || null,
          yearsExperience: years,
          externalRegistrationId: draft.externalRegistrationId.trim() || null,
          qualifications: quals.length ? quals : null,
        }),
      });
      if (me.role !== 'doctor') throw new Error('Unexpected profile response');
      setProfile(me.profile);
      setDraft(fromProfile(me.profile));
      toast.success('Professional profile saved');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save profile';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function onComplete() {
    setCompleting(true);
    setError('');
    try {
      const me = await api<MeProfileResponse>('/api/me/profile/complete', { method: 'POST' });
      if (me.role !== 'doctor') throw new Error('Unexpected profile response');
      setProfile(me.profile);
      setDraft(fromProfile(me.profile));
      if (session?.user.id) clearProfilePromptDismiss(session.user.id);
      toast.success('Professional profile completed');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not complete profile';
      setError(msg);
      toast.error(msg);
    } finally {
      setCompleting(false);
    }
  }

  async function onPhoto(file: File | null) {
    if (!file) return;
    setPhotoBusy(true);
    try {
      await uploadProfilePhoto(file);
      await reload();
      toast.success('Photo updated');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not upload photo');
    } finally {
      setPhotoBusy(false);
    }
  }

  if (loading || !draft || !profile) {
    return error ? (
      <p className="text-[13px] font-medium text-red-600">{error}</p>
    ) : (
      <DoctorProfileFormSkeleton />
    );
  }

  return (
    <form onSubmit={onSave} className="space-y-[21px]">
      <div className={CARD}>
        <div className="flex flex-wrap items-start justify-between gap-[21px]">
          <div className="min-w-0 flex-1 space-y-[13px]">
            <div>
              <p className="text-[13px] font-semibold text-gray-900">{profile.name || 'Your profile'}</p>
              <p className="mt-[4px] text-[13px] text-gray-500">{profile.email}</p>
            </div>

            <div className="flex flex-wrap items-center gap-[8px]">
              <span className="inline-flex items-center gap-[8px] rounded-full border border-blue-200 bg-blue-50 px-[13px] py-[8px] font-mono text-[13px] font-semibold text-blue-700">
                {profile.referralCode}
                <CopyButton text={profile.referralCode} label="DocID" iconSize={13} />
              </span>
              <span
                className={`inline-flex items-center rounded-full px-[13px] py-[8px] text-[13px] font-semibold ${
                  profile.completion.profileComplete
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'bg-amber-50 text-amber-900'
                }`}
              >
                {profile.completion.profileComplete ? 'Profile complete' : 'Profile incomplete'}
              </span>
            </div>

            {!profile.completion.profileComplete ? (
              <p className="text-[13px] leading-[21px] text-gray-600">
                Still needed: {profile.completion.missingFields.slice(0, 3).join(', ') || 'required fields'}
                {profile.completion.missingFields.length > 3
                  ? ` +${profile.completion.missingFields.length - 3} more`
                  : ''}
              </p>
            ) : null}
          </div>

          <div className="relative size-[89px] shrink-0">
            <div className="size-full overflow-hidden rounded-full bg-gray-100 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.45)] ring-2 ring-white">
              {photoUrl ? (
                <>
                  {!photoLoaded ? (
                    <div className="absolute inset-0 animate-pulse rounded-full bg-slate-200" aria-hidden />
                  ) : null}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    onLoad={() => setPhotoLoaded(true)}
                    onError={() => setPhotoLoaded(true)}
                    className={`size-full object-cover transition-opacity ${
                      photoLoaded ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                </>
              ) : (
                <div className="flex size-full items-center justify-center text-[13px] font-semibold text-gray-400">
                  {(profile.name || '?').trim().charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <label
              className={`absolute bottom-0 right-0 flex size-[34px] cursor-pointer items-center justify-center rounded-full border-2 border-white bg-gray-950 text-white shadow-md transition hover:bg-black ${
                photoBusy ? 'pointer-events-none opacity-60' : ''
              }`}
              title={photoBusy ? 'Uploading…' : 'Change photo'}
              aria-label={photoBusy ? 'Uploading photo' : 'Change photo'}
            >
              <CameraIcon className="size-[16px]" />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={photoBusy}
                onChange={(e) => void onPhoto(e.target.files?.[0] ?? null)}
              />
            </label>

            {profile.profilePhotoPath ? (
              <button
                type="button"
                disabled={photoBusy}
                title="Remove photo"
                aria-label="Remove photo"
                className="absolute -right-1 -top-1 flex size-[28px] items-center justify-center rounded-full border-2 border-white bg-white text-red-600 shadow-md transition hover:bg-red-50 disabled:opacity-60"
                onClick={() => {
                  if (!window.confirm('Remove your profile photo?')) return;
                  void (async () => {
                    setPhotoBusy(true);
                    try {
                      await deleteProfilePhoto();
                      await reload();
                      toast.success('Photo removed');
                    } catch (err) {
                      toast.error(err instanceof ApiError ? err.message : 'Could not remove photo');
                    } finally {
                      setPhotoBusy(false);
                    }
                  })();
                }}
              >
                <TrashIcon className="size-[13px]" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-[21px] sm:grid-cols-2">
        <TextField
          label="Name"
          value={draft.name}
          onChange={(v) => setDraft({ ...draft, name: v })}
          required
        />
        <PhoneField
          label="Phone"
          national={draft.phoneNational}
          onChange={(phoneNational) => setDraft({ ...draft, phoneNational })}
          required
        />
        <TextField
          label="Professional title"
          value={draft.professionalTitle}
          onChange={(v) => setDraft({ ...draft, professionalTitle: v })}
          required
        />
        <TextField
          label="Specialization"
          value={draft.specialization}
          onChange={(v) => setDraft({ ...draft, specialization: v })}
          required
        />
        <SelectField
          label="Preferred language"
          value={draft.preferredLanguage}
          onChange={(v) => setDraft({ ...draft, preferredLanguage: v })}
          options={PROFILE_LANGUAGE_OPTIONS}
          required
        />
        <TextField
          label="Years of experience"
          value={draft.yearsExperience}
          onChange={(v) => setDraft({ ...draft, yearsExperience: v.replace(/[^\d]/g, '') })}
        />
        <TextField
          label="External registration ID"
          value={draft.externalRegistrationId}
          onChange={(v) => setDraft({ ...draft, externalRegistrationId: v })}
        />
      </div>

      <div className={CARD}>
        <p className="text-[13px] font-semibold text-gray-900">
          Qualifications <span className="text-red-600">*</span>
        </p>
        <div className="mt-[13px] space-y-[13px]">
          {draft.qualifications.map((q, idx) => (
            <div key={idx} className="flex flex-wrap items-end gap-[8px]">
              <div className="min-w-0 flex-1">
                <TextField
                  label={`Qualification ${idx + 1}`}
                  value={q}
                  onChange={(v) => {
                    const next = [...draft.qualifications];
                    next[idx] = v;
                    setDraft({ ...draft, qualifications: next });
                  }}
                  required={idx === 0}
                />
              </div>
              {draft.qualifications.length > 1 ? (
                <button
                  type="button"
                  className={BTN_SECONDARY}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      qualifications: draft.qualifications.filter((_, i) => i !== idx),
                    })
                  }
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-[13px] text-[13px] font-semibold text-blue-700"
          onClick={() => setDraft({ ...draft, qualifications: [...draft.qualifications, ''] })}
        >
          Add qualification
        </button>
      </div>

      {error ? <p className="text-[13px] font-medium text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-[13px]">
        <button type="submit" disabled={saving} className={BTN_PRIMARY}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          disabled={completing || profile.completion.profileComplete}
          onClick={() => void onComplete()}
          className={BTN_SECONDARY}
        >
          {completing ? 'Completing…' : 'Mark profile complete'}
        </button>
      </div>
      <p className="text-[13px] text-gray-500">Email and DocID are not editable here.</p>
    </form>
  );
}
