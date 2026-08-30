'use client';

import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { ApiError, api } from '@/lib/api';
import type { IncomingDocIdRequest, PatientSummary } from '@candela/shared';
import { AppHeader } from '@/components/layout/AppHeader';
import { DoctorDashboardSkeleton } from '@/components/common/Skeleton';
import { SearchIcon, XIcon } from '@/components/icons/VectorIcons';
import {
  FloatingLabelInput,
  FloatingLabelPasswordInput,
} from '@/components/ui/FloatingLabelInput';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

export default function DoctorPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
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

  const filteredPatients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q)
    );
  }, [patients, searchQuery]);

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

  if (loading || dataLoading || !session || session.user.role !== 'doctor') {
    return (
      <div className="min-h-screen bg-[#F4F7FC]">
        <AppHeader />
        <DoctorDashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7FC]">
      <AppHeader
        extra={
          session.doctor ? (
            <span className="font-mono text-sm font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200/60">
              {session.doctor.referralCode}
            </span>
          ) : null
        }
      />

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">Doctor dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Patients you create are automatically linked to your DocID. Open a patient to prescribe modules.
          </p>
        </div>

        {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

        {incoming.length > 0 && (
          <section className="bg-white rounded-3xl border border-blue-100 shadow-sm p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Incoming attach requests</h2>
              <p className="text-sm text-gray-500 mt-1">
                Patients asked to join or switch to your DocID. Confirm or reject here if the email is delayed.
              </p>
            </div>
            <ul className="space-y-3">
              {incoming.map((request) => (
                <li
                  key={request.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-gray-100 p-4"
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
                      onClick={() => void settleIncoming(request.id, true)}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-60"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      disabled={incomingBusy === request.id}
                      onClick={() => void settleIncoming(request.id, false)}
                      className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex bg-gray-200 rounded-2xl p-1 max-w-lg">
          <button
            type="button"
            onClick={() => setListTab('create')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold cursor-pointer ${
              listTab === 'create' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            Create patient
          </button>
          <button
            type="button"
            onClick={() => setListTab('patients')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
              listTab === 'patients' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            Patients
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full ${
                listTab === 'patients' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {patients.length}
            </span>
          </button>
        </div>

        {listTab === 'create' && (
        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Create patient</h2>
          <form onSubmit={onCreatePatient} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <button type="submit" disabled={saving} className="sm:col-span-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl disabled:opacity-60">
              {saving ? 'Creating…' : 'Create patient'}
            </button>
          </form>
        </section>
        )}

        {listTab === 'patients' && (
        <section className="bg-white rounded-3xl border border-gray-100 p-5">
          <div className="flex items-center mb-3">
            <h2 className="text-lg font-bold text-gray-900">Patients</h2>
            <span className="ml-2 text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
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
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                searchOpen ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
              }`}
              title={searchOpen ? 'Close search' : 'Search patients'}
              aria-label={searchOpen ? 'Close search' : 'Search patients'}
            >
              {searchOpen ? <XIcon className="w-4 h-4" /> : <SearchIcon className="w-4 h-4" />}
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
                      className="text-gray-400 hover:text-gray-600 cursor-pointer"
                      title="Clear search"
                    >
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <SearchIcon className="w-4 h-4 text-gray-400" />
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
                className="mt-3 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold cursor-pointer"
              >
                Create a patient
              </button>
            </div>
          )}

          {patients.length > 0 && filteredPatients.length === 0 && (
            <div className="text-center py-6 px-2 text-gray-400">
              <SearchIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs font-semibold text-gray-500">No patients found</p>
              <p className="text-[11px] text-gray-400 mt-0.5">No match for &quot;{searchQuery}&quot;</p>
            </div>
          )}

          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filteredPatients.map((patient) => (
              <li key={patient.id}>
                <Link
                  href={`/doctor/patients/${patient.id}`}
                  className="block rounded-xl px-4 py-3 text-sm font-semibold bg-gray-50 text-gray-800 hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-colors"
                >
                  {patient.name}
                  <span className="block text-xs font-medium text-gray-500">
                    {patient.email} · {patient.phone}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        )}
      </main>
    </div>
  );
}
