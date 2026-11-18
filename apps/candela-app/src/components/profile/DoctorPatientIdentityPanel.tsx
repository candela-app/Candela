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
import { CopyButton } from '@/components/ui/CopyButton';
import {
  AccessibilityIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  MailIcon,
  UserIcon,
  UsersIcon,
} from '@/components/icons/VectorIcons';

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

function patientCodeFromId(id: string): string {
  const compact = id.replace(/-/g, '').slice(0, 6).toUpperCase();
  return `PAT-${compact || '------'}`;
}

function DetailRow({
  label,
  value,
  action,
  valueClassName = '',
}: {
  label: string;
  value: string;
  action?: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-[4px] py-[8px] sm:flex-row sm:items-start sm:justify-between sm:gap-[13px]">
      <dt className="shrink-0 text-[13px] text-gray-500">{label}</dt>
      <dd className="flex min-w-0 items-center justify-start gap-[8px] sm:max-w-[70%] sm:justify-end">
        <span
          className={`min-w-0 break-words text-[13px] font-semibold leading-[21px] text-gray-950 sm:text-right ${valueClassName}`}
        >
          {value}
        </span>
        {action}
      </dd>
    </div>
  );
}

function InfoGroup({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-[13px] border border-gray-200 bg-white p-[21px] shadow-[0_13px_34px_-13px_rgba(15,23,42,0.45)]">
      <h3 className="flex items-center justify-center gap-[8px] text-center text-[13px] font-semibold uppercase text-gray-400">
        <span className="inline-flex size-[14px] shrink-0 items-center justify-center text-gray-500" aria-hidden>
          {icon}
        </span>
        {title}
      </h3>
      <dl className="mt-[8px] divide-y divide-gray-100">{children}</dl>
    </div>
  );
}

function SkeletonBar({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-[8px] bg-slate-200/90 ${className}`} />;
}

function MetaChip({
  icon,
  children,
  className = 'bg-gray-100 text-gray-700',
}: {
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-[6px] rounded-full px-[10px] py-[4px] text-[12px] font-semibold ${className}`}
    >
      <span className="inline-flex size-[14px] shrink-0 items-center justify-center opacity-80" aria-hidden>
        {icon}
      </span>
      {children}
    </span>
  );
}

function AgeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-full" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function GenderIcon() {
  return <UserIcon className="size-full" />;
}

function LanguageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-full" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path
        d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9s1.3-6.3 3.8-9Z"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

export type IdentitySummaryStat = {
  label: string;
  value: string;
  hint: string;
  index: number;
  onClick?: () => void;
};

function SummaryStatCard({ label, value, hint, index, onClick }: IdentitySummaryStat) {
  const content = (
    <>
      <div className="min-w-0">
        <p className="text-[13px] leading-[21px] text-gray-900">
          <span className="kpi-draw" style={{ '--kpi-delay': `${index * 120}ms` } as CSSProperties}>
            {label}
          </span>
        </p>
        <p className="mt-[8px] truncate text-[13px] leading-[21px] text-gray-500">{hint}</p>
      </div>
      <div className="flex shrink-0 items-center gap-[8px]">
        <p className="whitespace-nowrap text-[34px] font-semibold leading-none tabular-nums text-gray-900">
          {value}
        </p>
        {onClick ? (
          <ArrowRightIcon className="size-[14px] text-gray-400 transition group-hover:text-blue-600" />
        ) : null}
      </div>
    </>
  );

  const layout =
    'flex h-full w-full items-center justify-between gap-[13px] rounded-[13px] border border-gray-200 bg-white p-[21px] shadow-[0_13px_34px_-13px_rgba(15,23,42,0.45)]';

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`group ${layout} text-left transition hover:border-blue-200 hover:bg-blue-50/40`}
      >
        {content}
      </button>
    );
  }

  return <div className={layout}>{content}</div>;
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
      className={`relative overflow-hidden rounded-[13px] border border-gray-100 bg-slate-100 ${className ?? ''}`}
    >
      {loading && !photoUrl ? (
        <div className="absolute inset-0 animate-pulse bg-slate-200" />
      ) : photoUrl ? (
        <>
          {!photoLoaded ? (
            <div className="absolute inset-0 animate-pulse bg-slate-200" aria-hidden />
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
          <div className="flex size-[55px] items-center justify-center rounded-full bg-white text-[21px] font-semibold text-slate-500 shadow-sm">
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
  fallbackName,
}: {
  patientId: string;
  stats?: IdentitySummaryStat[];
  /** When provided by the parent (incl. null), skip a second profile fetch. */
  profile?: PatientIdentityProfile | null;
  /** Parent-owned load: keep the identity skeleton until this flips false. */
  profileLoading?: boolean;
  /** Name to show before profile loads. */
  fallbackName?: string;
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

  const name = profile?.name || fallbackName || 'Patient';
  const complete = profile?.completion.profileComplete ?? false;
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const code = patientCodeFromId(patientId);
  const age = profile?.dateOfBirth ? ageFromIsoDate(profile.dateOfBirth) : null;
  const gender = optionLabel(PROFILE_GENDER_OPTIONS, profile?.gender);
  const language = optionLabel(PROFILE_LANGUAGE_OPTIONS, profile?.preferredLanguage);
  const trialActive = profile?.trial.active ?? false;

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
      {/* Hero: photo + identity | KPIs */}
      <section className="rounded-[13px] border border-gray-100 bg-white p-[21px] shadow-[0_13px_34px_-13px_rgba(15,23,42,0.45)]">
        <div className="flex flex-col gap-[21px] lg:flex-row lg:items-stretch lg:justify-between">
          <div className="flex min-w-0 flex-col gap-[21px] sm:flex-row sm:items-start">
            <PhotoBlock
              loading={loading}
              photoUrl={photoUrl}
              photoLoaded={photoLoaded}
              onPhotoLoad={() => setPhotoLoaded(true)}
              initial={initial}
              className="mx-auto h-[330px] w-full max-w-none shrink-0 sm:mx-0 sm:aspect-[2/3] sm:h-auto sm:w-[220px] sm:max-w-[220px]"
            />

            <div className="min-w-0 flex-1 space-y-[13px] text-center sm:text-left">
              <div className="inline-flex max-w-full items-center gap-[8px] rounded-[8px] border border-blue-200/60 bg-blue-50 px-[13px] py-[8px]">
                <span className="truncate text-[13px] font-semibold text-blue-800">
                  Patient ID <span className="font-mono">{code}</span>
                </span>
                <CopyButton text={code} label="Patient ID" iconSize={13} />
              </div>

              <div className="flex flex-wrap items-center justify-center gap-[8px] sm:justify-start">
                {loading ? (
                  <>
                    <SkeletonBar className="h-[24px] w-[72px] rounded-full" />
                    <SkeletonBar className="h-[24px] w-[72px] rounded-full" />
                    <SkeletonBar className="h-[24px] w-[72px] rounded-full" />
                    <SkeletonBar className="h-[24px] w-[72px] rounded-full" />
                  </>
                ) : (
                  <>
                    <MetaChip icon={<AgeIcon />}>
                      {age != null ? `${age} years` : 'Age —'}
                    </MetaChip>
                    <MetaChip icon={<GenderIcon />}>{gender !== '—' ? gender : 'Gender —'}</MetaChip>
                    <MetaChip icon={<LanguageIcon />}>
                      {language !== '—' ? language : 'Language —'}
                    </MetaChip>
                    {trialActive ? (
                      <MetaChip
                        icon={<CheckCircleIcon className="size-full" />}
                        className="bg-emerald-50 text-emerald-700"
                      >
                        Active
                      </MetaChip>
                    ) : complete ? (
                      <MetaChip
                        icon={<CheckCircleIcon className="size-full" />}
                        className="bg-emerald-50 text-emerald-700"
                      >
                        Complete
                      </MetaChip>
                    ) : (
                      <MetaChip
                        icon={<CheckCircleIcon className="size-full" />}
                        className="bg-amber-50 text-amber-800"
                      >
                        Incomplete
                      </MetaChip>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {stats.length > 0 ? (
            <div className="mx-auto grid w-full min-w-0 max-w-[377px] grid-cols-1 grid-rows-3 items-stretch gap-[21px] sm:mx-0 lg:w-[377px] lg:shrink-0">
              {stats.map((stat) => (
                <SummaryStatCard key={stat.label} {...stat} />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* Detail groups — separate cards */}
      <div className="space-y-[13px]">
        {!loading && !complete && profile ? (
          <p className="rounded-[13px] border border-amber-200 bg-amber-50 px-[13px] py-[13px] text-[13px] leading-[21px] text-amber-800">
            Incomplete · {profile.completion.missingFields.length} field
            {profile.completion.missingFields.length === 1 ? '' : 's'} still needed
          </p>
        ) : null}

        {loading || !profile ? (
          <div className="grid grid-cols-1 gap-[21px] sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
            {Array.from({ length: 3 }).map((_, group) => (
              <div
                key={group}
                className="min-w-0 space-y-[8px] rounded-[13px] border border-gray-200 bg-white p-[21px] shadow-[0_13px_34px_-13px_rgba(15,23,42,0.45)]"
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
          <div className="grid grid-cols-1 gap-[21px] sm:grid-cols-2 lg:grid-cols-3">
            <InfoGroup title="Reach them" icon={<MailIcon className="size-full" />}>
              <DetailRow
                label="Email"
                value={profile.email || '—'}
                action={
                  profile.email ? <CopyButton text={profile.email} label="Email" iconSize={13} /> : null
                }
              />
              <DetailRow
                label="Phone"
                value={profile.phone || '—'}
                action={
                  profile.phone ? <CopyButton text={profile.phone} label="Phone" iconSize={13} /> : null
                }
              />
              <DetailRow
                label="Language"
                value={optionLabel(PROFILE_LANGUAGE_OPTIONS, profile.preferredLanguage)}
              />
              <DetailRow
                label="Profile"
                value={profile.completion.profileComplete ? 'Complete' : 'Incomplete'}
                valueClassName={
                  profile.completion.profileComplete
                    ? 'rounded-full bg-emerald-50 px-[10px] py-[2px] text-emerald-700'
                    : 'rounded-full bg-amber-50 px-[10px] py-[2px] text-amber-800'
                }
              />
            </InfoGroup>

            <InfoGroup title="Clinical" icon={<AccessibilityIcon className="size-full" />}>
              <DetailRow label="Date of birth" value={formatDobWithAge(profile.dateOfBirth)} />
              <DetailRow label="Gender" value={optionLabel(PROFILE_GENDER_OPTIONS, profile.gender)} />
              <DetailRow
                label="Location"
                value={[profile.city, profile.state, profile.country].filter(Boolean).join(', ') || '—'}
              />
              <DetailRow
                label="Trial"
                value={trialValue}
                valueClassName={
                  profile.trial.active
                    ? 'rounded-full bg-blue-50 px-[10px] py-[2px] text-blue-800'
                    : ''
                }
              />
            </InfoGroup>

            <InfoGroup title="Guardian / emergency" icon={<UsersIcon className="size-full" />}>
              <DetailRow label="Contact" value={profile.guardianName || '—'} />
              <DetailRow
                label="Relationship"
                value={optionLabel(GUARDIAN_RELATIONSHIP_OPTIONS, profile.guardianRelationship)}
              />
              <DetailRow label="Phone" value={profile.guardianPhone || '—'} />
            </InfoGroup>
          </div>
        )}
      </div>
    </div>
  );
}
