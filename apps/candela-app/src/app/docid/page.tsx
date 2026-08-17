'use client';

import { useAuth } from '@/lib/auth-context';
import { AppHeader } from '@/components/layout/AppHeader';
import { DocIdRequestCard } from '@/components/docid/DocIdRequestCard';
import { PatientDashboardSkeleton } from '@/components/common/Skeleton';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DocIdPage() {
  const router = useRouter();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!session) {
      router.replace('/login');
      return;
    }
    if (session.user.role !== 'patient') {
      router.replace(session.user.role === 'admin' ? '/admin' : '/doctor');
    }
  }, [loading, session, router]);

  if (loading || !session || session.user.role !== 'patient') {
    return (
      <div className="min-h-screen bg-[#F4F7FC] flex flex-col">
        <AppHeader />
        <PatientDashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7FC] flex flex-col">
      <AppHeader />
      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-10">
        <h1 className="text-3xl font-extrabold text-gray-900">Doctor link</h1>
        <p className="text-sm text-gray-500 mt-2 mb-8">
          Attach to a clinic with a DocID, or request a switch if you are already linked. The requested doctor
          confirms attach and reassignment. An admin transfer is confirmed here by you.
        </p>
        <DocIdRequestCard />
      </main>
    </div>
  );
}
