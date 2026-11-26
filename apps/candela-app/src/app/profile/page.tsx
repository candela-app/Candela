'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/layout/AppHeader';
import {
  PatientProfileForm,
  PatientProfileFormSkeleton,
} from '@/components/profile/PatientProfileForm';
import { useAuth } from '@/lib/auth-context';
import patientShellStyles from '../dashboard/PatientShell.module.css';

export default function PatientProfilePage() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/login');
      return;
    }
    if (session.user.role === 'doctor') router.replace('/doctor/profile');
    else if (session.user.role === 'admin') router.replace('/admin/organization-profile');
    else if (session.user.role === 'super_admin') router.replace('/super-admin');
    else if (session.user.role !== 'patient') router.replace('/');
  }, [loading, session, router]);

  const showAuthSkeleton = loading || !session || session.user.role !== 'patient';

  return (
    <div className={`min-h-screen page-wash ${patientShellStyles.userShellFont}`}>
      <AppHeader
        onBack={
          showAuthSkeleton
            ? undefined
            : () => {
                if (typeof window !== 'undefined' && window.history.length > 1) {
                  router.back();
                  return;
                }
                router.push('/dashboard');
              }
        }
      />
      <main className="mx-auto max-w-[930px] space-y-[21px] px-[21px] py-[34px]">
        <div>
          <h1 className="text-[21px] font-semibold text-gray-900">Your identity profile</h1>
          <p className="mt-[8px] text-[13px] leading-[21px] text-gray-600">
            Complete your details anytime. Games stay available while this is incomplete.
          </p>
        </div>
        {showAuthSkeleton ? <PatientProfileFormSkeleton /> : <PatientProfileForm />}
      </main>
    </div>
  );
}
