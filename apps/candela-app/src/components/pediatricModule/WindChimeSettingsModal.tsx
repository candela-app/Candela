'use client';

import React, { useState } from 'react';
import {
  WindChimeSettings,
  ChimeScalePreset,
  SensoryTheme,
  TouchSensitivity,
} from '@candela/shared';
import { X, Volume2, Sliders, Sparkles, Clock, Eye } from 'lucide-react';

export interface WindChimeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: WindChimeSettings;
  onApply: (settings: WindChimeSettings) => void;
}

export const WindChimeSettingsModal: React.FC<WindChimeSettingsModalProps> = ({
  isOpen,
  onClose,
  currentSettings,
  onApply,
}) => {
  const [draft, setDraft] = useState<WindChimeSettings>(currentSettings);

  // Sync draft when opened
  React.useEffect(() => {
    if (isOpen) {
      setDraft(currentSettings);
    }
  }, [isOpen, currentSettings]);

  if (!isOpen) return null;

  const handleSave = () => {
    onApply(draft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">Clinical & Sensory Settings</h2>
              <p className="text-xs text-zinc-400">Pediatric Wind Chime & Auditory Harmony</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-zinc-300">
          {/* Section 1: Auditory & Musical Tuning */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-amber-400 font-semibold uppercase tracking-wider text-xs">
              <Volume2 className="w-4 h-4" />
              <span>Auditory & Musical Tuning</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  id: 'koshi_aria',
                  name: 'Koshi Aria (Air)',
                  desc: 'A C E A B C — Uplifting, light & airy',
                },
                {
                  id: 'koshi_terra',
                  name: 'Koshi Terra (Earth)',
                  desc: 'G C E F G C — Grounding, resonant & deep',
                },
                {
                  id: 'pentatonic_major',
                  name: 'Pentatonic Major',
                  desc: 'C D E G A C — Joyful, child-friendly harmony',
                },
                {
                  id: 'zen_solfeggio',
                  name: 'Zen Solfeggio',
                  desc: '396 - 852 Hz — Meditative sound-bath frequencies',
                },
              ].map((scale) => (
                <button
                  key={scale.id}
                  type="button"
                  onClick={() => setDraft({ ...draft, scalePreset: scale.id as ChimeScalePreset })}
                  className={`text-left p-3 rounded-xl border transition ${
                    draft.scalePreset === scale.id
                      ? 'bg-amber-500/15 border-amber-500 text-white font-medium shadow-md shadow-amber-500/10'
                      : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <div className="font-semibold">{scale.name}</div>
                  <div className="text-xs text-zinc-400 mt-1">{scale.desc}</div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Resonance Sustain: <span className="text-amber-400 font-semibold">{draft.decayDurationSec}s</span>
                </label>
                <input
                  type="range"
                  min="1.5"
                  max="5.0"
                  step="0.5"
                  value={draft.decayDurationSec}
                  onChange={(e) => setDraft({ ...draft, decayDurationSec: parseFloat(e.target.value) })}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/60 border border-zinc-700/60">
                <div>
                  <div className="font-medium text-zinc-200">Binaural Stereo Panning</div>
                  <div className="text-xs text-zinc-400">Pans left/right chime tubes across ears</div>
                </div>
                <input
                  type="checkbox"
                  checked={draft.stereoPanning}
                  onChange={(e) => setDraft({ ...draft, stereoPanning: e.target.checked })}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          <hr className="border-zinc-800" />

          {/* Section 2: Motor Accessibility & Target Scaling */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold uppercase tracking-wider text-xs">
              <Sparkles className="w-4 h-4" />
              <span>Motor Accessibility & Touch Sensitivity</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'gentle', label: '🪶 Gentle', desc: 'High response for hypotonia / soft touches' },
                { id: 'normal', label: '🍃 Standard', desc: 'Balanced velocity curve' },
                { id: 'firm', label: '⚡ Firm', desc: 'Requires deliberate swipe force' },
              ].map((sens) => (
                <button
                  key={sens.id}
                  type="button"
                  onClick={() => setDraft({ ...draft, touchSensitivity: sens.id as TouchSensitivity })}
                  className={`p-3 rounded-xl border text-center transition ${
                    draft.touchSensitivity === sens.id
                      ? 'bg-emerald-500/15 border-emerald-500 text-white font-medium'
                      : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <div className="font-semibold text-xs">{sens.label}</div>
                  <div className="text-[10px] text-zinc-400 mt-1 leading-tight">{sens.desc}</div>
                </button>
              ))}
            </div>

            <div className="pt-2">
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Chime & Target Scale: <span className="text-emerald-400 font-semibold">{Math.round(draft.chimeScale * 100)}%</span>
              </label>
              <input
                type="range"
                min="0.85"
                max="1.35"
                step="0.05"
                value={draft.chimeScale}
                onChange={(e) => setDraft({ ...draft, chimeScale: parseFloat(e.target.value) })}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>

          <hr className="border-zinc-800" />

          {/* Section 3: Sensory Ambience & Environment */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sky-400 font-semibold uppercase tracking-wider text-xs">
              <Eye className="w-4 h-4" />
              <span>Sensory Environment & Visual Ambience</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'garden', label: '🌿 Sunlit Garden', bg: 'from-emerald-900 to-green-950' },
                { id: 'twilight', label: '🌌 Twilight Sky', bg: 'from-slate-900 to-indigo-950' },
                { id: 'warm_sunset', label: '🌅 Amber Sunset', bg: 'from-amber-900 to-orange-950' },
                { id: 'high_contrast', label: '🔲 High Contrast', bg: 'from-black to-zinc-950' },
              ].map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setDraft({ ...draft, sensoryTheme: theme.id as SensoryTheme })}
                  className={`p-2.5 rounded-xl border text-center transition bg-gradient-to-br ${theme.bg} ${
                    draft.sensoryTheme === theme.id
                      ? 'border-sky-400 ring-2 ring-sky-400/30 font-semibold text-white'
                      : 'border-zinc-700/60 text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  <div className="text-xs">{theme.label}</div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Ambient Breeze: <span className="text-sky-400 font-semibold">{Math.round(draft.ambientBreeze * 100)}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="0.8"
                  step="0.1"
                  value={draft.ambientBreeze}
                  onChange={(e) => setDraft({ ...draft, ambientBreeze: parseFloat(e.target.value) })}
                  className="w-full accent-sky-400 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/60 border border-zinc-700/60">
                <div>
                  <div className="font-medium text-zinc-200">Visual Resonance Ripple</div>
                  <div className="text-xs text-zinc-400">Radiates glowing ring on chime contact</div>
                </div>
                <input
                  type="checkbox"
                  checked={draft.visualRipple}
                  onChange={(e) => setDraft({ ...draft, visualRipple: e.target.checked })}
                  className="w-4 h-4 accent-sky-400 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          <hr className="border-zinc-800" />

          {/* Section 4: Session Duration */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-violet-400 font-semibold uppercase tracking-wider text-xs">
              <Clock className="w-4 h-4" />
              <span>Therapy Session Duration</span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[
                { sec: 60, label: '1 Minute' },
                { sec: 120, label: '2 Minutes' },
                { sec: 300, label: '5 Minutes' },
                { sec: 0, label: 'Free Play' },
              ].map((dur) => (
                <button
                  key={dur.sec}
                  type="button"
                  onClick={() => setDraft({ ...draft, sessionDurationSec: dur.sec })}
                  className={`p-2.5 rounded-xl border text-center transition ${
                    draft.sessionDurationSec === dur.sec
                      ? 'bg-violet-500/20 border-violet-500 text-white font-semibold'
                      : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <div className="text-xs">{dur.label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800 bg-zinc-900/90">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold transition text-sm shadow-lg shadow-amber-500/20"
          >
            Apply Settings
          </button>
        </div>
      </div>
    </div>
  );
};
