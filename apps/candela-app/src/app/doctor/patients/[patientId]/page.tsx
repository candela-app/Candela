'use client';

import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { ApiError, api, getPatientPracticeSummary } from '@/lib/api';
import { recordRecentlyViewedPatient } from '@/lib/doctor-recent-patients';
import {
  MODULE_LEVELS,
  canonicalizeDirectionSenseLevels,
  type PatientIdentityProfile,
  type PatientSummary,
  type SavedPracticeSummary,
  type TherapyModuleId,
} from '@candela/shared';
import { AppHeader } from '@/components/layout/AppHeader';
import { Skeleton } from '@/components/common/Skeleton';
import { DoctorPatientPrescribe } from '@/components/doctor/DoctorPatientPrescribe';
import { DoctorPatientAnalytics } from '@/components/doctor/DoctorPatientAnalytics';
import { DoctorPatientIdentityPanel } from '@/components/profile/DoctorPatientIdentityPanel';
import {
  AnalyticsIcon,
  MailIcon,
  MonitorIcon,
  SlidersIcon,
  VerifiedBadgeIcon,
} from '@/components/icons/VectorIcons';
import { CopyButton } from '@/components/ui/CopyButton';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

type WorkspacePane = 'overview' | 'analytics' | 'prescription' | 'invitation' | 'devices';

function workspaceFromSearch(view: string | null): WorkspacePane {
  if (view === 'analytics') return 'analytics';
  if (view === 'prescription') return 'prescription';
  if (view === 'invitation') return 'invitation';
  if (view === 'devices') return 'devices';
  return 'overview';
}

function lastSavedCard(summary: SavedPracticeSummary | null, failed: boolean) {
  if (failed) return { value: '—', hint: 'Summary unavailable' };
  const last = summary?.availability === 'recorded' ? summary.last : null;
  if (!last) return { value: '—', hint: 'No session saved' };
  const parsed = new Date(last.recordedAt);
  const valid = !Number.isNaN(parsed.getTime());
  const time = valid ? parsed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
  const level = last.levelId ? last.levelName : '';
  return {
    value: valid ? parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—',
    hint: [last.gameName, level, time].filter(Boolean).join(' · '),
  };
}

const PAGE_SHADOW = 'shadow-[0_13px_34px_-13px_rgba(15,23,42,0.45)]';

function ProfileSkeleton() {
  return (
    <main className="mx-auto max-w-[987px] space-y-[34px] px-[21px] py-[34px]" aria-busy>
      <div className="flex flex-wrap items-center justify-between gap-[13px]">
        <Skeleton className="h-[34px] w-[144px] rounded-[8px]" />
        <div className="flex shrink-0 flex-wrap items-center gap-[8px]">
          <Skeleton className="h-[55px] w-[55px] rounded-[13px]" />
          <Skeleton className="h-[55px] w-[55px] rounded-[13px]" />
          <Skeleton className="h-[55px] w-[55px] rounded-[13px]" />
          <Skeleton className="h-[55px] w-[55px] rounded-[13px]" />
        </div>
      </div>

      <div className="space-y-[21px]">
        <div className={`rounded-[13px] border border-gray-100 bg-white p-[21px] ${PAGE_SHADOW}`}>
          <div className="flex flex-col gap-[21px] lg:flex-row lg:items-stretch lg:justify-between">
            <div className="flex flex-col gap-[21px] sm:flex-row sm:items-start">
              <Skeleton className="mx-auto h-[330px] w-full max-w-none shrink-0 rounded-[13px] sm:mx-0 sm:aspect-[2/3] sm:h-auto sm:w-[220px] sm:max-w-[220px]" />
              <div className="min-w-0 flex-1 space-y-[13px]">
                <Skeleton className="h-[34px] w-[200px] rounded-[8px]" />
                <div className="flex gap-[8px]">
                  <Skeleton className="h-[24px] w-[72px] rounded-full" />
                  <Skeleton className="h-[24px] w-[72px] rounded-full" />
                  <Skeleton className="h-[24px] w-[72px] rounded-full" />
                </div>
              </div>
            </div>
            <div className="mx-auto grid w-full max-w-[377px] gap-[21px] sm:mx-0 lg:w-[377px] lg:shrink-0">
              <Skeleton className="h-full min-h-[89px] w-full rounded-[13px]" />
              <Skeleton className="h-full min-h-[89px] w-full rounded-[13px]" />
              <Skeleton className="h-full min-h-[89px] w-full rounded-[13px]" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-[21px] sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, group) => (
            <div
              key={group}
              className={`min-w-0 space-y-[8px] rounded-[13px] border border-gray-200 bg-white p-[21px] ${PAGE_SHADOW}`}
            >
              <Skeleton className="h-[13px] w-[89px]" />
              {Array.from({ length: 4 }).map((__, i) => (
                <div key={i} className="flex items-center justify-between gap-[13px] py-[8px]">
                  <Skeleton className="h-[13px] w-[72px]" />
                  <Skeleton className="h-[13px] w-[89px]" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function goToPreviousPage(router: ReturnType<typeof useRouter>) {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back();
    return;
  }
  router.push('/doctor');
}

export default function DoctorPatientProfilePage() {
  const router = useRouter();
  return (
    <Suspense
      fallback={
        <div className="min-h-screen page-wash">
          <AppHeader onBack={() => goToPreviousPage(router)} />
          <ProfileSkeleton />
        </div>
      }
    >
      <DoctorPatientProfile />
    </Suspense>
  );
}

function DoctorPatientProfile() {
  const router = useRouter();
  const params = useParams<{ patientId: string }>();
  const searchParams = useSearchParams();
  const { session, loading } = useAuth();
  const toast = useToast();
  const patientId = params.patientId;

  const [patient, setPatient] = useState<PatientSummary | null>(null);
  const [error, setError] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const loadToken = useRef(0);
  const [practice, setPractice] = useState<SavedPracticeSummary | null>(null);
  const [practiceFailed, setPracticeFailed] = useState(false);
  const [practiceLoading, setPracticeLoading] = useState(true);
  const [identityLoading, setIdentityLoading] = useState(true);
  const [resendBusy, setResendBusy] = useState(false);
  const [inviteBanner, setInviteBanner] = useState<{ status: 'sent' | 'failed'; expiresAt: string | null } | null>(
    null,
  );
  const [identityProfile, setIdentityProfile] = useState<PatientIdentityProfile | null>(null);
  const profileComplete = identityProfile?.completion.profileComplete ?? false;

  const workspace = workspaceFromSearch(searchParams.get('view'));

  const openWorkspace = (pane: WorkspacePane) => {
    if (!patientId) return;
    if (pane === 'overview') {
      router.push(`/doctor/patients/${patientId}`);
      return;
    }
    router.push(`/doctor/patients/${patientId}?view=${pane}`);
  };

  useEffect(() => {
    const invite = searchParams.get('invite');
    if (invite !== 'sent' && invite !== 'failed') return;
    const expires = searchParams.get('expires');
    setInviteBanner({ status: invite, expiresAt: expires });
    router.replace(`/doctor/patients/${patientId}?view=invitation`);
  }, [searchParams, patientId, router]);

  const load = useCallback(async () => {
    if (!patientId) {
      throw new ApiError(404, 'Patient not found');
    }
    const token = ++loadToken.current;
    setError('');
    setPractice(null);
    setPracticeFailed(false);
    setIdentityProfile(null);
    setPracticeLoading(true);
    setIdentityLoading(true);

    const patientPromise = api<PatientSummary>(`/api/doctors/me/patients/${patientId}`);
    const practicePromise = getPatientPracticeSummary(patientId)
      .then((value) => ({ value, failed: false as const }))
      .catch(() => ({ value: null, failed: true as const }));
    const identityPromise = api<PatientIdentityProfile>(
      `/api/doctors/me/patients/${patientId}/profile`,
    ).catch(() => null);

    // Paint shell as soon as the patient summary is ready.
    const next = await patientPromise;
    if (loadToken.current !== token) return;
    if (session?.user.id) {
      recordRecentlyViewedPatient(session.user.id, next.id);
    }
    setPatient(next);
    setDataLoading(false);

    // Settle identity and practice independently so chips are not blocked by summary.
    void identityPromise.then((identity) => {
      if (loadToken.current !== token) return;
      setIdentityProfile(identity);
      setIdentityLoading(false);
    });
    void practicePromise.then((summary) => {
      if (loadToken.current !== token) return;
      setPractice(summary.value);
      setPracticeFailed(summary.failed);
      setPracticeLoading(false);
    });
  }, [patientId]);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!session || session.user.role !== 'doctor') {
      router.replace('/');
      return;
    }
    let cancelled = false;
    setDataLoading(true);
    setPracticeLoading(true);
    setIdentityLoading(true);
    load().catch((err) => {
      if (cancelled) return;
      setPatient(null);
      setIdentityProfile(null);
      setPractice(null);
      setPracticeFailed(false);
      setError(err instanceof ApiError ? err.message : 'Failed to load patient');
      setDataLoading(false);
      setPracticeLoading(false);
      setIdentityLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loading, session, router, load]);

  const prescribedCount = patient?.prescribedModuleIds.length ?? 0;
  const saved = practiceLoading
    ? { value: '…', hint: 'Loading practice summary' }
    : lastSavedCard(practice, practiceFailed);

  const assignedLevelCount = useMemo(() => {
    if (!patient) return 0;
    return Object.values(patient.prescribedLevels || {}).reduce((sum, levels) => sum + levels.length, 0);
  }, [patient]);

  async function onResendInvitation() {
    if (!patient) return;
    setResendBusy(true);
    setError('');
    try {
      const result = await api<{ emailSent: boolean; expiresAt: string }>(
        `/api/doctors/me/patients/${patient.id}/invitations/resend`,
        { method: 'POST' },
      );
      setInviteBanner({
        status: result.emailSent ? 'sent' : 'failed',
        expiresAt: result.expiresAt,
      });
      if (result.emailSent) {
        toast.success(
          `Invitation resent to ${patient.email} (expires ${new Date(result.expiresAt).toLocaleString('en-GB')}).`,
        );
      } else {
        toast.error('Invitation was renewed, but the email could not be sent. Try again shortly.');
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not resend invitation';
      setError(msg);
      toast.error(msg);
    } finally {
      setResendBusy(false);
    }
  }

  async function toggleModule(moduleId: TherapyModuleId, enabled: boolean) {
    if (!patient) {
      return;
    }
    const previousIds = patient.prescribedModuleIds;
    const previousLevels = { ...patient.prescribedLevels };
    const defaultLevels = enabled ? MODULE_LEVELS[moduleId]?.map((l) => l.id) || [] : [];
    setError('');

    setPatient({
      ...patient,
      prescribedModuleIds: enabled
        ? Array.from(new Set([...patient.prescribedModuleIds, moduleId]))
        : patient.prescribedModuleIds.filter((id) => id !== moduleId),
      prescribedLevels: enabled
        ? { ...patient.prescribedLevels, [moduleId]: defaultLevels }
        : Object.fromEntries(Object.entries(patient.prescribedLevels || {}).filter(([id]) => id !== moduleId)),
    });

    try {
      const updated = enabled
        ? await api<PatientSummary>(`/api/doctors/me/patients/${patient.id}/prescriptions`, {
            method: 'POST',
            body: JSON.stringify({ moduleId, levels: defaultLevels }),
          })
        : await api<PatientSummary>(
            `/api/doctors/me/patients/${patient.id}/prescriptions/${moduleId}`,
            { method: 'DELETE' },
          );
      setPatient(updated);
      toast.success(enabled ? `Prescribed module for ${patient.name}` : `Removed module for ${patient.name}`);
    } catch (err) {
      setPatient({ ...patient, prescribedModuleIds: previousIds, prescribedLevels: previousLevels });
      const msg = err instanceof ApiError ? err.message : 'Could not update prescription';
      setError(msg);
      toast.error(msg);
    }
  }

  async function toggleLevel(moduleId: TherapyModuleId, levelId: string, enabled: boolean) {
    if (!patient) {
      return;
    }
    const currentLevels =
      moduleId === 'direction_sense'
        ? canonicalizeDirectionSenseLevels(patient.prescribedLevels?.[moduleId] || [])
        : patient.prescribedLevels?.[moduleId] || [];
    const newLevels = enabled
      ? Array.from(new Set([...currentLevels, levelId]))
      : currentLevels.filter((id) => id !== levelId);
    const previousLevels = { ...patient.prescribedLevels };
    setError('');

    setPatient({
      ...patient,
      prescribedLevels: {
        ...patient.prescribedLevels,
        [moduleId]: newLevels,
      },
    });

    try {
      const updated = await api<PatientSummary>(`/api/doctors/me/patients/${patient.id}/prescriptions`, {
        method: 'POST',
        body: JSON.stringify({ moduleId, levels: newLevels }),
      });
      setPatient(updated);
      toast.success(`Updated levels for ${patient.name}`);
    } catch (err) {
      setPatient({ ...patient, prescribedLevels: previousLevels });
      const msg = err instanceof ApiError ? err.message : 'Could not update level';
      setError(msg);
      toast.error(msg);
    }
  }

  if (loading || dataLoading || !session || session.user.role !== 'doctor') {
    return (
      <div className="min-h-screen page-wash">
        <AppHeader onBack={() => goToPreviousPage(router)} />
        <ProfileSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-screen page-wash">
      <AppHeader
        onBack={() => goToPreviousPage(router)}
        extra={
          session.doctor ? (
            <div className="flex items-center gap-[8px] rounded-[8px] border border-blue-200/60 bg-blue-50 px-[13px] py-[8px]">
              <span className="font-mono text-[13px] font-semibold text-blue-700">
                {session.doctor.referralCode}
              </span>
              <CopyButton text={session.doctor.referralCode} label="DocID" iconSize={13} />
            </div>
          ) : null
        }
      />

      <main className="mx-auto max-w-[987px] space-y-[34px] px-[21px] py-[34px]">
        {!patient && (
          <section className={`rounded-[13px] border border-gray-100 bg-white p-[21px] text-center ${PAGE_SHADOW}`}>
            <h1 className="text-[21px] font-semibold text-gray-900">Patient not found</h1>
            <p className="mt-[8px] text-[13px] leading-[21px] text-gray-500">
              {error || 'This patient is not on your list.'}
            </p>
          </section>
        )}

        {patient && (
          <PatientWorkspace
            patient={patient}
            workspace={workspace}
            profileComplete={profileComplete}
            error={error}
            identityProfile={identityProfile}
            identityLoading={identityLoading}
            practiceLoading={practiceLoading}
            practice={practice}
            practiceFailed={practiceFailed}
            saved={saved}
            prescribedCount={prescribedCount}
            assignedLevelCount={assignedLevelCount}
            inviteBanner={inviteBanner}
            resendBusy={resendBusy}
            openWorkspace={openWorkspace}
            onResendInvitation={() => void onResendInvitation()}
            onToggleModule={(moduleId, enabled) => void toggleModule(moduleId, enabled)}
            onToggleLevel={(moduleId, levelId, enabled) => void toggleLevel(moduleId, levelId, enabled)}
          />
        )}
      </main>
    </div>
  );
}

function PatientWorkspace({
  patient,
  workspace,
  profileComplete,
  error,
  identityProfile,
  identityLoading,
  practiceLoading,
  practice,
  practiceFailed,
  saved,
  prescribedCount,
  assignedLevelCount,
  inviteBanner,
  resendBusy,
  openWorkspace,
  onResendInvitation,
  onToggleModule,
  onToggleLevel,
}: {
  patient: PatientSummary;
  workspace: WorkspacePane;
  profileComplete: boolean;
  error: string;
  identityProfile: PatientIdentityProfile | null;
  identityLoading: boolean;
  practiceLoading: boolean;
  practice: SavedPracticeSummary | null;
  practiceFailed: boolean;
  saved: { value: string; hint: string };
  prescribedCount: number;
  assignedLevelCount: number;
  inviteBanner: { status: 'sent' | 'failed'; expiresAt: string | null } | null;
  resendBusy: boolean;
  openWorkspace: (pane: WorkspacePane) => void;
  onResendInvitation: () => void;
  onToggleModule: (moduleId: TherapyModuleId, enabled: boolean) => void;
  onToggleLevel: (moduleId: TherapyModuleId, levelId: string, enabled: boolean) => void;
}) {
  const workspaceActions = (
    <>
      {(
        [
          {
            id: 'analytics' as const,
            label: 'Analytics',
            icon: AnalyticsIcon,
            title: 'Session analytics',
          },
          {
            id: 'prescription' as const,
            label: 'Prescription',
            icon: SlidersIcon,
            title: 'Prescribed modules',
          },
          {
            id: 'invitation' as const,
            label: 'Invitation',
            icon: MailIcon,
            title: 'Resend invitation',
          },
          {
            id: 'devices' as const,
            label: 'Devices',
            icon: MonitorIcon,
            title: 'Other device games',
          },
        ] as const
      ).map((item) => {
        const active = workspace === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => openWorkspace(active ? 'overview' : item.id)}
            title={active ? 'Back to overview' : item.title}
            aria-label={active ? 'Back to overview' : item.title}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex h-[55px] min-w-[55px] cursor-pointer items-center justify-center gap-[8px] rounded-[13px] border px-[13px] text-[13px] font-semibold leading-none transition ${
              active
                ? 'border-blue-200 bg-blue-50 text-blue-800'
                : 'border-gray-200 bg-white text-gray-800 hover:border-blue-200'
            }`}
          >
            <Icon className="size-[13px] shrink-0 text-blue-600" aria-hidden />
            <span className="hidden sm:inline">{item.label}</span>
          </button>
        );
      })}
    </>
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-[13px]">
        <button
          type="button"
          onClick={() => openWorkspace('overview')}
          className="flex items-center gap-[8px] text-left"
          title="Back to overview"
        >
          <h1 className="text-[34px] font-semibold leading-none text-gray-900">{patient.name}</h1>
          {profileComplete ? (
            <VerifiedBadgeIcon
              className="size-[21px] shrink-0 text-blue-600"
              aria-label="Profile complete"
            />
          ) : null}
        </button>
        <div className="flex shrink-0 flex-wrap items-center gap-[8px]">{workspaceActions}</div>
      </div>

      {error ? <p className="text-[13px] font-medium leading-[21px] text-red-600">{error}</p> : null}

      <section className="space-y-[21px]">
        {workspace === 'overview' ? (
          <DoctorPatientIdentityPanel
            patientId={patient.id}
            profile={identityProfile}
            profileLoading={identityLoading}
            fallbackName={patient.name}
            stats={[
              {
                label: 'Saved sessions',
                value: practiceLoading
                  ? '…'
                  : practiceFailed
                    ? '—'
                    : String(practice?.sessionCount ?? 0),
                hint: practiceLoading
                  ? 'Loading practice summary'
                  : practiceFailed
                    ? 'Summary unavailable'
                    : practice?.availability === 'recorded'
                      ? 'Saved sessions'
                      : 'No session saved',
                index: 0,
              },
              {
                label: 'Last saved',
                value: saved.value,
                hint: saved.hint,
                index: 1,
              },
              {
                label: 'Prescribed',
                value: String(prescribedCount),
                hint:
                  prescribedCount === 1
                    ? '1 activity'
                    : `${prescribedCount} activities${
                        assignedLevelCount ? ` · ${assignedLevelCount} levels` : ''
                      }`,
                index: 2,
                onClick: () => openWorkspace('prescription'),
              },
            ]}
          />
        ) : null}

        {workspace === 'analytics' ? (
          <div className={`rounded-[13px] border border-gray-100 bg-white p-[21px] ${PAGE_SHADOW}`}>
            <DoctorPatientAnalytics patientId={patient.id} patientName={patient.name} />
          </div>
        ) : null}

        {workspace === 'prescription' ? (
          <div className={`rounded-[13px] border border-gray-100 bg-white p-[21px] ${PAGE_SHADOW}`}>
            <DoctorPatientPrescribe
              patient={patient}
              onToggleModule={onToggleModule}
              onToggleLevel={onToggleLevel}
            />
          </div>
        ) : null}

        {workspace === 'invitation' ? (
          <div className={`space-y-[13px] rounded-[13px] border border-gray-100 bg-white p-[21px] ${PAGE_SHADOW}`}>
            <div>
              <h2 className="text-[21px] font-semibold text-gray-900">Invitation</h2>
              <p className="mt-[8px] text-[13px] leading-[21px] text-gray-600">
                Resend only works before the patient activates their account. They set their own
                password from the email link.
              </p>
            </div>
            {inviteBanner ? (
              <div
                className={`rounded-[13px] border px-[13px] py-[13px] text-[13px] leading-[21px] ${
                  inviteBanner.status === 'sent'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-amber-200 bg-amber-50 text-amber-900'
                }`}
              >
                {inviteBanner.status === 'sent' ? (
                  <p>
                    Invitation email sent
                    {inviteBanner.expiresAt
                      ? ` · expires ${new Date(inviteBanner.expiresAt).toLocaleString('en-GB')}`
                      : ''}
                    .
                  </p>
                ) : (
                  <p>
                    Invitation email could not be sent
                    {inviteBanner.expiresAt
                      ? ` (link expires ${new Date(inviteBanner.expiresAt).toLocaleString('en-GB')})`
                      : ''}
                    .
                  </p>
                )}
              </div>
            ) : null}
            <button
              type="button"
              onClick={onResendInvitation}
              disabled={resendBusy}
              className="cursor-pointer rounded-[13px] bg-blue-600 px-[21px] py-[13px] text-[13px] font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {resendBusy ? 'Resending…' : 'Resend invitation'}
            </button>
          </div>
        ) : null}

        {workspace === 'devices' ? (
          <div className={`rounded-[13px] border border-gray-100 bg-white p-[21px] ${PAGE_SHADOW}`}>
            <h2 className="text-[21px] font-semibold text-gray-900">Other device games</h2>
            <p className="mt-[8px] text-[13px] leading-[21px] text-gray-600">
              Cross-device game assignment is coming soon.
            </p>
          </div>
        ) : null}
      </section>
    </>
  );
}
