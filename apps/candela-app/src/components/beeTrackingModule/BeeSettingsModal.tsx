'use client';

import React from 'react';
import {
  BeeTracingSettings,
  TracingMode,
  ColorTheme,
  InputSensitivity,
} from '@candela/shared';
import { FloatingLabelInput } from '@/components/ui/FloatingLabelInput';

interface BeeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: BeeTracingSettings;
  onUpdateSettings: (newSettings: Partial<BeeTracingSettings>) => void;
}

export const BeeSettingsModal: React.FC<BeeSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in select-none">
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-amber-500/30 bg-[#12141C] p-6 sm:p-8 text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
          <div>
            <h2 className="text-2xl font-black text-amber-400 flex items-center gap-2">
              <span>🐝</span> Bee Tracing Therapy Settings
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Configure ocular pursuit parameters, low-vision contrast, and tolerance corridors
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-all cursor-pointer text-sm font-bold"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5 text-sm">
          {/* Patient Name */}
          <FloatingLabelInput
            label="Patient / User Name"
            value={settings.patientName}
            onChange={(patientName) => onUpdateSettings({ patientName })}
            variant="dark"
          />

          {/* Tracing Mode Selection */}
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-gray-400 mb-1.5">
              Core Mechanic Mode
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onUpdateSettings({ tracingMode: 'active' })}
                className={`py-3 px-4 rounded-xl border text-left font-bold transition-all cursor-pointer flex flex-col justify-center ${
                  settings.tracingMode === 'active'
                    ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                    : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                <span>Active Trace (Default)</span>
                <span className="text-[11px] font-normal opacity-80 mt-0.5">
                  Patient directly traces visible path line
                </span>
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ tracingMode: 'guided' })}
                className={`py-3 px-4 rounded-xl border text-left font-bold transition-all cursor-pointer flex flex-col justify-center ${
                  settings.tracingMode === 'guided'
                    ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                    : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                <span>Guided Trace (Demo + Recall)</span>
                <span className="text-[11px] font-normal opacity-80 mt-0.5">
                  Bee demos first, patient re-traces faint path
                </span>
              </button>
            </div>
          </div>

          {/* Tolerance Band Width */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs uppercase tracking-wider font-semibold text-gray-400">
                Trace Tolerance Corridor
              </label>
              <span className="text-amber-400 font-bold text-xs">{settings.toleranceBandPx} px band</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Easy (60px)', val: 60 },
                { label: 'Medium (40px)', val: 40 },
                { label: 'Hard (24px)', val: 24 },
              ].map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => onUpdateSettings({ toleranceBandPx: item.val })}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    settings.toleranceBandPx === item.val
                      ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                      : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Low Vision Color Theme */}
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-gray-400 mb-1.5">
              Low-Vision Color Theme
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'standard', label: 'Standard Neutral', bg: '#F5F5F0', text: '#D97706' },
                { id: 'high_contrast', label: 'High Contrast', bg: '#0F172A', text: '#FACC15' },
                { id: 'dark', label: 'Dark Mode', bg: '#121826', text: '#06B6D4' },
              ].map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => onUpdateSettings({ colorTheme: theme.id as ColorTheme })}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                    settings.colorTheme === theme.id
                      ? 'border-amber-400 bg-amber-500/20 text-white'
                      : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <span>{theme.label}</span>
                  <span
                    className="w-4 h-4 rounded-full border border-white/30"
                    style={{ backgroundColor: theme.text }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Audio Cues Toggle */}
          <div className="flex items-center justify-between py-2 border-t border-white/10">
            <div>
              <span className="font-semibold block text-sm">Multisensory Audio Cues</span>
              <span className="text-xs text-gray-400">Bee buzz & success chime sound effects</span>
            </div>
            <button
              type="button"
              onClick={() => onUpdateSettings({ audioEnabled: !settings.audioEnabled })}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                settings.audioEnabled ? 'bg-amber-500' : 'bg-gray-600'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                  settings.audioEnabled ? 'right-0.5' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          {/* Rounds per Set */}
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-gray-400 mb-1.5">
              Rounds per Set
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[5, 7, 10].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => onUpdateSettings({ roundsPerSet: count })}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    settings.roundsPerSet === count
                      ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                      : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {count} Rounds
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto py-3 px-8 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-slate-950 font-black shadow-lg transition-all cursor-pointer"
          >
            Apply & Start Training
          </button>
        </div>
      </div>
    </div>
  );
};
