'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AnnouncementItem } from '@candela/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';

const DISMISSED_STORAGE_KEY = 'candela_dismissed_announcements';

export function useAnnouncements() {
  const { session } = useAuth();
  const toast = useToast();
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);

  const fetchAnnouncements = useCallback(async () => {
    try {
      if (session) {
        const active = await api<AnnouncementItem[]>('/api/announcements/my-active');
        setAnnouncements(active);
      } else {
        const publicActive = await api<AnnouncementItem[]>('/api/announcements/public');
        let dismissedIds: string[] = [];
        try {
          dismissedIds = JSON.parse(localStorage.getItem(DISMISSED_STORAGE_KEY) || '[]');
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
    } catch {
      // Non-critical, ignore silent failures
    }
  }, [session]);

  useEffect(() => {
    fetchAnnouncements();

    if (!session) {
      return;
    }

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }
      fetchAnnouncements();
    }, 180000);

    return () => clearInterval(interval);
  }, [fetchAnnouncements, session]);

  const dismissBanner = useCallback(
    async (annId: string) => {
      try {
        setAnnouncements((prev) =>
          prev.map((a) => (a.id === annId ? { ...a, isDismissed: true, isRead: true } : a)),
        );
        if (session) {
          await api(`/api/announcements/${annId}/dismiss`, { method: 'POST' });
        } else {
          let dismissedIds: string[] = [];
          try {
            dismissedIds = JSON.parse(localStorage.getItem(DISMISSED_STORAGE_KEY) || '[]');
          } catch {
            dismissedIds = [];
          }
          if (!dismissedIds.includes(annId)) {
            dismissedIds.push(annId);
            localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(dismissedIds));
          }
        }
      } catch (err) {
        console.error(err);
      }
    },
    [session],
  );

  const markRead = useCallback(async (annId: string) => {
    try {
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === annId ? { ...a, isRead: true } : a)),
      );
      await api(`/api/announcements/${annId}/read`, { method: 'POST' });
    } catch (err) {
      console.error(err);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      setAnnouncements((prev) => prev.map((a) => ({ ...a, isRead: true })));
      await api('/api/announcements/read-all', { method: 'POST' });
      toast.info('All notifications marked as read.');
    } catch (err) {
      console.error(err);
    }
  }, [toast]);

  const unreadCount = announcements.filter((a) => !a.isRead).length;
  const topBanners = announcements.filter(
    (a) => (a.priority === 'critical' || a.priority === 'warning') && !a.isDismissed,
  );

  return {
    announcements,
    unreadCount,
    topBanners,
    dismissBanner,
    markRead,
    markAllRead,
  };
}
