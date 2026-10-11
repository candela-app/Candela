'use client';

import { HomePageContent } from '@/components/home/HomePageContentV2';
import { roleHomePath, useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const { session, loading, logout } = useAuth();

  const goToDashboard = () => {
    if (!session) {
      router.push('/login');
      return;
    }
    router.push(roleHomePath(session.user.role));
  };

  const selectFamily = (id: string) => {
    if (!session) {
      router.push('/login');
      return;
    }
    if (session.user.role !== 'patient') {
      router.push(roleHomePath(session.user.role));
      return;
    }
    const params = new URLSearchParams({ therapy: 'vision', family: id });
    router.push(`/dashboard?${params.toString()}`);
  };

  const openPatientFeature = (params: URLSearchParams) => {
    if (!session) {
      router.push('/login');
      return;
    }
    if (session.user.role !== 'patient') {
      router.push(roleHomePath(session.user.role));
      return;
    }
    router.push(`/dashboard?${params.toString()}`);
  };

  return (
    <HomePageContent
      onOpenDashboard={goToDashboard}
      onSelectFamily={selectFamily}
      onOpenAIGaze={() =>
        openPatientFeature(
          new URLSearchParams({
            therapy: 'vision',
            family: 'tap_timing',
            game: 'computer_vision',
          }),
        )
      }
      isAuthenticated={Boolean(session)}
      authLoading={loading}
      userName={session?.user.name}
      userEmail={session?.user.email}
      userRole={session?.user.role}
      onSignOut={() => {
        void logout().then(() => router.replace('/'));
      }}
    />
  );
}
