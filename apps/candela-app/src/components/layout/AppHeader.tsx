'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { roleHomePath, useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { api } from '@/lib/api';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import logoPng from '@candela/shared/assets/updated_Web logo.png';
import type { AnnouncementItem } from '@candela/shared';
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  LogOutIcon,
  PencilIcon,
  UserIcon,
  BellIcon,
  MegaphoneIcon,
  AlertCircleIcon,
  CheckCheckIcon,
  XIcon,
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
  const [showNotifications, setShowNotifications] = useState(false);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const onDocIdPage = pathname === '/docid';
  const homeHref = session ? roleHomePath(session.user.role) : '/';
  const showBack = Boolean(onBack || backHref || (session && onDocIdPage));

  const fetchAnnouncements = useCallback(async () => {
    try {
      if (session) {
        const active = await api<AnnouncementItem[]>('/api/announcements/my-active');
        setAnnouncements(active);
      } else {
        const publicActive = await api<AnnouncementItem[]>('/api/announcements/public');
        const dismissedKey = 'candela_dismissed_announcements';
        let dismissedIds: string[] = [];
        try {
          dismissedIds = JSON.parse(localStorage.getItem(dismissedKey) || '[]');
        } catch {
          dismissedIds = [];
        }
        const withLocalState = publicActive.map((a) => ({
          ...a,
          isDismissed: dismissedIds.includes(a.id),
          isRead: dismissedIds.includes(a.id),
        }));
        setAnnouncements(withLocalState);
      }
    } catch (err) {
      // Non-critical, ignore silent failures
    }
  }, [session]);

  useEffect(() => {
    fetchAnnouncements();
    const interval = setInterval(fetchAnnouncements, 60000);
    return () => clearInterval(interval);
  }, [fetchAnnouncements]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setShowDropdown(false);
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backHref) {
      router.push(backHref);
    } else if (onDocIdPage) {
      router.replace(homeHref);
    }
  };

  const handleDismissBanner = async (annId: string) => {
    try {
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === annId ? { ...a, isDismissed: true, isRead: true } : a)),
      );
      if (session) {
        await api(`/api/announcements/${annId}/dismiss`, { method: 'POST' });
      } else {
        const dismissedKey = 'candela_dismissed_announcements';
        let dismissedIds: string[] = [];
        try {
          dismissedIds = JSON.parse(localStorage.getItem(dismissedKey) || '[]');
        } catch {
          dismissedIds = [];
        }
        if (!dismissedIds.includes(annId)) {
          dismissedIds.push(annId);
          localStorage.setItem(dismissedKey, JSON.stringify(dismissedIds));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkRead = async (annId: string) => {
    try {
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === annId ? { ...a, isRead: true } : a)),
      );
      await api(`/api/announcements/${annId}/read`, { method: 'POST' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setAnnouncements((prev) => prev.map((a) => ({ ...a, isRead: true })));
      await api('/api/announcements/read-all', { method: 'POST' });
      toast.info('All notifications marked as read.');
    } catch (err) {
      console.error(err);
    }
  };

  const initialLetter = session?.user?.name ? session.user.name.trim().charAt(0).toUpperCase() : '';
  const unreadCount = announcements.filter((a) => !a.isRead).length;

  // Active top alert banners (critical or warning) that haven't been dismissed yet
  const topBanners = announcements.filter(
    (a) => (a.priority === 'critical' || a.priority === 'warning') && !a.isDismissed,
  );

  return (
    <>
      {/* Dismissible Top Alert Banners */}
      {topBanners.map((banner) => (
        <div
          key={banner.id}
          className={`relative z-50 px-4 py-2.5 flex items-center justify-between text-xs sm:text-sm font-medium transition-all ${
            banner.priority === 'critical'
              ? 'bg-red-600 text-white shadow-md'
              : 'bg-amber-500 text-amber-950 shadow-sm'
          }`}
        >
          <div className="flex items-center gap-2.5 max-w-4xl mx-auto flex-1 min-w-0 pr-4">
            <span className="flex-shrink-0 p-1 rounded-lg bg-black/10">
              {banner.priority === 'critical' ? (
                <AlertCircleIcon className="w-4 h-4 text-white animate-bounce" />
              ) : (
                <MegaphoneIcon className="w-4 h-4 text-amber-950" />
              )}
            </span>
            <div className="truncate">
              <strong className="font-extrabold mr-1.5">{banner.title}:</strong>
              <span className="opacity-95">{banner.content}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleDismissBanner(banner.id)}
            className="p-1 rounded-lg hover:bg-black/10 transition-colors cursor-pointer flex-shrink-0"
            title="Dismiss announcement"
            aria-label="Dismiss banner"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      ))}

      <header className="sticky top-0 z-40 min-h-[72px] flex flex-row items-center justify-between px-4 sm:px-6 py-3 bg-white/95 backdrop-blur-md border-b border-[#F3F4F6] gap-2">
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
            <>
              {/* Notification Bell Dropdown */}
              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  onClick={() => setShowNotifications((prev) => !prev)}
                  className="relative p-2 rounded-xl border border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 transition-all shadow-xs cursor-pointer text-gray-700"
                  aria-expanded={showNotifications}
                  aria-label="Notifications"
                  title="Announcements & Notifications"
                >
                  <BellIcon className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-xs animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-gray-200 shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 divide-y divide-gray-100">
                    {/* Header */}
                    <div className="px-4 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MegaphoneIcon className="w-4 h-4 text-indigo-600" />
                        <span className="text-sm font-bold text-gray-900">Announcements</span>
                        {unreadCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800">
                            {unreadCount} New
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCheckIcon className="w-3.5 h-3.5" />
                          Mark all as read
                        </button>
                      )}
                    </div>

                    {/* Announcement list */}
                    <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                      {announcements.length === 0 ? (
                        <div className="px-4 py-8 text-center text-xs text-gray-400">
                          No active announcements.
                        </div>
                      ) : (
                        announcements.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => handleMarkRead(item.id)}
                            className={`p-3.5 hover:bg-gray-50 transition-colors cursor-pointer flex gap-3 ${
                              !item.isRead ? 'bg-indigo-50/40' : ''
                            }`}
                          >
                            <div className="flex-shrink-0 mt-0.5">
                              {item.priority === 'critical' ? (
                                <span className="w-6 h-6 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                                  <AlertCircleIcon className="w-3.5 h-3.5" />
                                </span>
                              ) : item.priority === 'warning' ? (
                                <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                                  <AlertCircleIcon className="w-3.5 h-3.5" />
                                </span>
                              ) : (
                                <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                                  <MegaphoneIcon className="w-3.5 h-3.5" />
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <p className="text-xs font-bold text-gray-900 truncate">{item.title}</p>
                                {!item.isRead && (
                                  <span className="w-2 h-2 rounded-full bg-indigo-600 flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-xs text-gray-600 line-clamp-3 mt-1 whitespace-pre-line">
                                {item.content}
                              </p>
                              <span className="text-[10px] text-gray-400 block mt-1.5">
                                {new Date(item.createdAt).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User Avatar Dropdown */}
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

      {session?.user.role === 'patient' && (
        <EditPatientNameModal
          isOpen={showEditName}
          onClose={() => setShowEditName(false)}
        />
      )}
    </>
  );
}
