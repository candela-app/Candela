'use client';

import React, { useEffect, useState } from 'react';
import { requestFullScreenSafe, exitFullScreenSafe } from '@candela/shared';
import { ResetConfirmDialog } from './ResetConfirmDialog';

export interface ClinicalSettingSummaryItem {
  label: string;
  value: React.ReactNode;
}

export interface GameMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onQuit: () => void;
  onReset: () => void;
  onOpenSettings?: () => void;
  resetButtonLabel?: string;
  extraControls?: React.ReactNode;
  settingsSummary: ClinicalSettingSummaryItem[];
  sessionInProgress?: boolean;
}

export function GameMenuDrawer({
  isOpen,
  onClose,
  onQuit,
  onReset,
  onOpenSettings,
  resetButtonLabel = 'Reset Game',
  extraControls,
  settingsSummary,
  sessionInProgress = true,
}: GameMenuDrawerProps) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setConfirmReset(false);
      setConfirmQuit(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex justify-end animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-[300px] sm:w-[340px] max-w-[88vw] h-full h-[100dvh] max-h-[100dvh] bg-[#111111] text-white p-5 sm:p-6 flex flex-col gap-4 shadow-2xl overflow-y-auto custom-scrollbar touch-pan-y animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* DRAWER HEADER */}
        <div className="flex justify-between items-center border-b border-gray-800 pb-3 shrink-0">
          <h3 className="text-xl font-bold">Menu</h3>
          <button
            className="text-2xl text-white hover:text-gray-400 cursor-pointer p-1"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* SHARED CORE ACTIONS */}
        <button
          className="w-full py-3 px-4 bg-[#222222] border border-gray-700 rounded-xl text-gray-200 hover:bg-gray-800 font-semibold cursor-pointer transition-colors shrink-0"
          onClick={() => {
            if (sessionInProgress) setConfirmQuit(true);
            else {
              onClose();
              exitFullScreenSafe();
              onQuit();
            }
          }}
        >
          Quit Game
        </button>

        <button
          className="w-full py-3 px-4 bg-[#222222] border border-gray-700 rounded-xl text-gray-200 hover:bg-gray-800 font-semibold cursor-pointer transition-colors shrink-0"
          onClick={() => setConfirmReset(true)}
        >
          {resetButtonLabel}
        </button>

        <button
          className="w-full py-3 px-4 bg-blue-600/20 border border-blue-500/40 rounded-xl text-blue-400 hover:bg-blue-600/30 font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors shrink-0"
          onClick={() => {
            onClose();
            requestFullScreenSafe();
          }}
        >
          <span>Full Screen</span>
          <span>⛶</span>
        </button>

        {onOpenSettings && (
          <button
            className="w-full py-3 px-4 bg-blue-600 border border-blue-500 rounded-xl text-white hover:bg-blue-700 font-semibold cursor-pointer transition-colors shrink-0"
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
          >
            Open Settings
          </button>
        )}

        {/* GAME-SPECIFIC EXTRA CONTROLS (e.g. Speed buttons) */}
        {extraControls}

        {/* GAME-SPECIFIC CLINICAL SETTINGS SUMMARY */}
        {settingsSummary.length > 0 && (
          <div className="pt-4 mt-2 border-t border-gray-800 flex flex-col gap-2 shrink-0 pb-10 mb-6">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Current Clinical Settings
            </div>
            <div className="bg-[#181818] p-3.5 rounded-xl border border-gray-800 text-xs text-gray-300 flex flex-col gap-2.5 shadow-inner">
              {settingsSummary.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <span className="text-gray-400">{item.label}:</span>
                  <span className="font-semibold text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <ResetConfirmDialog
        isOpen={confirmReset}
        confirmLabel={resetButtonLabel}
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          onClose();
          onReset();
        }}
      />
      <ResetConfirmDialog
        isOpen={confirmQuit}
        title="Leave this game?"
        message="This session isn't finished yet. If you leave now, the current progress will be lost."
        confirmLabel="Leave"
        onCancel={() => setConfirmQuit(false)}
        onConfirm={() => {
          setConfirmQuit(false);
          onClose();
          exitFullScreenSafe();
          onQuit();
        }}
      />
    </div>
  );
}
