'use client';

import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { ApiError, api } from '@/lib/api';
import type {
  OrganizationSummary,
  SelfUserSummary,
  SuperAdminMetrics,
  AnnouncementItem,
  AnnouncementPriority,
  AnnouncementTargetType,
} from '@candela/shared';
import { AppHeader } from '@/components/layout/AppHeader';
import { AdminDashboardSkeleton } from '@/components/common/Skeleton';
import { SearchInput } from '@/components/common/SearchInput';
import {
  PlusIcon,
  XIcon,
  MegaphoneIcon,
  AlertCircleIcon,
  TrashIcon,
  EditIcon,
  BuildingIcon,
  UsersIcon,
  UserIcon,
} from '@/components/icons/VectorIcons';
import { RecipientSelector } from '@/components/super-admin/RecipientSelector';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

export default function SuperAdminPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState<'orgs' | 'self_users' | 'announcements'>('orgs');
  const [metrics, setMetrics] = useState<SuperAdminMetrics | null>(null);
  const [orgs, setOrgs] = useState<OrganizationSummary[]>([]);
  const [selfUsers, setSelfUsers] = useState<SelfUserSummary[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState('');

  // Search filters
  const [orgFilter, setOrgFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [announcementFilter, setAnnouncementFilter] = useState('');

  // Add / Edit Announcement Modal State
  const [showAddAnnouncement, setShowAddAnnouncement] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<AnnouncementItem | null>(null);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annPriority, setAnnPriority] = useState<AnnouncementPriority>('info');
  const [annTargetType, setAnnTargetType] = useState<AnnouncementTargetType>('all');
  const [annTargetHospitalIds, setAnnTargetHospitalIds] = useState<string[]>([]);
  const [annTargetUserIds, setAnnTargetUserIds] = useState<string[]>([]);
  const [annExpiresAt, setAnnExpiresAt] = useState('');
  const [annSaving, setAnnSaving] = useState(false);
  const [annError, setAnnError] = useState('');

  const load = useCallback(async () => {
    try {
      const [nextMetrics, nextOrgs, nextSelfUsers, nextAnnouncements] = await Promise.all([
        api<SuperAdminMetrics>('/api/super-admin/metrics'),
        api<OrganizationSummary[]>('/api/super-admin/organizations'),
        api<SelfUserSummary[]>('/api/super-admin/self-users'),
        api<AnnouncementItem[]>('/api/super-admin/announcements'),
      ]);
      setMetrics(nextMetrics);
      setOrgs(nextOrgs);
      setSelfUsers(nextSelfUsers);
      setAnnouncements(nextAnnouncements);
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

  const filteredAnnouncements = useMemo(() => {
    const q = announcementFilter.trim().toLowerCase();
    if (!q) return announcements;
    return announcements.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.content.toLowerCase().includes(q) ||
        a.priority.toLowerCase().includes(q) ||
        a.targetType.toLowerCase().includes(q),
    );
  }, [announcements, announcementFilter]);

  function openAddAnnouncementModal() {
    setEditingAnnouncement(null);
    setAnnTitle('');
    setAnnContent('');
    setAnnPriority('info');
    setAnnTargetType('all');
    setAnnTargetHospitalIds([]);
    setAnnTargetUserIds([]);
    setAnnExpiresAt('');
    setAnnError('');
    setShowAddAnnouncement(true);
  }

  function openEditAnnouncementModal(a: AnnouncementItem) {
    setEditingAnnouncement(a);
    setAnnTitle(a.title);
    setAnnContent(a.content);
    setAnnPriority(a.priority);
    setAnnTargetType(a.targetType);
    setAnnTargetHospitalIds(a.targetHospitalIds || []);
    setAnnTargetUserIds(a.targetUserIds || []);
    setAnnExpiresAt(a.expiresAt ? a.expiresAt.substring(0, 10) : '');
    setAnnError('');
    setShowAddAnnouncement(true);
  }

  function closeAddAnnouncementModal() {
    setEditingAnnouncement(null);
    setShowAddAnnouncement(false);
    setAnnError('');
  }

  async function handleSaveAnnouncement(e: FormEvent) {
    e.preventDefault();
    setAnnError('');
    setAnnSaving(true);
    try {
      const payload = {
        title: annTitle.trim(),
        content: annContent.trim(),
        priority: annPriority,
        targetType: annTargetType,
        targetHospitalIds: annTargetType === 'selected_hospitals' ? annTargetHospitalIds : undefined,
        targetUserIds: annTargetType === 'selected_users' ? annTargetUserIds : undefined,
        expiresAt: annExpiresAt ? new Date(annExpiresAt).toISOString() : null,
      };

      if (editingAnnouncement) {
        await api<AnnouncementItem>(`/api/super-admin/announcements/${editingAnnouncement.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success('Announcement updated successfully!');
      } else {
        await api<AnnouncementItem>('/api/super-admin/announcements', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Announcement published successfully!');
      }

      await load();
      closeAddAnnouncementModal();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to save announcement';
      setAnnError(msg);
      toast.error(msg);
    } finally {
      setAnnSaving(false);
    }
  }

  async function handleToggleAnnouncement(id: string) {
    try {
      await api<AnnouncementItem>(`/api/super-admin/announcements/${id}/toggle-active`, {
        method: 'PATCH',
      });
      await load();
      toast.info('Announcement status updated.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to toggle status');
    }
  }

  async function handleDeleteAnnouncement(id: string) {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await api(`/api/super-admin/announcements/${id}`, { method: 'DELETE' });
      await load();
      toast.success('Announcement deleted.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete announcement');
    }
  }

  const getPriorityBadge = (priority: AnnouncementPriority) => {
    switch (priority) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
            Critical Alert
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
            Maintenance / Warning
          </span>
        );
      case 'info':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
            Info
          </span>
        );
    }
  };

  const getTargetTypeDisplay = (a: AnnouncementItem) => {
    switch (a.targetType) {
      case 'homepage':
        return <span className="text-xs font-semibold text-sky-700">Public Homepage</span>;
      case 'all':
        return <span className="text-xs font-semibold text-slate-700">All Users</span>;
      case 'all_hospitals':
        return <span className="text-xs font-semibold text-blue-700">All Hospitals</span>;
      case 'all_doctors':
        return <span className="text-xs font-semibold text-indigo-700">All Doctors</span>;
      case 'all_patients':
        return <span className="text-xs font-semibold text-emerald-700">All Patients</span>;
      case 'selected_hospitals':
        return (
          <div className="space-y-1">
            <span className="text-xs font-semibold text-purple-700">Few Hospitals:</span>
            <div className="flex flex-wrap gap-1 max-w-[200px]">
              {(a.targetHospitalNames || []).map((name, idx) => (
                <span key={idx} className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200">
                  {name}
                </span>
              ))}
            </div>
          </div>
        );
      case 'selected_users':
        return (
          <div className="space-y-1">
            <span className="text-xs font-semibold text-teal-700">Few Users:</span>
            <div className="flex flex-wrap gap-1 max-w-[200px]">
              {(a.targetUserNames || []).map((name, idx) => (
                <span key={idx} className="text-[10px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded border border-teal-200">
                  {name}
                </span>
              ))}
            </div>
          </div>
        );
    }
  };

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
              Global overview of hospital organizations, announcements, doctors, and direct self-signup users.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={openAddAnnouncementModal}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <span>Announce</span>
            </button>
            <Link
              href="/super-admin/add-organization"
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Add Organization</span>
            </Link>
          </div>
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
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Announcements</p>
            <p className="text-3xl font-black text-gray-900 mt-2">{announcements.length}</p>
            <p className="text-xs text-purple-600 mt-1 font-medium">
              {announcements.filter((a) => a.isActive).length} active broadcasts
            </p>
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
            Direct Self-Signed Users ({selfUsers.length})
          </button>
          <button
            onClick={() => setTab('announcements')}
            className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              tab === 'announcements'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>Announcements ({announcements.length})</span>
            {announcements.filter((a) => a.isActive).length > 0 && (
              <span className="px-2 py-0.5 text-[10px] bg-green-100 text-green-700 font-bold rounded-full">
                {announcements.filter((a) => a.isActive).length} Active
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Organizations */}
        {tab === 'orgs' && (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <SearchInput
                value={orgFilter}
                onChange={setOrgFilter}
                placeholder="Search organizations by name, code, admin..."
                className="w-full sm:w-80"
                aria-label="Search organizations"
              />
              <span className="text-xs text-gray-500">
                Showing {filteredOrgs.length} of {orgs.length} organizations
              </span>
            </div>

            <div className="grid gap-3">
              {filteredOrgs.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500 text-sm">
                  {orgFilter ? 'No matching organizations found.' : 'No organizations found.'}
                </div>
              ) : (
                filteredOrgs.map((org) => (
                  <div
                    key={org.id}
                    onClick={() => router.push(`/super-admin/organizations/${org.id}`)}
                    className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 font-extrabold flex items-center justify-center text-sm">
                        {org.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-gray-900 text-base group-hover:text-blue-600 transition-colors">
                            {org.name}
                          </p>
                          <span className="font-mono text-xs font-extrabold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-100">
                            {org.code}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Admin: <strong className="text-gray-700">{org.adminName || '—'}</strong> · {org.adminEmail || org.contactEmail || 'No email'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                          {org.doctorCount} {org.doctorCount === 1 ? 'doctor' : 'doctors'}
                        </span>
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                          {org.patientCount} {org.patientCount === 1 ? 'patient' : 'patients'}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 hidden lg:inline">
                        Joined {new Date(org.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <span className="text-xs text-blue-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline">
                        View details →
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* Tab 2: Direct Self Users */}
        {tab === 'self_users' && (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <SearchInput
                value={userFilter}
                onChange={setUserFilter}
                placeholder="Search self-registered users by name, email..."
                className="w-full sm:w-80"
                aria-label="Search self-registered users"
              />
              <span className="text-xs text-gray-500">
                Showing {filteredSelfUsers.length} of {selfUsers.length} direct users
              </span>
            </div>

            <div className="grid gap-3">
              {filteredSelfUsers.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500 text-sm">
                  {userFilter ? 'No matching users found.' : 'No direct self-signup users found.'}
                </div>
              ) : (
                filteredSelfUsers.map((u) => (
                  <div
                    key={u.id}
                    className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs hover:shadow-md hover:border-purple-200 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 font-extrabold flex items-center justify-center text-sm">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900 text-base">
                            {u.name}
                          </p>
                          <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-100">
                            Self Patient
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {u.email} · {u.phone || 'No phone'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                      <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-3.5 py-1.5 rounded-xl border border-purple-100">
                        {u.sessionCount} {u.sessionCount === 1 ? 'session' : 'sessions'} played
                      </span>
                      <span className="text-xs text-gray-400">
                        Registered {new Date(u.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* Tab 3: Announcements */}
        {tab === 'announcements' && (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <SearchInput
                value={announcementFilter}
                onChange={setAnnouncementFilter}
                placeholder="Search announcements by title, message, priority..."
                className="w-full sm:w-80"
                aria-label="Search announcements"
              />
              <span className="text-xs text-gray-500">
                Showing {filteredAnnouncements.length} of {announcements.length} announcements
              </span>
            </div>

            {filteredAnnouncements.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-500 space-y-3">
                <MegaphoneIcon className="w-10 h-10 text-gray-300 mx-auto" />
                <p className="text-sm font-semibold text-gray-700">No announcements found</p>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  Click the &quot;Announce&quot; button above to create a notification broadcast for all or specific hospitals, doctors, and users.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-3.5">Announcement</th>
                        <th className="px-6 py-3.5">Priority</th>
                        <th className="px-6 py-3.5">Audience Target</th>
                        <th className="px-6 py-3.5 text-center">Status</th>
                        <th className="px-6 py-3.5 text-center">Read / Dismissed</th>
                        <th className="px-6 py-3.5">Published</th>
                        <th className="px-6 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredAnnouncements.map((a) => (
                        <tr key={a.id} className="hover:bg-gray-50/70 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-gray-900 max-w-[240px] truncate" title={a.title}>
                              {a.title}
                            </div>
                            <div className="text-xs text-gray-500 line-clamp-2 max-w-[280px] mt-0.5">
                              {a.content}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">{getPriorityBadge(a.priority)}</td>
                          <td className="px-6 py-4">{getTargetTypeDisplay(a)}</td>
                          <td className="px-6 py-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleAnnouncement(a.id)}
                              className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
                                a.isActive
                                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              }`}
                              title="Click to toggle active status"
                            >
                              {a.isActive ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-center text-xs">
                            <span className="font-bold text-blue-600">{a.readCount ?? 0}</span> read
                            <span className="text-gray-400 mx-1">•</span>
                            <span className="font-bold text-gray-500">{a.dismissedCount ?? 0}</span> dismissed
                          </td>
                          <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                            <div>
                              {new Date(a.createdAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </div>
                            {a.expiresAt && (
                              <div className="text-[10px] text-amber-600">
                                Exp: {new Date(a.expiresAt).toLocaleDateString()}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openEditAnnouncementModal(a)}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                title="Edit announcement"
                              >
                                <EditIcon className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAnnouncement(a.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete announcement"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
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

      {/* Add / Edit Announcement Modal */}
      {showAddAnnouncement && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
        >
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-5 my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {editingAnnouncement ? 'Edit Announcement' : 'Announce'}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {editingAnnouncement
                    ? 'Update announcement details, priority, or target recipients.'
                    : 'Broadcast updates, maintenance, or notices to targeted user groups.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeAddAnnouncementModal}
                className="p-2 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {annError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">
                {annError}
              </div>
            )}

            <form onSubmit={handleSaveAnnouncement} className="space-y-4">
              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Announcement Title / Subject *</label>
                <input
                  type="text"
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="e.g. Scheduled Maintenance, New Features Available, Clinical Protocol Notice"
                  required
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Priority Dropdown */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Priority Level *</label>
                <select
                  value={annPriority}
                  onChange={(e) => setAnnPriority(e.target.value as AnnouncementPriority)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 font-medium"
                >
                  <option value="info">Info (Standard)</option>
                  <option value="warning">Maintenance / Warning</option>
                  <option value="critical">Critical Alert (Top Banner)</option>
                </select>
              </div>

              {/* Target Audience Dropdown */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Target Audience *</label>
                <select
                  value={annTargetType}
                  onChange={(e) => setAnnTargetType(e.target.value as AnnouncementTargetType)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 font-medium"
                >
                  <option value="homepage">Homepage (Public Visitors / Commoners / New Signups)</option>
                  <option value="all">All Users (Everyone on platform)</option>
                  <option value="all_hospitals">All Hospitals (All Hospital Admins)</option>
                  <option value="all_doctors">All Doctors (All Clinicians)</option>
                  <option value="all_patients">All Patients (All App Patients)</option>
                  <option value="selected_hospitals">Few Hospitals (Specific Organizations)</option>
                  <option value="selected_users">Few Users (Specific Accounts)</option>
                </select>
              </div>

              {/* Conditional Recipient Pickers for Few Hospitals / Few Users */}
              {annTargetType === 'selected_hospitals' && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <label className="text-xs font-bold text-slate-800">
                    Select Specific Hospitals
                  </label>
                  <RecipientSelector
                    type="hospital"
                    selectedIds={annTargetHospitalIds}
                    onChange={setAnnTargetHospitalIds}
                    placeholder="Type hospital name or code to select..."
                  />
                </div>
              )}

              {annTargetType === 'selected_users' && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <label className="text-xs font-bold text-slate-800">
                    Select Specific Users
                  </label>
                  <RecipientSelector
                    type="user"
                    selectedIds={annTargetUserIds}
                    onChange={setAnnTargetUserIds}
                    placeholder="Type user name, email, or role to select..."
                  />
                </div>
              )}

              {/* Content Textarea */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Announcement Message Content *</label>
                <textarea
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                  rows={4}
                  placeholder="Type the detailed announcement message here..."
                  required
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Expiry Date (Optional) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Auto-Expiry Date (Optional)</label>
                <input
                  type="date"
                  value={annExpiresAt}
                  onChange={(e) => setAnnExpiresAt(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                />
              </div>

              {/* Live Preview Card */}
              {annTitle && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Recipient Preview
                  </p>
                  <div
                    className={`p-3.5 rounded-2xl border text-sm space-y-1 ${
                      annPriority === 'critical'
                        ? 'bg-red-50/70 border-red-200 text-red-950'
                        : annPriority === 'warning'
                        ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                        : 'bg-blue-50/70 border-blue-200 text-blue-950'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{annTitle}</span>
                      {getPriorityBadge(annPriority)}
                    </div>
                    <p className="text-xs whitespace-pre-line opacity-90">{annContent || 'Your message content preview...'}</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeAddAnnouncementModal}
                  disabled={annSaving}
                  className="flex-1 px-4 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl transition-colors cursor-pointer text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={annSaving}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors disabled:opacity-60 cursor-pointer text-sm"
                >
                  {annSaving
                    ? (editingAnnouncement ? 'Saving…' : 'Announcing…')
                    : (editingAnnouncement ? 'Save Changes' : 'Announce')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
