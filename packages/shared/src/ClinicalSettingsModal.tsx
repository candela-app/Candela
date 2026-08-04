import React, { useState, useEffect } from 'react';
import { requestFullScreenSafe } from './game-logic';
import { SPEED_PRESETS } from './constants';
import { DeviceOrientation, PursuitMovementPattern, PursuitTargetColor } from './types';

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
    });
  };



  return (
    <div
      className="fixed inset-0 z-[999] flex justify-center items-start sm:items-center p-4 sm:p-6 md:p-8 overflow-y-auto backdrop-blur-md touch-pan-y custom-scrollbar"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
    >
      <div
        className="bg-[#1A1A1A] text-white rounded-2xl sm:rounded-3xl w-[96vw] sm:w-[94vw] max-w-[1300px] h-auto my-auto flex flex-col justify-between gap-6 sm:gap-8 p-6 sm:p-8 md:p-10 border border-gray-700/80 shadow-2xl opacity-100 mb-12 sm:mb-8"
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

        {/* CLINICAL CONTROL GRID */}
        {showPursuitControls ? (
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

