'use client';

import { useState } from 'react';
import { roleHomePath, useAuth } from '@/lib/auth-context';
import { useAnnouncements } from '@/lib/use-announcements';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import logoPng from '@candela/shared/assets/updated_Web logo.png';
import { ArrowLeftIcon } from '@/components/icons/VectorIcons';
import { EditPatientNameModal } from '@/components/common/EditPatientNameModal';
import {
  AccountAvatarControl,
  AnnouncementBanners,
  NotificationBellControl,
} from '@/components/layout/HeaderControls';

const logoSrc = typeof logoPng === 'string' ? logoPng : logoPng.src;

export interface AppHeaderProps {
  extra?: React.ReactNode;
  leading?: React.ReactNode;
  onBack?: () => void;
  backHref?: string;
}

export function AppHeader({ extra, leading, onBack, backHref }: AppHeaderProps) {
  const { session } = useAuth();
  const [showEditName, setShowEditName] = useState(false);
  const {
    announcements,
    unreadCount,
    topBanners,
    dismissBanner,
    markRead,
    markAllRead,
  } = useAnnouncements();
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
      if (typeof window !== 'undefined' && window.history.length > 1) {
        router.back();
      } else {
        router.push('/dashboard?page=settings');
      }
    }
  };

  return (
    <>
      <AnnouncementBanners banners={topBanners} onDismiss={dismissBanner} />

      <div className="px-[13px] pt-[13px]">
        <header className="header-glass sticky top-[13px] z-40 mb-[13px] flex h-[55px] flex-row items-center justify-between gap-[8px] rounded-[13px] px-[21px] shadow-[0_12px_32px_-14px_rgba(15,23,42,0.35)]">
          <div className="flex min-w-0 flex-1 items-center gap-[8px] overflow-visible">
            {leading}
            {showBack ? (
              <button
                type="button"
                onClick={handleBack}
                className="flex size-9 shrink-0 items-center justify-center rounded-xl text-shell-text hover:bg-gray-100 cursor-pointer"
                title="Go back"
                aria-label="Back"
              >
                <ArrowLeftIcon className="w-[22px] h-[22px]" />
              </button>
            ) : session ? (
              <button
                type="button"
                onClick={() => router.replace(homeHref)}
                className="min-w-0 max-w-full cursor-pointer py-1 text-left"
                title="Go home"
              >
                <span className="block truncate text-[17px] sm:text-[21px] font-semibold leading-[29px] text-shell-text">
                  {session.user.name}
                </span>
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
            {extra}

            {session ? (
              <>
                <NotificationBellControl
                  announcements={announcements}
                  unreadCount={unreadCount}
                  onMarkRead={markRead}
                  onMarkAllRead={markAllRead}
                />

                <AccountAvatarControl
                  session={session}
                  onEditPatientName={() => setShowEditName(true)}
                />
              </>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all shadow-sm active:scale-95"
              >
                Sign in
              </Link>
            )}
          </div>
        </header>
      </div>

      {session?.user.role === 'patient' && (
        <EditPatientNameModal
          isOpen={showEditName}
          onClose={() => setShowEditName(false)}
        />
      )}
    </>
  );
}
