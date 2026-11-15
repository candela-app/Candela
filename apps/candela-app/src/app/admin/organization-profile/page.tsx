'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/layout/AppHeader';
import { OrganizationProfileForm } from '@/components/profile/OrganizationProfileForm';
import { useAuth } from '@/lib/auth-context';

export default function AdminOrganizationProfilePage() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'super_admin')) {
      router.replace('/login');
    }
  }, [loading, session, router]);

  if (loading || !session || (session.user.role !== 'admin' && session.user.role !== 'super_admin')) {
    return (
      <div className="min-h-screen bg-[#F4F7FC]">
        <AppHeader />
        <p className="p-8 text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7FC]">
      <AppHeader
        onBack={() => {
          if (typeof window !== 'undefined' && window.history.length > 1) {
            router.back();
            return;
          }
          router.push('/admin');
        }}
      />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Organisation profile</h1>
          <p className="mt-1 text-sm text-gray-600">
            Complete organisation details after creation. This does not change patient ownership.
          </p>
        </div>
        <OrganizationProfileForm />
      </main>
    </div>
  );
}
