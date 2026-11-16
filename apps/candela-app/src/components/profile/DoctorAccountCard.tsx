'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  PROFILE_LANGUAGE_OPTIONS,
  type DoctorIdentityProfile,
  type MeProfileResponse,
  type SessionUser,
} from '@candela/shared';
import { api } from '@/lib/api';
import { CopyButton } from '@/components/ui/CopyButton';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  PencilIcon,
  UserIcon,
  VerifiedBadgeIcon,
} from '@/components/icons/VectorIcons';

function optionLabel(
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string | null | undefined,
): string {
  if (!value) return '—';
  return options.find((o) => o.value === value)?.label ?? value;
}

function DetailRow({
  label,
  value,
  action,
}: {
  label: string;
  value: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-[34px] items-center justify-between gap-[8px]">
      <dt className="shrink-0 text-[13px] text-gray-500">{label}</dt>
      <dd className="flex min-w-0 items-center justify-end gap-[8px]">
        <span className="truncate text-right text-[13px] font-semibold text-gray-950">{value}</span>
        {action}
      </dd>
    </div>
  );
}

type Props = {
  session: SessionUser;
};

type PanelId = 'contact' | 'practice' | 'clinic';

const PANELS: ReadonlyArray<{ id: PanelId; title: string }> = [
  { id: 'contact', title: 'Contact' },
  { id: 'practice', title: 'Practice' },
  { id: 'clinic', title: 'Clinic' },
];

const PANEL_BODY_CLASS = 'h-[136px]';
const CARD =
  'mx-auto w-full max-w-[377px] overflow-hidden rounded-[21px] border border-gray-100 bg-white shadow-[0_13px_34px_-13px_rgba(15,23,42,0.45)]';

function SkeletonBar({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-[8px] bg-slate-200/90 ${className}`} />;
}

export function DoctorAccountCardSkeleton() {
  return (
    <article className={CARD} aria-busy aria-label="Loading account">
      <div className="relative aspect-[4/3] animate-pulse bg-gradient-to-br from-slate-200 via-slate-100 to-slate-300" />
      <div className="space-y-[13px] px-[21px] pb-[21px] pt-[13px]">
        <SkeletonBar className="h-[21px] w-[160px]" />
        <SkeletonBar className="h-[13px] w-[200px]" />
        <div className="rounded-[13px] border border-gray-100 bg-gray-50/80 px-[13px] py-[13px]">
          <div className="mb-[8px] flex items-center justify-between gap-[8px]">
            <SkeletonBar className="size-[34px] rounded-full" />
            <SkeletonBar className="h-[13px] w-[72px]" />
            <SkeletonBar className="size-[34px] rounded-full" />
          </div>
          <div className={`${PANEL_BODY_CLASS} flex flex-col justify-between py-[8px]`}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex h-[34px] items-center justify-between gap-[8px]">
                <SkeletonBar className="h-[13px] w-[72px]" />
                <SkeletonBar className="h-[13px] w-[120px]" />
              </div>
            ))}
          </div>
          <div className="mt-[8px] flex items-center justify-center gap-[8px]">
            <SkeletonBar className="h-[8px] w-[21px] rounded-full" />
            <SkeletonBar className="h-[8px] w-[8px] rounded-full" />
            <SkeletonBar className="h-[8px] w-[8px] rounded-full" />
          </div>
        </div>
        <SkeletonBar className="h-[55px] w-full rounded-[13px]" />
      </div>
    </article>
  );
}

export function DoctorAccountCard({ session }: Props) {
  const [profile, setProfile] = useState<DoctorIdentityProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [panelIndex, setPanelIndex] = useState(0);
  const [photoLoaded, setPhotoLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const me = await api<MeProfileResponse>('/api/me/profile');
        if (cancelled || me.role !== 'doctor') return;
        setProfile(me.profile);
      } catch {
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const photoUrl = profile?.profilePhotoUrl ?? null;

  useEffect(() => {
    setPhotoLoaded(false);
  }, [photoUrl]);

  const name = profile?.name || session.user.name;
  const complete = profile?.completion.profileComplete ?? false;
  const docId = profile?.referralCode || session.doctor?.referralCode || null;
  const orgName = session.organization?.name || '—';
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const qualifications =
    profile?.qualifications && profile.qualifications.length > 0
      ? profile.qualifications.join(', ')
      : '—';

  const panel = PANELS[panelIndex] ?? PANELS[0];
  const goPrev = () => setPanelIndex((i) => (i - 1 + PANELS.length) % PANELS.length);
  const goNext = () => setPanelIndex((i) => (i + 1) % PANELS.length);

  const panelBody = useMemo(() => {
    if (!profile) {
      return (
        <p className="flex h-full items-center justify-center text-[13px] text-gray-500">
          Could not load details.
        </p>
      );
    }

    if (panel.id === 'contact') {
      return (
        <dl className="flex h-full flex-col justify-between py-[8px]">
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
        </dl>
      );
    }

    if (panel.id === 'practice') {
      return (
        <dl className="flex h-full flex-col justify-between py-[8px]">
          <DetailRow label="Title" value={profile.professionalTitle || '—'} />
          <DetailRow label="Specialization" value={profile.specialization || '—'} />
          <DetailRow
            label="Experience"
            value={
              profile.yearsExperience != null ? `${profile.yearsExperience} years` : '—'
            }
          />
          <DetailRow label="Qualifications" value={qualifications} />
        </dl>
      );
    }

    return (
      <dl className="flex h-full flex-col justify-between py-[8px]">
        <DetailRow
          label="DocID"
          value={docId || '—'}
          action={docId ? <CopyButton text={docId} label="DocID" iconSize={13} /> : null}
        />
        <DetailRow label="Organisation" value={orgName} />
        <DetailRow label="Registration ID" value={profile.externalRegistrationId || '—'} />
        <DetailRow
          label="Missing"
          value={
            profile.completion.profileComplete
              ? 'None'
              : `${profile.completion.missingFields.length} field${
                  profile.completion.missingFields.length === 1 ? '' : 's'
                }`
          }
        />
      </dl>
    );
  }, [panel.id, profile, qualifications, docId, orgName]);

  if (loading) {
    return <DoctorAccountCardSkeleton />;
  }

  return (
    <article className={CARD}>
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
        {photoUrl ? (
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
              onLoad={() => setPhotoLoaded(true)}
              onError={() => setPhotoLoaded(true)}
              className={`h-full w-full object-cover transition-opacity duration-300 ${
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

      <div className="space-y-[13px] px-[21px] pb-[21px] pt-[13px]">
        <div className="flex items-center gap-[8px]">
          <h3 className="truncate text-[21px] font-semibold leading-none tracking-tight text-gray-950">
            {name}
          </h3>
          {complete ? (
            <VerifiedBadgeIcon
              className="size-[21px] shrink-0 text-blue-600"
              aria-label="Profile complete"
            />
          ) : null}
        </div>
        {profile?.professionalTitle || profile?.specialization ? (
          <p className="truncate text-[13px] leading-[21px] text-gray-500">
            {[profile.professionalTitle, profile.specialization].filter(Boolean).join(' · ')}
          </p>
        ) : null}

        <div className="rounded-[13px] border border-gray-100 bg-gray-50/80 px-[13px] py-[13px]">
          <div className="mb-[8px] flex items-center justify-between gap-[8px]">
            <button
              type="button"
              onClick={goPrev}
              className="flex size-[34px] items-center justify-center rounded-full bg-white text-gray-700 shadow-sm hover:bg-gray-100"
              aria-label="Previous details"
            >
              <ArrowLeftIcon className="size-[13px]" />
            </button>
            <p className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">
              {panel.title}
            </p>
            <button
              type="button"
              onClick={goNext}
              className="flex size-[34px] items-center justify-center rounded-full bg-white text-gray-700 shadow-sm hover:bg-gray-100"
              aria-label="Next details"
            >
              <ArrowRightIcon className="size-[13px]" />
            </button>
          </div>

          <div className={PANEL_BODY_CLASS}>{panelBody}</div>

          <div className="mt-[8px] flex items-center justify-center gap-[8px]">
            {PANELS.map((p, i) => (
              <button
                key={p.id}
                type="button"
                aria-label={`Show ${p.title}`}
                aria-current={i === panelIndex ? 'true' : undefined}
                onClick={() => setPanelIndex(i)}
                className={`h-[8px] rounded-full transition-all ${
                  i === panelIndex ? 'w-[21px] bg-gray-900' : 'w-[8px] bg-gray-300 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>
        </div>

        <Link
          href="/doctor/profile"
          className="flex w-full items-center justify-center gap-[8px] rounded-[13px] bg-gray-950 px-[21px] py-[13px] text-[13px] font-semibold text-white transition hover:bg-black"
        >
          <PencilIcon className="size-[13px]" />
          Edit professional profile
        </Link>
      </div>
    </article>
  );
}
