'use client';

import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import logoPng from '@candela/shared/assets/updated_Web logo.png';
import { ArrowLeftIcon } from '@/components/icons/VectorIcons';

const logoSrc = typeof logoPng === 'string' ? logoPng : logoPng.src;

export interface AppHeaderProps {
  extra?: React.ReactNode;
  onBack?: () => void;
  backHref?: string;
}

export function AppHeader({ extra, onBack, backHref }: AppHeaderProps) {
  const { session, loading, logout } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backHref) {
      router.push(backHref);
    }
  };

  const getLogoHref = () => {
    if (session?.user.role === 'admin') return '/admin';
    if (session?.user.role === 'doctor') return '/doctor';
    return '/';
  };

  const getLogoTitle = () => {
    if (session?.user.role === 'admin') return 'Go to Admin Dashboard';
    if (session?.user.role === 'doctor') return 'Go to Doctor Dashboard';
    return 'Go to Home';
  };

  return (
    <header className="sticky top-0 z-50 h-[72px] flex flex-row items-center justify-between px-6 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100 gap-4">
      <Link
        href={getLogoHref()}
        className="group flex items-center p-1.5 -ml-1.5 rounded-2xl hover:bg-slate-100/80 active:bg-slate-200/80 transition-all duration-200 cursor-pointer"
        title={getLogoTitle()}
      >
        <img
          src={logoSrc}
          alt="Kandela"
          className="h-10 w-auto object-contain transition-transform duration-200 group-hover:scale-105 group-active:scale-95"
        />
      </Link>
      <div className="flex items-center gap-3 mt-1">
        {session && (
          <span className="hidden sm:inline text-sm font-semibold text-gray-600">{session.user.name}</span>
        )}
        {extra}
        {(onBack || backHref) && (
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 text-sm font-semibold transition-all active:scale-95 cursor-pointer"
            title="Go back"
          >
            <ArrowLeftIcon className="w-4 h-4 text-gray-500" />
            <span>Back</span>
          </button>
        )}
        {session ? (
          <button
            type="button"
            onClick={async () => {
              await logout();
              toast.info('Signed out successfully.');
              router.replace('/');
            }}
            className="px-3.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200/80 text-sm font-semibold transition-all active:scale-95 cursor-pointer"
          >
            Sign out
          </button>
        ) : (
          <Link
            href="/login"
            className="px-3.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition-colors"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
