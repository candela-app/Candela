'use client';

import { HomePageContent } from '@/components/home/HomePageContent';
import { AppHeader } from '@/components/layout/AppHeader';
import { roleHomePath, useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const { session } = useAuth();

  const goToDashboard = () => {
    if (!session) {
      router.push('/login');
      return;
    }
    router.push(roleHomePath(session.user.role));
  };

  const selectModule = (id: string) => {
    if (!session) {
      router.push('/login');
      return;
    }
    if (session.user.role !== 'patient') {
      router.push(roleHomePath(session.user.role));
      return;
    }
    const params = new URLSearchParams({ therapy: 'vision', module: id });
    router.push(`/dashboard?${params.toString()}`);
  };

  return (
    <div className="min-h-screen overflow-y-auto flex flex-col bg-[#F4F7FC]">
      <AppHeader />
      <HomePageContent onOpenDashboard={goToDashboard} onSelectModule={selectModule} />
    </div>
  );
}
