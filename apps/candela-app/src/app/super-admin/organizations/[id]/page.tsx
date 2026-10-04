'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import type { OrganizationDetail } from '@candela/shared';
import { AppHeader } from '@/components/layout/AppHeader';
import { AdminDashboardSkeleton } from '@/components/common/Skeleton';
import { ArrowLeftIcon } from '@/components/icons/VectorIcons';
import { SearchInput } from '@/components/common/SearchInput';
import { CopyButton } from '@/components/ui/CopyButton';
import Link from 'next/link';

export default function OrganizationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { session, loading } = useAuth();

  const [org, setOrg] = useState<OrganizationDetail | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'doctors' | 'patients'>('doctors');

  // Search filters
  const [doctorFilter, setDoctorFilter] = useState('');
  const [patientFilter, setPatientFilter] = useState('');

  const loadOrg = useCallback(async () => {
    if (!params?.id) return;
    try {
      setDataLoading(true);
      setError('');
      const data = await api<OrganizationDetail>(`/api/super-admin/organizations/${params.id}`);
      setOrg(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load organization details');
    } finally {
      setDataLoading(false);
    }
  }, [params?.id]);

  useEffect(() => {
    if (loading) return;
    if (!session || session.user.role !== 'super_admin') {
      router.replace('/');
      return;
    }
    loadOrg();
  }, [loading, session, router, loadOrg]);

  const filteredDoctors = useMemo(() => {
    if (!org?.doctors) return [];
    const q = doctorFilter.trim().toLowerCase();
    if (!q) return org.doctors;
    return org.doctors.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.email.toLowerCase().includes(q) ||
        d.referralCode.toLowerCase().includes(q) ||
        (d.phone && d.phone.toLowerCase().includes(q)),
    );
  }, [org?.doctors, doctorFilter]);

  const filteredPatients = useMemo(() => {
    if (!org?.patients) return [];
    const q = patientFilter.trim().toLowerCase();
    if (!q) return org.patients;
    return org.patients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        (p.doctorName && p.doctorName.toLowerCase().includes(q)) ||
        (p.doctorReferralCode && p.doctorReferralCode.toLowerCase().includes(q)) ||
        (p.phone && p.phone.toLowerCase().includes(q)),
    );
  }, [org?.patients, patientFilter]);

  if (loading || dataLoading || !session || session.user.role !== 'super_admin') {
    return (
      <div className="min-h-screen bg-[#F4F7FC]">
        <AppHeader backHref="/super-admin" />
        <AdminDashboardSkeleton />
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="min-h-screen bg-[#F4F7FC]">
        <AppHeader backHref="/super-admin" />
        <main className="max-w-6xl mx-auto px-6 py-12 text-center space-y-4">
          <div className="p-8 bg-white rounded-3xl border border-gray-100 max-w-md mx-auto shadow-sm space-y-4">
            <p className="text-sm font-bold text-red-600">{error || 'Organization not found.'}</p>
            <Link
              href="/super-admin"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl"
            >
              <ArrowLeftIcon className="w-3.5 h-3.5" />
              <span>Back to Super Admin</span>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7FC]">
      <AppHeader backHref="/super-admin" />

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        {/* Navigation & Org Header */}
        <div className="space-y-4">
          <Link
            href="/super-admin"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            <span>Back to Super Admin</span>
          </Link>

          <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">{org.name}</h1>
                  <span className="px-3 py-1 bg-blue-50 text-blue-800 text-xs font-mono font-bold rounded-lg border border-blue-200">
                    {org.code}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                  {org.contactEmail && <span>Contact: {org.contactEmail}</span>}
                  {org.adminName && <span>Admin: <strong className="text-gray-700">{org.adminName}</strong> ({org.adminEmail})</span>}
                  <span>
                    Registered on{' '}
                    {new Date(org.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Metric Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Hospital Doctors</p>
            <p className="text-3xl font-black text-gray-900 mt-2">{org.doctorCount}</p>
            <p className="text-xs text-blue-600 mt-1 font-medium">Registered clinicians</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Hospital Patients</p>
            <p className="text-3xl font-black text-gray-900 mt-2">{org.patientCount}</p>
            <p className="text-xs text-emerald-600 mt-1 font-medium">Under active care</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Game Sessions Played</p>
            <p className="text-3xl font-black text-gray-900 mt-2">{org.sessionCount}</p>
            <p className="text-xs text-purple-600 mt-1 font-medium">Completed module runs</p>
          </div>
        </section>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setTab('doctors')}
            className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors cursor-pointer ${
              tab === 'doctors'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Doctors ({org.doctors.length})
          </button>
          <button
            onClick={() => setTab('patients')}
            className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors cursor-pointer ${
              tab === 'patients'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Patients ({org.patients.length})
          </button>
        </div>

        {/* Tab 1: Doctors */}
        {tab === 'doctors' && (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <SearchInput
                value={doctorFilter}
                onChange={setDoctorFilter}
                placeholder="Search doctors by name, DocID, email..."
                className="w-full sm:w-80"
                aria-label="Search doctors"
              />
              <span className="text-xs text-gray-500">
                Showing {filteredDoctors.length} of {org.doctors.length} doctors
              </span>
            </div>

            {filteredDoctors.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500 text-sm">
                No doctors found in this organization.
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-3.5">Doctor</th>
                        <th className="px-6 py-3.5">DocID Referral Code</th>
                        <th className="px-6 py-3.5">Contact Email</th>
                        <th className="px-6 py-3.5">Phone</th>
                        <th className="px-6 py-3.5 text-center">Patients</th>
                        <th className="px-6 py-3.5">Joined</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredDoctors.map((doc) => (
                        <tr key={doc.id} className="hover:bg-gray-50/70 transition-colors">
                          <td className="px-6 py-4 font-semibold text-gray-900">{doc.name}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5">
                              <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-mono font-bold rounded-lg border border-indigo-200">
                                {doc.referralCode}
                              </span>
                              <CopyButton text={doc.referralCode} label="DocID" iconSize={13} />
                            </div>
                          </td>
                          <td className="px-6 py-4 text-gray-700">{doc.email}</td>
                          <td className="px-6 py-4 text-gray-500">{doc.phone || '—'}</td>
                          <td className="px-6 py-4 text-center">
                            <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-full">
                              {doc.patientCount}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                            {new Date(doc.createdAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Tab 2: Patients */}
        {tab === 'patients' && (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <SearchInput
                value={patientFilter}
                onChange={setPatientFilter}
                placeholder="Search patients by name, email, assigned doctor..."
                className="w-full sm:w-80"
                aria-label="Search patients"
              />
              <span className="text-xs text-gray-500">
                Showing {filteredPatients.length} of {org.patients.length} patients
              </span>
            </div>

            {filteredPatients.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500 text-sm">
                No patients found in this organization.
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-3.5">Patient</th>
                        <th className="px-6 py-3.5">Assigned Doctor</th>
                        <th className="px-6 py-3.5">Contact Email</th>
                        <th className="px-6 py-3.5">Phone</th>
                        <th className="px-6 py-3.5 text-center">Sessions Played</th>
                        <th className="px-6 py-3.5">Registered</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredPatients.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                          <td className="px-6 py-4 font-semibold text-gray-900">{p.name}</td>
                          <td className="px-6 py-4">
                            {p.doctorName ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-gray-800">{p.doctorName}</span>
                                {p.doctorReferralCode && (
                                  <>
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded border border-gray-200">
                                      {p.doctorReferralCode}
                                    </span>
                                    <CopyButton text={p.doctorReferralCode} label="DocID" iconSize={12} />
                                  </>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-gray-700">{p.email}</td>
                          <td className="px-6 py-4 text-gray-500">{p.phone || '—'}</td>
                          <td className="px-6 py-4 text-center">
                            <span className="px-2.5 py-0.5 bg-purple-50 text-purple-700 text-xs font-bold rounded-full">
                              {p.sessionCount}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                            {new Date(p.createdAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
