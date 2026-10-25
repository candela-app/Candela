'use client';

import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { ApiError, api, listPatientGameSessions, type StoredGameSessionRecord } from '@/lib/api';
import {
  MODULE_LEVELS,
  canonicalizeDirectionSenseLevels,
  type PatientSummary,
  type TherapyModuleId,
} from '@candela/shared';
import { AppHeader } from '@/components/layout/AppHeader';
import { Skeleton } from '@/components/common/Skeleton';
import { DoctorPatientPrescribe } from '@/components/doctor/DoctorPatientPrescribe';
import { DoctorPatientAnalytics } from '@/components/doctor/DoctorPatientAnalytics';
import { AnalyticsIcon } from '@/components/icons/VectorIcons';
import { CopyButton } from '@/components/ui/CopyButton';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';

function SummaryCard({
  label,
  value,
  hint,
  labelColor,
}: {
  label: string;
  value: string;
  hint?: string;
  labelColor: string;
}) {
  return (
    <div className="rounded-[13px] border border-gray-100 bg-white p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: labelColor }}>
        {label}
      </p>
      <p className="text-2xl font-extrabold text-gray-900 mt-1">{value}</p>
      {hint ? <p className="text-xs text-gray-500 mt-1">{hint}</p> : null}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <main className="max-w-6xl mx-auto px-6 py-10 space-y-6 animate-pulse">
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Skeleton className="h-24 rounded-[13px]" />
        <Skeleton className="h-24 rounded-[13px]" />
        <Skeleton className="h-24 rounded-[13px]" />
        <Skeleton className="h-24 rounded-[13px]" />
      </div>
      <Skeleton className="h-96 rounded-[13px]" />
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
        <div className="min-h-screen bg-[#F4F7FC]">
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
  const [sessions, setSessions] = useState<StoredGameSessionRecord[]>([]);

  const isAnalytics = searchParams.get('view') === 'analytics';

  const load = useCallback(async () => {
    if (!patientId) {
      throw new ApiError(404, 'Patient not found');
    }
    const next = await api<PatientSummary>(`/api/doctors/me/patients/${patientId}`);
    setPatient(next);
    try {
      setSessions(await listPatientGameSessions(patientId));
    } catch {
      setSessions([]);
    }
  }, [patientId]);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!session || session.user.role !== 'doctor') {
      router.replace('/');
      return;
    }
    setDataLoading(true);
    load()
      .catch((err) => {
        setPatient(null);
        setError(err instanceof ApiError ? err.message : 'Failed to load patient');
      })
      .finally(() => setDataLoading(false));
  }, [loading, session, router, load]);

  const lastPlayed = sessions.length
    ? new Date(
        [...sessions].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))[sessions.length - 1].recordedAt,
      ).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
      })
    : '—';
  const avgAccuracy =
    sessions.length === 0
      ? null
      : Math.round((sessions.reduce((sum, row) => sum + row.accuracy, 0) / sessions.length) * 10) / 10;
  const prescribedCount = patient?.prescribedModuleIds.length ?? 0;

  const assignedLevelCount = useMemo(() => {
    if (!patient) return 0;
    return Object.values(patient.prescribedLevels || {}).reduce((sum, levels) => sum + levels.length, 0);
  }, [patient]);

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
      <div className="min-h-screen bg-[#F4F7FC]">
        <AppHeader onBack={() => goToPreviousPage(router)} />
        <ProfileSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7FC]">
      <AppHeader
        onBack={() => goToPreviousPage(router)}
        extra={
          session.doctor ? (
            <div className="flex items-center gap-1.5 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200/60">
              <span className="font-mono text-sm font-bold text-blue-700">
                {session.doctor.referralCode}
              </span>
              <CopyButton text={session.doctor.referralCode} label="DocID" iconSize={13} />
            </div>
          ) : null
        }
      />

      <main className="mx-auto max-w-[930px] space-y-[34px] px-[21px] py-[34px]">
        {!patient && (
          <section className="rounded-[13px] border border-gray-100 bg-white p-[21px] text-center">
            <h1 className="text-[21px] font-extrabold text-gray-900">Patient not found</h1>
            <p className="text-sm text-gray-500 mt-2">{error || 'This patient is not on your list.'}</p>
          </section>
        )}

        {patient && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-[34px] font-extrabold leading-none text-gray-900">{patient.name}</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {patient.email} · {patient.phone}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!isAnalytics && (
                  <button
                    type="button"
                    onClick={() => router.push(`/doctor/patients/${patient.id}?view=analytics`)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-800 font-semibold text-[13px] hover:border-blue-200 cursor-pointer"
                    title="View Session Analytics"
                  >
                    <AnalyticsIcon className="w-[18px] h-[18px] text-blue-600" />
                    <span className="hidden sm:inline">Analytics</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => toast.info('Coming soon.')}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-[13px] font-semibold text-gray-800 hover:border-blue-200 hover:text-blue-700 cursor-pointer"
                >
                  Other device games
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

            {isAnalytics ? (
              <DoctorPatientAnalytics patientId={patient.id} patientName={patient.name} />
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <SummaryCard
                    label="Sessions"
                    value={String(sessions.length)}
                    hint={sessions.length ? 'Finished games saved' : 'No sessions yet'}
                    labelColor="#2563EB"
                  />
                  <SummaryCard
                    label="Last played"
                    value={lastPlayed}
                    hint={sessions.length ? 'Most recent saved session' : 'Not stored yet'}
                    labelColor="#D97706"
                  />
                  <SummaryCard
                    label="Accuracy"
                    value={avgAccuracy != null ? `${avgAccuracy}%` : '—'}
                    hint={avgAccuracy != null ? 'Mean of saved sessions' : 'Not stored yet'}
                    labelColor="#059669"
                  />
                  <SummaryCard
                    label="Prescribed"
                    value={String(prescribedCount)}
                    hint={
                      prescribedCount === 1
                        ? '1 activity'
                        : `${prescribedCount} activities${assignedLevelCount ? ` · ${assignedLevelCount} levels` : ''}`
                    }
                    labelColor="#7C3AED"
                  />
                </div>

                <section className="bg-white rounded-[13px] border border-gray-100 p-6">
                  <DoctorPatientPrescribe
                    patient={patient}
                    sessions={sessions}
                    onToggleModule={(moduleId, enabled) => void toggleModule(moduleId, enabled)}
                    onToggleLevel={(moduleId, levelId, enabled) => void toggleLevel(moduleId, levelId, enabled)}
                  />
                </section>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
