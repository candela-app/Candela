import React, { useState, useEffect } from 'react';
import { MobileTargetSettings, GameMode, AlphabetVariant } from '@candela/shared';

interface MobileTargetSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: MobileTargetSettings;
  onUpdateSettings: (newSettings: MobileTargetSettings) => void;
  isInitialLaunch?: boolean;
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
    });
    onClose();
  };

  // Sample Symbol Preview Text
  const sampleSymbol =
    settings.gameMode === 'colors'
      ? 'CYAN'
      : settings.gameMode === 'numbers'
      ? '7'
      : settings.alphabetVariant === 'lowercase'
      ? 'a'
      : 'A';

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
                Mobile Pursuit
              </span>
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              Configure patient parameters, stimulus diameter, velocity & target parameters.
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
              <div className="flex-1 flex justify-center items-center py-4 relative w-full h-[180px] overflow-hidden">
                <div
                  className="rounded-full flex items-center justify-center font-black border-4 border-[#00F0FF] shadow-2xl transition-all duration-200 select-none max-w-full max-h-full"
                  style={{
                    width: `${tempBubbleSize}px`,
                    height: `${tempBubbleSize}px`,
                    backgroundColor: '#121626',
                    boxShadow: '0 0 25px rgba(0, 240, 255, 0.5), inset 0 0 10px rgba(0, 240, 255, 0.3)',
                  }}
                >
                  {settings.gameMode === 'colors' ? (
                    <div className="w-8 h-8 rounded-full bg-[#00F0FF] border-2 border-white shadow-md" />
                  ) : (
                    <span
                      className="font-black text-[#00F0FF]"
                      style={{ fontSize: `${tempLetterSize}px` }}
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
                <span className="text-gray-600">|</span>
                <span>
                  Font: <strong className="text-emerald-400 font-bold">{tempLetterSize}px</strong>
                </span>
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
                step="10"
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

          {/* COLUMN 3: SPEED & PATIENT PROFILE */}
          <div className="flex flex-col gap-5 justify-between">
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
