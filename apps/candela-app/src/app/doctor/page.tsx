'use client';

import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { ApiError, api } from '@/lib/api';
import { GAME_CATALOG, MODULE_LEVELS, type PatientSummary, type TherapyModuleId } from '@candela/shared';
import { AppHeader } from '@/components/layout/AppHeader';
import { DoctorDashboardSkeleton } from '@/components/common/Skeleton';
import { SearchIcon, XIcon } from '@/components/icons/VectorIcons';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

const MODULES = Object.values(GAME_CATALOG);

export default function DoctorPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const toast = useToast();
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

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

  const selected = useMemo(
    () => patients.find((p) => p.id === selectedId) ?? null,
    [patients, selectedId],
  );

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
      await load();
      setSelectedId(created.id);
      toast.success(`Patient ${patientName} created successfully!`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not create patient';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function toggleModule(moduleId: TherapyModuleId, enabled: boolean) {
    if (!selected) {
      return;
    }
    const patientId = selected.id;
    const patientName = selected.name;
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
      toast.success(enabled ? `Prescribed module for ${patientName}` : `Removed module for ${patientName}`);
    } catch (err) {
      setPatients((prev) =>
        prev.map((p) => (p.id === patientId ? { ...p, prescribedModuleIds: previousIds, prescribedLevels: previousLevels } : p)),
      );
      const msg = err instanceof ApiError ? err.message : 'Could not update prescription';
      setError(msg);
      toast.error(msg);
    }
  }

  async function toggleLevel(moduleId: TherapyModuleId, levelId: string, enabled: boolean) {
    if (!selected) {
      return;
    }
    const patientId = selected.id;
    const patientName = selected.name;
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
      toast.success(`Updated levels for ${patientName}`);
    } catch (err) {
      setPatients((prev) =>
        prev.map((p) => (p.id === patientId ? { ...p, prescribedLevels: previousLevels } : p)),
      );
      const msg = err instanceof ApiError ? err.message : 'Could not update level';
      setError(msg);
      toast.error(msg);
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
            Patients you create are automatically linked to your DocID. Prescribe modules and levels by adding or removing them.
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
          <section className="bg-white rounded-3xl border border-gray-100 p-5 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">Patients</h2>
                <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {patients.length}
                </span>
              </div>
            </div>

            <div className="relative mb-3">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <SearchIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patient name, email..."
                className="w-full pl-9 pr-8 py-2 bg-gray-50 hover:bg-gray-100/80 focus:bg-white rounded-xl border border-gray-200/80 focus:border-blue-500 text-xs font-medium outline-none transition-all placeholder:text-gray-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                  title="Clear search"
                >
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {patients.length === 0 && <p className="text-sm text-gray-500 py-2">No patients yet.</p>}

            {patients.length > 0 && filteredPatients.length === 0 && (
              <div className="text-center py-6 px-2 text-gray-400">
                <SearchIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs font-semibold text-gray-500">No patients found</p>
                <p className="text-[11px] text-gray-400 mt-0.5">No match for &quot;{searchQuery}&quot;</p>
              </div>
            )}

            <ul className="space-y-2 overflow-y-auto max-h-[460px] pr-0.5">
              {filteredPatients.map((patient) => (
                <li key={patient.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(patient.id)}
                    className={`w-full text-left rounded-xl px-4 py-3 text-sm font-semibold transition-colors cursor-pointer ${
                      selectedId === patient.id ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-gray-50 text-gray-800 hover:bg-gray-100'
                    }`}
                  >
                    {patient.name}
                    <span className={`block text-xs font-medium ${selectedId === patient.id ? 'text-blue-100' : 'text-gray-500'}`}>
                      {patient.email} · {patient.phone}
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
