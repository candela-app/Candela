'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  BeeTracingSettings,
  BeePathType,
  PathPoint,
  RoundResultData,
  BeeSessionResultData,
  playCorrectSoundAndHaptic,
  playSuccessSoundAndHaptic,
  playBeeBuzzSound,
  playSoftOffPathSound,
  ClinicalSettingsModal,
  exitFullScreenSafe,
  requestFullScreenSafe,
  resolveOrientation,
  resolveBeePathType,
} from '@candela/shared';
import {
  generateBeePath,
  GeneratedPath,
  findNearestPathPoint,
  findNearestPathPointInWindow,
  evaluateTracingMetrics,
} from './BeePathGenerator';
import { GameResultsModal } from '../shared/GameResultsModal';
import beePng from '@candela/shared/assets/bee.png';

const beeSrc = typeof beePng === 'string' ? beePng : beePng.src;

interface BeeTracingGameProps {
  onExit: () => void;
  initialPathType?: string;
}

const DEFAULT_SETTINGS: BeeTracingSettings = {
  patientName: 'Demo Patient',
  tracingMode: 'active',
  pathType: 'auto',
  toleranceBandPx: 40,
  beeSpeedSec: 5, // 5s Normal default
  pathComplexity: 'medium',
  colorTheme: 'dark', // Dark theme by default
  audioEnabled: true,
  inputSensitivity: 'auto',
  roundsPerSet: 7, // Auto progress defaults to playing through ALL 7 path types!
  orientation: 'auto',
};


const PATH_PROGRESSION: BeePathType[] = [
  'straight',
  'curve',
  'zigzag',
  'wave',
  'spiral',
  'branching',
  'dotted',
];

export const BeeTracingGame: React.FC<BeeTracingGameProps> = ({ onExit, initialPathType = 'straight' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lockedPathType = resolveBeePathType(initialPathType);

  // Settings & State
  const [settings, setSettings] = useState<BeeTracingSettings>({
    ...DEFAULT_SETTINGS,
    pathType: lockedPathType,
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(true); // Open settings BEFORE game starts
  const [isResultsOpen, setIsResultsOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Fullscreen state listener
  useEffect(() => {
    const handleFSChange = () => {
      const isFS = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isFS);
    };

    document.addEventListener('fullscreenchange', handleFSChange);
    document.addEventListener('webkitfullscreenchange', handleFSChange);
    handleFSChange();

    return () => {
      document.removeEventListener('fullscreenchange', handleFSChange);
      document.removeEventListener('webkitfullscreenchange', handleFSChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (isFullscreen) {
      exitFullScreenSafe();
    } else {
      requestFullScreenSafe();
    }
  };

  // Set & Round tracking
  const [currentRoundNumber, setCurrentRoundNumber] = useState<number>(1);
  const [roundResults, setRoundResults] = useState<RoundResultData[]>([]);

  // Generated Path Data
  const [currentPath, setCurrentPath] = useState<GeneratedPath | null>(null);

  // Interactive Bee Position & Tracing State
  const [beePos, setBeePos] = useState<PathPoint>({ x: 100, y: 100 });
  const [isTracing, setIsTracing] = useState<boolean>(false);
  const [isGuidedDemoRunning, setIsGuidedDemoRunning] = useState<boolean>(false);
  const [hasDemoPlayed, setHasDemoPlayed] = useState<boolean>(false);

  // Visual Trail of user touch/mouse trace
  const [userTracePoints, setUserTracePoints] = useState<PathPoint[]>([]);
  const [userTimestamps, setUserTimestamps] = useState<number[]>([]);

  // Feedback FX & Animations
  const [isOffPathWobble, setIsOffPathWobble] = useState<boolean>(false);
  const [roundSuccessCelebration, setRoundSuccessCelebration] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Session Start Time
  const sessionStartTimeRef = useRef<number>(Date.now());
  const roundStartTimeRef = useRef<number>(Date.now());
  const currentPathIndexRef = useRef<number>(0);

  // Generate path based on current round number and settings
  const initRoundPath = useCallback(
    (roundNum: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const w = Math.max(320, rect.width);
      const h = Math.max(320, rect.height);

      let targetPathType: BeePathType = 'straight';
      let tier = Math.min(5, Math.ceil(roundNum / 2));

      if (settings.pathType === 'auto') {
        const pathIndex = (roundNum - 1) % PATH_PROGRESSION.length;
        targetPathType = PATH_PROGRESSION[pathIndex];
      } else if (settings.pathType === 'random') {
        const randomIndex = Math.floor(Math.random() * PATH_PROGRESSION.length);
        targetPathType = PATH_PROGRESSION[randomIndex];
      } else {
        targetPathType = settings.pathType;
      }

      // Resolve orientation dynamically per round
      const resolvedOrientation = resolveOrientation(settings.orientation || 'auto', w, h);

      const generated = generateBeePath(
        targetPathType,
        w,
        h,
        tier,
        settings.pathComplexity,
        resolvedOrientation
      );
      setCurrentPath(generated);
      setBeePos(generated.startPoint);
      setUserTracePoints([generated.startPoint]);
      setUserTimestamps([Date.now()]);
      setRoundSuccessCelebration(false);
      setIsOffPathWobble(false);
      setHasDemoPlayed(false); // Reset demo played flag for new round
      currentPathIndexRef.current = 0; // Reset sequential path progress index
      roundStartTimeRef.current = Date.now();

      if (settings.tracingMode === 'guided') {
        // Start guided demo playback on round start
        runGuidedDemo(generated);
      }
    },
    [settings.pathType, settings.tracingMode, settings.pathComplexity, settings.orientation]
  );


  // Guided demo auto-movement
  const runGuidedDemo = (generated: GeneratedPath) => {
    setIsGuidedDemoRunning(true);
    const duration = settings.beeSpeedSec * 1000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);

      const ptIndex = Math.floor(progress * (generated.points.length - 1));
      const pt = generated.points[ptIndex] || generated.startPoint;
      setBeePos(pt);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsGuidedDemoRunning(false);
        setHasDemoPlayed(true); // Demo complete -> button changes to 'Replay Demo'
        setBeePos(generated.startPoint);
        showToast('Demo complete! Now trace the path!');
      }
    };

    requestAnimationFrame(animate);
  };

  // Re-init path ONLY when currentRoundNumber or explicit init is triggered
  useEffect(() => {
    initRoundPath(currentRoundNumber);
  }, [currentRoundNumber, initRoundPath]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Sound play helper
  const triggerAudioBuzz = () => {
    if (settings.audioEnabled) {
      playBeeBuzzSound();
    }
  };

  const triggerAudioOffPath = () => {
    if (settings.audioEnabled) {
      playSoftOffPathSound();
    }
  };

  // Start Tracing Pointer Handler - Requires direct click/touch on the Bee to start moving
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isGuidedDemoRunning || roundSuccessCelebration || !currentPath || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const distToBee = Math.hypot(x - beePos.x, y - beePos.y);
    const distToStart = Math.hypot(x - currentPath.startPoint.x, y - currentPath.startPoint.y);

    // Direct touch hit radius around Bee sprite (~60px around center)
    const BEE_GRAB_RADIUS = 60;
    const isStartOfRound = currentPathIndexRef.current === 0 || userTracePoints.length <= 1;

    let canGrabBee = false;
    if (isStartOfRound) {
      // At start of round, must touch Bee or Start dot
      canGrabBee = distToBee <= BEE_GRAB_RADIUS || distToStart <= BEE_GRAB_RADIUS;
    } else {
      // Mid-round: must touch Bee directly to resume move - clicking ahead on path does NOT move bee!
      canGrabBee = distToBee <= BEE_GRAB_RADIUS;
    }

    if (canGrabBee) {
      setIsTracing(true);
      if (isStartOfRound) {
        currentPathIndexRef.current = 0;
      }
      setUserTracePoints((prev) => (prev.length <= 1 ? [beePos] : prev));
      setUserTimestamps((prev) => [...prev, Date.now()]);
      triggerAudioBuzz();
    }
  };

  // Pointer Move Handler (Active Tracing with Speed-Controlled Pursuit Damping)
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!currentPath || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const currentPt = { x, y };

    // If lost tracking but user is actively dragging/touching directly over the active bee sprite, seamlessly resume
    if (!isTracing && (e.buttons === 1 || e.pointerType === 'touch')) {
      const distToBee = Math.hypot(x - beePos.x, y - beePos.y);
      if (distToBee <= 60) {
        setIsTracing(true);
      }
    }

    if (!isTracing) return;


    // Strict windowed path check (prevents shortcutting across spiral loops or intersecting paths)
    const { nearestPoint, distance, index } = findNearestPathPointInWindow(
      currentPt,
      currentPath.points,
      currentPathIndexRef.current,
      35
    );

    if (Math.random() < 0.3) {
      triggerAudioBuzz();
    }

    if (distance > settings.toleranceBandPx) {
      // Soft fail snap-back to current active path progress
      setIsOffPathWobble(true);
      triggerAudioOffPath();
      showToast('Stay on the path!');

      const snapPoint = currentPath.points[currentPathIndexRef.current] || nearestPoint;
      setBeePos(snapPoint);
      setUserTracePoints((prev) => [...prev, snapPoint]);
      setUserTimestamps((prev) => [...prev, Date.now()]);

      setTimeout(() => setIsOffPathWobble(false), 400);
    } else {
      // Advance sequential progress index
      currentPathIndexRef.current = Math.max(currentPathIndexRef.current, index);

      // Smooth pursuit move wired directly to bee speed settings
      const lerpFactor = settings.beeSpeedSec >= 10 ? 0.18 : settings.beeSpeedSec >= 5 ? 0.5 : 1.0;
      const lerpX = beePos.x + (currentPt.x - beePos.x) * lerpFactor;
      const lerpY = beePos.y + (currentPt.y - beePos.y) * lerpFactor;
      const activeBeePos = { x: lerpX, y: lerpY };

      setBeePos(activeBeePos);
      setUserTracePoints((prev) => [...prev, currentPt]);
      setUserTimestamps((prev) => [...prev, Date.now()]);
    }

    // Check if reached destination flower ONLY after traversing at least 85% of the total path length!
    const distToFlower = Math.hypot(x - currentPath.endPoint.x, y - currentPath.endPoint.y);
    const minRequiredIndex = Math.floor(currentPath.points.length * 0.85);
    const hasTraversedPath = currentPathIndexRef.current >= minRequiredIndex;

    if (distToFlower <= 45 && hasTraversedPath) {
      handleRoundCompletion();
    }
  };


  // Pointer End Handler
  const handlePointerUp = () => {
    if (isTracing) {
      setIsTracing(false);
    }
  };

  // Round Completion Logic
  const handleRoundCompletion = () => {
    if (roundSuccessCelebration || !currentPath) return;
    setIsTracing(false);
    setRoundSuccessCelebration(true);

    if (settings.audioEnabled) {
      playCorrectSoundAndHaptic();
      playSuccessSoundAndHaptic();
    }

    showToast('🎉 Flower Reached! Great Job!');

    const completionTimeSec = Math.max(1, Math.round((Date.now() - roundStartTimeRef.current) / 1000));
    const metrics = evaluateTracingMetrics(
      userTracePoints,
      currentPath.points,
      settings.toleranceBandPx,
      userTimestamps
    );

    const roundData: RoundResultData = {
      roundNumber: currentRoundNumber,
      pathType: currentPath.pathType,
      difficultyTier: currentPath.difficultyTier,
      accuracyPercent: metrics.accuracyPercent,
      completionTimeSec,
      baselineTimeSec: currentPath.baselineTimeSec,
      deviationCount: metrics.deviationCount,
      avgRecoveryTimeSec: metrics.avgRecoveryTimeSec,
      tracedPoints: userTracePoints,
      targetPoints: currentPath.points,
      idealSvgPathD: currentPath.svgPathD,
      orientation: currentPath.orientation,
    };

    const updatedResults = [...roundResults, roundData];
    setRoundResults(updatedResults);

    // Check if set is complete
    setTimeout(() => {
      if (currentRoundNumber >= settings.roundsPerSet) {
        setIsResultsOpen(true);
      } else {
        setCurrentRoundNumber((prev) => prev + 1);
      }
    }, 1800);
  };

  // Compute aggregated session results for set modal
  const getSessionResultData = (): BeeSessionResultData => {
    const totalAcc = roundResults.reduce((a, r) => a + r.accuracyPercent, 0);
    const avgAcc = roundResults.length > 0 ? Math.round(totalAcc / roundResults.length) : 100;

    const totalDuration = roundResults.reduce((a, r) => a + r.completionTimeSec, 0);
    const totalDeviations = roundResults.reduce((a, r) => a + r.deviationCount, 0);
    const totalRecovery = roundResults.reduce((a, r) => a + r.avgRecoveryTimeSec, 0);
    const avgRecovery = roundResults.length > 0 ? Math.round((totalRecovery / roundResults.length) * 10) / 10 : 0;

    // Horizontal vs Vertical Accuracy calculation
    const horizontalRounds = roundResults.filter((r) => r.orientation === 'landscape');
    const verticalRounds = roundResults.filter((r) => r.orientation === 'portrait');

    const horizontalAccuracyPercent =
      horizontalRounds.length > 0
        ? Math.round(horizontalRounds.reduce((a, r) => a + r.accuracyPercent, 0) / horizontalRounds.length)
        : undefined;

    const verticalAccuracyPercent =
      verticalRounds.length > 0
        ? Math.round(verticalRounds.reduce((a, r) => a + r.accuracyPercent, 0) / verticalRounds.length)
        : undefined;

    return {
      patientName: settings.patientName,
      sessionId: Date.now(),
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      gameName: 'Bee Path Tracing Therapy',
      stimuliCount: roundResults.length,
      letterSize: settings.toleranceBandPx,
      speed: settings.tracingMode,
      durationSec: totalDuration,
      clicksTotal: userTracePoints.length,
      correct: roundResults.length,
      wrong: totalDeviations,
      accuracy: avgAcc,
      avgReactionSec: totalDuration / Math.max(1, roundResults.length),
      pathType: settings.pathType,
      tracingMode: settings.tracingMode,
      colorTheme: settings.colorTheme,
      toleranceBandPx: settings.toleranceBandPx,
      deviationCount: totalDeviations,
      avgRecoveryTimeSec: avgRecovery,
      roundsCompleted: roundResults.length,
      roundResults,
      horizontalAccuracyPercent,
      verticalAccuracyPercent,
    };
  };


  // Color theme class bindings & Vibrant Neon Colors
  const themeBgClass =
    settings.colorTheme === 'high_contrast'
      ? 'bg-[#0A0E1A]'
      : settings.colorTheme === 'dark'
      ? 'bg-[#0B0F19]'
      : 'bg-[#F4F4EE]';

  const pathColor =
    settings.colorTheme === 'high_contrast'
      ? '#FFE600' // Ultra Neon Yellow
      : settings.colorTheme === 'dark'
      ? '#00F3FF' // Cyber Neon Cyan
      : '#FFB703'; // Electric Neon Gold

  const neonGlowColor =
    settings.colorTheme === 'high_contrast'
      ? '#FACC15'
      : settings.colorTheme === 'dark'
      ? '#00A8FF'
      : '#FFD166';

  const bandColor =
    settings.colorTheme === 'high_contrast'
      ? 'rgba(250, 204, 21, 0.15)'
      : settings.colorTheme === 'dark'
      ? 'rgba(0, 243, 255, 0.15)'
      : 'rgba(255, 183, 3, 0.12)';

  return (
    <div className={`w-screen h-screen ${themeBgClass} flex flex-col justify-between select-none touch-none overflow-hidden relative transition-colors duration-300`}>
      {/* Header Bar - Sleek & Minimal */}
      <header className="flex items-center justify-between px-3 sm:px-6 py-2.5 bg-slate-900/60 backdrop-blur-md border-b border-white/10 z-30">
        {/* Left: Exit button & Title */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={() => {
              exitFullScreenSafe();
              onExit();
            }}
            className="py-1.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm transition-all cursor-pointer"
          >
            ← Exit
          </button>
          <div className="flex items-center gap-1.5">
            <img src={beeSrc} alt="Bee" className="w-5 h-5 sm:w-7 sm:h-7 object-contain inline-block filter drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
            <h1 className="text-sm sm:text-base font-extrabold text-amber-400 whitespace-nowrap">
              Bee Tracing
            </h1>
          </div>
        </div>

        {/* Right: Demo button, Set Progress, Settings & Fullscreen */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {currentPath && (
            <button
              onClick={() => runGuidedDemo(currentPath)}
              disabled={isGuidedDemoRunning}
              className="py-1.5 px-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 font-bold text-xs transition-all cursor-pointer flex items-center gap-1 shadow-md disabled:opacity-50 active:scale-95"
              title={hasDemoPlayed ? 'Replay Demo Path' : 'Play Demo Path'}
            >
              <span>{isGuidedDemoRunning ? '▶' : hasDemoPlayed ? '↺' : '▶'}</span>
              <span className="hidden sm:inline">{isGuidedDemoRunning ? 'Playing...' : hasDemoPlayed ? 'Replay' : 'Demo'}</span>
            </button>
          )}

          <div className="text-right shrink-0">
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 block leading-tight">
              Set
            </span>
            <span className="text-xs sm:text-sm font-black text-white leading-none">
              {currentRoundNumber}/{settings.roundsPerSet}
            </span>
          </div>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-200 transition-all cursor-pointer text-base shrink-0"
            title="Clinical Settings"
          >
            ⚙️
          </button>

          <button
            onClick={toggleFullscreen}
            className={`p-2 rounded-xl font-bold text-xs transition-all cursor-pointer shrink-0 shadow-md active:scale-95 ${
              isFullscreen
                ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/30'
                : 'bg-white/10 border border-white/20 text-gray-200 hover:bg-white/20'
            }`}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            <span>{isFullscreen ? '↙' : '⛶'}</span>
          </button>
        </div>
      </header>

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-amber-500 text-slate-950 font-black px-4 py-2 rounded-2xl shadow-xl text-xs animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* Main Interactive Canvas Area */}
      <main
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="flex-1 relative cursor-crosshair w-full h-full overflow-hidden"
      >
        {currentPath && (
          <>
            {/* SVG Path & Tolerance Corridor Band */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
              {/* Defs for Neon Shiny Glow Filter */}
              <defs>
                <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="6" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Tolerance Corridor Band Line */}
              <path
                d={currentPath.svgPathD}
                fill="none"
                stroke={bandColor}
                strokeWidth={settings.toleranceBandPx * 2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Outer Neon Glow Path Line */}
              <path
                d={currentPath.svgPathD}
                fill="none"
                stroke={neonGlowColor}
                strokeWidth="14"
                strokeDasharray={currentPath.dashArray || 'none'}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.6"
                filter="url(#neon-glow)"
              />

              {/* Ideal Core Shiny Neon Target Path Line */}
              <path
                d={currentPath.svgPathD}
                fill="none"
                stroke={pathColor}
                strokeWidth="6"
                strokeDasharray={currentPath.dashArray || 'none'}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={settings.tracingMode === 'guided' && !isGuidedDemoRunning ? 0.4 : 0.95}
              />

              {/* Branching Distractor Path if active */}
              {currentPath.distractorSvgPathD && (
                <path
                  d={currentPath.distractorSvgPathD}
                  fill="none"
                  stroke={pathColor}
                  strokeWidth="4"
                  strokeDasharray="8 8"
                  opacity="0.35"
                />
              )}

              {/* Patient's Actual Touch Trail Line */}
              {userTracePoints.length > 1 && (
                <polyline
                  points={userTracePoints.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke="#00F3FF"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.85"
                  filter="url(#neon-glow)"
                />
              )}
            </svg>

            {/* Start Target Indicator - Clean Glowing Start Dot */}
            <div
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center"
              style={{ left: currentPath.startPoint.x, top: currentPath.startPoint.y }}
            >
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.9)] animate-pulse border-2 border-amber-200" />
              <span className="text-[10px] sm:text-[11px] font-bold text-amber-300 mt-1 bg-slate-900/90 px-2 py-0.5 rounded-full shadow-md whitespace-nowrap">
                Start
              </span>
            </div>


            {/* Target Flower (Destination) */}
            <div
              className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center ${
                roundSuccessCelebration ? 'scale-150 rotate-180 transition-transform duration-700' : ''
              }`}
              style={{ left: currentPath.endPoint.x, top: currentPath.endPoint.y }}
            >
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-pink-500/20 border-2 border-pink-400 flex items-center justify-center text-2xl sm:text-3xl shadow-xl">
                🌸
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold text-pink-300 mt-1 bg-slate-900/90 px-2 py-0.5 rounded-full shadow-md whitespace-nowrap">
                Flower
              </span>
            </div>

            {/* Distractor Flower if branching path */}
            {currentPath.distractorPoint && (
              <div
                className="absolute z-20 -translate-x-1/2 -translate-y-1/2 opacity-50 pointer-events-none flex flex-col items-center"
                style={{ left: currentPath.distractorPoint.x, top: currentPath.distractorPoint.y }}
              >
                <div className="w-10 h-10 rounded-full bg-gray-500/20 border border-gray-400 flex items-center justify-center text-xl">
                  🌼
                </div>
              </div>
            )}

            {/* Interactive Bee Sprite - Increased Size for Touch Ergonomics */}
            <div
              className={`absolute z-30 -translate-x-1/2 -translate-y-1/2 transition-transform duration-75 pointer-events-none ${
                isOffPathWobble ? 'animate-bounce scale-125' : ''
              } ${roundSuccessCelebration ? 'animate-spin scale-150' : ''}`}
              style={{ left: beePos.x, top: beePos.y }}
            >
              <div className="relative flex items-center justify-center">
                {/* Glowing Aura Filter */}
                <div className="absolute inset-0 bg-amber-400/25 blur-md rounded-full pointer-events-none" />

                {/* High-Resolution Realistic Bee Image - Increased Size */}
                <img
                  src={beeSrc}
                  alt="Bee Sprite"
                  className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 object-contain filter drop-shadow-[0_0_14px_rgba(245,158,11,0.9)] transition-transform transform hover:scale-110 relative z-10"
                />

                {/* Subtle Wing Flutter Pulse Indicator */}
                <div className="absolute -top-1 w-7 h-3.5 bg-amber-200/40 rounded-full animate-ping pointer-events-none" />
              </div>
            </div>

          </>
        )}
      </main>

      {/* Footer Info Bar */}
      <footer className="px-4 py-2 bg-slate-900/60 backdrop-blur-md border-t border-white/10 z-30 flex justify-between items-center text-xs text-gray-300 font-medium">
        <div className="truncate">
          <strong className="text-amber-400 capitalize">
            {currentPath?.pathType}
          </strong>
          <span className="text-gray-400 text-[11px] ml-1">
            (T{currentPath?.difficultyTier}, {currentPath?.orientation === 'portrait' ? 'Vertical ↕' : 'Horizontal ↔'})
          </span>
        </div>
        <div className="text-[11px] text-right truncate text-gray-400 ml-2">
          {isTracing ? (
            <span className="text-emerald-400 font-bold">● Tracing...</span>
          ) : (
            <span>Trace to flower!</span>
          )}
        </div>
      </footer>


      {/* Shared Clinical Settings Modal */}
      <ClinicalSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onApply={(applied) => {
          setSettings((prev) => ({
            ...prev,
            patientName: applied.patientName || prev.patientName,
            tracingMode: applied.tracingMode || prev.tracingMode,
            pathType: lockedPathType,
            toleranceBandPx: applied.toleranceBandPx || prev.toleranceBandPx,
            colorTheme: applied.colorTheme || prev.colorTheme,
            audioEnabled: applied.audioEnabled ?? prev.audioEnabled,
            roundsPerSet: applied.roundsPerSet || prev.roundsPerSet,
            pathComplexity: (applied.pathComplexity as any) || prev.pathComplexity,
            beeSpeedSec: applied.beeSpeedSec || prev.beeSpeedSec,
            orientation: applied.orientation || prev.orientation,
          }));
          setCurrentRoundNumber(1);
          setRoundResults([]);
          setIsSettingsOpen(false);
        }}
        patientName={settings.patientName}
        letterSize={1.5}
        bubbleSize={settings.toleranceBandPx}
        showBeeTracingControls={true}
        tracingMode={settings.tracingMode}
        pathType={settings.pathType}
        toleranceBandPx={settings.toleranceBandPx}
        colorTheme={settings.colorTheme}
        audioEnabled={settings.audioEnabled}
        roundsPerSet={settings.roundsPerSet}
        pathComplexity={settings.pathComplexity}
        beeSpeedSec={settings.beeSpeedSec}
        orientation={settings.orientation}
      />


      {/* Shared Game Results Modal */}
      <GameResultsModal
        isOpen={isResultsOpen}
        onClose={() => {
          setIsResultsOpen(false);
          exitFullScreenSafe();
          onExit();
        }}
        onReplay={() => {
          setIsResultsOpen(false);
          setCurrentRoundNumber(1);
          setRoundResults([]);
          sessionStartTimeRef.current = Date.now();
        }}
        data={getSessionResultData()}
      />
    </div>
  );
};
