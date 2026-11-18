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
  ArrowRightIcon,
  BellIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  PlusIcon,
  SearchIcon,
  SlidersIcon,
  UserIcon,
  UsersIcon,
  XIcon,
} from '@/components/icons/VectorIcons';
import { FloatingLabelInput, FloatingLabelPasswordInput } from '@/components/ui/FloatingLabelInput';
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

const PANEL =
  'rounded-[13px] border border-gray-100 bg-white p-[21px] shadow-[0_13px_34px_-13px_rgba(15,23,42,0.45)]';
const PRIMARY_BTN =
  'cursor-pointer rounded-[13px] bg-gray-950 px-[21px] py-[13px] text-[13px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60';
const SECONDARY_BTN =
  'cursor-pointer rounded-[13px] bg-gray-100 px-[13px] py-[13px] text-[13px] font-semibold text-gray-700 transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60';

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className={PANEL}>
      <p className="text-[13px] font-semibold text-gray-500">{label}</p>
      <p className="mt-[8px] text-[34px] font-semibold leading-none tabular-nums text-gray-950">{value}</p>
      <p className="mt-[8px] text-[13px] text-pretty text-gray-500">{hint}</p>
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
  const [password, setPassword] = useState('');
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
      await load();
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

  const navGroups: {
    label: string;
    items: { id: Section; label: string; icon: typeof LayoutDashboardIcon }[];
  }[] = [
    {
      label: 'Start',
      items: [{ id: 'overview', label: 'Overview', icon: LayoutDashboardIcon }],
    },
    {
      label: 'Patients',
      items: [
        { id: 'transfers', label: 'Transfer requests', icon: BellIcon },
        { id: 'patients', label: 'My patients', icon: UsersIcon },
      ],
    },
    {
      label: 'Care',
      items: [
        { id: 'prescriptions', label: 'Prescriptions', icon: SlidersIcon },
        { id: 'analytics', label: 'Analytics', icon: AnalyticsIcon },
      ],
    },
    {
      label: 'You',
      items: [{ id: 'account', label: 'Account', icon: UserIcon }],
    },
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
          className={`dashboard-scrollbar fixed left-4 top-[68px] z-40 flex max-h-[calc(100dvh-81px)] w-[220px] flex-col gap-[8px] overflow-y-auto rounded-[13px] border border-gray-100 bg-white p-[13px] shadow-[0_13px_34px_-13px_rgba(15,23,42,0.45)] ${
            navOpen ? 'translate-x-0' : '-translate-x-[calc(100%+2rem)]'
          } lg:sticky lg:left-auto lg:top-[68px] lg:z-auto lg:mb-0 lg:flex lg:h-auto lg:max-h-none lg:w-auto lg:translate-x-0 lg:self-start lg:overflow-visible`}
        >
          {navGroups.map((group, groupIndex) => (
            <div key={group.label} className="flex flex-col gap-[4px]">
              <p
                className={`px-[13px] text-[11px] font-semibold uppercase text-gray-400 ${
                  groupIndex === 0 ? 'pt-[2px]' : 'pt-[13px]'
                }`}
              >
                {group.label}
              </p>
              {group.items.map((item) => {
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
                    <Icon className="size-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="mt-[8px] flex shrink-0 cursor-pointer items-center gap-[8px] rounded-[8px] bg-transparent px-[13px] py-[13px] text-[13px] font-semibold text-red-600 hover:bg-red-100"
          >
            <LogOutIcon className="size-4 shrink-0" />
            <span>Sign out</span>
          </button>
        </nav>

        <main className="min-w-0 space-y-[34px]">
          {error && <p className="text-[13px] font-medium text-red-600">{error}</p>}

          {section === 'overview' && (
            <>
              <h1 className="text-balance text-[21px] font-semibold text-gray-950">Overview</h1>
              <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-3">
                <StatCard
                  label="Patients"
                  value={String(patients.length)}
                  hint="Assigned to you"
                />
                <StatCard
                  label="Transfers"
                  value={String(incoming.length)}
                  hint="Waiting on your decision"
                />
                <StatCard
                  label="Prescribed"
                  value={String(prescribedPatients.length)}
                  hint="With activities assigned"
                />
              </div>
              {incoming.length > 0 ? (
                <section className={`${PANEL} border-amber-100 bg-amber-50/70`}>
                  <div className="flex flex-wrap items-center justify-between gap-[13px]">
                    <div>
                      <h2 className="text-balance text-[18px] font-semibold text-gray-950">
                        Pending transfers
                      </h2>
                      <p className="mt-[8px] text-[13px] text-pretty text-gray-600">
                        {incoming.length} request{incoming.length === 1 ? '' : 's'} need a decision.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openSection('transfers')}
                      className={PRIMARY_BTN}
                    >
                      Review
                    </button>
                  </div>
                </section>
              ) : null}
              {unprescribedPatients.length > 0 ? (
                <section className={PANEL}>
                  <h2 className="text-balance text-[18px] font-semibold text-gray-950">
                    Needs a prescription
                  </h2>
                  <ul className="mt-[21px] space-y-[8px]">
                    {unprescribedPatients.slice(0, 5).map((patient) => (
                      <li key={patient.id}>
                        <Link
                          href={`/doctor/patients/${patient.id}?view=prescription`}
                          className="flex items-center justify-between gap-[13px] rounded-[13px] bg-gray-50 px-[13px] py-[13px] text-[13px] transition hover:bg-gray-100"
                        >
                          <span className="truncate font-semibold text-gray-950">{patient.name}</span>
                          <span className="shrink-0 font-semibold text-gray-500">Prescribe</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {unprescribedPatients.length > 5 ? (
                    <button
                      type="button"
                      onClick={() => openSection('patients')}
                      className="mt-[13px] cursor-pointer text-[13px] font-semibold text-gray-950"
                    >
                      View all patients
                    </button>
                  ) : null}
                </section>
              ) : (
                <section className={PANEL}>
                  <p className="text-[13px] text-pretty text-gray-500">
                    All assigned patients have a prescription. Manage the roster in{' '}
                    <button
                      type="button"
                      onClick={() => openSection('patients')}
                      className="cursor-pointer font-semibold text-gray-950"
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
              <div className="flex min-w-0 items-center gap-[13px]">
                <h1 className="text-balance text-[21px] font-semibold text-gray-950">My patients</h1>
                <span className="rounded-full bg-gray-100 px-[10px] py-[4px] text-[13px] font-semibold tabular-nums text-gray-600">
                  {patients.length}
                </span>
              </div>
              <div className="mx-auto flex w-full max-w-[576px] rounded-[13px] bg-gray-200 p-[8px]">
                <button
                  type="button"
                  onClick={() => setListTab('patients')}
                  className={`flex flex-1 cursor-pointer items-center justify-center gap-[8px] rounded-[13px] py-[13px] text-[13px] font-semibold ${
                    listTab === 'patients' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  <UsersIcon className="size-[14px]" />
                  Patients
                </button>
                <button
                  type="button"
                  onClick={() => setListTab('create')}
                  className={`flex flex-1 cursor-pointer items-center justify-center gap-[8px] rounded-[13px] py-[13px] text-[13px] font-semibold ${
                    listTab === 'create' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  <PlusIcon className="size-[14px]" />
                  Create patient
                </button>
              </div>

              {listTab === 'create' && (
                <section className={PANEL}>
                  <div className="mx-auto w-full max-w-[420px]">
                    <h2 className="text-balance text-center text-[18px] font-semibold text-gray-950">
                      Create patient
                    </h2>
                    <form onSubmit={onCreatePatient} className="mt-[21px] space-y-[21px]">
                      {activeMemberships.length > 1 ? (
                        <label className="block text-[13px] font-semibold text-gray-700">
                          Organisation
                          <select
                            className="mt-[8px] w-full rounded-[13px] border border-gray-200 bg-white px-[13px] py-[13px] text-[13px] text-gray-950"
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
                        <div className="rounded-[13px] border border-blue-100 bg-blue-50 px-[13px] py-[13px]">
                          <p className="text-[12px] font-semibold uppercase text-blue-700">
                            Organisation
                          </p>
                          <p className="mt-[4px] text-[15px] font-semibold text-gray-950">
                            {activeMemberships[0].organizationName}
                          </p>
                        </div>
                      ) : (
                        <p className="text-center text-[13px] font-medium text-red-600">
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
                      <p className="text-[12px] text-pretty text-gray-500">
                        {password.trim()
                          ? 'Account activates immediately — no invitation email.'
                          : 'Leave blank to email an invitation so the patient sets their own password.'}
                      </p>
                      <button
                        type="submit"
                        disabled={saving || !organizationId}
                        className={`w-full ${PRIMARY_BTN}`}
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
                <section className={PANEL}>
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
                      <p className="min-w-0 flex-1 text-[13px] text-pretty text-gray-500">
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
                      className={`flex size-[34px] shrink-0 items-center justify-center rounded-[13px] ${
                        searchOpen ? 'bg-gray-950 text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                      title={searchOpen ? 'Close search' : 'Search patients'}
                      aria-label={searchOpen ? 'Close search' : 'Search patients'}
                    >
                      {searchOpen ? <XIcon className="size-4" /> : <SearchIcon className="size-4" />}
                    </button>
                  </div>
                  {patients.length === 0 && (
                    <div>
                      <p className="text-[13px] text-pretty text-gray-500">No patients yet.</p>
                      <button
                        type="button"
                        onClick={() => setListTab('create')}
                        className={`mt-[13px] ${PRIMARY_BTN}`}
                      >
                        Invite a patient
                      </button>
                    </div>
                  )}
                  {patients.length > 0 && filteredPatients.length === 0 && (
                    <div className="py-[34px] text-center">
                      <SearchIcon className="mx-auto mb-[8px] size-8 text-gray-300" />
                      <p className="text-[13px] font-semibold text-gray-700">No matches</p>
                      <p className="mt-[4px] text-[13px] text-gray-500">
                        Nothing for &quot;{searchQuery}&quot;
                      </p>
                    </div>
                  )}
                  <ul className="grid grid-cols-1 gap-[8px] sm:grid-cols-2">
                    {filteredPatients.map((patient) => (
                      <li key={patient.id} className="min-w-0">
                        <Link
                          href={`/doctor/patients/${patient.id}`}
                          className="group flex min-w-0 items-center gap-[13px] rounded-[13px] border border-transparent bg-gray-50 px-[13px] py-[13px] text-[13px] font-semibold text-gray-950 transition hover:border-blue-200 hover:bg-blue-50"
                        >
                          <span
                            aria-hidden
                            className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-blue-600 text-[13px] font-bold uppercase text-white"
                          >
                            {patientInitials(patient.name)}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{patient.name}</span>
                          <ArrowRightIcon className="size-[14px] shrink-0 text-gray-400 transition group-hover:text-blue-600" />
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
              <h1 className="text-balance text-[21px] font-semibold text-gray-950">Prescriptions</h1>
              <PatientShortcutList
                title="Prescribe"
                empty="Invite a patient before prescribing."
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
              <h1 className="text-balance text-[21px] font-semibold text-gray-950">Transfer requests</h1>
              {incoming.length === 0 ? (
                <section className={PANEL}>
                  <p className="text-[13px] text-pretty text-gray-500">No pending transfer requests.</p>
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
              <h1 className="text-balance text-[21px] font-semibold text-gray-950">Analytics</h1>
              <PatientShortcutList
                title="Patient analytics"
                empty="No patients yet."
                patients={patients}
                hrefFor={(patient) => `/doctor/patients/${patient.id}?view=analytics`}
                actionLabel="Open"
              />
            </>
          )}

          {section === 'account' && (
            <>
              <h1 className="text-balance text-[21px] font-semibold text-gray-950">Account</h1>
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
    <section className={`${PANEL} space-y-[21px]`}>
      <div>
        <h2 className="text-balance text-[18px] font-semibold text-gray-950">Incoming requests</h2>
        <p className="mt-[8px] text-[13px] text-pretty text-gray-500">
          Confirm or reject attach requests for your DocID.
        </p>
      </div>
      <ul className="space-y-[8px]">
        {incoming.map((request) => (
          <li
            key={request.id}
            className="flex flex-col gap-[13px] rounded-[13px] bg-gray-50 p-[13px] sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-gray-950">{request.patientName}</p>
              <p className="truncate text-[13px] text-gray-500">
                {request.patientEmail}
                {request.source === 'change' ? ' · reassignment' : ' · new attach'}
              </p>
            </div>
            <div className="flex shrink-0 gap-[8px]">
              <button
                type="button"
                disabled={incomingBusy === request.id}
                onClick={() => onSettle(request.id, true)}
                className={PRIMARY_BTN}
              >
                Confirm
              </button>
              <button
                type="button"
                disabled={incomingBusy === request.id}
                onClick={() => onSettle(request.id, false)}
                className={SECONDARY_BTN}
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
    <section className={PANEL}>
      <h2 className="text-balance text-[18px] font-semibold text-gray-950">{title}</h2>
      {patients.length === 0 ? (
        <div className="mt-[21px]">
          <p className="text-[13px] text-pretty text-gray-500">{empty}</p>
          {onCreate ? (
            <button type="button" onClick={onCreate} className={`mt-[13px] ${PRIMARY_BTN}`}>
              Invite a patient
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="mt-[21px] space-y-[8px]">
          {patients.map((patient) => (
            <li key={patient.id}>
              <Link
                href={hrefFor(patient)}
                className="group flex items-center justify-between gap-[13px] rounded-[13px] border border-transparent bg-gray-50 px-[13px] py-[13px] text-[13px] transition hover:border-blue-200 hover:bg-blue-50"
              >
                <span className="flex min-w-0 items-center gap-[13px]">
                  <span
                    aria-hidden
                    className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-blue-600 text-[13px] font-bold uppercase text-white"
                  >
                    {patientInitials(patient.name)}
                  </span>
                  <span className="truncate font-semibold text-gray-950">{patient.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-[8px] font-semibold text-gray-500 transition group-hover:text-blue-600">
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
