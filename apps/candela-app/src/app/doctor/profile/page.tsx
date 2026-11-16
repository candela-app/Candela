'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/layout/AppHeader';
import {
  DoctorProfileForm,
  DoctorProfileFormSkeleton,
} from '@/components/profile/DoctorProfileForm';
import { useAuth } from '@/lib/auth-context';

export default function DoctorProfilePage() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!session || session.user.role !== 'doctor') router.replace('/login');
  }, [loading, session, router]);

  const showAuthSkeleton = loading || !session || session.user.role !== 'doctor';

  return (
    <div className="min-h-screen page-wash">
      <AppHeader
        onBack={
          showAuthSkeleton
            ? undefined
            : () => {
                if (typeof window !== 'undefined' && window.history.length > 1) {
                  router.back();
                  return;
                }
                router.push('/doctor?section=account');
              }
        }
      />
      <main className="mx-auto max-w-[930px] space-y-[21px] px-[21px] py-[34px]">
        <div>
          <h1 className="text-[21px] font-semibold text-gray-900">Professional profile</h1>
          <p className="mt-[8px] text-[13px] leading-[21px] text-gray-600">
            One profile for your account across all organisations.
          </p>
        </div>
        {showAuthSkeleton ? <DoctorProfileFormSkeleton /> : <DoctorProfileForm />}
      </main>
    </div>
  );
}
