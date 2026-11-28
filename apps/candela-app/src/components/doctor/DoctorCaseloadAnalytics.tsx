'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  resolveStrictLocalPeriod,
  resolvedTimeZone,
  type DoctorCaseloadAnalytics as DoctorCaseloadAnalyticsData,
  type PatientSummary,
  type StrictLocalPeriod,
} from '@candela/shared';
import { ApiError, getDoctorCaseloadAnalytics } from '@/lib/api';
import { ArrowRightIcon, SearchIcon, XIcon } from '@/components/icons/VectorIcons';
import { FloatingLabelInput } from '@/components/ui/FloatingLabelInput';
import styles from './DoctorDashboard.module.css';
import { DoctorPeriodControls, type AnalyticsRangeChoice } from './DoctorPeriodControls';

interface DoctorCaseloadAnalyticsProps {
  patients: PatientSummary[];
  patientsLoading: boolean;
  patientsError: string;
  onRetryPatients: () => void;
}

function patientInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatLastSession(iso: string | null, timeZone: string): string {
  if (!iso) return 'No completed sessions saved yet';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'Date unavailable';
  return `Last session: ${parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone,
  })}`;
}

export function DoctorCaseloadAnalytics({
  patients,
  patientsLoading,
  patientsError,
  onRetryPatients,
}: DoctorCaseloadAnalyticsProps) {
  const timeZone = useMemo(() => resolvedTimeZone(), []);
  const [choice, setChoice] = useState<AnalyticsRangeChoice>('30d');
  const [period, setPeriod] = useState<StrictLocalPeriod>(() =>
    resolveStrictLocalPeriod({ timeZone }),
  );

  const [caseload, setCaseload] = useState<DoctorCaseloadAnalyticsData | null>(null);
  const [caseloadLoading, setCaseloadLoading] = useState(true);
  const [caseloadError, setCaseloadError] = useState('');
  const requestSeq = useRef(0);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeRxOnly, setActiveRxOnly] = useState(false);

  const loadCaseload = useCallback(async (target: StrictLocalPeriod) => {
    const seq = ++requestSeq.current;
    setCaseloadLoading(true);
    setCaseloadError('');
    try {
      const result = await getDoctorCaseloadAnalytics({
        from: target.from,
        to: target.to,
        timeZone: target.timeZone,
      });
      if (seq === requestSeq.current) {
        setCaseload(result);
      }
    } catch (err) {
      if (seq === requestSeq.current) {
        setCaseload(null);
        setCaseloadError(
          err instanceof ApiError ? err.message : 'Failed to load caseload analytics.',
        );
      }
    } finally {
      if (seq === requestSeq.current) {
        setCaseloadLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadCaseload(period);
  }, [period, loadCaseload]);

  const filteredDirectory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return patients.filter((patient) => {
      if (activeRxOnly && patient.prescribedModuleIds.length === 0) {
        return false;
      }
      if (!q) return true;
      return (
        patient.name.toLowerCase().includes(q) ||
        patient.email.toLowerCase().includes(q) ||
        patient.phone.toLowerCase().includes(q) ||
        patient.id.toLowerCase().includes(q)
      );
    });
  }, [patients, searchQuery, activeRxOnly]);

  const snapshotCards = [
    {
      label: 'Authorized patients',
      value: caseload?.authorizedPatientCount ?? 0,
      note: 'Active assigned caseload (unchanged by directory filters).',
    },
    {
      label: 'Patients with sessions',
      value: caseload?.patientsWithCompletedSessionsCount ?? 0,
      note: 'Distinct patients with at least 1 completed session in period.',
    },
    {
      label: 'No completed sessions',
      value: caseload?.patientsWithNoCompletedSessionsCount ?? 0,
      note: 'Authorized patients with 0 completed sessions in period.',
    },
    {
      label: 'Completed sessions',
      value: caseload?.totalCompletedSessionsCount ?? 0,
      note: 'Total persisted completed sessions across caseload in period.',
    },
  ];

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-[21px] font-semibold text-[var(--doc-text)]">Analytics</h1>
        <p className="text-[13px] text-[var(--doc-muted)]">
          Caseload session overview for your assigned patients. Gaze Hold plays are not recorded here.
        </p>
      </div>

      {/* Period Bar */}
      <section className={`${styles.card} p-5`}>
        <DoctorPeriodControls
          choice={choice}
          period={period}
          onChange={(nextChoice, nextPeriod) => {
            setChoice(nextChoice);
            setPeriod(nextPeriod);
          }}
        />
      </section>

      {/* Section A — Caseload snapshot */}
      <section aria-labelledby="caseload-snapshot-heading" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="caseload-snapshot-heading"
            className="text-[16px] font-semibold text-[var(--doc-text)]"
          >
            Caseload snapshot
          </h2>
          <p className="text-[12px] text-[var(--doc-muted)]">
            Denominator: {caseload ? caseload.authorizedPatientCount : '—'} authorized patients
          </p>
        </div>

        {caseloadLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 animate-pulse">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`${styles.card} p-4`}>
                <div className="h-3.5 w-28 rounded bg-slate-200/80" />
                <div className="mt-3 h-7 w-12 rounded bg-slate-200/80" />
                <div className="mt-2 h-3 w-full rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : caseloadError ? (
          <div className={`${styles.card} border-[var(--doc-error-border)] bg-[var(--doc-error-bg)] p-4`}>
            <p className="text-[13px] font-medium text-[var(--doc-error-text)]">{caseloadError}</p>
            <button
              type="button"
              onClick={() => void loadCaseload(period)}
              className={`${styles.secondaryBtn} mt-3`}
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {snapshotCards.map((card) => (
              <div key={card.label} className={`${styles.card} p-4`}>
                <p className="text-[12px] font-semibold text-[var(--doc-muted)]">{card.label}</p>
                <p className="mt-2 text-[26px] font-bold leading-none tabular-nums text-[var(--doc-text)]">
                  {card.value}
                </p>
                <p className="mt-2 text-[12px] leading-snug text-[var(--doc-muted)]">{card.note}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section B — Patients to review */}
      <section aria-labelledby="patients-to-review-heading" className={`${styles.card} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2
              id="patients-to-review-heading"
              className="text-[18px] font-semibold text-[var(--doc-text)]"
            >
              Patients to review
            </h2>
            <p className="mt-1 text-[13px] text-[var(--doc-muted)]">
              Authorized patients with zero completed sessions during the selected period.
            </p>
          </div>
          {!caseloadLoading && caseload ? (
            <span className="rounded-full border border-[var(--doc-border)] bg-[var(--doc-surface-subtle)] px-2.5 py-0.5 text-[12px] font-semibold tabular-nums text-[var(--doc-muted)]">
              {caseload.patientsToReview.length}
            </span>
          ) : null}
        </div>

        {caseloadLoading ? (
          <div className="mt-4 space-y-2 animate-pulse">
            <div className="h-[58px] rounded-xl bg-slate-100" />
            <div className="h-[58px] rounded-xl bg-slate-100" />
          </div>
        ) : caseloadError ? (
          <p className="mt-4 text-[13px] text-[var(--doc-muted)]">
            Unable to load review list while caseload summary is unavailable.
          </p>
        ) : !caseload || caseload.authorizedPatientCount === 0 ? (
          <p className="mt-4 text-[13px] text-[var(--doc-muted)]">No authorized patients yet.</p>
        ) : caseload.patientsToReview.length === 0 ? (
          <p className="mt-4 text-[13px] text-[var(--doc-muted)]">
            All authorized patients have at least one completed session in this period.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {caseload.patientsToReview.map((patient) => (
              <li key={patient.patientId}>
                <Link
                  href={`/doctor/patients/${patient.patientId}?view=analytics`}
                  className="group flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--doc-border)] bg-[var(--doc-surface-subtle)] px-3.5 py-3 text-[13px] transition hover:border-[var(--doc-primary-border)] hover:bg-[var(--doc-primary-soft)]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden
                      className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-[var(--doc-primary)] text-[12px] font-bold uppercase text-white"
                    >
                      {patientInitials(patient.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--doc-text)]">{patient.name}</p>
                      <p className="text-[12px] text-[var(--doc-muted)]">
                        No completed sessions in this period. ·{' '}
                        {formatLastSession(patient.lastSessionAt, period.timeZone)}
                      </p>
                    </div>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5 font-semibold text-[var(--doc-muted)] transition group-hover:text-[var(--doc-primary)]">
                    Open
                    <ArrowRightIcon className="size-[14px]" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Section C — Full patient directory */}
      <section aria-labelledby="patient-directory-heading" className={`${styles.card} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {searchOpen ? (
            <div className="min-w-0 flex-1">
              <FloatingLabelInput
                label="Search name, email, or phone"
                value={searchQuery}
                onChange={setSearchQuery}
                autoFocus
                scale="golden"
              />
            </div>
          ) : (
            <div className="min-w-0 flex-1">
              <h2
                id="patient-directory-heading"
                className="text-[18px] font-semibold text-[var(--doc-text)]"
              >
                All patients
              </h2>
              <p className="mt-0.5 text-[12px] text-[var(--doc-muted)]">
                Select any patient to inspect their recorded performance and history.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            {!patientsLoading && !patientsError && patients.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => setActiveRxOnly((value) => !value)}
                  aria-pressed={activeRxOnly}
                  className={`cursor-pointer rounded-[10px] border px-3 py-1.5 text-[12px] font-semibold transition ${
                    activeRxOnly
                      ? 'border-[var(--doc-primary)] bg-[var(--doc-primary-soft)] text-[var(--doc-primary)]'
                      : 'border-[var(--doc-border)] bg-[var(--doc-surface-subtle)] text-[var(--doc-muted)] hover:text-[var(--doc-text)]'
                  }`}
                >
                  Active prescription
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (searchOpen) {
                      setSearchOpen(false);
                      setSearchQuery('');
                    } else {
                      setSearchOpen(true);
                    }
                  }}
                  className={`flex size-[34px] shrink-0 cursor-pointer items-center justify-center rounded-[10px] border transition ${
                    searchOpen
                      ? 'border-[var(--doc-primary)] bg-[var(--doc-primary)] text-white'
                      : 'border-[var(--doc-border)] bg-[var(--doc-surface-subtle)] text-[var(--doc-muted)]'
                  }`}
                  title={searchOpen ? 'Close search' : 'Search patients'}
                  aria-label={searchOpen ? 'Close search' : 'Search patients'}
                >
                  {searchOpen ? <XIcon className="size-4" /> : <SearchIcon className="size-4" />}
                </button>
              </>
            ) : null}
          </div>
        </div>

        {patientsLoading ? (
          <div className="mt-4 space-y-2 animate-pulse">
            <div className="h-[58px] rounded-xl bg-slate-100" />
            <div className="h-[58px] rounded-xl bg-slate-100" />
          </div>
        ) : patientsError ? (
          <div className="mt-4 rounded-xl border border-[var(--doc-error-border)] bg-[var(--doc-error-bg)] p-4">
            <p className="text-[13px] font-medium text-[var(--doc-error-text)]">{patientsError}</p>
            <button
              type="button"
              onClick={onRetryPatients}
              className={`${styles.secondaryBtn} mt-3`}
            >
              Retry
            </button>
          </div>
        ) : patients.length === 0 ? (
          <p className="mt-4 text-[13px] text-[var(--doc-muted)]">No patients yet.</p>
        ) : filteredDirectory.length === 0 ? (
          <div className="py-8 text-center">
            <SearchIcon className="mx-auto mb-2 size-8 text-gray-300" />
            <p className="text-[13px] font-semibold text-[var(--doc-text)]">No matching patients</p>
            <p className="mt-1 text-[12px] text-[var(--doc-muted)]">
              Adjust search or filter criteria. Authorized caseload count remains {patients.length}.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {filteredDirectory.map((patient) => (
              <li key={patient.id}>
                <Link
                  href={`/doctor/patients/${patient.id}?view=analytics`}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-[var(--doc-border)] bg-[var(--doc-surface-subtle)] px-3.5 py-3 text-[13px] transition hover:border-[var(--doc-primary-border)] hover:bg-[var(--doc-primary-soft)]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden
                      className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-[var(--doc-primary)] text-[12px] font-bold uppercase text-white"
                    >
                      {patientInitials(patient.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--doc-text)]">{patient.name}</p>
                      <p className="truncate text-[12px] text-[var(--doc-muted)]">
                        {patient.prescribedModuleIds.length > 0
                          ? `${patient.prescribedModuleIds.length} active prescribed ${
                              patient.prescribedModuleIds.length === 1 ? 'module' : 'modules'
                            }`
                          : 'No active prescriptions'}
                      </p>
                    </div>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5 font-semibold text-[var(--doc-muted)] transition group-hover:text-[var(--doc-primary)]">
                    Analytics
                    <ArrowRightIcon className="size-[14px]" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
