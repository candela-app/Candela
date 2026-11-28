'use client';

import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { ApiError, api, getDoctorDashboardSummary, withOrganizationId } from '@/lib/api';
import {
  readRecentlyViewedPatients,
  type RecentPatientEntry,
} from '@/lib/doctor-recent-patients';
import type {
  CreateDoctorPatientResponse,
  DoctorDashboardSummary,
  DoctorOrganizationMembershipView,
  IncomingDocIdRequest,
  PatientSummary,
} from '@candela/shared';
import { DoctorDashboardSkeleton } from '@/components/common/Skeleton';
import { DoctorCaseloadAnalytics } from '@/components/doctor/DoctorCaseloadAnalytics';
import { DoctorHeader } from '@/components/doctor/DoctorHeader';
import { DoctorOverview } from '@/components/doctor/DoctorOverview';
import { DoctorSidebar, type DoctorSection } from '@/components/doctor/DoctorSidebar';
import styles from '@/components/doctor/DoctorDashboard.module.css';
import { ArrowRightIcon, PlusIcon, SearchIcon, UsersIcon, XIcon } from '@/components/icons/VectorIcons';
import { FloatingLabelInput, FloatingLabelPasswordInput } from '@/components/ui/FloatingLabelInput';
import { DoctorAccountCard } from '@/components/profile/DoctorAccountCard';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from 'react';

const ORG_STORAGE_KEY = 'candela.doctor.activeOrganizationId';
const NAV_EXPANDED_KEY = 'candela.doctor.navExpanded';

const SECTIONS = ['overview', 'patients', 'prescriptions', 'transfers', 'analytics', 'account'] as const;

function readSection(value: string | null): DoctorSection {
  if (value === 'settings' || value === 'account') return 'account';
  if (value && (SECTIONS as readonly string[]).includes(value)) {
    return value as DoctorSection;
  }
  return 'overview';
}

function patientInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function filterPatients(patients: PatientSummary[], query: string, active: boolean): PatientSummary[] {
  const q = query.trim().toLowerCase();
  if (!q || !active) return patients;
  return patients.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.phone.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q),
  );
}

export default function DoctorPage() {
  return (
    <Suspense fallback={<DoctorDashboardSkeleton />}>
      <DoctorDashboard />
    </Suspense>
  );
}

function DoctorDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, loading, logout } = useAuth();
  const toast = useToast();

  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [patientsError, setPatientsError] = useState('');

  const [incoming, setIncoming] = useState<IncomingDocIdRequest[]>([]);
  const [incomingLoading, setIncomingLoading] = useState(true);
  const [incomingError, setIncomingError] = useState('');
  const [incomingBusy, setIncomingBusy] = useState<string | null>(null);

  const [summary, setSummary] = useState<DoctorDashboardSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');

  const [memberships, setMemberships] = useState<DoctorOrganizationMembershipView[]>([]);
  const [organizationId, setOrganizationId] = useState('');

  const [recentEntries, setRecentEntries] = useState<RecentPatientEntry[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [listTab, setListTab] = useState<'create' | 'patients'>('patients');
  const [navOpen, setNavOpen] = useState(false);
  const [navExpanded, setNavExpanded] = useState(false);

  useEffect(() => {
    try {
      setNavExpanded(window.localStorage.getItem(NAV_EXPANDED_KEY) === '1');
    } catch {
      setNavExpanded(false);
    }
  }, []);

  const toggleNavExpanded = useCallback(() => {
    setNavExpanded((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(NAV_EXPANDED_KEY, next ? '1' : '0');
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  const [createError, setCreateError] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const section = readSection(searchParams.get('section'));

  const activeMemberships = useMemo(
    () => memberships.filter((m) => m.membershipStatus === 'active'),
    [memberships],
  );

  const filteredPatients = useMemo(
    () => filterPatients(patients, searchQuery, searchOpen),
    [patients, searchQuery, searchOpen],
  );

  const loadPatients = useCallback(async () => {
    setPatientsLoading(true);
    setPatientsError('');
    try {
      const next = await api<PatientSummary[]>('/api/doctors/me/patients');
      setPatients(next);
    } catch (err) {
      setPatientsError(err instanceof ApiError ? err.message : 'Failed to load patients.');
    } finally {
      setPatientsLoading(false);
    }
  }, []);

  const loadIncoming = useCallback(async () => {
    setIncomingLoading(true);
    setIncomingError('');
    try {
      const nextIncoming = await api<IncomingDocIdRequest[]>('/api/docid/incoming');
      setIncoming(nextIncoming);
    } catch (err) {
      setIncomingError(
        err instanceof ApiError ? err.message : 'Failed to load transfer requests.',
      );
    } finally {
      setIncomingLoading(false);
    }
  }, []);

  const loadOrganizations = useCallback(async () => {
    try {
      const orgs = await api<DoctorOrganizationMembershipView[]>('/api/me/organizations');
      const active = orgs.filter((m) => m.membershipStatus === 'active');
      setMemberships(orgs);
      setOrganizationId((current) => {
        if (current && active.some((m) => m.organizationId === current)) return current;
        const stored =
          typeof window !== 'undefined' ? window.localStorage.getItem(ORG_STORAGE_KEY) : null;
        if (stored && active.some((m) => m.organizationId === stored)) return stored;
        const primary = active.find((m) => m.isPrimary);
        return primary?.organizationId ?? active[0]?.organizationId ?? '';
      });
    } catch {
      // Non-fatal; patient creation button handles missing memberships gracefully.
    }
  }, []);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError('');
    try {
      const nextSummary = await getDoctorDashboardSummary();
      setSummary(nextSummary);
    } catch (err) {
      setSummaryError(
        err instanceof ApiError ? err.message : 'Failed to load dashboard summary.',
      );
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!session || session.user.role !== 'doctor') {
      router.replace('/');
      return;
    }
    setRecentEntries(readRecentlyViewedPatients(session.user.id));
    void Promise.allSettled([
      loadPatients(),
      loadIncoming(),
      loadOrganizations(),
      loadSummary(),
    ]);
  }, [
    loading,
    session,
    router,
    loadPatients,
    loadIncoming,
    loadOrganizations,
    loadSummary,
  ]);

  useEffect(() => {
    if (session?.user.id && section === 'overview') {
      setRecentEntries(readRecentlyViewedPatients(session.user.id));
    }
  }, [section, session?.user.id]);

  function openSection(next: DoctorSection) {
    if (next === 'overview') {
      router.replace('/doctor');
      return;
    }
    router.replace(`/doctor?section=${next}`);
  }

  function handleSelectOrganization(nextOrgId: string) {
    setOrganizationId(nextOrgId);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ORG_STORAGE_KEY, nextOrgId);
    }
  }

  async function onCreatePatient(e: FormEvent) {
    e.preventDefault();
    setCreateError('');
    if (!organizationId) {
      const msg = 'Select an organisation before creating a patient.';
      setCreateError(msg);
      toast.error(msg);
      return;
    }
    setSaving(true);
    const patientName = name.trim();
    const passwordValue = password.trim();
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(ORG_STORAGE_KEY, organizationId);
      }
      const created = await api<CreateDoctorPatientResponse>(
        '/api/doctors/me/patients',
        withOrganizationId(organizationId, {
          method: 'POST',
          body: JSON.stringify({
            name,
            phone,
            email,
            ...(passwordValue ? { password: passwordValue } : {}),
          }),
        }),
      );
      setName('');
      setPhone('');
      setEmail('');
      setPassword('');
      await Promise.allSettled([loadPatients(), loadSummary()]);
      setListTab('patients');
      if (created.activated) {
        toast.success(
          `Patient ${patientName} created and activated. They can sign in with the password you set.`,
        );
        router.push(`/doctor/patients/${created.patient.id}`);
        return;
      }
      if (created.invitation?.emailSent) {
        toast.success(
          `Patient ${patientName} created. Invitation sent to ${created.patient.email} (expires ${new Date(created.invitation.expiresAt).toLocaleString('en-GB')}).`,
        );
      } else {
        toast.error(
          `Patient ${patientName} was created, but the invitation email could not be sent. Open the patient profile to resend.`,
        );
      }
      router.push(
        `/doctor/patients/${created.patient.id}?invite=${created.invitation?.emailSent ? 'sent' : 'failed'}&expires=${encodeURIComponent(created.invitation?.expiresAt ?? '')}`,
      );
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not create patient';
      setCreateError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function settleIncoming(id: string, accept: boolean) {
    setIncomingBusy(id);
    try {
      await api(`/api/docid/requests/${id}/${accept ? 'accept' : 'reject'}`, { method: 'POST' });
      await Promise.allSettled([loadPatients(), loadIncoming(), loadSummary()]);
      toast.success(accept ? 'Patient attached to your DocID.' : 'Attach request rejected.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update request');
    } finally {
      setIncomingBusy(null);
    }
  }

  async function onSignOut() {
    await logout();
    toast.info('Signed out successfully.');
    router.replace('/');
  }

  if (loading || !session || session.user.role !== 'doctor') {
    return <DoctorDashboardSkeleton />;
  }

  return (
    <div className={styles.doctorShell}>
      <div className={styles.layoutFrame}>
        <DoctorSidebar
          activeSection={section}
          pendingTransferCount={incoming.length}
          doctorName={session.user.name}
          referralCode={session.doctor?.referralCode ?? null}
          activeMemberships={activeMemberships}
          selectedOrganizationId={organizationId}
          onSelectOrganization={handleSelectOrganization}
          onSelectSection={openSection}
          onSignOut={() => void onSignOut()}
          expanded={navExpanded}
          onToggleExpanded={toggleNavExpanded}
          mobileOpen={navOpen}
          onCloseMobile={() => setNavOpen(false)}
        />

        <div className={styles.mainColumn}>
          <DoctorHeader
            patients={patients}
            patientsLoading={patientsLoading}
            patientsError={patientsError}
            navOpen={navOpen}
            onToggleMobileNav={() => setNavOpen((open) => !open)}
          />

          <main className={styles.mainContainer}>
            {section === 'overview' && (
              <DoctorOverview
                doctorName={session.user.name}
                patients={patients}
                patientsLoading={patientsLoading}
                patientsError={patientsError}
                incoming={incoming}
                incomingLoading={incomingLoading}
                incomingError={incomingError}
                summary={summary}
                summaryLoading={summaryLoading}
                summaryError={summaryError}
                recentEntries={recentEntries}
                canCreatePatient={activeMemberships.length > 0}
                onNavigateSection={openSection}
                onAddNewPatient={() => {
                  setListTab('create');
                  openSection('patients');
                }}
                onRetryPatients={() => void loadPatients()}
                onRetryIncoming={() => void loadIncoming()}
                onRetrySummary={() => void loadSummary()}
              />
            )}

            {section === 'patients' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-[21px] font-semibold text-[var(--doc-text)]">My Patients</h1>
                    <span className="rounded-full border border-[var(--doc-border)] bg-white px-3 py-1 text-[12px] font-semibold tabular-nums text-[var(--doc-muted)]">
                      {patients.length}
                    </span>
                  </div>
                  <div className="flex rounded-xl border border-[var(--doc-border)] bg-white p-1">
                    <button
                      type="button"
                      onClick={() => setListTab('patients')}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition ${
                        listTab === 'patients'
                          ? 'bg-[var(--doc-primary-soft)] text-[var(--doc-primary)]'
                          : 'text-[var(--doc-muted)] hover:text-[var(--doc-text)]'
                      }`}
                    >
                      <UsersIcon className="size-[14px]" />
                      Patients
                    </button>
                    <button
                      type="button"
                      onClick={() => setListTab('create')}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition ${
                        listTab === 'create'
                          ? 'bg-[var(--doc-primary-soft)] text-[var(--doc-primary)]'
                          : 'text-[var(--doc-muted)] hover:text-[var(--doc-text)]'
                      }`}
                    >
                      <PlusIcon className="size-[14px]" />
                      Create patient
                    </button>
                  </div>
                </div>

                {listTab === 'create' && (
                  <section className={`${styles.card} p-6`}>
                    <div className="mx-auto w-full max-w-[420px]">
                      <h2 className="text-balance text-center text-[18px] font-semibold text-[var(--doc-text)]">
                        Create patient
                      </h2>
                      {createError && (
                        <p className="mt-3 rounded-lg border border-[var(--doc-error-border)] bg-[var(--doc-error-bg)] px-3 py-2 text-[13px] font-medium text-[var(--doc-error-text)]">
                          {createError}
                        </p>
                      )}
                      <form onSubmit={onCreatePatient} className="mt-[21px] space-y-[21px]">
                        {activeMemberships.length > 1 ? (
                          <label className="block text-[13px] font-semibold text-[var(--doc-text)]">
                            Organisation
                            <select
                              className="mt-[8px] w-full rounded-[13px] border border-[var(--doc-border)] bg-white px-[13px] py-[13px] text-[13px] text-[var(--doc-text)]"
                              value={organizationId}
                              onChange={(e) => handleSelectOrganization(e.target.value)}
                              required
                            >
                              <option value="" disabled>
                                Select organisation
                              </option>
                              {activeMemberships.map((m) => (
                                <option key={m.organizationId} value={m.organizationId}>
                                  {m.organizationName}
                                  {m.isPrimary ? ' (primary)' : ''}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : activeMemberships.length === 1 ? (
                          <div className="rounded-[13px] border border-[var(--doc-primary-border)] bg-[var(--doc-primary-soft)] px-[13px] py-[13px]">
                            <p className="text-[12px] font-semibold uppercase text-[var(--doc-primary)]">
                              Organisation
                            </p>
                            <p className="mt-[4px] text-[15px] font-semibold text-[var(--doc-text)]">
                              {activeMemberships[0].organizationName}
                            </p>
                          </div>
                        ) : (
                          <p className="text-center text-[13px] font-medium text-[var(--doc-error-text)]">
                            Join an organisation before creating patients.
                          </p>
                        )}
                        <FloatingLabelInput label="Name" value={name} onChange={setName} required scale="golden" />
                        <FloatingLabelInput label="Email" type="email" value={email} onChange={setEmail} required scale="golden" />
                        <FloatingLabelInput label="Phone" value={phone} onChange={setPhone} required scale="golden" />
                        <FloatingLabelPasswordInput
                          label="Password (optional)"
                          value={password}
                          onChange={setPassword}
                          autoComplete="new-password"
                          minLength={8}
                          scale="golden"
                        />
                        <p className="text-[12px] text-pretty text-[var(--doc-muted)]">
                          {password.trim()
                            ? 'Account activates immediately — no invitation email.'
                            : 'Leave blank to email an invitation so the patient sets their own password.'}
                        </p>
                        <button
                          type="submit"
                          disabled={saving || !organizationId}
                          className={`w-full ${styles.primaryBtn}`}
                        >
                          {saving
                            ? 'Creating…'
                            : password.trim()
                              ? 'Create patient account'
                              : 'Create patient & send invitation'}
                        </button>
                      </form>
                    </div>
                  </section>
                )}

                {listTab === 'patients' && (
                  <section className={`${styles.card} p-5 sm:p-6`}>
                    {patientsError ? (
                      <div className="rounded-xl border border-[var(--doc-error-border)] bg-[var(--doc-error-bg)] p-4">
                        <p className="text-[13px] font-medium text-[var(--doc-error-text)]">
                          {patientsError}
                        </p>
                        <button
                          type="button"
                          onClick={() => void loadPatients()}
                          className={`${styles.secondaryBtn} mt-3`}
                        >
                          Retry
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="mb-[21px] flex items-center gap-[13px]">
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
                            <p className="min-w-0 flex-1 text-[13px] text-pretty text-[var(--doc-muted)]">
                              Open a patient to prescribe, review progress, or manage care.
                            </p>
                          )}
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
                            className={`flex size-[34px] shrink-0 items-center justify-center rounded-[10px] border transition ${
                              searchOpen
                                ? 'border-[var(--doc-primary)] bg-[var(--doc-primary)] text-white'
                                : 'border-[var(--doc-border)] bg-[var(--doc-surface-subtle)] text-[var(--doc-muted)]'
                            }`}
                            title={searchOpen ? 'Close search' : 'Search patients'}
                            aria-label={searchOpen ? 'Close search' : 'Search patients'}
                          >
                            {searchOpen ? <XIcon className="size-4" /> : <SearchIcon className="size-4" />}
                          </button>
                        </div>

                        {patientsLoading ? (
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 animate-pulse">
                            <div className="h-[58px] rounded-xl bg-slate-100" />
                            <div className="h-[58px] rounded-xl bg-slate-100" />
                            <div className="h-[58px] rounded-xl bg-slate-100" />
                            <div className="h-[58px] rounded-xl bg-slate-100" />
                          </div>
                        ) : patients.length === 0 ? (
                          <div>
                            <p className="text-[13px] text-pretty text-[var(--doc-muted)]">No patients yet.</p>
                            <button
                              type="button"
                              onClick={() => setListTab('create')}
                              className={`mt-[13px] ${styles.primaryBtn}`}
                            >
                              Invite a patient
                            </button>
                          </div>
                        ) : filteredPatients.length === 0 ? (
                          <div className="py-[34px] text-center">
                            <SearchIcon className="mx-auto mb-[8px] size-8 text-gray-300" />
                            <p className="text-[13px] font-semibold text-[var(--doc-text)]">No matches</p>
                            <p className="mt-[4px] text-[13px] text-[var(--doc-muted)]">
                              Nothing for &quot;{searchQuery}&quot;
                            </p>
                          </div>
                        ) : (
                          <ul className="grid grid-cols-1 gap-[10px] sm:grid-cols-2">
                            {filteredPatients.map((patient) => (
                              <li key={patient.id} className="min-w-0">
                                <Link
                                  href={`/doctor/patients/${patient.id}`}
                                  className="group flex min-w-0 items-center gap-[13px] rounded-xl border border-[var(--doc-border)] bg-[var(--doc-surface-subtle)] px-[13px] py-[13px] text-[13px] font-semibold text-[var(--doc-text)] transition hover:border-[var(--doc-primary-border)] hover:bg-[var(--doc-primary-soft)]"
                                >
                                  <span
                                    aria-hidden
                                    className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-[var(--doc-primary)] text-[12px] font-bold uppercase text-white"
                                  >
                                    {patientInitials(patient.name)}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate">{patient.name}</span>
                                  <ArrowRightIcon className="size-[14px] shrink-0 text-[var(--doc-muted-soft)] transition group-hover:text-[var(--doc-primary)]" />
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </section>
                )}
              </div>
            )}

            {section === 'prescriptions' && (
              <div className="space-y-5">
                <h1 className="text-[21px] font-semibold text-[var(--doc-text)]">Prescriptions</h1>
                <PatientShortcutList
                  title="Prescribe"
                  empty="Invite a patient before prescribing."
                  patients={patients}
                  loading={patientsLoading}
                  error={patientsError}
                  onRetry={() => void loadPatients()}
                  hrefFor={(patient) => `/doctor/patients/${patient.id}?view=prescription`}
                  actionLabel="Prescribe"
                  onCreate={() => {
                    setListTab('create');
                    openSection('patients');
                  }}
                />
              </div>
            )}

            {section === 'transfers' && (
              <div className="space-y-5">
                <h1 className="text-[21px] font-semibold text-[var(--doc-text)]">Transfers</h1>
                {incomingLoading ? (
                  <div className={`${styles.card} p-6 animate-pulse space-y-3`}>
                    <div className="h-5 w-40 rounded bg-slate-200/80" />
                    <div className="h-16 rounded-xl bg-slate-100" />
                  </div>
                ) : incomingError ? (
                  <section className={`${styles.card} p-6`}>
                    <p className="text-[13px] font-medium text-[var(--doc-error-text)]">
                      {incomingError}
                    </p>
                    <button
                      type="button"
                      onClick={() => void loadIncoming()}
                      className={`${styles.secondaryBtn} mt-3`}
                    >
                      Retry
                    </button>
                  </section>
                ) : incoming.length === 0 ? (
                  <section className={`${styles.card} p-6`}>
                    <p className="text-[13px] text-pretty text-[var(--doc-muted)]">
                      No pending transfer requests.
                    </p>
                  </section>
                ) : (
                  <TransferQueue
                    incoming={incoming}
                    incomingBusy={incomingBusy}
                    onSettle={(id, accept) => void settleIncoming(id, accept)}
                  />
                )}
              </div>
            )}

            {section === 'analytics' && (
              <DoctorCaseloadAnalytics
                patients={patients}
                patientsLoading={patientsLoading}
                patientsError={patientsError}
                onRetryPatients={() => void loadPatients()}
              />
            )}

            {section === 'account' && (
              <div className="space-y-5">
                <h1 className="text-[21px] font-semibold text-[var(--doc-text)]">My Profile</h1>
                <DoctorAccountCard session={session} />
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function TransferQueue({
  incoming,
  incomingBusy,
  onSettle,
}: {
  incoming: IncomingDocIdRequest[];
  incomingBusy: string | null;
  onSettle: (id: string, accept: boolean) => void;
}) {
  return (
    <section className={`${styles.card} space-y-[21px] p-5 sm:p-6`}>
      <div>
        <h2 className="text-balance text-[18px] font-semibold text-[var(--doc-text)]">
          Incoming requests
        </h2>
        <p className="mt-[8px] text-[13px] text-pretty text-[var(--doc-muted)]">
          Confirm or reject attach requests for your DocID.
        </p>
      </div>
      <ul className="space-y-[8px]">
        {incoming.map((request) => (
          <li
            key={request.id}
            className="flex flex-col gap-[13px] rounded-xl border border-[var(--doc-border)] bg-[var(--doc-surface-subtle)] p-[13px] sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-[var(--doc-text)]">
                {request.patientName}
              </p>
              <p className="truncate text-[13px] text-[var(--doc-muted)]">
                {request.patientEmail}
                {request.source === 'change' ? ' · reassignment' : ' · new attach'}
              </p>
            </div>
            <div className="flex shrink-0 gap-[8px]">
              <button
                type="button"
                disabled={incomingBusy === request.id}
                onClick={() => onSettle(request.id, true)}
                className={styles.primaryBtn}
              >
                Confirm
              </button>
              <button
                type="button"
                disabled={incomingBusy === request.id}
                onClick={() => onSettle(request.id, false)}
                className={styles.secondaryBtn}
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PatientShortcutList({
  title,
  patients,
  loading,
  error,
  onRetry,
  empty,
  hrefFor,
  actionLabel,
  onCreate,
}: {
  title: string;
  patients: PatientSummary[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  empty: string;
  hrefFor: (patient: PatientSummary) => string;
  actionLabel: string;
  onCreate?: () => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setSearchOpen(false);
    setSearchQuery('');
  }, [title]);

  const filtered = useMemo(
    () => filterPatients(patients, searchQuery, searchOpen),
    [patients, searchQuery, searchOpen],
  );

  return (
    <section className={`${styles.card} p-5 sm:p-6`}>
      <div className="flex items-center gap-[13px]">
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
          <h2 className="min-w-0 flex-1 text-balance text-[18px] font-semibold text-[var(--doc-text)]">
            {title}
          </h2>
        )}
        {!loading && !error && patients.length > 0 ? (
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
        ) : null}
      </div>
      {loading ? (
        <div className="mt-[21px] space-y-2 animate-pulse">
          <div className="h-[58px] rounded-xl bg-slate-100" />
          <div className="h-[58px] rounded-xl bg-slate-100" />
        </div>
      ) : error ? (
        <div className="mt-[21px] rounded-xl border border-[var(--doc-error-border)] bg-[var(--doc-error-bg)] p-4">
          <p className="text-[13px] font-medium text-[var(--doc-error-text)]">{error}</p>
          <button type="button" onClick={onRetry} className={`${styles.secondaryBtn} mt-3`}>
            Retry
          </button>
        </div>
      ) : patients.length === 0 ? (
        <div className="mt-[21px]">
          <p className="text-[13px] text-pretty text-[var(--doc-muted)]">{empty}</p>
          {onCreate ? (
            <button type="button" onClick={onCreate} className={`mt-[13px] ${styles.primaryBtn}`}>
              Invite a patient
            </button>
          ) : null}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-[34px] text-center">
          <SearchIcon className="mx-auto mb-[8px] size-8 text-gray-300" />
          <p className="text-[13px] font-semibold text-[var(--doc-text)]">No matches</p>
          <p className="mt-[4px] text-[13px] text-[var(--doc-muted)]">
            Nothing for &quot;{searchQuery}&quot;
          </p>
        </div>
      ) : (
        <ul className="mt-[21px] space-y-[8px]">
          {filtered.map((patient) => (
            <li key={patient.id}>
              <Link
                href={hrefFor(patient)}
                className="group flex items-center justify-between gap-[13px] rounded-xl border border-[var(--doc-border)] bg-[var(--doc-surface-subtle)] px-[13px] py-[13px] text-[13px] transition hover:border-[var(--doc-primary-border)] hover:bg-[var(--doc-primary-soft)]"
              >
                <span className="flex min-w-0 items-center gap-[13px]">
                  <span
                    aria-hidden
                    className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-[var(--doc-primary)] text-[12px] font-bold uppercase text-white"
                  >
                    {patientInitials(patient.name)}
                  </span>
                  <span className="truncate font-semibold text-[var(--doc-text)]">{patient.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-[8px] font-semibold text-[var(--doc-muted)] transition group-hover:text-[var(--doc-primary)]">
                  {actionLabel}
                  <ArrowRightIcon className="size-[14px]" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
