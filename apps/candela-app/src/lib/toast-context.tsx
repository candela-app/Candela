'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';
import { AlertCircleIcon, CheckCircleIcon, InfoIcon, XIcon } from '@/components/icons/VectorIcons';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

interface ToastContextValue {
  toast: {
    success: (message: string, title?: string, duration?: number) => void;
    error: (message: string, title?: string, duration?: number) => void;
    info: (message: string, title?: string, duration?: number) => void;
    warning: (message: string, title?: string, duration?: number) => void;
    show: (item: Omit<ToastItem, 'id'>) => void;
  };
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    ({ type, message, title, duration = 4000 }: Omit<ToastItem, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = { id, type, message, title, duration };
      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast],
  );

  const toast = {
    success: useCallback((message: string, title?: string, duration?: number) => show({ type: 'success', message, title, duration }), [show]),
    error: useCallback((message: string, title?: string, duration?: number) => show({ type: 'error', message, title, duration }), [show]),
    info: useCallback((message: string, title?: string, duration?: number) => show({ type: 'info', message, title, duration }), [show]),
    warning: useCallback((message: string, title?: string, duration?: number) => show({ type: 'warning', message, title, duration }), [show]),
    show,
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="candela-toast-viewport" aria-live="polite">
        {[...toasts].reverse().slice(0, 3).map((t, index) => (
          <div
            key={t.id}
            className="candela-toast-slot"
            style={
              {
                '--toast-index': index,
              } as React.CSSProperties
            }
          >
            <ToastCard toast={t} onClose={() => removeToast(t.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const styles = {
    success: {
      bg: 'bg-emerald-50/95 border-emerald-200 text-emerald-900',
      iconBg: 'bg-emerald-100 text-emerald-600',
      icon: <CheckCircleIcon className="w-5 h-5" />,
    },
    error: {
      bg: 'bg-red-50/95 border-red-200 text-red-900',
      iconBg: 'bg-red-100 text-red-600',
      icon: <AlertCircleIcon className="w-5 h-5" />,
    },
    info: {
      bg: 'bg-blue-50/95 border-blue-200 text-blue-900',
      iconBg: 'bg-blue-100 text-blue-600',
      icon: <InfoIcon className="w-5 h-5" />,
    },
    warning: {
      bg: 'bg-amber-50/95 border-amber-200 text-amber-900',
      iconBg: 'bg-amber-100 text-amber-600',
      icon: <AlertCircleIcon className="w-5 h-5" />,
    },
  }[toast.type];

  return (
    <div
      role="alert"
      className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-xl backdrop-blur-md ${styles.bg}`}
    >
      <div className={`p-1.5 rounded-xl flex-shrink-0 ${styles.iconBg}`}>{styles.icon}</div>
      <div className="flex-1 min-w-0 pt-0.5">
        {toast.title && <p className="text-xs font-bold uppercase tracking-wider opacity-80">{toast.title}</p>}
        <p className="text-sm font-semibold leading-snug">{toast.message}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="p-1 rounded-lg opacity-60 hover:opacity-100 hover:bg-black/5 transition-opacity cursor-pointer flex-shrink-0"
        title="Dismiss"
      >
        <XIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context.toast;
}
