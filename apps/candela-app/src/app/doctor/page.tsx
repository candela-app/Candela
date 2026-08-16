'use client';

import { useAuth } from '@/lib/auth-context';
import { ApiError, api } from '@/lib/api';
import { GAME_CATALOG, MODULE_LEVELS, type PatientSummary, type TherapyModuleId } from '@candela/shared';
import { AppHeader } from '@/components/layout/AppHeader';
import { DoctorDashboardSkeleton } from '@/components/common/Skeleton';
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
  const [dataLoading, setDataLoading] = useState(true);

  const selected = patients.find((p) => p.id === selectedId) ?? null;

  const load = useCallback(async () => {
    try {
      const next = await api<PatientSummary[]>('/api/doctors/me/patients');
      setPatients(next);
      setSelectedId((current) => current && next.some((p) => p.id === current) ? current : next[0]?.id ?? null);
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
    const previousIds = selected.prescribedModuleIds;
    const previousLevels = { ...selected.prescribedLevels };
    setError('');
    
    // Default to selecting all levels when enabling a module
    const defaultLevels = enabled ? (MODULE_LEVELS[moduleId]?.map(l => l.id) || []) : [];

    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== patientId) {
          return p;
        }
        const prescribedModuleIds = enabled
          ? Array.from(new Set([...p.prescribedModuleIds, moduleId]))
          : p.prescribedModuleIds.filter((id) => id !== moduleId);
        
        const prescribedLevels = { ...p.prescribedLevels };
        if (enabled) {
          prescribedLevels[moduleId] = defaultLevels;
        } else {
          delete prescribedLevels[moduleId];
        }

        return { ...p, prescribedModuleIds, prescribedLevels };
      }),
    );
    try {
      const updated = enabled
        ? await api<PatientSummary>(`/api/doctors/me/patients/${patientId}/prescriptions`, {
            method: 'POST',
            body: JSON.stringify({ moduleId, levels: defaultLevels }),
          })
        : await api<PatientSummary>(
            `/api/doctors/me/patients/${patientId}/prescriptions/${moduleId}`,
            { method: 'DELETE' },
          );
      setPatients((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err) {
      setPatients((prev) =>
        prev.map((p) => (p.id === patientId ? { ...p, prescribedModuleIds: previousIds, prescribedLevels: previousLevels } : p)),
      );
      setError(err instanceof ApiError ? err.message : 'Could not update prescription');
    }
  }

  async function toggleLevel(moduleId: TherapyModuleId, levelId: string, enabled: boolean) {
    if (!selected) {
      return;
    }
    const patientId = selected.id;
    const currentLevels = selected.prescribedLevels?.[moduleId] || [];
    const newLevels = enabled
      ? Array.from(new Set([...currentLevels, levelId]))
      : currentLevels.filter((id) => id !== levelId);

    const previousLevels = { ...selected.prescribedLevels };
    setError('');

    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== patientId) return p;
        return {
          ...p,
          prescribedLevels: {
            ...p.prescribedLevels,
            [moduleId]: newLevels,
          },
        };
      })
    );

    try {
      const updated = await api<PatientSummary>(`/api/doctors/me/patients/${patientId}/prescriptions`, {
        method: 'POST',
        body: JSON.stringify({ moduleId, levels: newLevels }),
      });
      setPatients((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err) {
      setPatients((prev) =>
        prev.map((p) => (p.id === patientId ? { ...p, prescribedLevels: previousLevels } : p)),
      );
      setError(err instanceof ApiError ? err.message : 'Could not update level');
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
                    const levels = MODULE_LEVELS[mod.id] || [];
                    const selectedLevels = selected.prescribedLevels?.[mod.id] || [];

                    return (
                      <div key={mod.id} className="rounded-2xl border border-gray-100 p-4">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={(e) => void toggleModule(mod.id, e.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>
                            <span className="block font-bold text-gray-900">{mod.name}</span>
                            <span className="block text-xs text-gray-500">{mod.description}</span>
                          </span>
                        </label>
                        
                        {on && levels.length > 0 && (
                          <div className="mt-3 ml-7 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {levels.map(level => {
                              const levelOn = selectedLevels.includes(level.id);
                              return (
                                <label key={level.id} className="flex items-center gap-2 cursor-pointer bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                                  <input
                                    type="checkbox"
                                    checked={levelOn}
                                    onChange={(e) => void toggleLevel(mod.id, level.id, e.target.checked)}
                                    className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm font-medium text-gray-700">{level.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
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
