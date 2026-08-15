import React, { useState, useEffect } from 'react';
import { requestFullScreenSafe } from './game-logic';
import { getContrastAdjustedColor, getPenColorName, GEOBOARD_PEN_COLORS } from './geoboard-logic';
import { SPEED_PRESETS } from './constants';
import {
  AlphabetVariant,
  DeviceOrientation,
  GeoboardBoardId,
  GeoboardMatrixTier,
  GeoboardTransform,
  PursuitMovementPattern,
  PursuitTargetColor,
} from './types';

export interface AppliedClinicalSettings {
  patientName: string;
  letterSize: number;
  bubbleSize: number;
  speed?: number;
  wheelColor?: string;
  tracingMode?: 'active' | 'guided';
  pathType?: string;
  toleranceBandPx?: number;
  colorTheme?: 'standard' | 'high_contrast' | 'dark';
  audioEnabled?: boolean;
  roundsPerSet?: number;
  pathComplexity?: 'short' | 'medium' | 'long';
  beeSpeedSec?: number;
  orientation?: DeviceOrientation;
  pursuitMovementPattern?: PursuitMovementPattern;
  pursuitTargetColor?: PursuitTargetColor;
  pursuitDecoyCount?: number;
  pursuitSpeedPxPerSec?: number;
  pursuitTrialTimeoutSec?: number;
  alphabetVariant?: AlphabetVariant;
  bpm?: number;
  metronomeEnabled?: boolean;
  matrixTier?: GeoboardMatrixTier;
  memoryMode?: boolean;
  memorizeSec?: number;
  transform?: GeoboardTransform;
  ocularity?: 'R' | 'L' | 'Both';
  timeLimitSec?: number;
  contrastSensitivity?: number;
  bgColor?: string;
  shapeColor?: string;
  penColor?: string;
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
  showBeeTracingControls?: boolean;
  tracingMode?: 'active' | 'guided';
  pathType?: string;
  toleranceBandPx?: number;
  colorTheme?: 'standard' | 'high_contrast' | 'dark';
  audioEnabled?: boolean;
  roundsPerSet?: number;
  pathComplexity?: 'short' | 'medium' | 'long';
  beeSpeedSec?: number;
  orientation?: DeviceOrientation;
  showPursuitControls?: boolean;
  pursuitMovementPattern?: PursuitMovementPattern;
  pursuitTargetColor?: PursuitTargetColor;
  pursuitDecoyCount?: number;
  pursuitSpeedPxPerSec?: number;
  pursuitTrialTimeoutSec?: number;
  showGeoboardControls?: boolean;
  geoboardBoardId?: GeoboardBoardId;
  geoboardBoardName?: string;
  geoboardSupportsLetterCase?: boolean;
  geoboardPatternCount?: number;
  alphabetVariant?: AlphabetVariant;
  bpm?: number;
  metronomeEnabled?: boolean;
  matrixTier?: GeoboardMatrixTier;
  memoryMode?: boolean;
  memorizeSec?: number;
  transform?: GeoboardTransform;
  ocularity?: 'R' | 'L' | 'Both';
  timeLimitSec?: number;
  contrastSensitivity?: number;
  bgColor?: string;
  shapeColor?: string;
  penColor?: string;
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
  showBeeTracingControls = false,
  tracingMode = 'active',
  pathType = 'auto',
  toleranceBandPx = 40,
  colorTheme = 'dark',
  audioEnabled = true,
  roundsPerSet = 7,
  pathComplexity = 'medium',
  beeSpeedSec = 4,
  orientation = 'auto',
  showPursuitControls = false,
  pursuitMovementPattern = 'linear_bounce',
  pursuitTargetColor = '#00E5FF',
  pursuitDecoyCount = 2,
  pursuitSpeedPxPerSec = 180,
  pursuitTrialTimeoutSec = 5,
  showGeoboardControls = false,
  geoboardBoardId = 1,
  geoboardBoardName = 'Geoboard',
  geoboardSupportsLetterCase = false,
  geoboardPatternCount = 0,
  alphabetVariant = 'uppercase',
  bpm = 60,
  metronomeEnabled = false,
  matrixTier = 1,
  memoryMode = false,
  memorizeSec = 5,
  transform = 'duplicate',
  ocularity = 'Both',
  timeLimitSec = 0,
  contrastSensitivity = 1,
  bgColor = '#FFFFFF',
  shapeColor = '#000000',
  penColor = '#FBBF24',
}: ClinicalSettingsModalProps) {
  const [tempPatientName, setTempPatientName] = useState<string>(patientName);
  const [tempLetterSize, setTempLetterSize] = useState<number>(letterSize);
  const [tempBubbleSize, setTempBubbleSize] = useState<number>(bubbleSize);
  const [tempSpeed, setTempSpeed] = useState<number>(speed);
  const [tempWheelColor, setTempWheelColor] = useState<string>(wheelColor);
  const [tempTracingMode, setTempTracingMode] = useState<'active' | 'guided'>(tracingMode);
  const [tempPathType, setTempPathType] = useState<string>(pathType);
  const [tempToleranceBandPx, setTempToleranceBandPx] = useState<number>(toleranceBandPx);
  const [tempColorTheme, setTempColorTheme] = useState<'standard' | 'high_contrast' | 'dark'>(colorTheme);
  const [tempAudioEnabled, setTempAudioEnabled] = useState<boolean>(audioEnabled);
  const [tempRoundsPerSet, setTempRoundsPerSet] = useState<number>(roundsPerSet);
  const [tempPathComplexity, setTempPathComplexity] = useState<'short' | 'medium' | 'long'>(pathComplexity);
  const [tempBeeSpeedSec, setTempBeeSpeedSec] = useState<number>(beeSpeedSec);
  const [tempOrientation, setTempOrientation] = useState<DeviceOrientation>(orientation);

  const [tempPursuitMovementPattern, setTempPursuitMovementPattern] = useState<PursuitMovementPattern>(pursuitMovementPattern);
  const [tempPursuitTargetColor, setTempPursuitTargetColor] = useState<PursuitTargetColor>(pursuitTargetColor);
  const [tempPursuitDecoyCount, setTempPursuitDecoyCount] = useState<number>(pursuitDecoyCount);
  const [tempPursuitSpeedPxPerSec, setTempPursuitSpeedPxPerSec] = useState<number>(pursuitSpeedPxPerSec);
  const [tempPursuitTrialTimeoutSec, setTempPursuitTrialTimeoutSec] = useState<number>(pursuitTrialTimeoutSec);

  const [tempAlphabetVariant, setTempAlphabetVariant] = useState<AlphabetVariant>(alphabetVariant);
  const [tempBpm, setTempBpm] = useState<number>(bpm);
  const [tempMetronomeEnabled, setTempMetronomeEnabled] = useState<boolean>(metronomeEnabled);
  const [tempMatrixTier, setTempMatrixTier] = useState<GeoboardMatrixTier>(matrixTier);
  const [tempMemoryMode, setTempMemoryMode] = useState<boolean>(memoryMode);
  const [tempMemorizeSec, setTempMemorizeSec] = useState<number>(memorizeSec);
  const [tempTransform, setTempTransform] = useState<GeoboardTransform>(transform);
  const [tempOcularity, setTempOcularity] = useState<'R' | 'L' | 'Both'>(ocularity);
  const [tempTimeLimitSec, setTempTimeLimitSec] = useState<number>(timeLimitSec);
  const [tempContrastSensitivity, setTempContrastSensitivity] = useState<number>(contrastSensitivity);
  const [tempBgColor, setTempBgColor] = useState<string>(bgColor);
  const [tempShapeColor, setTempShapeColor] = useState<string>(shapeColor);
  const [tempPenColor, setTempPenColor] = useState<string>(penColor);

  useEffect(() => {
    if (isOpen) {
      setTempPatientName(patientName);
      setTempLetterSize(letterSize);
      setTempBubbleSize(bubbleSize);
      setTempSpeed(speed);
      setTempWheelColor(wheelColor);
      setTempTracingMode(tracingMode);
      setTempPathType(pathType);
      setTempToleranceBandPx(toleranceBandPx);
      setTempColorTheme(colorTheme);
      setTempAudioEnabled(audioEnabled);
      setTempRoundsPerSet(roundsPerSet);
      setTempPathComplexity(pathComplexity);
      setTempBeeSpeedSec(beeSpeedSec);
      setTempOrientation(orientation);
      setTempPursuitMovementPattern(pursuitMovementPattern);
      setTempPursuitTargetColor(pursuitTargetColor);
      setTempPursuitDecoyCount(pursuitDecoyCount);
      setTempPursuitSpeedPxPerSec(pursuitSpeedPxPerSec);
      setTempPursuitTrialTimeoutSec(pursuitTrialTimeoutSec);
      setTempAlphabetVariant(alphabetVariant);
      setTempBpm(bpm);
      setTempMetronomeEnabled(metronomeEnabled);
      setTempMatrixTier(matrixTier);
      setTempMemoryMode(memoryMode);
      setTempMemorizeSec(memorizeSec);
      setTempTransform(transform);
      setTempOcularity(ocularity);
      setTempTimeLimitSec(timeLimitSec);
      setTempContrastSensitivity(contrastSensitivity);
      setTempBgColor(bgColor);
      setTempShapeColor(shapeColor);
      setTempPenColor(penColor);
      requestFullScreenSafe();
    }
  }, [
    isOpen,
    patientName,
    letterSize,
    bubbleSize,
    speed,
    wheelColor,
    tracingMode,
    pathType,
    toleranceBandPx,
    colorTheme,
    audioEnabled,
    roundsPerSet,
    pathComplexity,
    beeSpeedSec,
    orientation,
    pursuitMovementPattern,
    pursuitTargetColor,
    pursuitDecoyCount,
    pursuitSpeedPxPerSec,
    pursuitTrialTimeoutSec,
    alphabetVariant,
    bpm,
    metronomeEnabled,
    matrixTier,
    memoryMode,
    memorizeSec,
    transform,
    ocularity,
    timeLimitSec,
    contrastSensitivity,
    bgColor,
    shapeColor,
    penColor,
  ]);

  if (!isOpen) return null;

  const handleApply = () => {
    onApply({
      patientName: tempPatientName,
      letterSize: tempLetterSize,
      bubbleSize: tempBubbleSize,
      speed: tempSpeed,
      wheelColor: tempWheelColor,
      tracingMode: tempTracingMode,
      pathType: tempPathType,
      toleranceBandPx: tempToleranceBandPx,
      colorTheme: tempColorTheme,
      audioEnabled: tempAudioEnabled,
      roundsPerSet: tempRoundsPerSet,
      pathComplexity: tempPathComplexity,
      beeSpeedSec: tempBeeSpeedSec,
      orientation: tempOrientation,
      pursuitMovementPattern: tempPursuitMovementPattern,
      pursuitTargetColor: tempPursuitTargetColor,
      pursuitDecoyCount: tempPursuitDecoyCount,
      pursuitSpeedPxPerSec: tempPursuitSpeedPxPerSec,
      pursuitTrialTimeoutSec: tempPursuitTrialTimeoutSec,
      alphabetVariant: tempAlphabetVariant,
      bpm: tempBpm,
      metronomeEnabled: tempMetronomeEnabled,
      matrixTier: tempMatrixTier,
      memoryMode: tempMemoryMode,
      memorizeSec: tempMemorizeSec,
      transform: tempTransform,
      ocularity: tempOcularity,
      timeLimitSec: tempTimeLimitSec,
      contrastSensitivity: tempContrastSensitivity,
      bgColor: tempBgColor,
      shapeColor: tempShapeColor,
      penColor: tempPenColor,
    });
  };



  return (
    <div
      className="fixed inset-0 z-[999] flex justify-center items-start sm:items-center p-4 sm:p-6 md:p-8 overflow-y-auto backdrop-blur-md touch-pan-y custom-scrollbar animate-fade-in"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
    >
      <div
        className="bg-[#1A1A1A] text-white rounded-2xl sm:rounded-3xl w-[96vw] sm:w-[94vw] max-w-[1300px] h-auto my-auto flex flex-col justify-between gap-6 sm:gap-8 p-6 sm:p-8 md:p-10 border border-gray-700/80 shadow-2xl opacity-100 mb-12 sm:mb-8 animate-scale-up"
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
                {showGeoboardControls
                  ? `Configure ${geoboardBoardName} before the session starts. Every pattern in this board runs in order.`
                  : 'Configure patient parameters, stimulus diameter & optical symbol scaling.'}
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

        {/* CLINICAL CONTROL GRID */}
        {showGeoboardControls ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full items-stretch">
            {/* CONTAINER 1: SESSION & STIMULUS */}
            <div className="bg-[#242424] p-6 rounded-2xl border border-gray-800 flex flex-col gap-5 shadow-lg">
              <div className="flex justify-between items-center text-sm font-extrabold text-teal-400 uppercase tracking-wider border-b border-gray-800 pb-3">
                <span>Session & Stimulus</span>
                <span className="text-[11px] text-gray-500 normal-case font-bold tracking-normal">
                  Board {String(geoboardBoardId).padStart(2, '0')}
                </span>
              </div>

              <div className="rounded-xl bg-[#141414] border border-gray-800 px-4 py-3">
                <div className="text-sm font-bold text-gray-100">{geoboardBoardName}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  {geoboardSupportsLetterCase && tempAlphabetVariant === 'lowercase'
                    ? `${geoboardPatternCount} patterns · lowercase set`
                    : `${geoboardPatternCount} patterns in this playlist`}
                </div>
              </div>

              {/* Patient Name Input */}
              <div>
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1.5">
                  Patient Name
                </label>
                <input
                  type="text"
                  className="w-full p-3 bg-[#141414] border border-gray-700 rounded-xl text-white outline-none focus:border-teal-500 font-medium text-sm transition-all shadow-inner"
                  style={{ backgroundColor: '#141414' }}
                  value={tempPatientName}
                  placeholder="Enter patient name..."
                  onChange={(e) => setTempPatientName(e.target.value)}
                />
              </div>

              {/* Letter Case — Board 02 only */}
              {geoboardSupportsLetterCase && (
                <div>
                  <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1.5">
                    Letter Case
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { label: 'Uppercase  A B C', val: 'uppercase' as AlphabetVariant },
                      { label: 'Lowercase  a b c', val: 'lowercase' as AlphabetVariant },
                    ]).map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setTempAlphabetVariant(opt.val)}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                          tempAlphabetVariant === opt.val
                            ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-2">
                    The lowercase set omits a, e, s and g — their curves are not legible on a 5&times;5 dot grid.
                  </p>
                </div>
              )}

              {/* Matrix Density */}
              <div>
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1.5">
                  Matrix Density (Dot Support)
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {([
                    { label: '25', val: 1 as GeoboardMatrixTier },
                    { label: '17', val: 2 as GeoboardMatrixTier },
                    { label: '13', val: 3 as GeoboardMatrixTier },
                    { label: '9', val: 4 as GeoboardMatrixTier },
                    { label: '5', val: 5 as GeoboardMatrixTier },
                  ]).map((tier) => (
                    <button
                      key={tier.val}
                      type="button"
                      onClick={() => setTempMatrixTier(tier.val)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                        tempMatrixTier === tier.val
                          ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {tier.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-500 mt-2">
                  Visible dots on the answer grid. Fewer dots removes scaffolding and loads spatial memory.
                </p>
              </div>

              {/* Transform */}
              <div>
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1.5">
                  Response Transform
                </label>
                <select
                  value={tempTransform}
                  onChange={(e) => setTempTransform(e.target.value as GeoboardTransform)}
                  className="w-full rounded-xl bg-[#141414] border border-gray-700 p-3 text-xs text-white font-bold focus:border-teal-400 focus:outline-none"
                  style={{ backgroundColor: '#141414' }}
                >
                  <option value="duplicate">Duplicate — copy exactly as shown</option>
                  <option value="flip_h">Mirror Horizontally — left/right reversal</option>
                  <option value="flip_v">Mirror Vertically — top/bottom reversal</option>
                  <option value="rotate_90_r">Rotate 90&deg; Clockwise</option>
                  <option value="rotate_90_l">Rotate 90&deg; Counter-clockwise</option>
                </select>
              </div>
            </div>

            {/* CONTAINER 2: DIFFICULTY & PRESENTATION */}
            <div className="bg-[#242424] p-6 rounded-2xl border border-gray-800 flex flex-col gap-5 shadow-lg">
              <div className="flex justify-between items-center text-sm font-extrabold text-amber-400 uppercase tracking-wider border-b border-gray-800 pb-3">
                <span>Difficulty & Presentation</span>
              </div>

              {/* Memory Mode */}
              <div className="flex justify-between items-center gap-4">
                <div>
                  <span className="text-xs font-bold text-gray-200 block">Memory Mode</span>
                  <span className="text-[11px] text-gray-400">Hide the model after a preview interval</span>
                </div>
                <button
                  type="button"
                  onClick={() => setTempMemoryMode(!tempMemoryMode)}
                  className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 ${
                    tempMemoryMode ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  {tempMemoryMode ? 'ON' : 'OFF'}
                </button>
              </div>

              {tempMemoryMode && (
                <div>
                  <div className="flex justify-between items-center text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                    <span>Preview Duration</span>
                    <span className="text-amber-400 font-mono font-extrabold">{tempMemorizeSec}s</span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={15}
                    step={1}
                    className="w-full accent-amber-500 cursor-pointer h-2.5 my-2"
                    value={tempMemorizeSec}
                    onChange={(e) => setTempMemorizeSec(parseInt(e.target.value, 10))}
                  />
                </div>
              )}

              {/* Time Limit */}
              <div>
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1.5">
                  Time Limit per Pattern
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: 'Off', val: 0 },
                    { label: '15s', val: 15 },
                    { label: '30s', val: 30 },
                    { label: '45s', val: 45 },
                    { label: '60s', val: 60 },
                  ].map((tl) => (
                    <button
                      key={tl.val}
                      type="button"
                      onClick={() => setTempTimeLimitSec(tl.val)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                        tempTimeLimitSec === tl.val
                          ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {tl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Metronome */}
              <div className="flex justify-between items-center gap-4 border-t border-gray-800/80 pt-4">
                <div>
                  <span className="text-xs font-bold text-gray-200 block">Metronome Pacing</span>
                  <span className="text-[11px] text-gray-400">Audible beat to time each connection</span>
                </div>
                <button
                  type="button"
                  onClick={() => setTempMetronomeEnabled(!tempMetronomeEnabled)}
                  className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 ${
                    tempMetronomeEnabled ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20' : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  {tempMetronomeEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              {tempMetronomeEnabled && (
                <div>
                  <div className="flex justify-between items-center text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                    <span>Tempo</span>
                    <span className="text-emerald-400 font-mono font-extrabold">{tempBpm} BPM</span>
                  </div>
                  <input
                    type="range"
                    min={40}
                    max={140}
                    step={5}
                    className="w-full accent-emerald-500 cursor-pointer h-2.5 my-2"
                    value={tempBpm}
                    onChange={(e) => setTempBpm(parseInt(e.target.value, 10))}
                  />
                </div>
              )}

              {/* Ocularity */}
              <div>
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1.5">
                  Ocularity (Occlusion Protocol)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { label: 'Right Eye', val: 'R' as const },
                    { label: 'Left Eye', val: 'L' as const },
                    { label: 'Binocular', val: 'Both' as const },
                  ]).map((oc) => (
                    <button
                      key={oc.val}
                      type="button"
                      onClick={() => setTempOcularity(oc.val)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                        tempOcularity === oc.val
                          ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {oc.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contrast Sensitivity */}
              <div className="border-t border-gray-800/80 pt-4">
                <div className="flex justify-between items-center text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                  <span>Stimulus Contrast</span>
                  <span className="text-blue-400 font-mono font-extrabold">
                    {Math.round(tempContrastSensitivity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.15}
                  max={1}
                  step={0.05}
                  className="w-full accent-blue-500 cursor-pointer h-2.5 my-2"
                  value={tempContrastSensitivity}
                  onChange={(e) => setTempContrastSensitivity(parseFloat(e.target.value))}
                />
                <div
                  className="mt-2 rounded-xl border border-gray-700 h-12 flex items-center justify-center"
                  style={{ backgroundColor: tempBgColor }}
                >
                  <span
                    className="text-sm font-black tracking-widest"
                    style={{ color: getContrastAdjustedColor(tempShapeColor, tempBgColor, tempContrastSensitivity) }}
                  >
                    PREVIEW
                  </span>
                </div>
              </div>

              {/* Pen colour — presets for speed, free picker for anything else.
                  Recorded with the session so a report shows what was drawn with. */}
              <div className="border-t border-gray-800/80 pt-4">
                <div className="flex justify-between items-center text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                  <span>Pen Colour</span>
                  <span className="text-teal-400 font-mono font-extrabold normal-case tracking-normal">
                    {getPenColorName(tempPenColor)}
                  </span>
                </div>

                <div className="grid grid-cols-6 gap-2 mb-3">
                  {GEOBOARD_PEN_COLORS.map((preset) => (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => setTempPenColor(preset.hex)}
                      title={preset.name}
                      aria-label={`Pen colour ${preset.name}`}
                      aria-pressed={tempPenColor.toLowerCase() === preset.hex.toLowerCase()}
                      className={`h-9 rounded-xl border-2 transition-all ${
                        tempPenColor.toLowerCase() === preset.hex.toLowerCase()
                          ? 'border-white scale-105 shadow-lg'
                          : 'border-transparent hover:border-gray-500'
                      }`}
                      style={{ backgroundColor: preset.hex }}
                    />
                  ))}
                </div>

                <label
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-700 shadow-inner cursor-pointer"
                  style={{ backgroundColor: '#141414' }}
                >
                  <input
                    type="color"
                    className="w-9 h-9 bg-transparent border-none cursor-pointer rounded shrink-0"
                    value={tempPenColor}
                    onChange={(e) => setTempPenColor(e.target.value)}
                  />
                  <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                    Custom colour
                  </span>
                  <span className="text-[11px] font-mono text-gray-400 font-bold ml-auto">
                    {tempPenColor.toUpperCase()}
                  </span>
                </label>

                <div
                  className="mt-3 rounded-xl border border-gray-700 h-14 flex items-center justify-center gap-4 px-4"
                  style={{ backgroundColor: tempBgColor }}
                >
                  <svg width="120" height="28" viewBox="0 0 120 28" aria-hidden="true">
                    <path
                      d="M6 22 Q 30 2 58 14 T 114 8"
                      fill="none"
                      stroke={tempPenColor}
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Pen preview
                  </span>
                </div>
              </div>

              {/* Board & model palette */}
              <div className="grid grid-cols-2 gap-3">
                {([
                  { label: 'Board', value: tempBgColor, set: setTempBgColor },
                  { label: 'Model', value: tempShapeColor, set: setTempShapeColor },
                ]).map((swatch) => (
                  <div key={swatch.label}>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                      {swatch.label}
                    </label>
                    <div
                      className="flex items-center gap-2 p-2 rounded-xl border border-gray-700 shadow-inner"
                      style={{ backgroundColor: '#141414' }}
                    >
                      <input
                        type="color"
                        className="w-7 h-7 bg-transparent border-none cursor-pointer rounded shrink-0"
                        value={swatch.value}
                        onChange={(e) => swatch.set(e.target.value)}
                      />
                      <span className="text-[10px] font-mono text-gray-300 font-bold truncate">{swatch.value}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* EXTRA STATS INTEGRATION */}
              {extraStats}
            </div>
          </div>
        ) : showPursuitControls ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full items-stretch">
            {/* CONTAINER 1: PATIENT & STIMULUS PROFILES */}
            <div className="bg-[#242424] p-6 rounded-2xl border border-gray-800 flex flex-col justify-between gap-5 shadow-lg">
              <div className="flex justify-between items-center text-sm font-extrabold text-cyan-400 uppercase tracking-wider border-b border-gray-800 pb-3">
                <span>Pursuit Stimulus & Target Profile</span>
              </div>

              {/* Patient Name Input */}
              <div>
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1.5">
                  Patient Name
                </label>
                <input
                  type="text"
                  className="w-full p-3 bg-[#141414] border border-gray-700 rounded-xl text-white outline-none focus:border-cyan-500 font-medium text-sm transition-all shadow-inner"
                  style={{ backgroundColor: '#141414' }}
                  value={tempPatientName}
                  placeholder="Enter patient name..."
                  onChange={(e) => setTempPatientName(e.target.value)}
                />
              </div>

              {/* Movement Pattern Selection */}
              <div>
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1.5">
                  Movement Pattern (Trajectory Math)
                </label>
                <select
                  value={tempPursuitMovementPattern}
                  onChange={(e) => setTempPursuitMovementPattern(e.target.value as PursuitMovementPattern)}
                  className="w-full rounded-xl bg-[#141414] border border-gray-700 p-3 text-xs text-white font-bold focus:border-cyan-400 focus:outline-none"
                  style={{ backgroundColor: '#141414' }}
                >
                  <option value="linear_bounce">1. Linear Bounce (Straight Wall Bounces - Easiest)</option>
                  <option value="circular_orbit">2. Circular / Elliptical Orbit (Smooth Angular Pursuit)</option>
                  <option value="figure_eight">3. Figure-8 Wave (Continuous Direction Changes)</option>
                  <option value="random_walk">4. Random Walk with Momentum (Smooth Steering Math)</option>
                  <option value="freeze_drift">5. Freeze & Drift (Slow Motion + Brief Random Freezes)</option>
                </select>
              </div>

              {/* Target Bubble Color */}
              <div>
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1.5">
                  Target Luminance Color (High Salience)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Cyan (#00E5FF)', val: '#00E5FF', bg: '#00E5FF', text: '#000000' },
                    { label: 'Yellow (#FFD600)', val: '#FFD600', bg: '#FFD600', text: '#000000' },
                    { label: 'Bright White', val: '#FFFFFF', bg: '#FFFFFF', text: '#000000' },
                  ].map((clr) => (
                    <button
                      key={clr.val}
                      type="button"
                      onClick={() => setTempPursuitTargetColor(clr.val as PursuitTargetColor)}
                      className={`py-2 px-2 rounded-xl text-xs font-extrabold transition-all border flex items-center justify-center gap-1.5 ${
                        tempPursuitTargetColor === clr.val
                          ? 'border-white shadow-lg ring-2 ring-cyan-400/50'
                          : 'border-gray-700 opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: clr.bg, color: clr.text }}
                    >
                      <span>●</span>
                      <span>{clr.label.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* CONTAINER 2: DYNAMICS & DECOY DENSITY */}
            <div className="bg-[#242424] p-6 rounded-2xl border border-gray-800 flex flex-col justify-between gap-5 shadow-lg">
              <div className="flex justify-between items-center text-sm font-extrabold text-blue-400 uppercase tracking-wider border-b border-gray-800 pb-3">
                <span>Dynamics & Selective Attention Controls</span>
              </div>

              {/* Simultaneous Decoy Count */}
              <div>
                <div className="flex justify-between items-center text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                  <span>Decoy Element Count (Selective Attention)</span>
                  <span className="text-cyan-400 font-mono font-extrabold">{tempPursuitDecoyCount + 1} Total (1 Target + {tempPursuitDecoyCount} Decoys)</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '1 Decoy (2 Total)', val: 1 },
                    { label: '2 Decoys (3 Total)', val: 2 },
                    { label: '3 Decoys (4 Max)', val: 3 },
                  ].map((dc) => (
                    <button
                      key={dc.val}
                      type="button"
                      onClick={() => setTempPursuitDecoyCount(dc.val)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                        tempPursuitDecoyCount === dc.val
                          ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {dc.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bubble Diameter */}
              <div>
                <div className="flex justify-between items-center text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                  <span>Bubble Size</span>
                  <span className="text-cyan-400 font-mono font-extrabold">{tempBubbleSize}px</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="130"
                  step="10"
                  className="w-full accent-cyan-500 cursor-pointer h-2.5 my-2"
                  value={tempBubbleSize}
                  onChange={(e) => setTempBubbleSize(parseInt(e.target.value, 10))}
                />
              </div>

              {/* Travel Speed */}
              <div>
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1.5">
                  Pursuit Speed (px/sec)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Slow (110 px/s)', val: 110 },
                    { label: 'Normal (180 px/s)', val: 180 },
                    { label: 'Fast (260 px/s)', val: 260 },
                  ].map((spd) => (
                    <button
                      key={spd.val}
                      type="button"
                      onClick={() => setTempPursuitSpeedPxPerSec(spd.val)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                        tempPursuitSpeedPxPerSec === spd.val
                          ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {spd.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Trial Timeout */}
              <div>
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1.5">
                  Trial Timeout (Seconds per Trial)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '4 Seconds', val: 4 },
                    { label: '5 Seconds', val: 5 },
                    { label: '6 Seconds', val: 6 },
                  ].map((to) => (
                    <button
                      key={to.val}
                      type="button"
                      onClick={() => setTempPursuitTrialTimeoutSec(to.val)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                        tempPursuitTrialTimeoutSec === to.val
                          ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {to.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : showBeeTracingControls ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full items-stretch">
            {/* CONTAINER 1: PATIENT & SESSION CONFIGURATION */}
            <div className="bg-[#242424] p-6 rounded-2xl border border-gray-800 flex flex-col justify-between gap-5 shadow-lg">
              <div className="flex justify-between items-center text-sm font-extrabold text-blue-400 uppercase tracking-wider border-b border-gray-800 pb-3">
                <span>Patient & Session Configuration</span>
              </div>

              {/* Patient Name Input */}
              <div>
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1.5">
                  Patient Name
                </label>
                <input
                  type="text"
                  className="w-full p-3 bg-[#141414] border border-gray-700 rounded-xl text-white outline-none focus:border-blue-500 font-medium text-sm transition-all shadow-inner"
                  style={{ backgroundColor: '#141414' }}
                  value={tempPatientName}
                  placeholder="Enter patient name..."
                  onChange={(e) => setTempPatientName(e.target.value)}
                />
              </div>

              {/* Rounds per Session / Set */}
              <div>
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1.5">
                  Rounds per Session / Set
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '3 Rounds', val: 3 },
                    { label: '5 Rounds', val: 5 },
                    { label: '7 Rounds (All)', val: 7 },
                  ].map((rnd) => (
                    <button
                      key={rnd.val}
                      type="button"
                      onClick={() => setTempRoundsPerSet(rnd.val)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                        tempRoundsPerSet === rnd.val
                          ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {rnd.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Audio Toggle */}
              <div className="flex justify-between items-center border-t border-gray-800/80 pt-3">
                <div>
                  <span className="text-xs font-bold text-gray-200 block">Multisensory Audio FX</span>
                  <span className="text-[11px] text-gray-400">Bee buzz & off-trail warning hums</span>
                </div>
                <button
                  type="button"
                  onClick={() => setTempAudioEnabled(!tempAudioEnabled)}
                  className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${
                    tempAudioEnabled ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20' : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  {tempAudioEnabled ? 'ENABLED' : 'MUTED'}
                </button>
              </div>
            </div>

            {/* CONTAINER 2: TRACING MECHANICS & MODE */}
            <div className="bg-[#242424] p-6 rounded-2xl border border-gray-800 flex flex-col justify-between gap-5 shadow-lg">
              <div className="flex justify-between items-center text-sm font-extrabold text-amber-400 uppercase tracking-wider border-b border-gray-800 pb-3">
                <span>Tracing Mechanics & Mode</span>
              </div>

              {/* Tracing Mode */}
              <div>
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1.5">
                  Tracing Mode
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTempTracingMode('active')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                      tempTracingMode === 'active'
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    Active Trace (Manual Pursuit)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTempTracingMode('guided')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                      tempTracingMode === 'guided'
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    Guided Trace (Demo First)
                  </button>
                </div>
              </div>

              {/* Bee Speed & Pursuit Responsiveness */}
              <div>
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1.5">
                  Bee Speed & Pursuit Responsiveness
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Slow (10s)', val: 10 },
                    { label: 'Normal (5s)', val: 5 },
                    { label: 'Fast (2.5s)', val: 2.5 },
                  ].map((spd) => (
                    <button
                      key={spd.val}
                      type="button"
                      onClick={() => setTempBeeSpeedSec(spd.val)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                        tempBeeSpeedSec === spd.val
                          ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {spd.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* CONTAINER 3: PATH GEOMETRY & COMPLEXITY */}
            <div className="bg-[#242424] p-6 rounded-2xl border border-gray-800 flex flex-col justify-between gap-5 shadow-lg">
              <div className="flex justify-between items-center text-sm font-extrabold text-emerald-400 uppercase tracking-wider border-b border-gray-800 pb-3">
                <span>Path Geometry & Complexity</span>
              </div>

              {/* Path Type */}
              <div>
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1.5">
                  Path Type (Progression Sequence)
                </label>
                <select
                  value={tempPathType}
                  onChange={(e) => setTempPathType(e.target.value)}
                  className="w-full rounded-xl bg-[#141414] border border-gray-700 p-3 text-xs text-white font-bold focus:border-emerald-400 focus:outline-none"
                  style={{ backgroundColor: '#141414' }}
                >
                  <option value="auto">Auto Progress (All 7 Path Types Sequentially)</option>
                  <option value="procedural_random">✨ Fully Procedural Dynamic Path (Random Endpoints & Custom Curve)</option>
                  <option value="random">🎲 Random Preset Path (Random Template Each Round)</option>
                  <option value="straight">1. Straight Line (Horizontal/Diagonal)</option>
                  <option value="curve">2. Gentle Curve (Broad Arc)</option>
                  <option value="zigzag">3. Zigzag Shifts (Sharp Direction Changes)</option>
                  <option value="wave">4. S-Curve Wave (Sinusoidal Motion)</option>
                  <option value="spiral">5. Spiral Pursuit (Inward Arc)</option>
                  <option value="branching">6. Branching Path (Distractor Branch)</option>
                  <option value="dotted">7. Dotted Gap Fill (Occlusion Jumps)</option>
                </select>
              </div>

              {/* Path Length & Complexity */}
              <div>
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1.5">
                  Path Length & Complexity
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'short', label: 'Short' },
                    { id: 'medium', label: 'Medium' },
                    { id: 'long', label: 'Long / Complex' },
                  ].map((cx) => (
                    <button
                      key={cx.id}
                      type="button"
                      onClick={() => setTempPathComplexity(cx.id as any)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                        tempPathComplexity === cx.id
                          ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {cx.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Device Orientation Mapping */}
              <div>
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1.5">
                  Device Orientation & Primary Motion Axis
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'auto', label: 'Auto (Container Match)' },
                    { id: 'landscape', label: 'Landscape (Horizontal)' },
                    { id: 'portrait', label: 'Portrait (Vertical)' },
                  ].map((ori) => (
                    <button
                      key={ori.id}
                      type="button"
                      onClick={() => setTempOrientation(ori.id as any)}
                      className={`py-2 px-2 text-center rounded-xl text-xs font-bold transition-all ${
                        tempOrientation === ori.id
                          ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {ori.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>



            {/* CONTAINER 4: VISUAL & CONTRAST THEME */}
            <div className="bg-[#242424] p-6 rounded-2xl border border-gray-800 flex flex-col justify-between gap-5 shadow-lg">
              <div className="flex justify-between items-center text-sm font-extrabold text-purple-400 uppercase tracking-wider border-b border-gray-800 pb-3">
                <span>Visual & Contrast Theme</span>
              </div>

              {/* Tolerance Corridor Band */}
              <div>
                <div className="flex justify-between items-center text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                  <span>Corridor Width (Tolerance Band)</span>
                  <span className="text-purple-400 font-mono font-extrabold">{tempToleranceBandPx}px</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '60px (Easy)', val: 60 },
                    { label: '40px (Medium)', val: 40 },
                    { label: '24px (Hard)', val: 24 },
                  ].map((band) => (
                    <button
                      key={band.val}
                      type="button"
                      onClick={() => setTempToleranceBandPx(band.val)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                        tempToleranceBandPx === band.val
                          ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {band.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Low-Vision Color Theme */}
              <div>
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1.5">
                  Low-Vision Contrast Theme
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'standard', label: 'Standard' },
                    { id: 'high_contrast', label: 'High Contrast' },
                    { id: 'dark', label: 'Dark Mode' },
                  ].map((thm) => (
                    <button
                      key={thm.id}
                      type="button"
                      onClick={() => setTempColorTheme(thm.id as any)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                        tempColorTheme === thm.id
                          ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {thm.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch w-full">
            {/* COLUMN 1 (LEFT): LIVE PREVIEW - ONLY FOR BUBBLE / SORTING GAMES */}
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

            {/* COLUMN 2 (CENTER): LETTER SIZE & BUBBLE SIZE CONTROLS - ONLY FOR BUBBLE / SORTING GAMES */}
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
        )}

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

