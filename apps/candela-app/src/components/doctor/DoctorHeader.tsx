'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { PatientSummary } from '@candela/shared';
import { useAnnouncements } from '@/lib/use-announcements';
import { SearchIcon, XIcon } from '@/components/icons/VectorIcons';
import {
  AnnouncementBanners,
  NotificationBellControl,
} from '@/components/layout/HeaderControls';

function patientInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

interface DoctorHeaderProps {
  patients: PatientSummary[];
  patientsLoading: boolean;
  patientsError: string;
  navOpen: boolean;
  onToggleMobileNav: () => void;
}

export function DoctorHeader({
  patients,
  patientsLoading,
  patientsError,
  navOpen,
  onToggleMobileNav,
}: DoctorHeaderProps) {
  const {
    announcements,
    unreadCount,
    topBanners,
    dismissBanner,
    markRead,
    markAllRead,
  } = useAnnouncements();

  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setSearchFocused(false);
        setMobileSearchOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSearchFocused(false);
        setMobileSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const trimmedQuery = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!trimmedQuery) return [];
    return patients
      .filter(
        (patient) =>
          patient.name.toLowerCase().includes(trimmedQuery) ||
          patient.email.toLowerCase().includes(trimmedQuery) ||
          patient.phone.toLowerCase().includes(trimmedQuery) ||
          patient.id.toLowerCase().includes(trimmedQuery),
      )
      .slice(0, 6);
  }, [patients, trimmedQuery]);

  const showResults = searchFocused && trimmedQuery.length > 0;

  return (
    <>
      <AnnouncementBanners banners={topBanners} onDismiss={dismissBanner} />

      <div className="pointer-events-none sticky top-0 z-30 px-[13px] pt-[13px] pb-[8px]">
        <div className="mx-auto flex max-w-[1184px] items-center justify-between gap-[8px] lg:justify-end">
          {/* Left: Mobile sidebar drawer toggle only */}
          <div
            className={`pointer-events-auto min-w-0 items-center lg:hidden ${
              mobileSearchOpen ? 'hidden sm:flex' : 'flex'
            }`}
          >
            <button
              type="button"
              onClick={onToggleMobileNav}
              className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-gray-700 hover:bg-gray-100/80"
              aria-label={navOpen ? 'Close sidebar' : 'Open sidebar'}
              aria-expanded={navOpen}
            >
              <svg
                className="size-[22px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 3v18" />
                {navOpen ? (
                  <rect x="4" y="4" width="5" height="16" rx="1" fill="currentColor" stroke="none" />
                ) : null}
              </svg>
            </button>
          </div>

          {/* Right: Patient search (icon on mobile, bar on sm+) + Notification icon */}
          <div
            className={`pointer-events-auto flex items-center gap-2 ${
              mobileSearchOpen ? 'flex-1 sm:flex-initial' : 'shrink-0'
            }`}
          >
            <div
              ref={searchContainerRef}
              className={`relative ${
                mobileSearchOpen
                  ? 'flex-1 sm:flex-initial sm:w-[230px] md:w-[270px]'
                  : 'sm:w-[230px] md:w-[270px]'
              }`}
            >
              {!mobileSearchOpen && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileSearchOpen(true);
                    setSearchFocused(true);
                    requestAnimationFrame(() => searchInputRef.current?.focus());
                  }}
                  disabled={Boolean(patientsError) && patients.length === 0}
                  aria-label="Search patients"
                  title="Search patients"
                  className="flex size-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-xs transition-all hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 sm:hidden cursor-pointer"
                >
                  <SearchIcon className="size-4" />
                </button>
              )}

              <div className={`${mobileSearchOpen ? 'block' : 'hidden sm:block'} relative`}>
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <SearchIcon className="size-4" />
                </div>
                <input
                  ref={searchInputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  placeholder="Search patients..."
                  aria-label="Search patients"
                  disabled={Boolean(patientsError) && patients.length === 0}
                  className="w-full rounded-xl border border-gray-200 bg-white py-1.5 pl-9 pr-8 text-sm text-[var(--doc-text)] placeholder:text-gray-400 shadow-2xs transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                />
                {(query || mobileSearchOpen) && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      setMobileSearchOpen(false);
                      setSearchFocused(false);
                    }}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 ${
                      query ? '' : 'sm:hidden'
                    }`}
                    title={mobileSearchOpen && !query ? 'Close search' : 'Clear search'}
                    aria-label={mobileSearchOpen && !query ? 'Close patient search' : 'Clear patient search'}
                  >
                    <XIcon className="size-3.5" />
                  </button>
                )}
              </div>

              {showResults && (
                <div
                  role="listbox"
                  aria-label="Patient search results"
                  className="absolute right-0 left-0 sm:left-auto z-50 mt-2 sm:w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl"
                >
                  {patientsLoading ? (
                    <p className="px-3.5 py-3 text-xs text-[var(--doc-muted)]">
                      Loading patients...
                    </p>
                  ) : patientsError && patients.length === 0 ? (
                    <p className="px-3.5 py-3 text-xs text-[var(--doc-error-text)]">
                      Patient search unavailable right now.
                    </p>
                  ) : matches.length === 0 ? (
                    <p className="px-3.5 py-3 text-xs text-[var(--doc-muted)]">
                      No assigned patients match &quot;{query.trim()}&quot;.
                    </p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {matches.map((patient) => (
                        <li key={patient.id}>
                          <Link
                            href={`/doctor/patients/${patient.id}`}
                            onClick={() => {
                              setSearchFocused(false);
                              setMobileSearchOpen(false);
                              setQuery('');
                            }}
                            className="flex items-center gap-2.5 px-3.5 py-2.5 text-left transition hover:bg-[var(--doc-primary-soft)]/70"
                          >
                            <span
                              aria-hidden
                              className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--doc-primary-soft)] text-[11px] font-bold text-[var(--doc-primary)]"
                            >
                              {patientInitials(patient.name)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-semibold text-[var(--doc-text)]">
                                {patient.name}
                              </span>
                              <span className="block truncate text-[11px] text-[var(--doc-muted)]">
                                {patient.email || patient.phone}
                              </span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <NotificationBellControl
              announcements={announcements}
              unreadCount={unreadCount}
              onMarkRead={markRead}
              onMarkAllRead={markAllRead}
            />
          </div>
        </div>
      </div>
    </>
  );
}
