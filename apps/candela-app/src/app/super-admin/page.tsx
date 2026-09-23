'use client';

import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { ApiError, api } from '@/lib/api';
import type {
  OrganizationSummary,
  SelfUserSummary,
  SuperAdminMetrics,
} from '@candela/shared';
import { AppHeader } from '@/components/layout/AppHeader';
import { AdminDashboardSkeleton } from '@/components/common/Skeleton';
import { PlusIcon, XIcon } from '@/components/icons/VectorIcons';
import {
  FloatingLabelInput,
  FloatingLabelPasswordInput,
} from '@/components/ui/FloatingLabelInput';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

export default function SuperAdminPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState<'orgs' | 'self_users'>('orgs');
  const [metrics, setMetrics] = useState<SuperAdminMetrics | null>(null);
  const [orgs, setOrgs] = useState<OrganizationSummary[]>([]);
  const [selfUsers, setSelfUsers] = useState<SelfUserSummary[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState('');

  // Search filters
  const [orgFilter, setOrgFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');

  // Add Org Modal State
  const [showAddOrg, setShowAddOrg] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgCode, setOrgCode] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const load = useCallback(async () => {
    try {
      const [nextMetrics, nextOrgs, nextSelfUsers] = await Promise.all([
        api<SuperAdminMetrics>('/api/super-admin/metrics'),
        api<OrganizationSummary[]>('/api/super-admin/organizations'),
        api<SelfUserSummary[]>('/api/super-admin/self-users'),
      ]);
      setMetrics(nextMetrics);
      setOrgs(nextOrgs);
      setSelfUsers(nextSelfUsers);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load platform data');
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!session || session.user.role !== 'super_admin') {
      router.replace('/');
      return;
    }
    load();
  }, [loading, session, router, load]);

  const filteredOrgs = useMemo(() => {
    const q = orgFilter.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.code.toLowerCase().includes(q) ||
        (o.adminEmail && o.adminEmail.toLowerCase().includes(q)) ||
        (o.adminName && o.adminName.toLowerCase().includes(q)),
    );
  }, [orgs, orgFilter]);

  const filteredSelfUsers = useMemo(() => {
    const q = userFilter.trim().toLowerCase();
    if (!q) return selfUsers;
    return selfUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone && u.phone.toLowerCase().includes(q)),
    );
  }, [selfUsers, userFilter]);

  function openAddOrgModal() {
    setOrgName('');
    setOrgCode('');
    setAdminName('');
    setAdminEmail('');
    setAdminPhone('');
    setAdminPassword('');
    setModalError('');
    setShowAddOrg(true);
  }

  function closeAddOrgModal() {
    setShowAddOrg(false);
    setModalError('');
  }

  async function handleCreateOrg(e: FormEvent) {
    e.preventDefault();
    setModalError('');
    setModalSaving(true);
    try {
      const newOrg = await api<OrganizationSummary>('/api/super-admin/organizations', {
        method: 'POST',
        body: JSON.stringify({
          name: orgName.trim(),
          code: orgCode.trim(),
          contactEmail: adminEmail.trim(),
          adminName: adminName.trim(),
          adminPhone: adminPhone.trim() || undefined,
          adminPassword: adminPassword.trim(),
        }),
      });
      await load();
      toast.success(`Organization "${newOrg.name}" created successfully!`);
      closeAddOrgModal();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not create organization';
      setModalError(msg);
      toast.error(msg);
    } finally {
      setModalSaving(false);
    }
  }

  if (loading || dataLoading || !session || session.user.role !== 'super_admin') {
    return (
      <div className="min-h-screen bg-[#F4F7FC]">
        <AppHeader />
        <AdminDashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7FC]">
      <AppHeader />

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold text-gray-900">Platform Super Admin</h1>
              <span className="px-3 py-1 bg-amber-50 text-amber-800 text-xs font-bold rounded-full border border-amber-200">
                Super Admin Access
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Global overview of hospital organizations, partner clinics, doctors, and direct self-signup users.
            </p>
          </div>

          <button
            onClick={openAddOrgModal}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Add Organization</span>
          </button>
        </div>

        {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

        {/* Global Metrics Cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Organizations</p>
            <p className="text-3xl font-black text-gray-900 mt-2">{metrics?.totalOrganizations ?? 0}</p>
            <p className="text-xs text-blue-600 mt-1 font-medium">Hospitals & Clinics</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Doctors</p>
            <p className="text-3xl font-black text-gray-900 mt-2">{metrics?.totalDoctors ?? 0}</p>
            <p className="text-xs text-indigo-600 mt-1 font-medium">Across all orgs</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Hospital Patients</p>
            <p className="text-3xl font-black text-gray-900 mt-2">{metrics?.totalOrgPatients ?? 0}</p>
            <p className="text-xs text-emerald-600 mt-1 font-medium">Doctor-referred</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Direct Self Users</p>
            <p className="text-3xl font-black text-gray-900 mt-2">{metrics?.totalSelfPatients ?? 0}</p>
            <p className="text-xs text-purple-600 mt-1 font-medium">Independent B2C</p>
          </div>
        </section>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setTab('orgs')}
            className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors cursor-pointer ${
              tab === 'orgs'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Organizations ({orgs.length})
          </button>
          <button
            onClick={() => setTab('self_users')}
            className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors cursor-pointer ${
              tab === 'self_users'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Direct Self-Signup Users ({selfUsers.length})
          </button>
        </div>

        {/* Tab 1: Organizations */}
        {tab === 'orgs' && (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <input
                type="search"
                value={orgFilter}
                onChange={(e) => setOrgFilter(e.target.value)}
                placeholder="Search organizations by name, code, admin..."
                className="w-full sm:w-80 px-4 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-500">
                Showing {filteredOrgs.length} of {orgs.length} organizations
              </span>
            </div>

            {filteredOrgs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500 text-sm">
                No organizations found.
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-3.5">Organization</th>
                        <th className="px-6 py-3.5">Code</th>
                        <th className="px-6 py-3.5">Admin Account</th>
                        <th className="px-6 py-3.5 text-center">Doctors</th>
                        <th className="px-6 py-3.5 text-center">Patients</th>
                        <th className="px-6 py-3.5">Joined</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredOrgs.map((org) => (
                        <tr key={org.id} className="hover:bg-gray-50/70 transition-colors">
                          <td className="px-6 py-4 font-semibold text-gray-900">
                            <div>{org.name}</div>
                            <div className="text-xs text-gray-400 font-normal">{org.contactEmail}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 bg-gray-100 text-gray-800 text-xs font-mono font-bold rounded-lg">
                              {org.code}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-gray-900 font-medium">{org.adminName || '—'}</div>
                            <div className="text-xs text-gray-500">{org.adminEmail || '—'}</div>
                          </td>
                          <td className="px-6 py-4 text-center font-bold text-gray-900">
                            <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                              {org.doctorCount}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center font-bold text-gray-900">
                            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded-full">
                              {org.patientCount}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                            {new Date(org.createdAt).toLocaleDateString(undefined, {
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

        {/* Tab 2: Direct Self Users */}
        {tab === 'self_users' && (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <input
                type="search"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                placeholder="Search self-registered users by name, email..."
                className="w-full sm:w-80 px-4 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-500">
                Showing {filteredSelfUsers.length} of {selfUsers.length} direct users
              </span>
            </div>

            {filteredSelfUsers.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500 text-sm">
                No direct self-signup users found.
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-3.5">User</th>
                        <th className="px-6 py-3.5">Email</th>
                        <th className="px-6 py-3.5">Phone</th>
                        <th className="px-6 py-3.5 text-center">Sessions Played</th>
                        <th className="px-6 py-3.5">Registered</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredSelfUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50/70 transition-colors">
                          <td className="px-6 py-4 font-semibold text-gray-900">{u.name}</td>
                          <td className="px-6 py-4 text-gray-700">{u.email}</td>
                          <td className="px-6 py-4 text-gray-500">{u.phone || '—'}</td>
                          <td className="px-6 py-4 text-center">
                            <span className="px-2.5 py-0.5 bg-purple-50 text-purple-700 text-xs font-bold rounded-full">
                              {u.sessionCount}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                            {new Date(u.createdAt).toLocaleDateString(undefined, {
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

      {/* Add Organization Modal */}
      {showAddOrg && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        >
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Add New Organization</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Creates an organization and its dedicated admin account.
                </p>
              </div>
              <button
                type="button"
                onClick={closeAddOrgModal}
                className="p-2 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FloatingLabelInput
                  label="Hospital / Org Name"
                  value={orgName}
                  onChange={setOrgName}
                  required
                />
                <FloatingLabelInput
                  label="Org Code (e.g. APOLLO)"
                  value={orgCode}
                  onChange={setOrgCode}
                  required
                />
              </div>

              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">
                  Organization Admin Details
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FloatingLabelInput
                    label="Admin Name"
                    value={adminName}
                    onChange={setAdminName}
                    required
                  />
                  <FloatingLabelInput
                    label="Admin Phone"
                    value={adminPhone}
                    onChange={setAdminPhone}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <FloatingLabelInput
                    label="Admin Email"
                    type="email"
                    value={adminEmail}
                    onChange={setAdminEmail}
                    required
                  />
                  <FloatingLabelPasswordInput
                    label="Admin Password"
                    value={adminPassword}
                    onChange={setAdminPassword}
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeAddOrgModal}
                  disabled={modalSaving}
                  className="flex-1 px-4 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl transition-colors cursor-pointer text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSaving}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors disabled:opacity-60 cursor-pointer text-sm"
                >
                  {modalSaving ? 'Creating…' : 'Create Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
