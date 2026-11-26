'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AnnouncementItem, SessionUser } from '@candela/shared';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import {
  AlertCircleIcon,
  BellIcon,
  CheckCheckIcon,
  ChevronDownIcon,
  LogOutIcon,
  MegaphoneIcon,
  PencilIcon,
  UserIcon,
  XIcon,
} from '@/components/icons/VectorIcons';

export function AnnouncementBanners({
  banners,
  onDismiss,
}: {
  banners: AnnouncementItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <>
      {banners.map((banner) => (
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
            onClick={() => onDismiss(banner.id)}
            className="p-1 rounded-lg hover:bg-black/10 transition-colors cursor-pointer flex-shrink-0"
            title="Dismiss announcement"
            aria-label="Dismiss banner"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      ))}
    </>
  );
}

export function NotificationBellControl({
  announcements,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  buttonClassName,
}: {
  announcements: AnnouncementItem[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  buttonClassName?: string;
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
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

  return (
    <div className="relative" ref={notifRef}>
      <button
        type="button"
        onClick={() => setShowNotifications((prev) => !prev)}
        className={
          buttonClassName ||
          'relative p-2 rounded-xl border border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 transition-all shadow-xs cursor-pointer text-gray-700'
        }
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
                onClick={onMarkAllRead}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                <CheckCheckIcon className="w-3.5 h-3.5" />
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
            {announcements.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-gray-400">
                No active announcements.
              </div>
            ) : (
              announcements.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onMarkRead(item.id)}
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
  );
}

export function AccountAvatarControl({
  session,
  onEditPatientName,
  profileHref,
  buttonClassName,
  avatarClassName,
  showName = false,
}: {
  session: SessionUser;
  onEditPatientName?: () => void;
  profileHref?: string;
  buttonClassName?: string;
  avatarClassName?: string;
  showName?: boolean;
}) {
  const { logout } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const initialLetter = session?.user?.name ? session.user.name.trim().charAt(0).toUpperCase() : '';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setShowDropdown((prev) => !prev)}
        className={
          buttonClassName ||
          'flex items-center gap-1.5 p-1 sm:px-2 sm:py-1 rounded-xl border border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 transition-all shadow-xs cursor-pointer active:scale-95'
        }
        aria-expanded={showDropdown}
        aria-label="Account menu"
      >
        <div
          className={
            avatarClassName ||
            'w-7 h-7 rounded-lg bg-shell-blue text-white font-bold text-xs flex items-center justify-center uppercase select-none'
          }
        >
          {initialLetter || <UserIcon className="w-3.5 h-3.5" />}
        </div>
        {showName && (
          <span className="hidden md:inline max-w-[130px] truncate text-xs font-semibold text-current">
            {session.user.name}
          </span>
        )}
        <ChevronDownIcon
          className={`w-3.5 h-3.5 text-gray-500 transition-transform ${
            showDropdown ? 'rotate-180' : ''
          }`}
        />
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-shell-border shadow-xl py-2 z-50 animate-fade-in divide-y divide-gray-100">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span
                className="text-sm font-bold text-shell-text truncate max-w-[170px]"
                title={session.user.name}
              >
                {session.user.name}
              </span>
              {session.user.role === 'patient' && onEditPatientName && (
                <button
                  type="button"
                  onClick={() => {
                    setShowDropdown(false);
                    onEditPatientName();
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

          {profileHref && (
            <div className="py-1">
              <Link
                href={profileHref}
                onClick={() => setShowDropdown(false)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors text-left"
              >
                <UserIcon className="w-4 h-4 text-gray-500" />
                My Profile
              </Link>
            </div>
          )}

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
  );
}
