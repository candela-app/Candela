'use client';

import { useAuth } from '@/lib/auth-context';
import { ApiError, api } from '@/lib/api';
import { GAME_CATALOG, type PatientSummary, type TherapyModuleId } from '@candela/shared';
import { AppHeader } from '@/components/layout/AppHeader';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';

const MODULES = Object.values(GAME_CATALOG);

export default function DoctorPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const selected = patients.find((p) => p.id === selectedId) ?? null;

  const load = useCallback(async () => {
    const next = await api<PatientSummary[]>('/api/doctors/me/patients');
    setPatients(next);
    setSelectedId((current) => current && next.some((p) => p.id === current) ? current : next[0]?.id ?? null);
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!session || session.user.role !== 'doctor') {
      router.replace('/login');
      return;
    }
    load().catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load'));
  }, [loading, session, router, load]);

  async function onCreatePatient(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const created = await api<PatientSummary>('/api/doctors/me/patients', {
        method: 'POST',
        body: JSON.stringify({ name, phone, email, password }),
      });
      setName('');
      setPhone('');
      setEmail('');
      setPassword('');
      await load();
      setSelectedId(created.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create patient');
    } finally {
      setSaving(false);
    }
  }

  async function toggleModule(moduleId: TherapyModuleId, enabled: boolean) {
    if (!selected) {
      return;
    }
    const patientId = selected.id;
    const previous = selected.prescribedModuleIds;
    setError('');
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== patientId) {
          return p;
        }
        const prescribedModuleIds = enabled
          ? Array.from(new Set([...p.prescribedModuleIds, moduleId]))
          : p.prescribedModuleIds.filter((id) => id !== moduleId);
        return { ...p, prescribedModuleIds };
      }),
    );
    try {
      const updated = enabled
        ? await api<PatientSummary>(`/api/doctors/me/patients/${patientId}/prescriptions`, {
            method: 'POST',
            body: JSON.stringify({ moduleId }),
          })
        : await api<PatientSummary>(
            `/api/doctors/me/patients/${patientId}/prescriptions/${moduleId}`,
            { method: 'DELETE' },
          );
      setPatients((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err) {
      setPatients((prev) =>
        prev.map((p) => (p.id === patientId ? { ...p, prescribedModuleIds: previous } : p)),
      );
      setError(err instanceof ApiError ? err.message : 'Could not update prescription');
    }
  }

  if (loading || !session || session.user.role !== 'doctor') {
    return <div className="p-8 text-center text-gray-600">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-[#F4F7FC]">
      <AppHeader
        extra={
          session.doctor ? (
            <span className="font-mono text-sm font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-lg">
              {session.doctor.referralCode}
            </span>
          ) : null
        }
      />

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">Doctor dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Patients you create are already linked to your referral code. Prescribe modules by adding or removing them.
          </p>
        </div>

        {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Create patient</h2>
          <form onSubmit={onCreatePatient} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input className="rounded-xl border border-gray-200 px-4 py-3 text-sm" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
            <input className="rounded-xl border border-gray-200 px-4 py-3 text-sm" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            <input className="rounded-xl border border-gray-200 px-4 py-3 text-sm" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input className="rounded-xl border border-gray-200 px-4 py-3 text-sm" placeholder="Password (min 8)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            <button type="submit" disabled={saving} className="sm:col-span-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl disabled:opacity-60">
              {saving ? 'Creating…' : 'Create patient'}
            </button>
          </form>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="bg-white rounded-3xl border border-gray-100 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Patients</h2>
            {patients.length === 0 && <p className="text-sm text-gray-500">No patients yet.</p>}
            <ul className="space-y-2">
              {patients.map((patient) => (
                <li key={patient.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(patient.id)}
                    className={`w-full text-left rounded-xl px-4 py-3 text-sm font-semibold ${
                      selectedId === patient.id ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-800 hover:bg-gray-100'
                    }`}
                  >
                    {patient.name}
                    <span className={`block text-xs font-medium ${selectedId === patient.id ? 'text-blue-100' : 'text-gray-500'}`}>
                      {patient.email}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 p-6">
            {!selected && <p className="text-sm text-gray-500">Select a patient to prescribe modules.</p>}
            {selected && (
              <>
                <h2 className="text-lg font-bold text-gray-900">{selected.name}</h2>
                <p className="text-sm text-gray-500 mb-6">
                  {selected.email} · {selected.phone}
                </p>
                <p className="text-sm font-semibold text-gray-700 mb-3">Prescribed modules</p>
                <div className="space-y-3">
                  {MODULES.map((mod) => {
                    const on = selected.prescribedModuleIds.includes(mod.id);
                    return (
                      <label key={mod.id} className="flex items-start gap-3 rounded-2xl border border-gray-100 p-4">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) => void toggleModule(mod.id, e.target.checked)}
                          className="mt-1 h-4 w-4"
                        />
                        <span>
                          <span className="block font-bold text-gray-900">{mod.name}</span>
                          <span className="block text-xs text-gray-500">{mod.description}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
