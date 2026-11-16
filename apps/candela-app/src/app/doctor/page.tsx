'use client';

import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { ApiError, api, withOrganizationId } from '@/lib/api';
import type {
  CreateDoctorPatientResponse,
  DoctorOrganizationMembershipView,
  IncomingDocIdRequest,
  PatientSummary,
} from '@candela/shared';
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
import { FloatingLabelInput } from '@/components/ui/FloatingLabelInput';
import { CopyButton } from '@/components/ui/CopyButton';
import { DoctorAccountCard } from '@/components/profile/DoctorAccountCard';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from 'react';

const ORG_STORAGE_KEY = 'candela.doctor.activeOrganizationId';

const SECTIONS = ['overview', 'patients', 'prescriptions', 'transfers', 'analytics', 'account'] as const;
type Section = (typeof SECTIONS)[number];

function readSection(value: string | null): Section {
  if (value === 'settings') return 'account';
  if (value && (SECTIONS as readonly string[]).includes(value)) {
    return value as Section;
  }
  return 'patients';
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
      <p className="mt-[8px] text-[34px] font-semibold leading-none text-gray-900">{value}</p>
      <p className="mt-[8px] text-[13px] text-gray-500">{hint}</p>
    </div>
  );
}

export default function DoctorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen page-wash">
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
  const [saving, setSaving] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [incoming, setIncoming] = useState<IncomingDocIdRequest[]>([]);
  const [incomingBusy, setIncomingBusy] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [listTab, setListTab] = useState<'create' | 'patients'>('patients');
  const [navOpen, setNavOpen] = useState(false);
  const [memberships, setMemberships] = useState<DoctorOrganizationMembershipView[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const section = readSection(searchParams.get('section'));

  const activeMemberships = useMemo(
    () => memberships.filter((m) => m.membershipStatus === 'active'),
    [memberships],
  );

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
      const [next, nextIncoming, orgs] = await Promise.all([
        api<PatientSummary[]>('/api/doctors/me/patients'),
        api<IncomingDocIdRequest[]>('/api/docid/incoming'),
        api<DoctorOrganizationMembershipView[]>('/api/me/organizations'),
      ]);
      setPatients(next);
      setIncoming(nextIncoming);
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
    if (!organizationId) {
      const msg = 'Select an organisation before creating a patient.';
      setError(msg);
      toast.error(msg);
      return;
    }
    setSaving(true);
    const patientName = name.trim();
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(ORG_STORAGE_KEY, organizationId);
      }
      const created = await api<CreateDoctorPatientResponse>(
        '/api/doctors/me/patients',
        withOrganizationId(organizationId, {
          method: 'POST',
          body: JSON.stringify({ name, phone, email }),
        }),
      );
      setName('');
      setPhone('');
      setEmail('');
      await load();
      if (created.invitation.emailSent) {
        toast.success(
          `Patient ${patientName} created. Invitation sent to ${created.patient.email} (expires ${new Date(created.invitation.expiresAt).toLocaleString('en-GB')}).`,
        );
      } else {
        toast.error(
          `Patient ${patientName} was created, but the invitation email could not be sent. Open the patient profile to resend.`,
        );
      }
      setListTab('patients');
      router.push(
        `/doctor/patients/${created.patient.id}?invite=${created.invitation.emailSent ? 'sent' : 'failed'}&expires=${encodeURIComponent(created.invitation.expiresAt)}`,
      );
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
      <div className="min-h-screen page-wash">
        <AppHeader />
        <DoctorDashboardSkeleton />
      </div>
    );
  }

  const nav: { id: Section; label: string; icon: typeof LayoutDashboardIcon }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboardIcon },
    { id: 'patients', label: 'My patients', icon: UsersIcon },
    { id: 'prescriptions', label: 'Prescriptions', icon: SlidersIcon },
    { id: 'analytics', label: 'Analytics', icon: AnalyticsIcon },
    { id: 'transfers', label: 'Transfer requests', icon: BellIcon },
    { id: 'account', label: 'Account', icon: UserIcon },
  ];

  return (
    <div className="min-h-screen page-wash">
      <AppHeader
        leading={
          <button
            type="button"
            onClick={() => setNavOpen((open) => !open)}
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[13px] text-gray-700 hover:bg-gray-100 lg:hidden"
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
            <div className="flex items-center gap-[8px] bg-blue-50 px-[13px] py-[8px] rounded-[8px] border border-blue-200/60">
              <span className="font-mono text-[13px] font-semibold text-blue-700">{session.doctor.referralCode}</span>
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
                  active ? 'bg-gray-900 text-white' : 'bg-transparent text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="mt-[13px] flex shrink-0 cursor-pointer items-center gap-[8px] rounded-[8px] bg-transparent px-[13px] py-[13px] text-[13px] font-semibold text-red-600 hover:bg-red-100"
          >
            <LogOutIcon className="h-4 w-4 shrink-0" />
            <span>Sign out</span>
          </button>
        </nav>

        <main className="min-w-0 space-y-[34px]">
          {error && <p className="text-[13px] font-medium text-red-600">{error}</p>}

          {section === 'overview' && (
            <>
              <h1 className="text-[21px] font-semibold text-gray-900">Doctor dashboard</h1>
              <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-3">
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
              {incoming.length > 0 ? (
                <section className="rounded-[13px] border border-amber-100 bg-amber-50/70 p-[21px]">
                  <div className="flex flex-wrap items-center justify-between gap-[13px]">
                    <div>
                      <h2 className="text-[21px] font-semibold text-gray-900">Pending transfers</h2>
                      <p className="mt-[8px] text-[13px] text-gray-600">
                        {incoming.length} request{incoming.length === 1 ? '' : 's'} waiting for your decision.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openSection('transfers')}
                      className="cursor-pointer rounded-[13px] bg-amber-600 px-[13px] py-[13px] text-[13px] font-semibold text-white"
                    >
                      Review transfers
                    </button>
                  </div>
                </section>
              ) : null}
              {unprescribedPatients.length > 0 ? (
                <section className="rounded-[13px] border border-gray-100 bg-white p-[21px] shadow-[0_12px_32px_-14px_rgba(15,23,42,0.35)]">
                  <h2 className="text-[21px] font-semibold text-gray-900">Needs a prescription</h2>
                  <p className="mt-[8px] text-[13px] text-gray-500">
                    Open a patient to prescribe. Full roster lives under My patients.
                  </p>
                  <ul className="mt-[21px] space-y-[13px]">
                    {unprescribedPatients.slice(0, 5).map((patient) => (
                      <li key={patient.id}>
                        <Link
                          href={`/doctor/patients/${patient.id}?view=prescription`}
                          className="flex items-center justify-between rounded-[13px] border border-gray-100 px-[13px] py-[13px] text-[13px] hover:border-blue-200 hover:bg-blue-50"
                        >
                          <span className="font-semibold text-gray-900">{patient.name}</span>
                          <span className="font-semibold text-blue-600">Prescribe</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {unprescribedPatients.length > 5 ? (
                    <button
                      type="button"
                      onClick={() => openSection('patients')}
                      className="mt-[13px] cursor-pointer text-[13px] font-semibold text-blue-600"
                    >
                      View all patients
                    </button>
                  ) : null}
                </section>
              ) : (
                <section className="rounded-[13px] border border-gray-100 bg-white p-[21px] shadow-[0_12px_32px_-14px_rgba(15,23,42,0.35)]">
                  <p className="text-[13px] text-gray-500">
                    Roster and create live under{' '}
                    <button
                      type="button"
                      onClick={() => openSection('patients')}
                      className="cursor-pointer font-semibold text-blue-600"
                    >
                      My patients
                    </button>
                    .
                  </p>
                </section>
              )}
            </>
          )}

          {section === 'patients' && (
            <>
              <h1 className="text-[21px] font-semibold text-gray-900">My patients</h1>
              <div className="mx-auto flex w-full max-w-[576px] rounded-[13px] bg-gray-200 p-[8px]">
                <button
                  type="button"
                  onClick={() => setListTab('create')}
                  className={`flex-1 cursor-pointer rounded-[13px] py-[13px] text-[13px] font-semibold ${
                    listTab === 'create' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  Create patient
                </button>
                <button
                  type="button"
                  onClick={() => setListTab('patients')}
                  className={`flex-1 cursor-pointer rounded-[13px] py-[13px] text-[13px] font-semibold ${
                    listTab === 'patients' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  Patients
                </button>
              </div>
              {listTab === 'create' && (
                <section className="rounded-[13px] border border-gray-100 bg-white p-[21px] shadow-[0_12px_32px_-14px_rgba(15,23,42,0.35)]">
                  <h2 className="mb-[21px] text-[21px] font-semibold leading-none text-gray-900">Create patient</h2>
                  <p className="mb-[21px] text-[13px] text-gray-500">
                    The patient receives a secure email invitation to set their own password. You never create or send a
                    password.
                  </p>
                  <form onSubmit={onCreatePatient} className="grid grid-cols-1 gap-[21px] sm:grid-cols-2">
                    {activeMemberships.length > 1 ? (
                      <label className="sm:col-span-2 block text-[13px] font-semibold text-gray-700">
                        Organisation
                        <select
                          className="mt-[8px] w-full rounded-[13px] border border-gray-200 bg-white px-[13px] py-[13px] text-[13px] text-gray-900"
                          value={organizationId}
                          onChange={(e) => setOrganizationId(e.target.value)}
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
                      <p className="sm:col-span-2 text-[13px] text-gray-500">
                        Organisation: <span className="font-semibold text-gray-800">{activeMemberships[0].organizationName}</span>
                      </p>
                    ) : (
                      <p className="sm:col-span-2 text-[13px] font-medium text-red-600">
                        No active organisation membership. You cannot create patients until you join an organisation.
                      </p>
                    )}
                    <FloatingLabelInput label="Name" value={name} onChange={setName} required scale="golden" />
                    <FloatingLabelInput label="Phone" value={phone} onChange={setPhone} required scale="golden" />
                    <FloatingLabelInput label="Email" type="email" value={email} onChange={setEmail} required scale="golden" />
                    <button
                      type="submit"
                      disabled={saving || !organizationId}
                      className="w-fit rounded-[13px] bg-blue-600 px-[21px] py-[13px] text-[13px] font-semibold text-white disabled:opacity-60 sm:col-span-2"
                    >
                      {saving ? 'Creating…' : 'Create patient & send invitation'}
                    </button>
                  </form>
                </section>
              )}
              {listTab === 'patients' && (
                <section className="rounded-[13px] border border-gray-100 bg-white p-[21px] shadow-[0_12px_32px_-14px_rgba(15,23,42,0.35)]">
                  <div className="mb-[13px] flex items-center gap-[13px]">
                    {searchOpen ? (
                      <div className="min-w-0 flex-1">
                        <FloatingLabelInput
                          label="Search patient name, email..."
                          value={searchQuery}
                          onChange={setSearchQuery}
                          autoFocus
                          scale="golden"
                        />
                      </div>
                    ) : (
                      <>
                        <h2 className="text-[21px] font-semibold text-gray-900">Patients</h2>
                        <span className="rounded-full bg-gray-100 px-[8px] py-[8px] text-[13px] font-semibold text-gray-500">
                          {patients.length}
                        </span>
                        <div className="flex-1" />
                      </>
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
                      className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[13px] ${
                        searchOpen ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
                      }`}
                      title={searchOpen ? 'Close search' : 'Search patients'}
                      aria-label={searchOpen ? 'Close search' : 'Search patients'}
                    >
                      {searchOpen ? <XIcon className="h-4 w-4" /> : <SearchIcon className="h-4 w-4" />}
                    </button>
                  </div>
                  {patients.length === 0 && (
                    <div className="py-2">
                      <p className="text-[13px] text-gray-500">No patients yet.</p>
                      <button
                        type="button"
                        onClick={() => setListTab('create')}
                        className="mt-[13px] cursor-pointer rounded-[13px] bg-blue-600 px-[13px] py-[13px] text-[13px] font-semibold text-white"
                      >
                        Create a patient
                      </button>
                    </div>
                  )}
                  {patients.length > 0 && filteredPatients.length === 0 && (
                    <div className="px-[13px] py-[34px] text-center text-gray-400">
                      <SearchIcon className="mx-auto mb-2 h-8 w-8 opacity-40" />
                      <p className="text-[13px] font-semibold text-gray-500">No patients found</p>
                      <p className="mt-0.5 text-[13px] text-gray-400">No match for &quot;{searchQuery}&quot;</p>
                    </div>
                  )}
                  <ul className="grid grid-cols-2 gap-[13px]">
                    {filteredPatients.map((patient) => (
                      <li key={patient.id} className="min-w-0">
                        <Link
                          href={`/doctor/patients/${patient.id}`}
                          className="flex min-w-0 items-center gap-[13px] rounded-[13px] border border-transparent bg-gray-50 px-[13px] py-[13px] text-[13px] font-semibold text-gray-800 transition-colors hover:border-blue-200 hover:bg-blue-50"
                        >
                          <span
                            aria-hidden
                            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-blue-600 text-[13px] font-bold uppercase text-white"
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
              <h1 className="text-[21px] font-semibold text-gray-900">Prescriptions</h1>
              <PatientShortcutList
                title="Open a patient to prescribe"
                empty="No patients yet. Create a patient before prescribing."
                patients={patients}
                hrefFor={(patient) => `/doctor/patients/${patient.id}?view=prescription`}
                actionLabel="Prescribe"
                onCreate={() => {
                  setListTab('create');
                  openSection('patients');
                }}
              />
            </>
          )}

          {section === 'transfers' && (
            <>
              <h1 className="text-[21px] font-semibold text-gray-900">Transfer requests</h1>
              {incoming.length === 0 ? (
                <section className="rounded-[13px] border border-gray-100 bg-white p-[21px] shadow-[0_12px_32px_-14px_rgba(15,23,42,0.35)]">
                  <p className="text-[13px] text-gray-500">No pending transfer requests.</p>
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
              <h1 className="text-[21px] font-semibold text-gray-900">Analytics</h1>
              <PatientShortcutList
                title="Open a patient for analytics"
                empty="No patients yet."
                patients={patients}
                hrefFor={(patient) => `/doctor/patients/${patient.id}?view=analytics`}
                actionLabel="Analytics"
              />
            </>
          )}

          {section === 'account' && (
            <>
              <h1 className="text-[21px] font-semibold text-gray-900">Account</h1>
              <DoctorAccountCard session={session} />
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
    <section className="space-y-[21px] rounded-[13px] border border-gray-100 bg-white p-[21px] shadow-[0_12px_32px_-14px_rgba(15,23,42,0.35)]">
      <div>
        <h2 className="text-[21px] font-semibold text-gray-900">Incoming attach requests</h2>
        <p className="mt-[8px] text-[13px] text-gray-500">
          Patients asked to join or switch to your DocID. Confirm or reject here if the email is delayed.
        </p>
      </div>
      <ul className="space-y-[13px]">
        {incoming.map((request) => (
          <li
            key={request.id}
            className="flex flex-col gap-[13px] rounded-[13px] border border-gray-100 p-[13px] sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-[13px] font-semibold text-gray-900">{request.patientName}</p>
              <p className="text-[13px] text-gray-500">
                {request.patientEmail}
                {request.source === 'change' ? ' · reassignment' : ' · new attach'}
              </p>
            </div>
            <div className="flex gap-[8px]">
              <button
                type="button"
                disabled={incomingBusy === request.id}
                onClick={() => onSettle(request.id, true)}
                className="rounded-[13px] bg-blue-600 px-[13px] py-[13px] text-[13px] font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                Confirm
              </button>
              <button
                type="button"
                disabled={incomingBusy === request.id}
                onClick={() => onSettle(request.id, false)}
                className="rounded-[13px] bg-gray-100 px-[13px] py-[13px] text-[13px] font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-60"
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
  empty,
  hrefFor,
  actionLabel,
  onCreate,
}: {
  title: string;
  patients: PatientSummary[];
  empty: string;
  hrefFor: (patient: PatientSummary) => string;
  actionLabel: string;
  onCreate?: () => void;
}) {
  return (
    <section className="rounded-[13px] border border-gray-100 bg-white p-[21px] shadow-[0_12px_32px_-14px_rgba(15,23,42,0.35)]">
      <h2 className="text-[21px] font-semibold text-gray-900">{title}</h2>
      <p className="mt-[8px] text-[13px] text-gray-500">
        Full roster stays under My patients. This list jumps straight into the patient workspace.
      </p>
      {patients.length === 0 ? (
        <div className="mt-[21px]">
          <p className="text-[13px] text-gray-500">{empty}</p>
          {onCreate ? (
            <button
              type="button"
              onClick={onCreate}
              className="mt-[13px] cursor-pointer rounded-[13px] bg-blue-600 px-[13px] py-[13px] text-[13px] font-semibold text-white"
            >
              Create a patient
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="mt-[21px] space-y-[13px]">
          {patients.map((patient) => (
            <li key={patient.id}>
              <Link
                href={hrefFor(patient)}
                className="flex items-center justify-between gap-[13px] rounded-[13px] border border-gray-100 px-[13px] py-[13px] text-[13px] hover:border-blue-200 hover:bg-blue-50"
              >
                <span className="flex min-w-0 items-center gap-[13px]">
                  <span
                    aria-hidden
                    className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-blue-600 text-[13px] font-bold uppercase text-white"
                  >
                    {patientInitials(patient.name)}
                  </span>
                  <span className="truncate font-semibold text-gray-900">{patient.name}</span>
                </span>
                <span className="shrink-0 font-semibold text-blue-600">{actionLabel}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
