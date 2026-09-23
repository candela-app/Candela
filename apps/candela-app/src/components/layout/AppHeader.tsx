'use client';

import { useState, useRef, useEffect } from 'react';
import { roleHomePath, useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import logoPng from '@candela/shared/assets/updated_Web logo.png';
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  LogOutIcon,
  PencilIcon,
  UserIcon,
} from '@/components/icons/VectorIcons';
import { EditPatientNameModal } from '@/components/common/EditPatientNameModal';

const logoSrc = typeof logoPng === 'string' ? logoPng : logoPng.src;

export interface AppHeaderProps {
  extra?: React.ReactNode;
  onBack?: () => void;
  backHref?: string;
}

export function AppHeader({ extra, onBack, backHref }: AppHeaderProps) {
  const { session, loading, logout } = useAuth();
  const [showEditName, setShowEditName] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const onDocIdPage = pathname === '/docid';
  const homeHref = session ? roleHomePath(session.user.role) : '/';
  const showBack = Boolean(onBack || backHref || (session && onDocIdPage));

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showDropdown]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backHref) {
      router.push(backHref);
    } else if (onDocIdPage) {
      router.replace(homeHref);
    }
  };

  const initialLetter = session?.user?.name ? session.user.name.trim().charAt(0).toUpperCase() : '';

  return (
    <>
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
              className="text-left py-1 cursor-pointer truncate max-w-full"
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
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setShowDropdown((prev) => !prev)}
                className="flex items-center gap-1.5 p-1 sm:px-2 sm:py-1 rounded-xl border border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 transition-all shadow-xs cursor-pointer active:scale-95"
                aria-expanded={showDropdown}
                aria-label="Account menu"
              >
                <div className="w-7 h-7 rounded-lg bg-shell-blue text-white font-bold text-xs flex items-center justify-center uppercase select-none">
                  {initialLetter || <UserIcon className="w-3.5 h-3.5" />}
                </div>
                <ChevronDownIcon
                  className={`w-3.5 h-3.5 text-gray-500 transition-transform ${
                    showDropdown ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-shell-border shadow-xl py-2 z-50 animate-fade-in divide-y divide-gray-100">
                  {/* Identity card */}
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-bold text-shell-text truncate max-w-[170px]" title={session.user.name}>
                        {session.user.name}
                      </span>
                      {session.user.role === 'patient' && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowDropdown(false);
                            setShowEditName(true);
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-shell-blue hover:bg-blue-50 transition-colors cursor-pointer flex-shrink-0"
                          title="Change patient name"
                          aria-label="Change patient name"
                        >
                          <PencilIcon className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate" title={session.user.email}>
                      {session.user.email}
                    </p>
                    <span className="inline-block mt-2 px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      {session.user.role}
                    </span>
                  </div>

                  {/* Sign out item */}
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={async () => {
                        setShowDropdown(false);
                        await logout();
                        toast.info('Signed out successfully.');
                        router.replace('/');
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors text-left cursor-pointer"
                    >
                      <LogOutIcon className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
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

      {session?.user.role === 'patient' && (
        <EditPatientNameModal
          isOpen={showEditName}
          onClose={() => setShowEditName(false)}
        />
      )}
    </>
  );
}


