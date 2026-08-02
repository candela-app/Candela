import React, { useState, useEffect } from 'react';
import { requestFullScreenSafe } from './game-logic';
import { SPEED_PRESETS } from './constants';

export interface AppliedClinicalSettings {
  patientName: string;
  letterSize: number;
  bubbleSize: number;
  speed?: number;
  wheelColor?: string;
}

export interface ClinicalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (settings: AppliedClinicalSettings) => void;
  patientName: string;
  letterSize: number;
  bubbleSize: number;
  speed?: number;
  wheelColor?: string;
  showSpeedControl?: boolean;
  showWheelColorControl?: boolean;
  sampleSymbol?: string;
  extraStats?: React.ReactNode;
}

/**
 * Reusable Clinical Settings Modal for Vision Therapy & Rehabilitation Modules.
 * Includes Live Bubble/Letter Preview, stepped size presets (letter 1.0-3.0rem, bubble 50-130px),
 * patient name input, speed controls, wheel color picker, and stats integration.
 */
export function ClinicalSettingsModal({
  isOpen,
  onClose,
  onApply,
  patientName,
  letterSize,
  bubbleSize,
  speed = 1,
  wheelColor = '#000000',
  showSpeedControl = false,
  showWheelColorControl = false,
  sampleSymbol = 'A',
  extraStats,
}: ClinicalSettingsModalProps) {
  const [tempPatientName, setTempPatientName] = useState<string>(patientName);
  const [tempLetterSize, setTempLetterSize] = useState<number>(letterSize);
  const [tempBubbleSize, setTempBubbleSize] = useState<number>(bubbleSize);
  const [tempSpeed, setTempSpeed] = useState<number>(speed);
  const [tempWheelColor, setTempWheelColor] = useState<string>(wheelColor);

  useEffect(() => {
    if (isOpen) {
      setTempPatientName(patientName);
      setTempLetterSize(letterSize);
      setTempBubbleSize(bubbleSize);
      setTempSpeed(speed);
      setTempWheelColor(wheelColor);
      requestFullScreenSafe();
    }
  }, [isOpen, patientName, letterSize, bubbleSize, speed, wheelColor]);

  if (!isOpen) return null;

  const handleApply = () => {
    onApply({
      patientName: tempPatientName,
      letterSize: tempLetterSize,
      bubbleSize: tempBubbleSize,
      speed: tempSpeed,
      wheelColor: tempWheelColor,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[999] flex justify-center items-start sm:items-center p-4 sm:p-6 md:p-8 overflow-y-auto backdrop-blur-md"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
    >
      <div
        className="bg-[#1A1A1A] text-white rounded-2xl sm:rounded-3xl w-[96vw] sm:w-[94vw] max-w-[1300px] h-auto my-auto flex flex-col justify-between gap-6 sm:gap-8 p-6 sm:p-8 md:p-10 border border-gray-700/80 shadow-2xl opacity-100"
        style={{ backgroundColor: '#1A1A1A' }}
      >
        {/* HEADER BAR */}
        <div className="flex justify-between items-center border-b border-gray-800 pb-5">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-wide flex items-center gap-3 flex-wrap">
                Clinical Configuration
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase tracking-widest">
                  Vision Therapy
                </span>
              </h3>
              <p className="text-sm text-gray-400 mt-1.5">
                Configure patient parameters, stimulus diameter & optical symbol scaling.
              </p>
            </div>
          </div>

          <button
            className="w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 flex items-center justify-center transition-all text-lg shadow-md cursor-pointer shrink-0"
            onClick={onClose}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* 3-COLUMN LANDSCAPE CLINICAL CONTROL GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch w-full">
          {/* COLUMN 1 (LEFT): LIVE PREVIEW */}
          <div className="flex flex-col h-full justify-between">
            <div
              className="bg-[#0D0D0D] p-6 rounded-2xl border border-gray-800 flex flex-col items-center justify-between gap-4 overflow-hidden shadow-inner relative h-full min-h-[260px] sm:min-h-[280px]"
              style={{ backgroundColor: '#0D0D0D' }}
            >
              <div className="w-full flex items-center gap-2 text-xs font-extrabold text-blue-400 uppercase tracking-widest">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping inline-block" />
                Live Preview
              </div>

              {/* ISOLATED NON-OVERLAPPING PREVIEW CONTAINER */}
              <div className="flex-1 flex justify-center items-center py-3 relative w-full h-[160px] overflow-hidden">
                <div
                  className="rounded-full flex justify-center items-center font-extrabold border-2 border-white/60 shadow-2xl transition-all duration-200 select-none max-w-full max-h-full"
                  style={{
                    width: `${tempBubbleSize}px`,
                    height: `${tempBubbleSize}px`,
                    fontSize: `${tempLetterSize}rem`,
                    backgroundColor: '#2F80FF',
                    color: '#FFFFFF',
                  }}
                >
                  <span>{sampleSymbol}</span>
                </div>
              </div>

              <div
                className="flex gap-5 text-xs sm:text-sm text-gray-300 font-mono px-5 py-2.5 rounded-full border border-gray-800 shadow-md"
                style={{ backgroundColor: '#141414' }}
              >
                <span>Bubble: <strong className="text-blue-400 font-bold">{tempBubbleSize}</strong></span>
                <span className="text-gray-600">|</span>
                <span>Font: <strong className="text-blue-400 font-bold">{tempLetterSize}</strong></span>
              </div>
            </div>
          </div>

          {/* COLUMN 2 (CENTER): LETTER SIZE & BUBBLE SIZE CONTROLS */}
          <div className="flex flex-col gap-6 justify-between">
            {/* STEPPED LETTER SIZE CONTROL */}
            <div
              className="bg-[#242424] p-6 rounded-2xl border border-gray-800 flex flex-col gap-4 flex-1 justify-center shadow-lg"
              style={{ backgroundColor: '#242424' }}
            >
              <div className="flex justify-between items-center border-b border-gray-800 pb-2.5">
                <span className="text-xs sm:text-sm font-extrabold text-gray-200 uppercase tracking-wider">
                  Letter Size
                </span>
                <span className="font-black text-blue-400 font-mono text-lg">{tempLetterSize}</span>
              </div>

              <input
                type="range"
                min="1.0"
                max="3.0"
                step="0.5"
                className="w-full accent-blue-500 cursor-pointer h-2.5 my-2"
                value={tempLetterSize}
                onChange={(e) => setTempLetterSize(parseFloat(e.target.value))}
              />

              <div className="flex justify-between text-xs text-gray-400 font-mono px-1 mt-1">
                <span>1</span>
                <span>1.5</span>
                <span>2</span>
                <span>2.5</span>
                <span>3</span>
              </div>
            </div>

            {/* STEPPED BUBBLE SIZE CONTROL */}
            <div
              className="bg-[#242424] p-6 rounded-2xl border border-gray-800 flex flex-col gap-4 flex-1 justify-center shadow-lg"
              style={{ backgroundColor: '#242424' }}
            >
              <div className="flex justify-between items-center border-b border-gray-800 pb-2.5">
                <span className="text-xs sm:text-sm font-extrabold text-gray-200 uppercase tracking-wider">
                  Bubble Size
                </span>
                <span className="font-black text-blue-400 font-mono text-lg">{tempBubbleSize}</span>
              </div>

              <input
                type="range"
                min="50"
                max="130"
                step="20"
                className="w-full accent-blue-500 cursor-pointer h-2.5 my-2"
                value={tempBubbleSize}
                onChange={(e) => setTempBubbleSize(parseInt(e.target.value, 10))}
              />

              <div className="flex justify-between text-xs text-gray-400 font-mono px-1 mt-1">
                <span>50</span>
                <span>70</span>
                <span>90</span>
                <span>110</span>
                <span>130</span>
              </div>
            </div>
          </div>

          {/* COLUMN 3 (RIGHT): PATIENT PROFILE & DYNAMICS */}
          <div className="flex flex-col gap-6 justify-between">
            {/* PATIENT NAME CARD */}
            <div
              className="bg-[#242424] p-6 rounded-2xl border border-gray-800 flex flex-col gap-3 shadow-lg"
              style={{ backgroundColor: '#242424' }}
            >
              <label className="text-xs sm:text-sm font-extrabold text-gray-200 uppercase tracking-wider">
                Patient Profile
              </label>
              <input
                type="text"
                className="w-full p-3.5 bg-[#141414] border border-gray-700 rounded-xl text-white outline-none focus:border-blue-500 font-medium text-sm transition-all shadow-inner"
                style={{ backgroundColor: '#141414' }}
                value={tempPatientName}
                placeholder="Enter patient name..."
                onChange={(e) => setTempPatientName(e.target.value)}
              />
            </div>

            {/* SPEED CONTROL CARD (IF APPLICABLE) */}
            {showSpeedControl && (
              <div
                className="bg-[#242424] p-6 rounded-2xl border border-gray-800 flex flex-col gap-4 shadow-lg"
                style={{ backgroundColor: '#242424' }}
              >
                <div className="flex justify-between items-center text-xs sm:text-sm font-extrabold text-gray-200 uppercase tracking-wider border-b border-gray-800 pb-2.5">
                  <span>Wheel Speed</span>
                  <span className="font-black text-blue-400 font-mono text-lg">{tempSpeed}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={SPEED_PRESETS.length - 1}
                  step={1}
                  className="w-full accent-blue-500 cursor-pointer h-2.5 my-2"
                  value={SPEED_PRESETS.indexOf(tempSpeed) !== -1 ? SPEED_PRESETS.indexOf(tempSpeed) : 1}
                  onChange={(e) => {
                    const idx = parseInt(e.target.value, 10);
                    if (SPEED_PRESETS[idx] !== undefined) {
                      setTempSpeed(SPEED_PRESETS[idx]);
                    }
                  }}
                />
                <div className="flex justify-between text-xs text-gray-400 font-mono px-1 mt-1">
                  {SPEED_PRESETS.map((val) => (
                    <span key={val}>{val}</span>
                  ))}
                </div>
              </div>
            )}

            {/* WHEEL COLOR CARD (IF APPLICABLE) */}
            {showWheelColorControl && (
              <div
                className="bg-[#242424] p-5 rounded-2xl border border-gray-800 flex items-center justify-between gap-4 shadow-lg"
                style={{ backgroundColor: '#242424' }}
              >
                <label className="text-xs sm:text-sm font-extrabold text-gray-200 uppercase tracking-wider">
                  Wheel Color
                </label>
                <div
                  className="flex items-center gap-3.5 p-2 px-3.5 rounded-xl border border-gray-700 shadow-inner"
                  style={{ backgroundColor: '#141414' }}
                >
                  <input
                    type="color"
                    className="w-9 h-9 bg-transparent border-none cursor-pointer rounded"
                    value={tempWheelColor}
                    onChange={(e) => setTempWheelColor(e.target.value)}
                  />
                  <span className="text-sm font-mono text-gray-200 font-bold">{tempWheelColor}</span>
                </div>
              </div>
            )}

            {/* EXTRA STATS INTEGRATION */}
            {extraStats}
          </div>
        </div>

        {/* MODAL FOOTER ACTIONS WITH PREMIUM STYLING */}
        <div className="flex justify-end items-center gap-4 border-t border-gray-800 pt-5 mt-2">
          <button
            className="px-7 py-3 rounded-xl bg-gray-800/90 hover:bg-gray-700 text-gray-300 hover:text-white font-semibold transition-all border border-gray-700 text-sm cursor-pointer shadow-md active:scale-95"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-9 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer flex items-center gap-2.5"
            onClick={handleApply}
          >
            <span>Save & Apply Settings</span>
            <span className="text-base">✓</span>
          </button>
        </div>
      </div>
    </div>
  );
}

