'use client';

import { FormEvent, useEffect, useId, useMemo, useState } from 'react';
import {
  DEFAULT_PHONE_COUNTRY_CODE,
  GUARDIAN_RELATIONSHIP_OPTIONS,
  INDIA_STATE_OPTIONS,
  PROFILE_COUNTRY_OPTIONS,
  PROFILE_GENDER_OPTIONS,
  PROFILE_LANGUAGE_OPTIONS,
  ageFromIsoDate,
  type MeProfileResponse,
  type PatientIdentityProfile,
} from '@candela/shared';
import { ApiError, api, deleteProfilePhoto, uploadProfilePhoto } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import { clearProfilePromptDismiss } from '@/lib/profile-prompt';
import { useAuth } from '@/lib/auth-context';
import { CameraIcon, TrashIcon } from '@/components/icons/VectorIcons';

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
  dateOfBirth: string;
  gender: string;
  preferredLanguage: string;
  city: string;
  state: string;
  country: string;
  guardianName: string;
  guardianPhoneNational: string;
  guardianRelationship: string;
  guardianPhoneSameAsPatient: boolean;
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

function fromProfile(p: PatientIdentityProfile): Draft {
  const phoneNational = nationalFromE164(p.phone);
  const guardianPhoneNational = nationalFromE164(p.guardianPhone);
  return {
    name: p.name || '',
    phoneNational,
    dateOfBirth: p.dateOfBirth || '',
    gender: p.gender || '',
    preferredLanguage: p.preferredLanguage || '',
    city: p.city || '',
    state: p.state || '',
    country: p.country || 'IN',
    guardianName: p.guardianName || '',
    guardianPhoneNational,
    guardianRelationship: p.guardianRelationship || '',
    guardianPhoneSameAsPatient:
      Boolean(phoneNational) && phoneNational === guardianPhoneNational && Boolean(guardianPhoneNational),
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
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <FieldLabel label={label} required={required} htmlFor={id} />
      <input
        id={id}
        type="text"
        value={value}
        disabled={disabled}
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
  allowEmpty = true,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  allowEmpty?: boolean;
  required?: boolean;
}) {
  const id = useId();
  const hasValue = Boolean(value) && options.some((o) => o.value === value);
  const merged =
    value && !hasValue && value !== 'other' ? [{ value, label: value }, ...options] : options;

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
        {allowEmpty ? <option value="">Select…</option> : null}
        {merged.map((opt) => (
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
  disabled = false,
}: {
  label: string;
  national: string;
  onChange: (national: string) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <FieldLabel label={label} required={required} htmlFor={id} />
      <div
        className={`flex min-h-[55px] overflow-hidden rounded-[13px] border border-shell-border bg-white focus-within:border-shell-blue focus-within:ring-2 focus-within:ring-shell-blue/20 ${
          disabled ? 'opacity-60' : ''
        }`}
      >
        <span className="flex items-center border-r border-shell-border bg-gray-50 px-[13px] text-[13px] font-semibold text-gray-700">
          {DEFAULT_PHONE_COUNTRY_CODE}
        </span>
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={national}
          disabled={disabled}
          required={required}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
          className="w-full bg-transparent px-[13px] py-[13px] text-[13px] font-semibold text-shell-text outline-none"
          placeholder="9876543210"
        />
      </div>
    </div>
  );
}

function DateField({
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
        type="date"
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className={FIELD}
      />
    </div>
  );
}

function SkeletonBar({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-[13px] bg-slate-200/80 ${className}`} />;
}

export function PatientProfileFormSkeleton() {
  return (
    <div className="space-y-[21px]" aria-busy="true" aria-label="Loading profile">
      <div className={CARD}>
        <div className="flex flex-wrap items-start justify-between gap-[21px]">
          <div className="min-w-0 flex-1 space-y-[13px]">
            <div className="space-y-[8px]">
              <SkeletonBar className="h-[13px] w-[120px]" />
              <SkeletonBar className="h-[13px] w-[180px]" />
            </div>
            <div className="flex gap-[8px]">
              <SkeletonBar className="h-[34px] w-[130px] rounded-full" />
              <SkeletonBar className="h-[34px] w-[110px] rounded-full" />
            </div>
          </div>
          <SkeletonBar className="size-[89px] rounded-full" />
        </div>
      </div>

      <div className="grid gap-[21px] sm:grid-cols-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-[8px]">
            <SkeletonBar className="h-[13px] w-[89px]" />
            <SkeletonBar className="h-[55px] w-full" />
          </div>
        ))}
      </div>

      <div className={`${CARD} space-y-[13px]`}>
        <SkeletonBar className="h-[13px] w-[140px]" />
        <div className="grid gap-[21px] sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-[8px]">
              <SkeletonBar className="h-[13px] w-[110px]" />
              <SkeletonBar className="h-[55px] w-full" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-[13px]">
        <SkeletonBar className="h-[55px] w-[130px]" />
        <SkeletonBar className="h-[55px] w-[170px]" />
      </div>
    </div>
  );
}

export function PatientProfileForm() {
  const toast = useToast();
  const { session } = useAuth();
  const [profile, setProfile] = useState<PatientIdentityProfile | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [otherState, setOtherState] = useState('');
  const [photoLoaded, setPhotoLoaded] = useState(false);

  async function reload() {
    const me = await api<MeProfileResponse>('/api/me/profile');
    if (me.role !== 'patient') throw new Error('Not a patient profile');
    setProfile(me.profile);
    const next = fromProfile(me.profile);
    const knownState = INDIA_STATE_OPTIONS.some((s) => s.value === next.state);
    if (next.state && !knownState) {
      setOtherState(next.state);
      next.state = 'other';
    } else {
      setOtherState('');
    }
    setDraft(next);
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

  const isMinor = useMemo(() => {
    if (!draft?.dateOfBirth) return false;
    const age = ageFromIsoDate(draft.dateOfBirth);
    return age != null && age < 18;
  }, [draft?.dateOfBirth]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError('');
    try {
      const resolvedState =
        draft.state === 'other' ? otherState.trim() || null : draft.state.trim() || null;
      const phone = e164FromNational(draft.phoneNational);
      const guardianPhone = draft.guardianPhoneSameAsPatient
        ? phone
        : e164FromNational(draft.guardianPhoneNational);
      const body: Record<string, string | null> = {
        name: draft.name.trim(),
        phone,
        dateOfBirth: draft.dateOfBirth || null,
        gender: draft.gender || null,
        preferredLanguage: draft.preferredLanguage || null,
        city: draft.city.trim() || null,
        state: resolvedState,
        country: draft.country || null,
        guardianName: draft.guardianName.trim() || null,
        guardianPhone,
        guardianRelationship: draft.guardianRelationship || null,
      };
      const me = await api<MeProfileResponse>('/api/me/profile', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (me.role !== 'patient') throw new Error('Unexpected profile response');
      setProfile(me.profile);
      const next = fromProfile(me.profile);
      const knownState = INDIA_STATE_OPTIONS.some((s) => s.value === next.state);
      if (next.state && !knownState) {
        setOtherState(next.state);
        next.state = 'other';
      } else {
        setOtherState('');
      }
      setDraft(next);
      toast.success('Profile saved');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not save profile';
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
      if (me.role !== 'patient') throw new Error('Unexpected profile response');
      setProfile(me.profile);
      const next = fromProfile(me.profile);
      const knownState = INDIA_STATE_OPTIONS.some((s) => s.value === next.state);
      if (next.state && !knownState) {
        setOtherState(next.state);
        next.state = 'other';
      } else {
        setOtherState('');
      }
      setDraft(next);
      if (session?.user.id) clearProfilePromptDismiss(session.user.id);
      toast.success('Identity profile completed');
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
    return <PatientProfileFormSkeleton />;
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

            <div className="flex flex-wrap gap-[8px]">
              <span
                className={`inline-flex items-center rounded-full px-[13px] py-[8px] text-[13px] font-semibold ${
                  profile.completion.profileComplete
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'bg-amber-50 text-amber-900'
                }`}
              >
                {profile.completion.profileComplete ? 'Profile complete' : 'Profile incomplete'}
              </span>
              {profile.trial.startedAt ? (
                <span
                  className={`inline-flex items-center rounded-full px-[13px] py-[8px] text-[13px] font-semibold ${
                    profile.trial.active ? 'bg-sky-50 text-sky-900' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {profile.trial.active
                    ? profile.trial.daysRemaining != null
                      ? `Trial · ${profile.trial.daysRemaining}d left`
                      : 'Trial active'
                    : 'Trial ended'}
                </span>
              ) : null}
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
            <div className="size-full overflow-hidden rounded-full bg-gray-100 ring-2 ring-white shadow-[0_8px_24px_-12px_rgba(15,23,42,0.45)]">
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
          required
          onChange={(phoneNational) =>
            setDraft((prev) =>
              prev
                ? {
                    ...prev,
                    phoneNational,
                    guardianPhoneNational: prev.guardianPhoneSameAsPatient
                      ? phoneNational
                      : prev.guardianPhoneNational,
                  }
                : prev,
            )
          }
        />
        <DateField
          label="Date of birth"
          value={draft.dateOfBirth}
          onChange={(v) => setDraft({ ...draft, dateOfBirth: v })}
          required
        />
        <SelectField
          label="Gender"
          value={draft.gender}
          onChange={(v) => setDraft({ ...draft, gender: v })}
          options={PROFILE_GENDER_OPTIONS}
        />
        <SelectField
          label="Preferred language"
          value={draft.preferredLanguage}
          onChange={(v) => setDraft({ ...draft, preferredLanguage: v })}
          options={PROFILE_LANGUAGE_OPTIONS}
          required
        />
        <SelectField
          label="Country"
          value={draft.country}
          onChange={(v) => setDraft({ ...draft, country: v === 'other' ? '' : v })}
          options={PROFILE_COUNTRY_OPTIONS}
          required
        />
        <TextField
          label="City"
          value={draft.city}
          onChange={(v) => setDraft({ ...draft, city: v })}
          required
        />
        <SelectField
          label="State"
          value={draft.state}
          onChange={(v) => setDraft({ ...draft, state: v })}
          options={INDIA_STATE_OPTIONS}
          required
        />
        {draft.state === 'other' ? (
          <TextField label="State / region" value={otherState} onChange={setOtherState} required />
        ) : null}
        {draft.country === '' ||
        (draft.country && !PROFILE_COUNTRY_OPTIONS.some((c) => c.value === draft.country)) ? (
          <TextField
            label="Country code (ISO-2)"
            value={draft.country}
            onChange={(v) => setDraft({ ...draft, country: v.toUpperCase() })}
            required
          />
        ) : null}
      </div>

      <div className={`${CARD} space-y-[13px] border-blue-100 bg-blue-50/40`}>
        <div>
          <p className="text-[13px] font-semibold text-gray-900">Guardian details</p>
          <p className="mt-[8px] text-[13px] text-gray-600">
            {isMinor
              ? 'Required for patients under 18.'
              : 'Optional for adults; required if the patient is under 18.'}
          </p>
        </div>
        <div className="grid gap-[21px] sm:grid-cols-2">
          <TextField
            label="Guardian name"
            value={draft.guardianName}
            onChange={(v) => setDraft({ ...draft, guardianName: v })}
            required={isMinor}
          />
          <PhoneField
            label="Guardian phone"
            national={
              draft.guardianPhoneSameAsPatient ? draft.phoneNational : draft.guardianPhoneNational
            }
            required={isMinor}
            disabled={draft.guardianPhoneSameAsPatient}
            onChange={(guardianPhoneNational) => setDraft({ ...draft, guardianPhoneNational })}
          />
          <label className="flex items-center gap-[8px] text-[13px] font-semibold text-gray-800 sm:col-span-2">
            <input
              type="checkbox"
              className="size-[13px] rounded border-gray-300"
              checked={draft.guardianPhoneSameAsPatient}
              onChange={(e) => {
                const checked = e.target.checked;
                setDraft({
                  ...draft,
                  guardianPhoneSameAsPatient: checked,
                  guardianPhoneNational: checked ? draft.phoneNational : draft.guardianPhoneNational,
                });
              }}
            />
            Same as patient contact
          </label>
          <SelectField
            label="Guardian relationship"
            value={draft.guardianRelationship}
            onChange={(v) => setDraft({ ...draft, guardianRelationship: v })}
            options={GUARDIAN_RELATIONSHIP_OPTIONS}
            required={isMinor}
          />
        </div>
      </div>

      {error ? <p className="text-[13px] font-semibold text-red-600">{error}</p> : null}

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
      <p className="text-[13px] text-gray-500">Email: {profile.email} (not editable here)</p>
    </form>
  );
}
