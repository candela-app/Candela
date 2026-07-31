import React, { useState, useEffect } from 'react';

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
    <div className="fixed inset-0 bg-black/75 z-[200] flex justify-center items-center p-4">
      <div className="bg-[#1e1e1e] text-white rounded-2xl w-[95vw] max-w-[700px] p-6 shadow-2xl border border-gray-800">
        <div className="flex justify-between items-center border-b border-gray-800 pb-3 mb-4">
          <h3 className="text-xl font-bold">Clinical Settings</h3>
          <button className="text-2xl text-gray-400 hover:text-white" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-2">
          {/* LEFT COLUMN */}
          <div className="flex flex-col gap-4">
            {/* LIVE BUBBLE & LETTER PREVIEW BOX */}
            <div className="bg-[#111111] p-4 rounded-2xl border border-gray-700 flex flex-col items-center justify-center gap-2 overflow-hidden h-[170px] shadow-inner">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                Live Bubble & Letter Preview
              </span>
              <div className="flex-1 flex justify-center items-center py-2">
                <div
                  className="rounded-full flex justify-center items-center font-bold border-2 border-white/40 shadow-xl transition-all"
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
              <div className="text-xs text-gray-400 flex gap-4">
                <span>Bubble: <strong className="text-blue-400 font-mono">{tempBubbleSize}px</strong></span>
                <span>Letter: <strong className="text-blue-400 font-mono">{tempLetterSize}rem</strong></span>
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-300 block mb-1 font-medium">Patient Name</label>
              <input
                type="text"
                className="w-full p-2.5 bg-[#2a2a2a] border border-gray-700 rounded-lg text-white outline-none focus:border-blue-500 font-medium"
                value={tempPatientName}
                onChange={(e) => setTempPatientName(e.target.value)}
              />
            </div>

            {showWheelColorControl && (
              <div>
                <label className="text-sm text-gray-300 block mb-1 font-medium">Wheel Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    className="w-12 h-10 bg-transparent border-none cursor-pointer"
                    value={tempWheelColor}
                    onChange={(e) => setTempWheelColor(e.target.value)}
                  />
                  <span className="text-sm font-mono text-gray-400">{tempWheelColor}</span>
                </div>
              </div>
            )}

            {showSpeedControl && (
              <div>
                <div className="flex justify-between text-sm text-gray-300 mb-1 font-medium">
                  <span>Rotation Speed</span>
                  <span className="font-bold text-blue-400">{tempSpeed}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="3.0"
                  step="0.5"
                  className="w-full accent-blue-500 cursor-pointer"
                  value={tempSpeed}
                  onChange={(e) => setTempSpeed(parseFloat(e.target.value))}
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[0.5, 1.0, 1.5, 2.0, 2.5, 3.0].map((sp) => (
                    <button
                      key={sp}
                      type="button"
                      className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all border ${
                        tempSpeed === sp
                          ? 'bg-blue-600 text-white border-blue-400 shadow'
                          : 'bg-[#2a2a2a] text-gray-300 border-gray-700 hover:bg-gray-700'
                      }`}
                      onClick={() => setTempSpeed(sp)}
                    >
                      {sp}x
                    </button>
                  ))}
                </div>
              </div>
            )}

            {extraStats}
          </div>

          {/* RIGHT COLUMN */}
          <div className="flex flex-col gap-4 justify-between">
            {/* STEPPED LETTER SIZE CONTROL FOR LOW-VISION USERS */}
            <div>
              <div className="flex justify-between text-sm text-gray-300 mb-1">
                <span className="font-medium">Letter Size</span>
                <span className="font-bold text-blue-400">{tempLetterSize} rem</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="3.0"
                step="0.5"
                className="w-full accent-blue-500 cursor-pointer"
                value={tempLetterSize}
                onChange={(e) => setTempLetterSize(parseFloat(e.target.value))}
              />
              <div className="flex justify-between text-[11px] text-gray-400 px-1 mt-1 font-mono">
                <span>1.0</span>
                <span>1.5</span>
                <span>2.0</span>
                <span>2.5</span>
                <span>3.0</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[1.0, 1.5, 2.0, 2.5, 3.0].map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    className={`px-3 py-1 text-xs rounded-lg font-bold transition-all border ${
                      tempLetterSize === sz
                        ? 'bg-blue-600 text-white border-blue-400 shadow'
                        : 'bg-[#2a2a2a] text-gray-300 border-gray-700 hover:bg-gray-700'
                    }`}
                    onClick={() => setTempLetterSize(sz)}
                  >
                    {sz} rem
                  </button>
                ))}
              </div>
            </div>

            {/* STEPPED STIMULUS / BUBBLE SIZE CONTROL FOR LOW-VISION USERS */}
            <div>
              <div className="flex justify-between text-sm text-gray-300 mb-1">
                <span className="font-medium">Stimulus / Bubble Size</span>
                <span className="font-bold text-blue-400">{tempBubbleSize} px</span>
              </div>
              <input
                type="range"
                min="50"
                max="130"
                step="20"
                className="w-full accent-blue-500 cursor-pointer"
                value={tempBubbleSize}
                onChange={(e) => setTempBubbleSize(parseInt(e.target.value, 10))}
              />
              <div className="flex justify-between text-[11px] text-gray-400 px-1 mt-1 font-mono">
                <span>50</span>
                <span>70</span>
                <span>90</span>
                <span>110</span>
                <span>130</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[50, 70, 90, 110, 130].map((bsz) => (
                  <button
                    key={bsz}
                    type="button"
                    className={`px-3 py-1 text-xs rounded-lg font-bold transition-all border ${
                      tempBubbleSize === bsz
                        ? 'bg-blue-600 text-white border-blue-400 shadow'
                        : 'bg-[#2a2a2a] text-gray-300 border-gray-700 hover:bg-gray-700'
                    }`}
                    onClick={() => setTempBubbleSize(bsz)}
                  >
                    {bsz} px
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* MODAL FOOTER BUTTONS */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-800">
          <button
            className="px-5 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-semibold transition-colors"
            onClick={onClose}
          >
            Close
          </button>
          <button
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg transition-colors"
            onClick={handleApply}
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
}
