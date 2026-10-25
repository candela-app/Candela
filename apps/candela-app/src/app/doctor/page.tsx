'use client';

import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { ApiError, api } from '@/lib/api';
import type { IncomingDocIdRequest, PatientSummary } from '@candela/shared';
import { AppHeader } from '@/components/layout/AppHeader';
import { DoctorDashboardSkeleton } from '@/components/common/Skeleton';
import {
  AnalyticsIcon,
  BellIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  SearchIcon,
  SlidersIcon,
  UserIcon,
  UsersIcon,
  XIcon,
} from '@/components/icons/VectorIcons';
import {
  FloatingLabelInput,
  FloatingLabelPasswordInput,
} from '@/components/ui/FloatingLabelInput';
import { CopyButton } from '@/components/ui/CopyButton';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from 'react';

const SECTIONS = ['overview', 'patients', 'prescriptions', 'transfers', 'analytics', 'settings'] as const;
type Section = (typeof SECTIONS)[number];

function readSection(value: string | null): Section {
  if (value && (SECTIONS as readonly string[]).includes(value)) {
    return value as Section;
  }
  return 'patients';
}

function prescriptionLabel(patient: PatientSummary) {
  const activities = patient.prescribedModuleIds.length;
  if (activities === 0) {
    return 'None';
  }
  const levels = Object.values(patient.prescribedLevels || {}).reduce((sum, ids) => sum + ids.length, 0);
  return levels > 0 ? `${activities} activities · ${levels} levels` : `${activities} activities`;
}

function patientInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function StatCard({
  label,
  value,
  hint,
  labelColor,
}: {
  label: string;
  value: string;
  hint: string;
  labelColor: string;
}) {
  return (
    <div className="rounded-[13px] border border-gray-100 bg-white p-[21px] shadow-[0_12px_32px_-14px_rgba(15,23,42,0.35)]">
      <p className="text-[13px] font-bold uppercase tracking-wider" style={{ color: labelColor }}>
        {label}
      </p>
      <p className="mt-[8px] text-[34px] font-extrabold leading-none text-gray-900">{value}</p>
      <p className="mt-[8px] text-[13px] text-gray-500">{hint}</p>
    </div>
  );
}

export default function DoctorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F4F7FC]">
          <AppHeader />
          <DoctorDashboardSkeleton />
        </div>
      }
    >
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
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [incoming, setIncoming] = useState<IncomingDocIdRequest[]>([]);
  const [incomingBusy, setIncomingBusy] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [listTab, setListTab] = useState<'create' | 'patients'>('patients');
  const [navOpen, setNavOpen] = useState(false);
  const section = readSection(searchParams.get('section'));

  const filteredPatients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || !searchOpen) return patients;
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q),
    );
  }, [patients, searchQuery, searchOpen]);

  const prescribedPatients = useMemo(
    () => patients.filter((patient) => patient.prescribedModuleIds.length > 0),
    [patients],
  );
  const unprescribedPatients = useMemo(
    () => patients.filter((patient) => patient.prescribedModuleIds.length === 0),
    [patients],
  );

  const load = useCallback(async () => {
    try {
      const [next, nextIncoming] = await Promise.all([
        api<PatientSummary[]>('/api/doctors/me/patients'),
        api<IncomingDocIdRequest[]>('/api/docid/incoming'),
      ]);
      setPatients(next);
      setIncoming(nextIncoming);
    } finally {
      setDataLoading(false);
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
    load().catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load'));
  }, [loading, session, router, load]);

  function openSection(next: Section) {
    if (next === 'patients') {
      router.replace('/doctor');
      return;
    }
    router.replace(`/doctor?section=${next}`);
  }

  async function onCreatePatient(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    const patientName = name.trim();
    try {
      const created = await api<PatientSummary>('/api/doctors/me/patients', {
        method: 'POST',
        body: JSON.stringify({ name, phone, email, password }),
      });
      setName('');
      setPhone('');
      setEmail('');
      setPassword('');
      toast.success(`Patient ${patientName} created successfully!`);
      setListTab('patients');
      router.push(`/doctor/patients/${created.id}`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not create patient';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function settleIncoming(id: string, accept: boolean) {
    setIncomingBusy(id);
    try {
      await api(`/api/docid/requests/${id}/${accept ? 'accept' : 'reject'}`, { method: 'POST' });
      await load();
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

  if (loading || dataLoading || !session || session.user.role !== 'doctor') {
    return (
      <div className="min-h-screen bg-[#F4F7FC]">
        <AppHeader />
        <DoctorDashboardSkeleton />
      </div>
    );
  }

  const nav: { id: Section; label: string; icon: typeof LayoutDashboardIcon; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboardIcon },
    { id: 'patients', label: 'My patients', icon: UsersIcon, badge: patients.length },
    { id: 'prescriptions', label: 'Prescriptions', icon: SlidersIcon },
    { id: 'analytics', label: 'Analytics', icon: AnalyticsIcon },
    { id: 'transfers', label: 'Transfer requests', icon: BellIcon, badge: incoming.length },
    { id: 'settings', label: 'Settings', icon: UserIcon },
  ];

  return (
    <div className="min-h-screen bg-[#F4F7FC]">
      <AppHeader
        leading={
          <button
            type="button"
            onClick={() => setNavOpen((open) => !open)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-700 hover:bg-gray-100 lg:hidden"
            aria-label={navOpen ? 'Close sidebar' : 'Open sidebar'}
            aria-expanded={navOpen}
          >
            <svg
              className="h-[22px] w-[22px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 3v18" />
              {navOpen ? <rect x="4" y="4" width="5" height="16" rx="1" fill="currentColor" stroke="none" /> : null}
            </svg>
          </button>
        }
        extra={
          session.doctor ? (
            <div className="flex items-center gap-1.5 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200/60">
              <span className="font-mono text-sm font-bold text-blue-700">{session.doctor.referralCode}</span>
              <CopyButton text={session.doctor.referralCode} label="DocID" iconSize={13} />
            </div>
          ) : null
        }
      />

      <div className="mx-auto max-w-[1184px] px-[13px] py-[21px] sm:px-[21px] lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-[34px] lg:py-[34px]">
        {navOpen ? (
          <button
            type="button"
            className="fixed inset-x-0 bottom-0 top-[68px] z-30 bg-slate-900/40 lg:hidden"
            aria-label="Close menu"
            onClick={() => setNavOpen(false)}
          />
        ) : null}
        <nav
          aria-label="Doctor workspace"
          className={`dashboard-scrollbar fixed left-4 top-[68px] z-40 flex max-h-[calc(100dvh-81px)] w-[220px] flex-col gap-[8px] overflow-y-auto rounded-[13px] border border-gray-100 bg-white p-[13px] shadow-[0_12px_32px_-14px_rgba(15,23,42,0.35)] ${
            navOpen ? 'translate-x-0' : '-translate-x-[calc(100%+2rem)]'
          } lg:sticky lg:left-auto lg:top-[68px] lg:z-auto lg:mb-0 lg:flex lg:h-auto lg:max-h-none lg:w-auto lg:translate-x-0 lg:self-start lg:overflow-visible`}
        >
          {nav.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  openSection(item.id);
                  setNavOpen(false);
                }}
                aria-current={active ? 'page' : undefined}
                className={`flex shrink-0 cursor-pointer items-center gap-[8px] rounded-[8px] px-[13px] py-[13px] text-[13px] font-semibold ${
                  active ? 'bg-blue-600 text-white' : 'bg-transparent text-gray-700 hover:bg-blue-50'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
                {item.badge ? (
                  <span
                    className={`ml-auto rounded-full px-2 py-0.5 text-[11px] ${
                      active ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'
                    }`}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="mt-2 flex shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-transparent px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100"
          >
            <LogOutIcon className="h-4 w-4 shrink-0" />
            <span>Sign out</span>
          </button>
        </nav>

        <main className="min-w-0 space-y-6">
          <nav aria-label="Breadcrumb" className="text-sm">
            <ol className="flex flex-wrap items-center gap-2 text-gray-500">
              <li>
                {section === 'overview' ? (
                  <span className="font-semibold text-gray-900">Doctor dashboard</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => openSection('overview')}
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    Doctor dashboard
                  </button>
                )}
              </li>
              {section !== 'overview' && (
                <>
                  <li aria-hidden className="text-gray-300">
                    /
                  </li>
                  <li className="font-semibold text-gray-900" aria-current="page">
                    {nav.find((item) => item.id === section)?.label}
                  </li>
                </>
              )}
            </ol>
          </nav>
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}

          {section === 'overview' && (
            <>
              <h1 className="text-3xl font-extrabold text-gray-900">Doctor dashboard</h1>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCard
                  label="Assigned patients"
                  value={String(patients.length)}
                  hint="Patients you can open"
                  labelColor="#2563EB"
                />
                <StatCard
                  label="Pending transfers"
                  value={String(incoming.length)}
                  hint="Attach and change requests"
                  labelColor="#D97706"
                />
                <StatCard
                  label="Active prescriptions"
                  value={String(prescribedPatients.length)}
                  hint="Patients with activities assigned"
                  labelColor="#7C3AED"
                />
              </div>
              {incoming.length > 0 && (
                <TransferQueue
                  incoming={incoming}
                  incomingBusy={incomingBusy}
                  onSettle={(id, accept) => void settleIncoming(id, accept)}
                />
              )}
              <PatientTable
                title="Patients"
                patients={patients}
                empty="No patients yet."
                searchable
                onCreate={() => {
                  setListTab('create');
                  openSection('patients');
                }}
              />
              {unprescribedPatients.length > 0 && (
                <section className="rounded-[13px] border border-gray-100 bg-white p-[21px] shadow-sm">
                  <h2 className="text-lg font-bold text-gray-900">Needs a prescription</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    These assigned patients have no activities yet. Open a patient to prescribe on their profile.
                  </p>
                  <ul className="mt-4 space-y-2">
                    {unprescribedPatients.map((patient) => (
                      <li key={patient.id}>
                        <Link
                          href={`/doctor/patients/${patient.id}`}
                          className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 text-sm hover:border-blue-200 hover:bg-blue-50"
                        >
                          <span className="font-semibold text-gray-900">{patient.name}</span>
                          <span className="font-bold text-blue-600">Open</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          {section === 'patients' && (
            <>
              <h1 className="text-3xl font-extrabold text-gray-900">My patients</h1>
              <div className="mx-auto flex max-w-lg rounded-[13px] bg-gray-200 p-1">
                <button
                  type="button"
                  onClick={() => setListTab('create')}
                  className={`flex-1 cursor-pointer rounded-xl py-2.5 text-sm font-bold ${
                    listTab === 'create' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  Create patient
                </button>
                <button
                  type="button"
                  onClick={() => setListTab('patients')}
                  className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold ${
                    listTab === 'patients' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  Patients
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] ${
                      listTab === 'patients' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {patients.length}
                  </span>
                </button>
              </div>
              {listTab === 'create' && (
                <section className="rounded-[13px] border border-gray-100 bg-white p-[21px] shadow-sm">
                  <h2 className="mb-4 text-lg font-bold text-gray-900">Create patient</h2>
                  <form onSubmit={onCreatePatient} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FloatingLabelInput label="Name" value={name} onChange={setName} required />
                    <FloatingLabelInput label="Phone" value={phone} onChange={setPhone} required />
                    <FloatingLabelInput label="Email" type="email" value={email} onChange={setEmail} required />
                    <FloatingLabelPasswordInput
                      label="Password (min 8)"
                      value={password}
                      onChange={setPassword}
                      required
                      minLength={8}
                    />
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white disabled:opacity-60 sm:col-span-2"
                    >
                      {saving ? 'Creating…' : 'Create patient'}
                    </button>
                  </form>
                </section>
              )}
              {listTab === 'patients' && (
                <section className="rounded-[13px] border border-gray-100 bg-white p-[21px] shadow-[0_12px_32px_-14px_rgba(15,23,42,0.35)]">
                  <div className="mb-3 flex items-center">
                    <h2 className="text-lg font-bold text-gray-900">Patients</h2>
                    <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
                      {patients.length}
                    </span>
                    <div className="flex-1" />
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
                      className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                        searchOpen ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
                      }`}
                      title={searchOpen ? 'Close search' : 'Search patients'}
                      aria-label={searchOpen ? 'Close search' : 'Search patients'}
                    >
                      {searchOpen ? <XIcon className="h-4 w-4" /> : <SearchIcon className="h-4 w-4" />}
                    </button>
                  </div>
                  {searchOpen && (
                    <div className="relative mb-3 max-w-md">
                      <FloatingLabelInput
                        label="Search patient name, email..."
                        value={searchQuery}
                        onChange={setSearchQuery}
                        autoFocus
                        endAdornment={
                          searchQuery ? (
                            <button
                              type="button"
                              onClick={() => setSearchQuery('')}
                              className="cursor-pointer text-gray-400 hover:text-gray-600"
                              title="Clear search"
                            >
                              <XIcon className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <SearchIcon className="h-4 w-4 text-gray-400" />
                          )
                        }
                      />
                    </div>
                  )}
                  {patients.length === 0 && (
                    <div className="py-2">
                      <p className="text-sm text-gray-500">No patients yet.</p>
                      <button
                        type="button"
                        onClick={() => setListTab('create')}
                        className="mt-3 cursor-pointer rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white"
                      >
                        Create a patient
                      </button>
                    </div>
                  )}
                  {patients.length > 0 && filteredPatients.length === 0 && (
                    <div className="px-2 py-6 text-center text-gray-400">
                      <SearchIcon className="mx-auto mb-2 h-8 w-8 opacity-40" />
                      <p className="text-xs font-semibold text-gray-500">No patients found</p>
                      <p className="mt-0.5 text-[11px] text-gray-400">No match for &quot;{searchQuery}&quot;</p>
                    </div>
                  )}
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {filteredPatients.map((patient) => (
                      <li key={patient.id}>
                        <Link
                          href={`/doctor/patients/${patient.id}`}
                          className="flex items-center gap-3 rounded-xl border border-transparent bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-800 transition-colors hover:border-blue-200 hover:bg-blue-50"
                        >
                          <span
                            aria-hidden
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold uppercase text-white"
                          >
                            {patientInitials(patient.name)}
                          </span>
                          <span className="min-w-0 truncate">{patient.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          {section === 'prescriptions' && (
            <>
              <h1 className="text-3xl font-extrabold text-gray-900">Prescriptions</h1>
              <PatientTable
                title="Assigned patients"
                patients={patients}
                empty="No patients yet. Create a patient before prescribing."
                searchable
                onCreate={() => {
                  setListTab('create');
                  openSection('patients');
                }}
              />
            </>
          )}

          {section === 'transfers' && (
            <>
              <h1 className="text-3xl font-extrabold text-gray-900">Transfer requests</h1>
              {incoming.length === 0 ? (
                <section className="rounded-[13px] border border-gray-100 bg-white p-[21px] shadow-[0_12px_32px_-14px_rgba(15,23,42,0.35)]">
                  <p className="text-sm text-gray-500">No pending transfer requests.</p>
                </section>
              ) : (
                <TransferQueue
                  incoming={incoming}
                  incomingBusy={incomingBusy}
                  onSettle={(id, accept) => void settleIncoming(id, accept)}
                />
              )}
            </>
          )}

          {section === 'analytics' && (
            <>
              <h1 className="text-3xl font-extrabold text-gray-900">Analytics</h1>
              <PatientTable
                title="Assigned patients"
                patients={patients}
                empty="No patients yet."
                searchable
                showAnalytics
              />
            </>
          )}

          {section === 'settings' && (
            <>
              <h1 className="text-3xl font-extrabold text-gray-900">Settings</h1>
              <section className="rounded-[13px] border border-gray-100 bg-white p-[21px] shadow-[0_12px_32px_-14px_rgba(15,23,42,0.35)]">
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Name</dt>
                    <dd className="mt-1 text-sm font-semibold text-gray-900">{session.user.name}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Email</dt>
                    <dd className="mt-1 text-sm font-semibold text-gray-900">{session.user.email}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Phone</dt>
                    <dd className="mt-1 text-sm font-semibold text-gray-900">{session.user.phone || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Organization</dt>
                    <dd className="mt-1 text-sm font-semibold text-gray-900">{session.organization?.name || '—'}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-gray-500">DocID</dt>
                    <dd className="mt-1 flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-blue-700">
                        {session.doctor?.referralCode || '—'}
                      </span>
                      <CopyButton text={session.doctor?.referralCode} label="DocID" iconSize={13} />
                    </dd>
                  </div>
                </dl>
              </section>
            </>
          )}
        </main>
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
    <section className="space-y-4 rounded-[13px] border border-blue-100 bg-white p-[21px] shadow-sm">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Incoming attach requests</h2>
        <p className="mt-1 text-sm text-gray-500">
          Patients asked to join or switch to your DocID. Confirm or reject here if the email is delayed.
        </p>
      </div>
      <ul className="space-y-3">
        {incoming.map((request) => (
          <li
            key={request.id}
            className="flex flex-col gap-3 rounded-[13px] border border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-semibold text-gray-900">{request.patientName}</p>
              <p className="text-xs text-gray-500">
                {request.patientEmail}
                {request.source === 'change' ? ' · reassignment' : ' · new attach'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={incomingBusy === request.id}
                onClick={() => onSettle(request.id, true)}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                Confirm
              </button>
              <button
                type="button"
                disabled={incomingBusy === request.id}
                onClick={() => onSettle(request.id, false)}
                className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-60"
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

function PatientTable({
  title,
  patients,
  empty,
  searchable = false,
  showAnalytics = false,
  onCreate,
}: {
  title: string;
  patients: PatientSummary[];
  empty: string;
  searchable?: boolean;
  showAnalytics?: boolean;
  onCreate?: () => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const visiblePatients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!searchable || !q || !searchOpen) return patients;
    return patients.filter(
      (patient) =>
        patient.name.toLowerCase().includes(q) ||
        patient.email.toLowerCase().includes(q) ||
        patient.phone.toLowerCase().includes(q),
    );
  }, [patients, searchQuery, searchOpen, searchable]);

  return (
    <section className="rounded-[13px] border border-gray-100 bg-white p-[21px] shadow-[0_12px_32px_-14px_rgba(15,23,42,0.35)]">
      <div className={`flex items-center ${searchable ? 'mb-3' : ''}`}>
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        {searchable && patients.length > 0 && (
          <>
            <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
              {patients.length}
            </span>
            <div className="flex-1" />
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
              className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                searchOpen ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
              }`}
              title={searchOpen ? 'Close search' : 'Search patients'}
              aria-label={searchOpen ? 'Close search' : 'Search patients'}
            >
              {searchOpen ? <XIcon className="h-4 w-4" /> : <SearchIcon className="h-4 w-4" />}
            </button>
          </>
        )}
      </div>
      {searchable && patients.length > 0 && searchOpen && (
        <div className="relative mb-3 max-w-md">
          <FloatingLabelInput
            label="Search patient name, email..."
            value={searchQuery}
            onChange={setSearchQuery}
            autoFocus
            endAdornment={
              searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="cursor-pointer text-gray-400 hover:text-gray-600"
                  title="Clear search"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              ) : (
                <SearchIcon className="h-4 w-4 text-gray-400" />
              )
            }
          />
        </div>
      )}
      {patients.length === 0 ? (
        <div className="py-2">
          <p className="text-sm text-gray-500">{empty}</p>
          {onCreate && (
            <button
              type="button"
              onClick={onCreate}
              className="mt-3 cursor-pointer rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white"
            >
              Create a patient
            </button>
          )}
        </div>
      ) : visiblePatients.length === 0 ? (
        <div className="px-2 py-6 text-center text-gray-400">
          <SearchIcon className="mx-auto mb-2 h-8 w-8 opacity-40" />
          <p className="text-xs font-semibold text-gray-500">No patients found</p>
          <p className="mt-0.5 text-[11px] text-gray-400">No match for &quot;{searchQuery}&quot;</p>
        </div>
      ) : (
        <>
          <ul className={`md:hidden ${searchable ? '' : 'mt-4'}`}>
            {visiblePatients.map((patient) => (
              <li key={patient.id} className="border-b border-gray-200 py-3">
                <div className="flex items-center gap-3 rounded-xl border border-transparent bg-gray-50 px-4 py-3 transition-colors hover:border-blue-200 hover:bg-blue-50">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span
                      aria-hidden
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold uppercase text-white"
                    >
                      {patientInitials(patient.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-800">{patient.name}</p>
                      <p className="truncate text-xs text-gray-500">{prescriptionLabel(patient)}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    <Link
                      href={`/doctor/patients/${patient.id}`}
                      className="cursor-pointer rounded-lg px-2.5 py-1 text-sm font-bold text-blue-600 transition-colors hover:bg-white hover:text-blue-800"
                    >
                      Open
                    </Link>
                    {showAnalytics && (
                      <Link
                        href={`/doctor/patients/${patient.id}?view=analytics`}
                        className="cursor-pointer rounded-lg px-2.5 py-1 text-sm font-bold text-blue-600 transition-colors hover:bg-white hover:text-blue-800"
                      >
                        Analytics
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className={`dashboard-scrollbar hidden overflow-x-auto md:block ${searchable ? '' : 'mt-4'}`}>
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  <th className="px-2 py-2 font-bold">Patient</th>
                  <th className="px-2 py-2 font-bold">Prescription</th>
                  <th className="px-2 py-2 font-bold">Action</th>
                </tr>
              </thead>
              <tbody>
                {visiblePatients.map((patient) => (
                  <tr key={patient.id} className="border-b border-gray-50 last:border-0 transition-colors hover:bg-[#F4F7FC]">
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold uppercase text-white"
                        >
                          {patientInitials(patient.name)}
                        </span>
                        <p className="truncate font-semibold text-gray-900">{patient.name}</p>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-gray-700">{prescriptionLabel(patient)}</td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/doctor/patients/${patient.id}`}
                          className="cursor-pointer rounded-lg px-2.5 py-1 font-bold text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-800"
                        >
                          Open
                        </Link>
                        {showAnalytics && (
                          <Link
                            href={`/doctor/patients/${patient.id}?view=analytics`}
                            className="cursor-pointer rounded-lg px-2.5 py-1 font-bold text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-800"
                          >
                            Analytics
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
