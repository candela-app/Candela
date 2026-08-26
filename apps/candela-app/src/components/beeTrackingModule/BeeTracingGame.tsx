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
  resolveOrientation,
  resolveBeePathType,
  DEFAULT_BEE_TARGET_DOT_COLOR,
  beeHeadingDeg,
  lerpHeadingDeg,
  reactionStatsFromMs,
} from '@candela/shared';
import {
  generateBeePath,
  GeneratedPath,
  findNearestPathPoint,
  findNearestPathPointInWindow,
  evaluateTracingMetrics,
} from './BeePathGenerator';
import { GameResultsModal } from '../shared/GameResultsModal';
import { GameMenuDrawer } from '../shared/GameMenuDrawer';
import { useGameSessionLock } from '../shared/useGameSessionLock';
import { ClickToStartOverlay } from '../shared/ClickToStartOverlay';
import { ReplayIcon, SlidersIcon } from '../icons/VectorIcons';
import beePng from '@candela/shared/assets/bee.png';

const beeSrc = typeof beePng === 'string' ? beePng : beePng.src;
const INVISIBLE_CORRIDOR_PX = 72;
const CORRIDOR_SEARCH_WINDOW = 80;
const VISIBLE_PATH_WIDTH = 6;

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
  targetDotColor: DEFAULT_BEE_TARGET_DOT_COLOR,
  audioEnabled: true,
  inputSensitivity: 'auto',
  roundsPerSet: 10, // Auto progress plays 10 rounds through the path sequence
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
  const [gameStarted, setGameStarted] = useState(false);
  const [beeHeading, setBeeHeading] = useState(0);
  useGameSessionLock(true);
  const [isResultsOpen, setIsResultsOpen] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

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
  const roundStartTimeRef = useRef<number>(performance.now());
  const reactionReadyAtRef = useRef<number | null>(null);
  const roundReactionMsRef = useRef<number | null>(null);
  const currentPathIndexRef = useRef<number>(0);
  const roundSuccessRef = useRef(false);

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
      roundSuccessRef.current = false;
      setIsOffPathWobble(false);
      setHasDemoPlayed(false); // Reset demo played flag for new round
      currentPathIndexRef.current = 0; // Reset sequential path progress index
      roundStartTimeRef.current = performance.now();
      roundReactionMsRef.current = null;

      if (settings.tracingMode === 'guided') {
        reactionReadyAtRef.current = null;
        // Start guided demo playback on round start
        runGuidedDemo(generated);
      } else {
        reactionReadyAtRef.current = performance.now();
      }
    },
    [settings.pathType, settings.tracingMode, settings.pathComplexity, settings.orientation]
  );


  // Guided demo auto-movement
  const runGuidedDemo = (generated: GeneratedPath) => {
    setIsGuidedDemoRunning(true);
    reactionReadyAtRef.current = null;
    roundReactionMsRef.current = null;
    const duration = settings.beeSpeedSec * 1000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);

      const ptIndex = Math.floor(progress * (generated.points.length - 1));
      const pt = generated.points[ptIndex] || generated.startPoint;
      currentPathIndexRef.current = ptIndex;
      setBeePos(pt);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsGuidedDemoRunning(false);
        setHasDemoPlayed(true); // Demo complete -> button changes to 'Replay Demo'
        setBeePos(generated.startPoint);
        reactionReadyAtRef.current = performance.now();
        roundReactionMsRef.current = null;
        showToast('Demo complete! Now trace the path!');
      }
    };

    requestAnimationFrame(animate);
  };

  // Re-init path ONLY when currentRoundNumber or explicit init is triggered
  useEffect(() => {
    if (isSettingsOpen || !gameStarted) return;
    initRoundPath(currentRoundNumber);
  }, [currentRoundNumber, initRoundPath, isSettingsOpen, gameStarted]);

  useEffect(() => {
    if (!currentPath) return;
    const lookAhead =
      currentPath.pathType === 'spiral' || currentPath.pathType === 'curve' || currentPath.pathType === 'wave' ? 8 : 4;
    const target = beeHeadingDeg(currentPath.points, currentPathIndexRef.current, lookAhead);
    setBeeHeading((prev) => lerpHeadingDeg(prev, target, currentPath.pathType === 'spiral' ? 0.2 : 0.34));
  }, [beePos, currentPath]);

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
      if (roundReactionMsRef.current == null && reactionReadyAtRef.current != null) {
        roundReactionMsRef.current = Math.max(0, Math.round(performance.now() - reactionReadyAtRef.current));
      }
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
      CORRIDOR_SEARCH_WINDOW
    );

    if (Math.random() < 0.3) {
      triggerAudioBuzz();
    }

    const corridorPx = Math.max(settings.toleranceBandPx, INVISIBLE_CORRIDOR_PX);
    if (distance > corridorPx) {
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
    if (roundSuccessRef.current || !currentPath) return;
    roundSuccessRef.current = true;
    setIsTracing(false);
    setRoundSuccessCelebration(true);

    if (settings.audioEnabled) {
      playCorrectSoundAndHaptic();
      playSuccessSoundAndHaptic();
    }

    showToast('🎉 Flower Reached! Great Job!');

    const completionTimeSec = Math.max(
      1,
      Math.round((performance.now() - roundStartTimeRef.current) / 1000),
    );
    const corridorPx = Math.max(settings.toleranceBandPx, INVISIBLE_CORRIDOR_PX);
    const metrics = evaluateTracingMetrics(
      userTracePoints,
      currentPath.points,
      corridorPx,
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
      reactionTimeMs: roundReactionMsRef.current ?? undefined,
      tracedPoints: userTracePoints,
      targetPoints: currentPath.points,
      idealSvgPathD: currentPath.svgPathD,
      orientation: currentPath.orientation,
    };

    const updatedResults = [...roundResults, roundData];
    setRoundResults(updatedResults);
    const finishedRound = currentRoundNumber;

    setTimeout(() => {
      if (finishedRound >= settings.roundsPerSet) {
        setIsResultsOpen(true);
      } else {
        setCurrentRoundNumber((prev) => (prev === finishedRound ? prev + 1 : prev));
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
      avgReactionSec: reactionStatsFromMs(
        roundResults
          .map((r) => r.reactionTimeMs)
          .filter((ms): ms is number => typeof ms === 'number' && Number.isFinite(ms)),
      ).avgSec,
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

  const uiColor =
    settings.colorTheme === 'high_contrast'
      ? '#F8FAFC'
      : settings.colorTheme === 'dark'
      ? '#E7EEF5'
      : '#1A2A32';
  const mutedColor =
    settings.colorTheme === 'high_contrast'
      ? '#CBD5E1'
      : settings.colorTheme === 'dark'
      ? '#9AA8B5'
      : '#4A5C66';
  const targetDotColor = settings.targetDotColor || DEFAULT_BEE_TARGET_DOT_COLOR;
  const isGuided = settings.tracingMode === 'guided';

  return (
    <div className={`w-screen h-screen ${themeBgClass} select-none touch-none overflow-hidden relative transition-colors duration-300`}>
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-40 bg-amber-500 text-slate-950 font-black px-4 py-2 rounded-2xl shadow-xl text-xs animate-bounce">
          {toastMessage}
        </div>
      )}

      <span
        className="absolute top-12 right-4 z-30 font-bold text-sm pointer-events-none"
        style={{ color: uiColor }}
      >
        Round {currentRoundNumber}/{settings.roundsPerSet}
      </span>

      {!gameStarted && !isSettingsOpen && !isResultsOpen ? (
        <ClickToStartOverlay
          title="Bee Path Tracing"
          onStart={() => setGameStarted(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onExit={onExit}
        />
      ) : null}

      {/* Main Interactive Canvas Area */}
      <main
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="absolute inset-0 cursor-crosshair w-full h-full overflow-hidden"
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

              {/* Invisible corridor is hit-tested only. Draw a thin visible guide path. */}
              <path
                d={currentPath.svgPathD}
                fill="none"
                stroke={pathColor}
                strokeWidth={currentPath.pathType === 'spiral' ? 6 : VISIBLE_PATH_WIDTH}
                strokeDasharray={currentPath.dashArray || undefined}
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
                  strokeWidth={VISIBLE_PATH_WIDTH}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.28"
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

              {currentPath.distractorPoint ? (
                <circle
                  cx={currentPath.distractorPoint.x}
                  cy={currentPath.distractorPoint.y}
                  r={16}
                  fill={targetDotColor}
                  opacity={0.35}
                />
              ) : null}
              <circle
                cx={currentPath.endPoint.x}
                cy={currentPath.endPoint.y}
                r={roundSuccessCelebration ? 26 : 18}
                fill={targetDotColor}
              />
            </svg>

            {/* Interactive Bee Sprite - Increased Size for Touch Ergonomics */}
            <div
              className={`absolute z-30 transition-transform duration-75 pointer-events-none ${
                isOffPathWobble ? 'animate-bounce' : ''
              } ${roundSuccessCelebration && currentPath.pathType !== 'spiral' ? 'animate-spin scale-150' : ''}`}
              style={{
                left: beePos.x,
                top: beePos.y,
                transform: `translate(-50%, -50%) rotate(${beeHeading}deg)`,
              }}
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

      {isGuided && currentPath ? (
        <button
          type="button"
          onClick={() => {
            if (roundSuccessCelebration) return;
            runGuidedDemo(currentPath);
          }}
          disabled={isGuidedDemoRunning}
          className="absolute bottom-14 right-4 z-40 w-11 h-11 bg-transparent border-0 flex items-center justify-center cursor-pointer disabled:opacity-45 active:scale-95"
          style={{ color: mutedColor }}
          title={hasDemoPlayed ? 'Replay demo' : 'Play demo'}
        >
          <ReplayIcon className="w-[22px] h-[22px]" />
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => setIsMenuOpen(true)}
        className="absolute bottom-3 right-4 z-40 w-11 h-11 bg-transparent border-0 flex items-center justify-center cursor-pointer active:scale-95"
        style={{ color: mutedColor }}
        title="Settings menu"
      >
        <SlidersIcon className="w-[22px] h-[22px]" />
      </button>

      <GameMenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onQuit={() => {
          exitFullScreenSafe();
          onExit();
        }}
        onReset={() => {
          setCurrentRoundNumber(1);
          setRoundResults([]);
          setGameStarted(false);
          setIsSettingsOpen(true);
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        resetButtonLabel="Reset Level"
        sessionInProgress={gameStarted && !isSettingsOpen && !isResultsOpen}
        settingsSummary={[
          { label: 'Patient', value: settings.patientName },
          { label: 'Mode', value: settings.tracingMode },
          { label: 'Path', value: String(settings.pathType) },
          { label: 'Path Width', value: `${settings.toleranceBandPx}px` },
          { label: 'Rounds', value: `${currentRoundNumber}/${settings.roundsPerSet}` },
        ]}
      />

      {/* Shared Clinical Settings Modal */}
      <ClinicalSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onApply={(applied) => {
          const wasPlaying = gameStarted && !isResultsOpen;
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
            targetDotColor: applied.targetDotColor || prev.targetDotColor || DEFAULT_BEE_TARGET_DOT_COLOR,
          }));
          setCurrentRoundNumber(1);
          setRoundResults([]);
          setIsSettingsOpen(false);
          if (wasPlaying) setGameStarted(true);
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
        targetDotColor={settings.targetDotColor || DEFAULT_BEE_TARGET_DOT_COLOR}
        sessionLocked={gameStarted && !isResultsOpen}
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
