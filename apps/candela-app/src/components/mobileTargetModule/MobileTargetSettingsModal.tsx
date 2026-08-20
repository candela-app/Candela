import React, { useState, useEffect } from 'react';
import { MobileTargetSettings, THERAPY_COLOR_ITEMS } from '@candela/shared';

interface MobileTargetSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: MobileTargetSettings;
  onUpdateSettings: (newSettings: MobileTargetSettings) => void;
  isInitialLaunch?: boolean;
}

export function getContrastTextColor(hexColor: string): '#000000' | '#FFFFFF' {
  if (!hexColor) return '#FFFFFF';
  const hex = hexColor.replace('#', '');
  if (hex.length !== 6) return '#FFFFFF';
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? '#000000' : '#FFFFFF';
}

export function MobileTargetSettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  isInitialLaunch = false,
}: MobileTargetSettingsModalProps) {
  // Temporary state for form controls
  const [tempPatientName, setTempPatientName] = useState<string>(settings.patientName);
  const [tempSpeed, setTempSpeed] = useState<number>(settings.speedPxPerSec);
  const [tempSetDuration, setTempSetDuration] = useState<number>(settings.setDurationSec);
  const [tempTotalSets, setTempTotalSets] = useState<number>(settings.totalSets);
  const [tempBubbleSize, setTempBubbleSize] = useState<number>(settings.bubbleSize || 96);
  const [tempLetterSize, setTempLetterSize] = useState<number>(settings.letterSize || 32);
  const [tempMovementAxis, setTempMovementAxis] = useState<'horizontal' | 'vertical' | 'random'>(
    settings.movementAxis || 'random'
  );
  const [tempHasBackground, setTempHasBackground] = useState<boolean>(
    settings.hasBackground ?? false
  );
  const [tempTherapyColors, setTempTherapyColors] = useState<string[]>(
    settings.therapyColors?.length ? settings.therapyColors : THERAPY_COLOR_ITEMS.map((item) => item.code)
  );

  // Sync state on open
  useEffect(() => {
    if (isOpen) {
      setTempPatientName(settings.patientName);
      setTempSpeed(settings.speedPxPerSec);
      setTempSetDuration(settings.setDurationSec);
      setTempTotalSets(settings.totalSets);
      setTempBubbleSize(settings.bubbleSize || 96);
      setTempLetterSize(settings.letterSize || 32);
      setTempMovementAxis(settings.movementAxis || 'random');
      setTempHasBackground(settings.hasBackground ?? false);
      setTempTherapyColors(
        settings.therapyColors?.length ? settings.therapyColors : THERAPY_COLOR_ITEMS.map((item) => item.code)
      );
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleApply = () => {
    onUpdateSettings({
      patientName: tempPatientName,
      gameMode: settings.gameMode,
      alphabetVariant: settings.alphabetVariant,
      speedPxPerSec: tempSpeed,
      setDurationSec: tempSetDuration,
      totalSets: tempTotalSets,
      bubbleSize: tempBubbleSize,
      letterSize: tempLetterSize,
      movementAxis: tempMovementAxis,
      hasBackground: tempHasBackground,
      therapyColors: tempTherapyColors,
    });
    onClose();
  };

  // Sample Symbol Preview Text
  const sampleSymbol =
    settings.gameMode === 'colors'
      ? THERAPY_COLOR_ITEMS.find((item) =>
          tempTherapyColors.some((hex) => hex.toLowerCase() === item.code.toLowerCase())
        )?.name || 'Yellow'
      : settings.gameMode === 'numbers'
      ? '7'
      : settings.alphabetVariant === 'lowercase'
      ? 'a'
      : 'A';

  const previewColor =
    THERAPY_COLOR_ITEMS.find((item) =>
      tempTherapyColors.some((hex) => hex.toLowerCase() === item.code.toLowerCase())
    )?.code || '#00F0FF';
  const previewFilled = tempHasBackground;
  const previewBg = previewFilled ? previewColor : '#121626';
  const previewTextColor = previewFilled ? getContrastTextColor(previewColor) : previewColor;

  return (
    <div
      className="fixed inset-0 z-[999] flex justify-center items-start sm:items-center p-4 sm:p-6 md:p-8 overflow-y-auto backdrop-blur-md touch-pan-y custom-scrollbar"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
    >
      <div
        className="bg-[#1A1A1A] text-white rounded-2xl sm:rounded-3xl w-[96vw] sm:w-[94vw] max-w-[1250px] my-auto flex flex-col justify-between gap-6 p-6 sm:p-8 border border-gray-700/80 shadow-2xl opacity-100"
        style={{ backgroundColor: '#1A1A1A' }}
      >
        {/* HEADER BAR */}
        <div className="flex justify-between items-center border-b border-gray-800 pb-4">
          <div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-wide flex items-center gap-3 flex-wrap">
              Clinical Configuration
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-widest">
                Bubble Chase
              </span>
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              Configure patient parameters, stimulus diameter, velocity & background style.
            </p>
          </div>

          <button
            className="w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 flex items-center justify-center transition-all text-lg shadow-md cursor-pointer shrink-0"
            onClick={onClose}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* CLINICAL CONTROL GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch w-full">
          {/* COLUMN 1: LIVE PREVIEW CARD */}
          <div className="flex flex-col h-full justify-between">
            <div
              className="bg-[#0D0D0D] p-6 rounded-2xl border border-gray-800 flex flex-col items-center justify-between gap-4 overflow-hidden shadow-inner relative h-full min-h-[260px] sm:min-h-[280px]"
              style={{ backgroundColor: '#0D0D0D' }}
            >
              <div className="w-full flex items-center justify-between text-xs font-extrabold text-emerald-400 uppercase tracking-widest border-b border-gray-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                  <span>Target Live Preview</span>
                </div>
                <span className="text-gray-500 font-mono text-[10px] capitalize">{settings.gameMode}</span>
              </div>

              {/* LIVE TARGET BUBBLE DISPLAY */}
              <div className="flex-1 flex justify-center items-center py-4 relative w-full min-h-[180px] overflow-hidden">
                <div
                  className="rounded-full flex items-center justify-center font-black transition-all duration-200 select-none shrink-0"
                  style={{
                    width: `${tempBubbleSize}px`,
                    height: `${tempBubbleSize}px`,
                    backgroundColor: previewBg,
                    border: previewFilled ? '3px solid #FFFFFF' : `4px solid ${previewColor}`,
                    boxShadow: 'none',
                  }}
                >
                  {settings.gameMode === 'colors' ? null : (
                    <span
                      className="font-black"
                      style={{
                        fontSize: `${tempLetterSize}px`,
                        color: previewTextColor,
                      }}
                    >
                      {sampleSymbol}
                    </span>
                  )}
                </div>
              </div>

              <div
                className="flex justify-around w-full text-xs text-gray-300 font-mono px-4 py-2.5 rounded-xl border border-gray-800 shadow-md"
                style={{ backgroundColor: '#141414' }}
              >
                <span>
                  Bubble: <strong className="text-emerald-400 font-bold">{tempBubbleSize}px</strong>
                </span>
                {settings.gameMode !== 'colors' ? (
                  <>
                    <span className="text-gray-600">|</span>
                    <span>
                      Font: <strong className="text-emerald-400 font-bold">{tempLetterSize}px</strong>
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {/* COLUMN 2: BUBBLE GEOMETRY & FONT SIZE */}
          <div className="flex flex-col gap-5 justify-between">
            {/* BUBBLE DIAMETER CONTROL */}
            <div
              className="bg-[#242424] p-5 rounded-2xl border border-gray-800 flex flex-col gap-3 shadow-lg"
              style={{ backgroundColor: '#242424' }}
            >
              <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                <span className="text-xs font-extrabold text-gray-200 uppercase tracking-wider">
                  Bubble Diameter
                </span>
                <span className="font-black text-emerald-400 font-mono text-base">{tempBubbleSize}px</span>
              </div>

              <input
                type="range"
                min="60"
                max="130"
                step="5"
                className="w-full accent-emerald-500 cursor-pointer h-2.5 my-1"
                value={tempBubbleSize}
                onChange={(e) => setTempBubbleSize(parseInt(e.target.value, 10))}
              />

              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { label: 'Medium (80px)', val: 80 },
                  { label: 'Large (96px)', val: 96 },
                  { label: 'Extra (112px)', val: 112 },
                ].map((sz) => (
                  <button
                    key={sz.val}
                    type="button"
                    onClick={() => setTempBubbleSize(sz.val)}
                    className={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all ${
                      tempBubbleSize === sz.val
                        ? 'bg-emerald-500 text-slate-950 shadow-md'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {sz.label}
                  </button>
                ))}
              </div>
            </div>

            {/* FONT SIZE CONTROL */}
            {settings.gameMode !== 'colors' ? (
            <div
              className="bg-[#242424] p-5 rounded-2xl border border-gray-800 flex flex-col gap-3 shadow-lg"
              style={{ backgroundColor: '#242424' }}
            >
              <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                <span className="text-xs font-extrabold text-gray-200 uppercase tracking-wider">
                  Target Font Size
                </span>
                <span className="font-black text-emerald-400 font-mono text-base">{tempLetterSize}px</span>
              </div>

              <input
                type="range"
                min="18"
                max="48"
                step="2"
                className="w-full accent-emerald-500 cursor-pointer h-2.5 my-1"
                value={tempLetterSize}
                onChange={(e) => setTempLetterSize(parseInt(e.target.value, 10))}
              />

              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { label: 'Standard (28px)', val: 28 },
                  { label: 'Large (36px)', val: 36 },
                  { label: 'Extra (44px)', val: 44 },
                ].map((fs) => (
                  <button
                    key={fs.val}
                    type="button"
                    onClick={() => setTempLetterSize(fs.val)}
                    className={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all ${
                      tempLetterSize === fs.val
                        ? 'bg-emerald-500 text-slate-950 shadow-md'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {fs.label}
                  </button>
                ))}
              </div>
            </div>
            ) : null}

            {/* MOVEMENT AXIS CONTROL */}
            <div
              className="bg-[#242424] p-5 rounded-2xl border border-gray-800 flex flex-col gap-2.5 shadow-lg"
              style={{ backgroundColor: '#242424' }}
            >
              <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                <span className="text-xs font-extrabold text-gray-200 uppercase tracking-wider">
                  Movement Axis / Direction
                </span>
                <span className="font-black text-blue-400 font-mono text-xs uppercase">{tempMovementAxis}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { id: 'horizontal', label: '↔ Horizontal' },
                  { id: 'vertical', label: '↕ Vertical' },
                  { id: 'random', label: '🔀 Random 2D' },
                ].map((axis) => (
                  <button
                    key={axis.id}
                    type="button"
                    onClick={() => setTempMovementAxis(axis.id as any)}
                    className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all ${
                      tempMovementAxis === axis.id
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {axis.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* COLUMN 3: BACKGROUND STYLE, SPEED & PATIENT PROFILE */}
          <div className="flex flex-col gap-5 justify-between">
            {/* BUBBLE BACKGROUND STYLE RADIO BUTTONS */}
            <div
              className="bg-[#242424] p-5 rounded-2xl border border-gray-800 flex flex-col gap-3 shadow-lg"
              style={{ backgroundColor: '#242424' }}
            >
              <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                <span className="text-xs font-extrabold text-gray-200 uppercase tracking-wider">
                  Bubble Fill / Background
                </span>
                <span className="font-black text-emerald-400 font-mono text-xs uppercase">
                  {tempHasBackground ? 'With Background' : 'No Background'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <label
                  onClick={() => setTempHasBackground(false)}
                  className={`flex items-center gap-2.5 p-3 rounded-xl cursor-pointer border transition-all text-xs font-bold ${
                    !tempHasBackground
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="bubbleBackgroundOption"
                    checked={!tempHasBackground}
                    onChange={() => setTempHasBackground(false)}
                    className="accent-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <span>⭕ No Background</span>
                </label>

                <label
                  onClick={() => setTempHasBackground(true)}
                  className={`flex items-center gap-2.5 p-3 rounded-xl cursor-pointer border transition-all text-xs font-bold ${
                    tempHasBackground
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="bubbleBackgroundOption"
                    checked={tempHasBackground}
                    onChange={() => setTempHasBackground(true)}
                    className="accent-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <span>🟢 With Background</span>
                </label>
              </div>
            </div>

            {/* PATIENT PROFILE */}
            <div
              className="bg-[#242424] p-5 rounded-2xl border border-gray-800 flex flex-col gap-3 shadow-lg"
              style={{ backgroundColor: '#242424' }}
            >
              <label className="text-xs font-extrabold text-gray-200 uppercase tracking-wider">
                Patient Profile
              </label>
              <input
                type="text"
                className="w-full p-3 bg-[#141414] border border-gray-700 rounded-xl text-white outline-none focus:border-emerald-500 font-medium text-sm transition-all shadow-inner"
                style={{ backgroundColor: '#141414' }}
                value={tempPatientName}
                placeholder="Enter patient name..."
                onChange={(e) => setTempPatientName(e.target.value)}
              />
            </div>

            {/* BUBBLE TRAVEL SPEED */}
            <div
              className="bg-[#242424] p-5 rounded-2xl border border-gray-800 flex flex-col gap-3 shadow-lg"
              style={{ backgroundColor: '#242424' }}
            >
              <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                <span className="text-xs font-extrabold text-gray-200 uppercase tracking-wider">
                  Bubble Travel Speed
                </span>
                <span className="font-black text-cyan-400 font-mono text-base">{tempSpeed} px/s</span>
              </div>

              <input
                type="range"
                min="30"
                max="180"
                step="5"
                className="w-full accent-cyan-500 cursor-pointer h-2.5 my-1"
                value={tempSpeed}
                onChange={(e) => setTempSpeed(parseInt(e.target.value, 10))}
              />

              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {[
                  { label: 'Ultra (40)', val: 40 },
                  { label: 'Gentle (70)', val: 70 },
                  { label: 'Mod (100)', val: 100 },
                  { label: 'Active (140)', val: 140 },
                ].map((spd) => (
                  <button
                    key={spd.val}
                    type="button"
                    onClick={() => setTempSpeed(spd.val)}
                    className={`py-1.5 px-1 text-center rounded-xl text-[10px] font-bold transition-all ${
                      tempSpeed === spd.val
                        ? 'bg-cyan-500 text-slate-950 shadow-md'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {spd.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {settings.gameMode === 'colors' ? (
          <div
            className="bg-[#242424] p-5 rounded-2xl border border-gray-800 flex flex-col gap-3 shadow-lg"
            style={{ backgroundColor: '#242424' }}
          >
            <div className="flex justify-between items-center border-b border-gray-800 pb-2">
              <span className="text-xs font-extrabold text-gray-200 uppercase tracking-wider">
                Therapy Colors
              </span>
              <span className="font-black text-cyan-400 font-mono text-xs uppercase">
                {tempTherapyColors.length} selected
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Simple names children know. Keep at least two selected.
            </p>
            <div className="flex flex-wrap gap-3">
              {THERAPY_COLOR_ITEMS.map((item) => {
                const active = tempTherapyColors.some(
                  (hex) => hex.toLowerCase() === item.code.toLowerCase()
                );
                return (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => {
                      setTempTherapyColors((prev) => {
                        const on = prev.some((hex) => hex.toLowerCase() === item.code.toLowerCase());
                        if (on) {
                          if (prev.length <= 2) return prev;
                          return prev.filter((hex) => hex.toLowerCase() !== item.code.toLowerCase());
                        }
                        return [...prev, item.code];
                      });
                    }}
                    className="flex flex-col items-center gap-1.5 min-w-[52px]"
                  >
                    <span
                      className="w-9 h-9 rounded-full"
                      style={{
                        backgroundColor: '#121626',
                        border: `3px solid ${item.code}`,
                        outline: active ? '2px solid #FFFFFF' : 'none',
                        outlineOffset: 2,
                      }}
                    />
                    <span className={`text-[10px] font-extrabold ${active ? 'text-white' : 'text-gray-500'}`}>
                      {item.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* MODAL FOOTER ACTIONS */}
        <div className="flex justify-end items-center gap-4 border-t border-gray-800 pt-4 mt-1">
          <button
            className="px-7 py-3 rounded-xl bg-gray-800/90 hover:bg-gray-700 text-gray-300 hover:text-white font-semibold transition-all border border-gray-700 text-sm cursor-pointer shadow-md active:scale-95"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-9 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer flex items-center gap-2.5"
            onClick={handleApply}
          >
            <span>{isInitialLaunch ? 'Start Session' : 'Save & Apply Settings'}</span>
            <span className="text-base">✓</span>
          </button>
        </div>
      </div>
    </div>
  );
}
