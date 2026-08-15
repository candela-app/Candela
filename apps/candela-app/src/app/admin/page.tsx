'use client';

import { useAuth } from '@/lib/auth-context';
import { ApiError, api } from '@/lib/api';
import type { DoctorSummary, PatientSummary } from '@candela/shared';
import { AppHeader } from '@/components/layout/AppHeader';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

export default function AdminPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [doctors, setDoctors] = useState<DoctorSummary[]>([]);
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [nextDoctors, nextPatients] = await Promise.all([
      api<DoctorSummary[]>('/api/admin/doctors'),
      api<PatientSummary[]>('/api/admin/patients'),
    ]);
    setDoctors(nextDoctors);
    setPatients(nextPatients);
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!session || session.user.role !== 'admin') {
      router.replace('/login');
      return;
    }
    load().catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load'));
  }, [loading, session, router, load]);

  const grouped = useMemo(() => {
    const byDoctor = new Map<string, { doctorName: string; code: string; patients: PatientSummary[] }>();
    const unlinked: PatientSummary[] = [];
    for (const patient of patients) {
      if (!patient.doctorId) {
        unlinked.push(patient);
        continue;
      }
      const existing = byDoctor.get(patient.doctorId);
      if (existing) {
        existing.patients.push(patient);
      } else {
        byDoctor.set(patient.doctorId, {
          doctorName: patient.doctorName || 'Doctor',
          code: patient.referralCode || '—',
          patients: [patient],
        });
      }
    }
    return { byDoctor, unlinked };
  }, [patients]);

  async function onCreateDoctor(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api('/api/admin/doctors', {
        method: 'POST',
        body: JSON.stringify({ name, phone, email, password }),
      });
      setName('');
      setPhone('');
      setEmail('');
      setPassword('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create doctor');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !session || session.user.role !== 'admin') {
    return <div className="p-8 text-center text-gray-600">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-[#F4F7FC]">
      <AppHeader />

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">Admin</h1>
          <p className="text-sm text-gray-500 mt-1">Create doctors and review every patient on the platform.</p>
        </div>

        {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Create doctor</h2>
          <form onSubmit={onCreateDoctor} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input className="rounded-xl border border-gray-200 px-4 py-3 text-sm" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
            <input className="rounded-xl border border-gray-200 px-4 py-3 text-sm" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            <input className="rounded-xl border border-gray-200 px-4 py-3 text-sm" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input className="rounded-xl border border-gray-200 px-4 py-3 text-sm" placeholder="Password (min 8)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            <button type="submit" disabled={saving} className="sm:col-span-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl disabled:opacity-60">
              {saving ? 'Creating…' : 'Create doctor'}
            </button>
          </form>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Doctors</h2>
          <div className="grid gap-4">
            {doctors.length === 0 && <p className="text-sm text-gray-500">No doctors yet.</p>}
            {doctors.map((doctor) => (
              <div key={doctor.id} className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-gray-900">{doctor.name}</p>
                  <p className="text-sm text-gray-500">{doctor.email} · {doctor.phone}</p>
                </div>
                <span className="font-mono text-lg font-extrabold tracking-widest text-blue-700 bg-blue-50 px-4 py-2 rounded-xl">
                  {doctor.referralCode}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-lg font-bold text-gray-900">Patients managed by doctors</h2>
          {[...Array.from(grouped.byDoctor.entries())].map(([id, group]) => (
            <div key={id} className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="font-bold text-gray-900">
                {group.doctorName}{' '}
                <span className="font-mono text-blue-700 text-sm">({group.code})</span>
              </p>
              <ul className="mt-3 space-y-2">
                {group.patients.map((patient: PatientSummary) => (
                  <li key={patient.id} className="text-sm text-gray-700">
                    {patient.name} · {patient.email} · {patient.phone}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {grouped.byDoctor.size === 0 && <p className="text-sm text-gray-500">No doctor-managed patients yet.</p>}
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Self-signup patients</h2>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            {grouped.unlinked.length === 0 && <p className="text-sm text-gray-500">None yet.</p>}
            <ul className="space-y-2">
              {grouped.unlinked.map((patient) => (
                <li key={patient.id} className="text-sm text-gray-700">
                  {patient.name} · {patient.email} · {patient.phone}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
