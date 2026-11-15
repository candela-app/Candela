'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import {
  GUARDIAN_RELATIONSHIP_OPTIONS,
  PROFILE_GENDER_OPTIONS,
  PROFILE_LANGUAGE_OPTIONS,
  ageFromIsoDate,
  type PatientIdentityProfile,
} from '@candela/shared';
import { ApiError, api } from '@/lib/api';
import { UserIcon } from '@/components/icons/VectorIcons';

function optionLabel(
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string | null | undefined,
): string {
  if (!value) return '—';
  return options.find((o) => o.value === value)?.label ?? value;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDobWithAge(iso: string | null | undefined): string {
  const date = formatDate(iso);
  if (!iso || date === '—') return '—';
  const age = ageFromIsoDate(iso);
  return age != null ? `${date} · ${age}y` : date;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-[4px] py-[8px] sm:flex-row sm:items-start sm:justify-between sm:gap-[13px]">
      <dt className="shrink-0 text-[13px] text-gray-500">{label}</dt>
      <dd className="min-w-0 break-words text-[13px] font-semibold leading-[21px] text-gray-950 sm:max-w-[70%] sm:text-right">
        {value}
      </dd>
    </div>
  );
}

function InfoGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-[13px] border border-gray-100 bg-gray-50/80 p-[13px]">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-gray-400">{title}</h3>
      <dl className="mt-[8px] divide-y divide-gray-100/80">{children}</dl>
    </div>
  );
}

function SkeletonBar({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-[8px] bg-slate-200/90 ${className}`} />;
}

export type IdentitySummaryStat = {
  label: string;
  value: string;
  hint: string;
  index: number;
};

function SummaryStatRow({ label, value, hint, index }: IdentitySummaryStat) {
  return (
    <div className="flex h-full items-center justify-between gap-[13px] rounded-[13px] border border-gray-200 bg-white p-[21px] shadow-[0_13px_34px_-13px_rgba(15,23,42,0.45)]">
      <div className="min-w-0">
        <p className="text-[13px] leading-[21px] text-gray-900">
          <span className="kpi-draw" style={{ '--kpi-delay': `${index * 120}ms` } as CSSProperties}>
            {label}
          </span>
        </p>
        <p className="mt-[8px] truncate text-[13px] leading-[21px] text-gray-500">{hint}</p>
      </div>
      <p className="shrink-0 whitespace-nowrap text-[34px] font-semibold leading-none tabular-nums text-gray-900">
        {value}
      </p>
    </div>
  );
}

function PhotoBlock({
  loading,
  photoUrl,
  photoLoaded,
  onPhotoLoad,
  initial,
  className,
}: {
  loading: boolean;
  photoUrl: string | null;
  photoLoaded: boolean;
  onPhotoLoad: () => void;
  initial: string;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[13px] bg-gradient-to-br from-slate-100 to-slate-200 ${className ?? ''}`}
    >
      {loading && !photoUrl ? (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-200 via-slate-100 to-slate-300" />
      ) : photoUrl ? (
        <>
          {!photoLoaded ? (
            <div
              className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-200 via-slate-100 to-slate-300"
              aria-hidden
            />
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={onPhotoLoad}
            onError={onPhotoLoad}
            className={`h-full w-full object-cover object-top transition-opacity duration-300 ${
              photoLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-[8px] text-slate-400">
          <div className="flex size-[55px] items-center justify-center rounded-full bg-white/80 text-[21px] font-semibold text-slate-500 shadow-sm">
            {initial}
          </div>
          <UserIcon className="absolute bottom-[13px] right-[13px] size-[21px] opacity-40" />
        </div>
      )}
    </div>
  );
}

export function DoctorPatientIdentityPanel({
  patientId,
  stats = [],
  profile: profileProp,
  profileLoading,
}: {
  patientId: string;
  stats?: IdentitySummaryStat[];
  /** When provided by the parent (incl. null), skip a second profile fetch. */
  profile?: PatientIdentityProfile | null;
  /** Parent-owned load: keep the identity skeleton until this flips false. */
  profileLoading?: boolean;
}) {
  const parentOwned = profileLoading !== undefined;
  const [profile, setProfile] = useState<PatientIdentityProfile | null>(profileProp ?? null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(parentOwned ? profileLoading : profileProp == null);
  const [photoLoaded, setPhotoLoaded] = useState(false);

  useEffect(() => {
    if (parentOwned) {
      setProfile(profileProp ?? null);
      setError('');
      setLoading(Boolean(profileLoading));
      return;
    }

    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const data = await api<PatientIdentityProfile>(`/api/doctors/me/patients/${patientId}/profile`);
        if (!cancelled) {
          setProfile(data);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setProfile(null);
          setError(err instanceof ApiError ? err.message : 'Could not load patient identity');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId, profileProp, profileLoading, parentOwned]);

  const photoUrl = profile?.profilePhotoUrl ?? null;
  useEffect(() => {
    setPhotoLoaded(false);
  }, [photoUrl]);

  if (error) {
    return (
      <div className="rounded-[13px] border border-red-100 bg-red-50 px-[21px] py-[13px] text-[13px] text-red-700">
        {error}
      </div>
    );
  }

  const name = profile?.name || 'Patient';
  const complete = profile?.completion.profileComplete ?? false;
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  const trialValue = !profile
    ? '—'
    : profile.trial.active
      ? profile.trial.daysRemaining != null
        ? `${profile.trial.daysRemaining}d left`
        : 'Active'
      : profile.trial.startedAt
        ? 'Ended'
        : '—';

  return (
    <div className="space-y-[21px]" aria-busy={loading}>
      {/* Row 1: photo | KPIs */}
      <div className="grid grid-cols-1 items-stretch gap-[13px] md:grid-cols-2">
        <PhotoBlock
          loading={loading}
          photoUrl={photoUrl}
          photoLoaded={photoLoaded}
          onPhotoLoad={() => setPhotoLoaded(true)}
          initial={initial}
          className="aspect-[4/3] w-full"
        />
        <div className="grid min-w-0 grid-cols-1 items-stretch gap-[13px]">
          {stats.map((stat) => (
            <SummaryStatRow key={stat.label} {...stat} />
          ))}
        </div>
      </div>

      {/* Row 2: doctor-organized patient information */}
      <section className="rounded-[13px] border border-gray-100 bg-white p-[21px] shadow-[0_13px_34px_-13px_rgba(15,23,42,0.45)]">
        {!loading && !complete && profile ? (
          <p className="mb-[13px] text-[13px] leading-[21px] text-amber-800">
            Incomplete · {profile.completion.missingFields.length} field
            {profile.completion.missingFields.length === 1 ? '' : 's'} still needed
          </p>
        ) : null}

        {loading || !profile ? (
          <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
            {Array.from({ length: 3 }).map((_, group) => (
              <div
                key={group}
                className="min-w-0 space-y-[8px] rounded-[13px] border border-gray-100 bg-gray-50/80 p-[13px]"
              >
                <SkeletonBar className="h-[13px] w-[89px]" />
                {Array.from({ length: 4 }).map((__, i) => (
                  <div key={i} className="flex items-center justify-between gap-[13px] py-[8px]">
                    <SkeletonBar className="h-[13px] w-[72px]" />
                    <SkeletonBar className="h-[13px] w-[89px]" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2 lg:grid-cols-3">
            <InfoGroup title="Reach them">
              <DetailRow label="Email" value={profile.email || '—'} />
              <DetailRow label="Phone" value={profile.phone || '—'} />
              <DetailRow
                label="Language"
                value={optionLabel(PROFILE_LANGUAGE_OPTIONS, profile.preferredLanguage)}
              />
              <DetailRow
                label="Profile"
                value={profile.completion.profileComplete ? 'Complete' : 'Incomplete'}
              />
            </InfoGroup>

            <InfoGroup title="Clinical">
              <DetailRow label="Date of birth" value={formatDobWithAge(profile.dateOfBirth)} />
              <DetailRow label="Gender" value={optionLabel(PROFILE_GENDER_OPTIONS, profile.gender)} />
              <DetailRow
                label="Location"
                value={[profile.city, profile.state, profile.country].filter(Boolean).join(', ') || '—'}
              />
              <DetailRow label="Trial" value={trialValue} />
            </InfoGroup>

            <InfoGroup title="Guardian / emergency">
              <DetailRow label="Contact" value={profile.guardianName || '—'} />
              <DetailRow
                label="Relationship"
                value={optionLabel(GUARDIAN_RELATIONSHIP_OPTIONS, profile.guardianRelationship)}
              />
              <DetailRow label="Phone" value={profile.guardianPhone || '—'} />
            </InfoGroup>
          </div>
        )}
      </section>
    </div>
  );
}
