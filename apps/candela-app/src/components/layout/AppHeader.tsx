'use client';

import { roleHomePath, useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import logoPng from '@candela/shared/assets/updated_Web logo.png';
import { ArrowLeftIcon, LogOutIcon } from '@/components/icons/VectorIcons';

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
  const pathname = usePathname();
  const onDocIdPage = pathname === '/docid';
  const homeHref = session ? roleHomePath(session.user.role) : '/';
  const showBack = Boolean(onBack || backHref || (session && onDocIdPage));

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backHref) {
      router.push(backHref);
    } else if (onDocIdPage) {
      router.replace(homeHref);
    }
  };

  return (
    <header className="sticky top-0 z-50 min-h-[72px] flex flex-row items-center justify-between px-4 sm:px-6 py-3 bg-white/95 backdrop-blur-md border-b border-[#F3F4F6] gap-2">
      <div className="flex-1 flex items-center min-w-0">
        {showBack ? (
          <button
            type="button"
            onClick={handleBack}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-shell-text hover:bg-gray-100 cursor-pointer"
            title="Go back"
            aria-label="Back"
          >
            <ArrowLeftIcon className="w-[22px] h-[22px]" />
          </button>
        ) : session ? (
          <button
            type="button"
            onClick={() => router.replace(homeHref)}
            className="max-w-full text-left py-1 cursor-pointer"
            title="Go home"
          >
            <span className="block truncate text-base font-bold text-shell-text">{session.user.name}</span>
          </button>
        ) : (
          <Link
            href="/"
            className="group flex items-center p-1.5 -ml-1.5 rounded-2xl hover:bg-slate-100/80 transition-all"
            title="Go to Home"
          >
            <img
              src={logoSrc}
              alt="Kandela"
              className="h-10 w-auto object-contain transition-transform group-hover:scale-105"
            />
          </Link>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {session?.user.role === 'patient' && !onDocIdPage ? (
          <Link
            href="/docid"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] text-xs font-bold transition-all active:scale-95"
            title="Attach or change DocID"
          >
            DocID
            {session.patient?.pendingDocIdRequest ? (
              <span className="w-2 h-2 rounded-full bg-shell-blue" aria-label="Pending request" />
            ) : null}
          </Link>
        ) : null}
        {extra}
        {session ? (
          <button
            type="button"
            onClick={async () => {
              await logout();
              toast.info('Signed out successfully.');
              router.replace('/');
            }}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#FEF2F2] border border-red-200/80 text-shell-red hover:bg-red-100 transition-all active:scale-95 cursor-pointer"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOutIcon className="w-4 h-4" />
          </button>
        ) : (
          !loading && (
            <Link
              href="/login"
              className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition-colors"
            >
              Sign in
            </Link>
          )
        )}
      </div>
    </header>
  );
}
