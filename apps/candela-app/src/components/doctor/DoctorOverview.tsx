'use client';

import Link from 'next/link';
import {
  Activity,
  ArrowLeftRight,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  FilePlus2,
  RefreshCw,
  UserPlus,
  Users,
} from 'lucide-react';
import type {
  DoctorDashboardSummary,
  IncomingDocIdRequest,
  PatientSummary,
} from '@candela/shared';
import type { RecentPatientEntry } from '@/lib/doctor-recent-patients';
import type { DoctorSection } from './DoctorSidebar';
import styles from './DoctorDashboard.module.css';

interface DoctorOverviewProps {
  doctorName: string;
  patients: PatientSummary[];
  patientsLoading: boolean;
  patientsError: string;
  incoming: IncomingDocIdRequest[];
  incomingLoading: boolean;
  incomingError: string;
  summary: DoctorDashboardSummary | null;
  summaryLoading: boolean;
  summaryError: string;
  recentEntries: RecentPatientEntry[];
  canCreatePatient: boolean;
  onNavigateSection: (section: DoctorSection) => void;
  onAddNewPatient: () => void;
  onRetryPatients: () => void;
  onRetryIncoming: () => void;
  onRetrySummary: () => void;
}

function getGreeting(name: string): string {
  const hour = new Date().getHours();
  const timePrefix =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const cleanedName = name.trim().replace(/^dr\.?\s+/i, '');
  return cleanedName ? `${timePrefix}, Dr. ${cleanedName}` : `${timePrefix}, Doctor`;
}

function patientInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatEventTimestamp(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'Date unavailable';
  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPracticeDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function MetricSkeleton() {
  return (
    <div className={`${styles.card} p-5 animate-pulse`}>
      <div className="flex items-center justify-between gap-2">
        <div className="h-3.5 w-28 rounded bg-slate-200/80" />
        <div className="size-8 rounded-lg bg-slate-100" />
      </div>
      <div className="mt-3 h-8 w-14 rounded bg-slate-200/80" />
      <div className="mt-2 h-3 w-32 rounded bg-slate-100" />
    </div>
  );
}

export function DoctorOverview({
  doctorName,
  patients,
  patientsLoading,
  patientsError,
  incoming,
  incomingLoading,
  incomingError,
  summary,
  summaryLoading,
  summaryError,
  recentEntries,
  canCreatePatient,
  onNavigateSection,
  onAddNewPatient,
  onRetryPatients,
  onRetryIncoming,
  onRetrySummary,
}: DoctorOverviewProps) {
  const patientsWithActivePlansFallback = patients.filter(
    (patient) => patient.prescribedModuleIds.length > 0,
  ).length;

  const myPatientsValue = summary
    ? String(summary.assignedPatientCount)
    : patientsError
      ? '—'
      : String(patients.length);

  const activePlansValue = summary
    ? String(summary.patientsWithActivePlansCount)
    : patientsError
      ? '—'
      : String(patientsWithActivePlansFallback);

  const pendingTransfersValue = summary
    ? String(summary.pendingTransferCount)
    : incomingError
      ? '—'
      : String(incoming.length);

  const sessionsTodayValue = summary ? String(summary.sessionsTodayCount) : '—';

  const patientById = new Map(patients.map((patient) => [patient.id, patient]));
  const recentPatients = recentEntries
    .map((entry) => {
      const patient = patientById.get(entry.patientId);
      return patient ? { patient, viewedAt: entry.viewedAt } : null;
    })
    .filter((item): item is { patient: PatientSummary; viewedAt: string } => item !== null)
    .slice(0, 3);

  const showMetricsSkeleton =
    summaryLoading && patientsLoading && incomingLoading;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-[22px] font-semibold leading-tight text-[var(--doc-text)] sm:text-[24px]">
          {getGreeting(doctorName)}
        </h1>
        <p className="text-[13px] text-[var(--doc-muted)]">
          Here&apos;s what&apos;s happening with your patients.
        </p>
      </div>

      {/* SECTION B: FOUR SUMMARY METRICS */}
      <section aria-label="Dashboard summary metrics">
        {showMetricsSkeleton ? (
          <div className={styles.overviewMetricsGrid}>
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
          </div>
        ) : (
          <div className={styles.overviewMetricsGrid}>
            <button
              type="button"
              onClick={() => onNavigateSection('patients')}
              className={styles.metricCard}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-[var(--doc-muted)]">
                  My Patients
                </span>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--doc-primary-soft)] text-[var(--doc-primary)]">
                  <Users className="size-4" strokeWidth={2} />
                </span>
              </div>
              <p className="mt-2.5 text-[28px] font-semibold leading-none tabular-nums text-[var(--doc-text)]">
                {myPatientsValue}
              </p>
              <p className="mt-2 text-[12px] text-[var(--doc-muted)]">
                {patientsError && !summary ? 'Unavailable right now' : 'Assigned to you'}
              </p>
            </button>

            <button
              type="button"
              onClick={() => onNavigateSection('prescriptions')}
              className={styles.metricCard}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-[var(--doc-muted)]">
                  Patients with Active Plans
                </span>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--doc-primary-soft)] text-[var(--doc-primary)]">
                  <ClipboardList className="size-4" strokeWidth={2} />
                </span>
              </div>
              <p className="mt-2.5 text-[28px] font-semibold leading-none tabular-nums text-[var(--doc-text)]">
                {activePlansValue}
              </p>
              <p className="mt-2 text-[12px] text-[var(--doc-muted)]">
                {patientsError && !summary
                  ? 'Unavailable right now'
                  : 'With prescribed activities'}
              </p>
            </button>

            <button
              type="button"
              onClick={() => onNavigateSection('transfers')}
              className={styles.metricCard}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-[var(--doc-muted)]">
                  Pending Transfers
                </span>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--doc-primary-soft)] text-[var(--doc-primary)]">
                  <ArrowLeftRight className="size-4" strokeWidth={2} />
                </span>
              </div>
              <p className="mt-2.5 text-[28px] font-semibold leading-none tabular-nums text-[var(--doc-text)]">
                {pendingTransfersValue}
              </p>
              <p className="mt-2 text-[12px] text-[var(--doc-muted)]">
                {incomingError && !summary
                  ? 'Unavailable right now'
                  : 'Awaiting your decision'}
              </p>
            </button>

            <button
              type="button"
              onClick={() => onNavigateSection('analytics')}
              className={styles.metricCard}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-[var(--doc-muted)]">
                  Sessions Today
                </span>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--doc-primary-soft)] text-[var(--doc-primary)]">
                  <Activity className="size-4" strokeWidth={2} />
                </span>
              </div>
              <p className="mt-2.5 text-[28px] font-semibold leading-none tabular-nums text-[var(--doc-text)]">
                {summaryLoading && !summary ? '…' : sessionsTodayValue}
              </p>
              <p className="mt-2 text-[12px] text-[var(--doc-muted)]">
                {summaryError && !summary
                  ? 'Summary unavailable'
                  : summary
                    ? `Completed today (${summary.timeZone})`
                    : 'Completed today'}
              </p>
            </button>
          </div>
        )}
      </section>

      {/* SECOND CONTENT ROW: NEEDS YOUR ATTENTION (2/3) + QUICK ACTIONS (1/3) */}
      <div className={styles.overviewSplitGrid}>
        {/* SECTION C: NEEDS YOUR ATTENTION */}
        <section
          aria-labelledby="needs-attention-heading"
          className={`${styles.card} p-5 sm:p-6`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--doc-border)] pb-4">
            <div>
              <h2
                id="needs-attention-heading"
                className="text-[16px] font-semibold text-[var(--doc-text)]"
              >
                Needs your attention
              </h2>
              <p className="mt-0.5 text-[13px] text-[var(--doc-muted)]">
                Pending decisions and requests assigned to you.
              </p>
            </div>
            {incoming.length > 0 && (
              <span className="inline-flex items-center rounded-full border border-[var(--doc-warning-border)] bg-[var(--doc-warning-bg)] px-2.5 py-0.5 text-[12px] font-semibold text-[var(--doc-warning-text)]">
                {incoming.length} pending
              </span>
            )}
          </div>

          {incomingLoading ? (
            <div className="mt-4 space-y-3 animate-pulse">
              <div className="h-[78px] rounded-xl bg-slate-100" />
              <div className="h-[78px] rounded-xl bg-slate-100" />
            </div>
          ) : incomingError ? (
            <div className="mt-4 rounded-xl border border-[var(--doc-error-border)] bg-[var(--doc-error-bg)] p-4">
              <p className="text-[13px] font-medium text-[var(--doc-error-text)]">
                {incomingError}
              </p>
              <button
                type="button"
                onClick={onRetryIncoming}
                className={`${styles.secondaryBtn} mt-3`}
              >
                <RefreshCw className="size-3.5" />
                Retry
              </button>
            </div>
          ) : incoming.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-9 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-[var(--doc-success-bg)] text-[var(--doc-success-text)]">
                <CheckCircle2 className="size-5" />
              </span>
              <p className="mt-3 text-[15px] font-semibold text-[var(--doc-text)]">
                You&apos;re all caught up.
              </p>
              <p className="mt-1 text-[13px] text-[var(--doc-muted)]">
                No actions require your attention right now.
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {incoming.map((request) => (
                <li
                  key={request.id}
                  className="flex flex-col gap-3 rounded-xl border border-[var(--doc-border)] bg-[var(--doc-surface-subtle)] p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-semibold text-[var(--doc-text)]">
                        {request.source === 'change'
                          ? 'Patient transfer request'
                          : 'New patient attach request'}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-[var(--doc-warning-border)] bg-[var(--doc-warning-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--doc-warning-text)]">
                        Pending decision
                      </span>
                    </div>
                    <p className="truncate text-[14px] font-medium text-[var(--doc-text)]">
                      {request.patientName}
                    </p>
                    <p className="text-[12px] text-[var(--doc-muted)]">
                      {request.source === 'change'
                        ? `Reassignment to DocID ${request.targetReferralCode} (${request.patientEmail}).`
                        : `Requested attachment to DocID ${request.targetReferralCode} (${request.patientEmail}).`}
                    </p>
                    <p className="flex items-center gap-1.5 pt-0.5 text-[11px] text-[var(--doc-muted-soft)]">
                      <Clock className="size-3 shrink-0" />
                      <span>Requested {formatEventTimestamp(request.createdAt)}</span>
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center">
                    <button
                      type="button"
                      onClick={() => onNavigateSection('transfers')}
                      className={styles.primaryBtn}
                    >
                      Review transfer
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* SECTION E: QUICK ACTIONS */}
        <section
          aria-labelledby="quick-actions-heading"
          className={`${styles.card} p-5 sm:p-6`}
        >
          <h2
            id="quick-actions-heading"
            className="text-[16px] font-semibold text-[var(--doc-text)]"
          >
            Quick actions
          </h2>
          <p className="mt-0.5 text-[13px] text-[var(--doc-muted)]">
            Jump directly to common workflows.
          </p>

          <div className="mt-4 space-y-2.5">
            <button
              type="button"
              onClick={() => onNavigateSection('prescriptions')}
              className="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--doc-border)] bg-[var(--doc-surface-subtle)] px-3.5 py-3 text-left transition hover:border-[var(--doc-primary-border)] hover:bg-[var(--doc-primary-soft)] focus-visible:outline-2 focus-visible:outline-[var(--doc-primary)]"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--doc-primary)] shadow-2xs">
                  <FilePlus2 className="size-4" />
                </span>
                <span className="truncate text-[13px] font-semibold text-[var(--doc-text)]">
                  Create Prescription
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-[var(--doc-muted-soft)] transition group-hover:text-[var(--doc-primary)]" />
            </button>

            <button
              type="button"
              onClick={() => onNavigateSection('transfers')}
              className="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--doc-border)] bg-[var(--doc-surface-subtle)] px-3.5 py-3 text-left transition hover:border-[var(--doc-primary-border)] hover:bg-[var(--doc-primary-soft)] focus-visible:outline-2 focus-visible:outline-[var(--doc-primary)]"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--doc-primary)] shadow-2xs">
                  <ArrowLeftRight className="size-4" />
                </span>
                <span className="truncate text-[13px] font-semibold text-[var(--doc-text)]">
                  Manage Transfers
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                {incoming.length > 0 && (
                  <span className="rounded-full bg-[var(--doc-warning-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--doc-warning-text)]">
                    {incoming.length}
                  </span>
                )}
                <ChevronRight className="size-4 text-[var(--doc-muted-soft)] transition group-hover:text-[var(--doc-primary)]" />
              </span>
            </button>

            <button
              type="button"
              onClick={onAddNewPatient}
              disabled={!canCreatePatient}
              className="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--doc-border)] bg-[var(--doc-surface-subtle)] px-3.5 py-3 text-left transition hover:border-[var(--doc-primary-border)] hover:bg-[var(--doc-primary-soft)] disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-[var(--doc-primary)]"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--doc-primary)] shadow-2xs">
                  <UserPlus className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-[var(--doc-text)]">
                    Add New Patient
                  </span>
                  {!canCreatePatient && (
                    <span className="block text-[11px] text-[var(--doc-muted)]">
                      Active clinic membership required
                    </span>
                  )}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-[var(--doc-muted-soft)] transition group-hover:text-[var(--doc-primary)]" />
            </button>
          </div>
        </section>
      </div>

      {/* THIRD CONTENT ROW: RECENTLY VIEWED PATIENTS (2/3) + TODAY AT A GLANCE (1/3) */}
      <div className={styles.overviewSplitGrid}>
        {/* SECTION D: RECENTLY VIEWED PATIENTS */}
        <section
          aria-labelledby="recently-viewed-heading"
          className={`${styles.card} p-5 sm:p-6`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--doc-border)] pb-4">
            <div>
              <h2
                id="recently-viewed-heading"
                className="text-[16px] font-semibold text-[var(--doc-text)]"
              >
                Recently viewed patients
              </h2>
              <p className="mt-0.5 text-[13px] text-[var(--doc-muted)]">
                Quick access to patients you recently opened.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateSection('patients')}
              className="cursor-pointer rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-[var(--doc-primary)] transition hover:bg-[var(--doc-primary-soft)] focus-visible:outline-2 focus-visible:outline-[var(--doc-primary)]"
            >
              View all patients
            </button>
          </div>

          {patientsLoading ? (
            <div className="mt-4 space-y-2.5 animate-pulse">
              <div className="h-[60px] rounded-xl bg-slate-100" />
              <div className="h-[60px] rounded-xl bg-slate-100" />
            </div>
          ) : patientsError ? (
            <div className="mt-4 rounded-xl border border-[var(--doc-error-border)] bg-[var(--doc-error-bg)] p-4">
              <p className="text-[13px] font-medium text-[var(--doc-error-text)]">
                {patientsError}
              </p>
              <button
                type="button"
                onClick={onRetryPatients}
                className={`${styles.secondaryBtn} mt-3`}
              >
                <RefreshCw className="size-3.5" />
                Retry
              </button>
            </div>
          ) : recentPatients.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-[13px] text-[var(--doc-muted)]">
                Patients you open will appear here.
              </p>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--doc-border)]">
              {recentPatients.map(({ patient }) => {
                const lastPractice = formatPracticeDate(
                  summary?.lastSessionAtByPatientId?.[patient.id],
                );
                const planCount = patient.prescribedModuleIds.length;
                return (
                  <li key={patient.id}>
                    <Link
                      href={`/doctor/patients/${patient.id}`}
                      className="group flex items-center justify-between gap-3 rounded-xl px-2 py-3 transition hover:bg-[var(--doc-surface-subtle)] focus-visible:outline-2 focus-visible:outline-[var(--doc-primary)]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          aria-hidden
                          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--doc-primary-soft)] text-[12px] font-semibold text-[var(--doc-primary)]"
                        >
                          {patientInitials(patient.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold text-[var(--doc-text)]">
                            {patient.name}
                          </p>
                          <p className="truncate text-[12px] text-[var(--doc-muted)]">
                            {patient.email}
                            {lastPractice ? ` · Last practice ${lastPractice}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2.5">
                        <span
                          className={`hidden rounded-full px-2.5 py-0.5 text-[11px] font-medium sm:inline-flex ${
                            planCount > 0
                              ? 'border border-[var(--doc-success-border)] bg-[var(--doc-success-bg)] text-[var(--doc-success-text)]'
                              : 'border border-[var(--doc-border)] bg-[var(--doc-surface-subtle)] text-[var(--doc-muted)]'
                          }`}
                        >
                          {planCount > 0
                            ? `${planCount} active module${planCount === 1 ? '' : 's'}`
                            : 'No plan assigned'}
                        </span>
                        <ChevronRight className="size-4 text-[var(--doc-muted-soft)] transition group-hover:text-[var(--doc-primary)]" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* SECTION F: TODAY AT A GLANCE */}
        <section
          aria-labelledby="today-glance-heading"
          className={`${styles.cardMuted} p-5 sm:p-6`}
        >
          <div className="flex items-center justify-between gap-2">
            <h2
              id="today-glance-heading"
              className="text-[15px] font-semibold text-[var(--doc-text)]"
            >
              Today at a glance
            </h2>
            {summary && (
              <span className="text-[11px] font-medium text-[var(--doc-muted-soft)]">
                {summary.dateKey}
              </span>
            )}
          </div>

          {summaryLoading && !summary ? (
            <div className="mt-4 space-y-2.5 animate-pulse">
              <div className="h-9 rounded-lg bg-white/80" />
              <div className="h-9 rounded-lg bg-white/80" />
              <div className="h-9 rounded-lg bg-white/80" />
            </div>
          ) : summaryError && !summary ? (
            <div className="mt-4 rounded-xl border border-[var(--doc-border)] bg-white p-3.5">
              <p className="text-[12px] text-[var(--doc-muted)]">
                Today&apos;s activity summary is unavailable right now.
              </p>
              <button
                type="button"
                onClick={onRetrySummary}
                className={`${styles.secondaryBtn} mt-2.5 py-1.5 text-[12px]`}
              >
                <RefreshCw className="size-3" />
                Retry
              </button>
            </div>
          ) : summary ? (
            <dl className="mt-4 divide-y divide-[var(--doc-border)] rounded-xl border border-[var(--doc-border)] bg-white px-3.5">
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-[13px] text-[var(--doc-muted)]">
                  Sessions completed today
                </dt>
                <dd className="text-[14px] font-semibold tabular-nums text-[var(--doc-text)]">
                  {summary.sessionsTodayCount}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-[13px] text-[var(--doc-muted)]">
                  Transfers reviewed today
                </dt>
                <dd className="text-[14px] font-semibold tabular-nums text-[var(--doc-text)]">
                  {summary.transfersReviewedTodayCount}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-[13px] text-[var(--doc-muted)]">
                  Prescriptions updated today
                </dt>
                <dd className="text-[14px] font-semibold tabular-nums text-[var(--doc-text)]">
                  {summary.prescriptionsUpdatedTodayCount}
                </dd>
              </div>
            </dl>
          ) : null}

          {summary && (
            <p className="mt-3 text-[11px] text-[var(--doc-muted-soft)]">
              Calendar day in {summary.timeZone}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
