'use client';

import React from 'react';
import { moduleCta, type TherapyModuleId } from '@candela/shared';
import { SlidersIcon, XIcon } from '../icons/VectorIcons';

export interface ClickToStartOverlayProps {
  title: string;
  hint?: string;
  onStart: () => void;
  onOpenSettings?: () => void;
  onExit?: () => void;
  startLabel?: string;
  /** Start button uses this module's dashboard bar color. */
  accentModuleId?: TherapyModuleId;
  /** Replace the default start button (e.g. Peripheral triangle). */
  children?: React.ReactNode;
}

/**
 * Clean pre-play gate: title + start CTA, with corner X (back to module menu)
 * and settings icon — no separate "Edit Clinical Settings" text button.
 */
export function ClickToStartOverlay({
  title,
  hint,
  onStart,
  onOpenSettings,
  onExit,
  startLabel = 'Click to Start',
  accentModuleId,
  children,
}: ClickToStartOverlayProps) {
  const cta = moduleCta(accentModuleId ?? 'mobile_target');
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-center items-center gap-4 p-6 text-center select-none"
      style={{ backgroundColor: '#06070D' }}
    >
      {onExit ? (
        <button
          type="button"
          onClick={onExit}
          className="absolute top-4 left-4 z-10 w-11 h-11 rounded-full bg-gray-900/70 border border-gray-700/80 text-gray-300 hover:text-white hover:bg-gray-800 flex items-center justify-center cursor-pointer active:scale-95 transition-colors"
          title="Back to menu"
          aria-label="Back to menu"
        >
          <XIcon className="w-5 h-5" />
        </button>
      ) : null}

      {onOpenSettings ? (
      <button
        type="button"
        onClick={onOpenSettings}
        className="absolute top-4 right-4 z-10 w-11 h-11 rounded-full bg-gray-900/70 border border-gray-700/80 text-gray-300 hover:text-cyan-300 hover:bg-gray-800 flex items-center justify-center cursor-pointer active:scale-95 transition-colors"
        title="Clinical settings"
        aria-label="Open clinical settings"
      >
        <SlidersIcon className="w-5 h-5" />
      </button>
      ) : null}

      <h2 className="text-2xl sm:text-3xl font-black text-white max-w-xl px-12">{title}</h2>
      {hint ? (
        <p className="text-sm text-gray-400 font-semibold max-w-md leading-relaxed -mt-1">{hint}</p>
      ) : null}

      {children ?? (
        <button
          type="button"
          onClick={onStart}
          className="px-8 py-4 rounded-full font-black text-xl cursor-pointer active:scale-95"
          style={{ backgroundColor: cta.bar, color: cta.ink }}
          title="Click to Start Therapy Session"
        >
          {startLabel}
        </button>
      )}
    </div>
  );
}
