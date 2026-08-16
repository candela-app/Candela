'use client';

import { useAuth, roleHomePath } from '@/lib/auth-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import logoJpeg from '@candela/shared/assets/logo.jpeg';

const logoSrc = typeof logoJpeg === 'string' ? logoJpeg : logoJpeg.src;

export function AppHeader({ extra }: { extra?: React.ReactNode }) {
  const { session, loading, logout } = useAuth();
  const router = useRouter();
  const logoHref = session ? roleHomePath(session.user.role) : '/';

  return (
    <header className="sticky top-0 z-50 flex flex-row items-center justify-between px-6 py-4 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100 gap-4">
      <Link
        href={logoHref}
        className="flex items-center gap-2.5 text-2xl md:text-3xl font-extrabold text-[#1A1A1A] tracking-tight hover:opacity-80 transition-opacity"
      >
        <img src={logoSrc} alt="" className="h-9 w-9 md:h-10 md:w-10 object-contain" />
        Kandela
      </Link>
      <div className="flex items-center gap-3">
        {session && (
          <span className="hidden sm:inline text-sm font-semibold text-gray-600">{session.user.name}</span>
        )}
        {extra}
        {session ? (
          <button
            onClick={async () => {
              await logout();
              router.replace('/login');
            }}
            className="px-3.5 py-1.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold"
          >
            Sign out
          </button>
        ) : (
          !loading && (
            <Link
              href="/login"
              className="px-3.5 py-1.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold"
            >
              Sign in
            </Link>
          )
        )}
      </div>
    </header>
  );
}
