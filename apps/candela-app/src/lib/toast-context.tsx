'use client';

import { type ReactNode } from 'react';
import { toast as sonner, type ExternalToast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
  position?: ExternalToast['position'];
}

const DEFAULT_POSITION: ExternalToast['position'] = 'top-right';

function toastOptions(title?: string, duration?: number, position?: ExternalToast['position']): ExternalToast {
  return {
    ...(title ? { description: title } : {}),
    duration: duration ?? 4000,
    position: position ?? DEFAULT_POSITION,
  };
}

export const toast = {
  success: (message: string, title?: string, duration?: number, position?: ExternalToast['position']) =>
    sonner.success(message, toastOptions(title, duration, position)),
  error: (message: string, title?: string, duration?: number, position?: ExternalToast['position']) =>
    sonner.error(message, toastOptions(title, duration, position)),
  info: (message: string, title?: string, duration?: number, position?: ExternalToast['position']) =>
    sonner.info(message, toastOptions(title, duration, position)),
  warning: (message: string, title?: string, duration?: number, position?: ExternalToast['position']) =>
    sonner.warning(message, toastOptions(title, duration, position)),
  show: ({ type, message, title, duration, position }: ToastItem) =>
    sonner[type](message, toastOptions(title, duration, position)),
};

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}

export function useToast() {
  return toast;
}
