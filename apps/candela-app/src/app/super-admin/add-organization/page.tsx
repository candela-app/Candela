'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { ApiError, api } from '@/lib/api';
import type { OrganizationSummary } from '@candela/shared';
import { AppHeader } from '@/components/layout/AppHeader';
import { AdminDashboardSkeleton } from '@/components/common/Skeleton';
import {
  FloatingLabelInput,
  FloatingLabelPasswordInput,
} from '@/components/ui/FloatingLabelInput';
import { ArrowLeftIcon } from '@/components/icons/VectorIcons';
import Link from 'next/link';

export default function AddOrganizationPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const toast = useToast();

  const [orgName, setOrgName] = useState('');
  const [orgCode, setOrgCode] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!session || session.user.role !== 'super_admin') {
      router.replace('/');
    }
  }, [loading, session, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

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

      toast.success(`Organization "${newOrg.name}" created successfully!`);
      router.push('/super-admin');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not create organization';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !session || session.user.role !== 'super_admin') {
    return (
      <div className="min-h-screen bg-[#F4F7FC]">
        <AppHeader backHref="/super-admin" />
        <AdminDashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7FC]">
      <AppHeader backHref="/super-admin" />

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        {/* Navigation / Header */}
        <div className="space-y-2">
          <Link
            href="/super-admin"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>

          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">Add New Organization</h1>
            <p className="text-sm text-gray-500 mt-1">
              Register a partner hospital or clinic and create its dedicated Organization Admin account.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-600 font-medium">
            {error}
          </div>
        )}

        <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Organization Info Section */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Hospital / Organization Info
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FloatingLabelInput
                  label="Organization Name"
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
            </div>

            {/* Admin Details Section */}
            <div className="border-t border-gray-100 pt-6 space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Dedicated Admin Credentials
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FloatingLabelInput
                  label="Admin Full Name"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
              <Link
                href="/super-admin"
                className="flex-1 py-3 text-center border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl transition-colors text-sm"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors disabled:opacity-60 cursor-pointer text-sm shadow-sm"
              >
                {saving ? 'Creating Organization…' : 'Create Organization'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
