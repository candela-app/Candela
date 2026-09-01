import React from 'react';
import {
  CLINICAL_BG_COLORS,
  CLINICAL_COLOR_PAIRS,
  CLINICAL_CONTRAST_PRESETS,
  CLINICAL_STIMULUS_COLORS,
  getContrastAdjustedColor,
  matchClinicalPair,
} from './clinical-color';

export function ClinicalLookBadge({
  bgColor,
  stimulusColor,
  contrastPercent,
}: {
  bgColor?: string;
  stimulusColor?: string;
  contrastPercent?: number;
}) {
  if (!bgColor && contrastPercent == null) return null;
  const pair = bgColor && stimulusColor ? matchClinicalPair(bgColor, stimulusColor) : undefined;
  return (
    <div className="flex items-center justify-center gap-2 text-xs text-gray-400 mt-2">
      {bgColor ? (
        <span className="inline-flex items-center gap-1.5" aria-hidden>
          <span className="w-3.5 h-3.5 rounded-md border border-white/25" style={{ backgroundColor: bgColor }} />
          {stimulusColor ? (
            <span className="w-3.5 h-3.5 rounded-full border border-white/30" style={{ backgroundColor: stimulusColor }} />
          ) : null}
        </span>
      ) : null}
      <span className="font-semibold text-gray-300">{pair?.label ?? 'Custom look'}</span>
      {contrastPercent != null ? (
        <>
          <span className="text-gray-600">·</span>
          <span className="font-mono font-bold text-cyan-400">{contrastPercent}%</span>
        </>
      ) : null}
    </div>
  );
}

export function ClinicalColorFields({
  bgColor,
  stimulusColor,
  contrast,
  onBgColor,
  onStimulusColor,
  onContrast,
  hint = 'Field and stimulus are chosen separately. Lower contrast blends the target toward the background.',
}: {
  bgColor: string;
  stimulusColor: string;
  contrast: number;
  onBgColor: (hex: string) => void;
  onStimulusColor: (hex: string) => void;
  onContrast: (value: number) => void;
  hint?: string;
}) {
  const activePair = matchClinicalPair(bgColor, stimulusColor);
  const preview = getContrastAdjustedColor(stimulusColor, bgColor, contrast);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1.5">
          Clinical color pair
        </label>
        <p className="text-[11px] text-gray-500 mb-2">{hint}</p>
        <div className="grid grid-cols-2 gap-2">
          {CLINICAL_COLOR_PAIRS.map((pair) => {
            const active = activePair?.id === pair.id;
            return (
              <button
                key={pair.id}
                type="button"
                onClick={() => {
                  onBgColor(pair.bg);
                  onStimulusColor(pair.stimulus);
                }}
                className={`py-2 px-2 rounded-xl text-[11px] font-bold text-left border transition-all ${
                  active
                    ? 'border-cyan-400 bg-slate-800 text-white'
                    : 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-md border border-white/20" style={{ backgroundColor: pair.bg }} />
                  <span className="w-4 h-4 rounded-full border border-white/30" style={{ backgroundColor: pair.stimulus }} />
                  <span>{pair.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1.5">Field</label>
        <div className="flex flex-wrap gap-2">
          {CLINICAL_BG_COLORS.map((c) => {
            const active = bgColor.toLowerCase() === c.code.toLowerCase();
            return (
              <button
                key={c.code}
                type="button"
                title={c.name}
                onClick={() => onBgColor(c.code)}
                className={`w-9 h-9 rounded-xl border-2 ${active ? 'border-white scale-105' : 'border-transparent opacity-80 hover:opacity-100'}`}
                style={{ backgroundColor: c.code }}
              />
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1.5">Stimulus</label>
        <div className="flex flex-wrap gap-2">
          {CLINICAL_STIMULUS_COLORS.map((c) => {
            const active = stimulusColor.toLowerCase() === c.code.toLowerCase();
            return (
              <button
                key={c.code}
                type="button"
                title={c.name}
                onClick={() => onStimulusColor(c.code)}
                className={`w-9 h-9 rounded-full border-2 ${
                  active ? 'border-white scale-105' : c.code === '#FFFFFF' ? 'border-slate-500' : 'border-transparent opacity-80 hover:opacity-100'
                }`}
                style={{ backgroundColor: c.code }}
              />
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
          <span>Stimulus contrast</span>
          <span className="text-cyan-400 font-mono">{Math.round(contrast * 100)}%</span>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-2">
          {CLINICAL_CONTRAST_PRESETS.map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => onContrast(val)}
              className={`py-2 rounded-xl text-xs font-bold ${
                Math.abs(contrast - val) < 0.02
                  ? 'bg-cyan-400 text-slate-950'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {Math.round(val * 100)}%
            </button>
          ))}
        </div>
        <div className="h-12 rounded-xl border border-gray-700 flex items-center justify-center" style={{ backgroundColor: bgColor }}>
          <span className="text-sm font-black tracking-widest" style={{ color: preview }}>
            Aa 12
          </span>
        </div>
      </div>
    </div>
  );
}
