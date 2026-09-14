'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  getDeviceTier,
  getMovementPath,
  pickPursuitTargetSeed,
  resolvePursuitDecoyCollisions,
  spawnPursuitDecoys,
  stepPursuitBody,
  calculateTrackingError,
  calculateAnticipationVsLag,
  ElementState,
  playCorrectSoundAndHaptic,
  playWrongSoundAndHaptic,
  playMissPressSoundAndHaptic,
  PursuitSettings,
  PursuitTrialMetric,
  PursuitSessionResultData,
  PursuitMovementPattern,
  AppliedClinicalSettings,
  ClinicalSettingsModal,
  resolvePursuitPattern,
  pursuitPatternName,
  buildSessionMetrics,
  useHowToPlayGate,
  usePauseShiftedClock,
  clinicalColorSessionFields,
  clinicalColorSummaryItems,
  getContrastAdjustedColor,
  CLINICAL_INK,
  isDarkClinicalBg,
} from '@candela/shared';
import { sessionDisplayName, useAuth } from '@/lib/auth-context';
import { GameMenuDrawer, ClinicalSettingSummaryItem } from '../shared/GameMenuDrawer';
import { FullscreenToggleButton } from '../shared/FullscreenToggleButton';
import { useGameSessionLock } from '../shared/useGameSessionLock';
import { ClickToStartOverlay } from '../shared/ClickToStartOverlay';
import { HowToPlayManual } from '../shared/HowToPlayManual';
import { GameResultsModal } from '../shared/GameResultsModal';
import { SlidersIcon } from '../icons/VectorIcons';
import styles from './PursuitGame.module.css';

interface PursuitGameProps {
  onExit: () => void;
  initialMovementPattern?: PursuitMovementPattern | string;
}

const TOTAL_TRIALS = 20;

export const PursuitGame: React.FC<PursuitGameProps> = ({ onExit, initialMovementPattern = 'linear_bounce' }) => {
  const { session } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const lockedPattern = resolvePursuitPattern(initialMovementPattern);

  // --- Clinical Settings State ---
  const [settings, setSettings] = useState<PursuitSettings>(() => ({
    patientName: sessionDisplayName(session),
    movementPattern: lockedPattern,
    bubbleSizePx: 140,
    targetColor: '#00E5FF',
    decoyCount: 0,
    decoySalience: 0.35,
    speedPxPerSec: 70,
    trialTimeoutSec: 0,
    totalTrials: TOTAL_TRIALS,
    blocksCount: 1,
    orientation: 'auto',
    bgColor: CLINICAL_INK,
    contrastSensitivity: 1,
  }));

  useEffect(() => {
    setSettings((prev) => (prev.movementPattern === lockedPattern ? prev : { ...prev, movementPattern: lockedPattern }));
  }, [lockedPattern]);

  useEffect(() => {
    const name = session?.user?.name?.trim();
    if (!name) return;
    setSettings((prev) => (prev.patientName === name ? prev : { ...prev, patientName: name }));
  }, [session?.user?.name]);

  // --- Session & Trial Execution State ---
  const [currentTrialIndex, setCurrentTrialIndex] = useState<number>(0);
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const [trialStartTime, setTrialStartTime] = useState<number | null>(null);

  // Locked Container Dimensions per Trial (Orientation Lock)
  const [containerBounds, setContainerBounds] = useState<{ width: number; height: number }>({
    width: 1024,
    height: 768,
  });

  // Dynamic Element Positions for active 60fps render loop
  const [elapsedSec, setElapsedSec] = useState<number>(0);

  // Metrics collection
  const trialMetricsRef = useRef<PursuitTrialMetric[]>([]);
  const missCountRef = useRef(0);
  const wrongTapCountRef = useRef(0);

  // Menu & Results Modals
  const { showHowToPlay, howToPlayMode, isSettingsOpen, setIsSettingsOpen, finishHowToPlay, openHowToPlay, closeHowToPlay, playBlocked, isMenuOpen, setIsMenuOpen } = useHowToPlayGate();
  const [gameStarted, setGameStarted] = useState(false);
  useGameSessionLock(true);
  const [isResultsOpen, setIsResultsOpen] = useState<boolean>(false);
  const [sessionResults, setSessionResults] = useState<PursuitSessionResultData | null>(null);
  const sessionFrozen = playBlocked || isResultsOpen;
  usePauseShiftedClock(sessionFrozen, Boolean(gameStarted && trialStartTime != null), (delta) => {
    setTrialStartTime((prev) => (prev == null ? prev : prev + delta));
  }, trialStartTime);

  // Animation frame ref & Timeout timer ref
  const animFrameRef = useRef<number | null>(null);
  const timeoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const targetSeedRef = useRef<number>(1);
  const decoysRef = useRef<ElementState[]>([]);
  const decoysEpochRef = useRef(-1);
  const elapsedSecRef = useRef(0);
  const trialLockRef = useRef(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Detect device tier
  const deviceTier = getDeviceTier(
    typeof window !== 'undefined' ? window.innerWidth : 1024,
    typeof window !== 'undefined' ? window.innerHeight : 768
  );

  const activeDecoyCount = Math.max(0, Math.min(3, settings.decoyCount));

  // Lock container dimensions at start of each trial to enforce orientation lock
  const updateLockedContainerBounds = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const winW = typeof window !== 'undefined' ? window.innerWidth : 1024;
      const winH = typeof window !== 'undefined' ? window.innerHeight : 768;
      const width = rect.width > 100 ? rect.width : winW;
      const height = rect.height > 100 ? rect.height : winH;
      setContainerBounds({
        width: Math.max(300, width),
        height: Math.max(300, height),
      });
    } else if (typeof window !== 'undefined') {
      setContainerBounds({
        width: Math.max(300, window.innerWidth),
        height: Math.max(300, window.innerHeight),
      });
    }
  }, []);

  const startTrial = useCallback(
    (trialIdx: number) => {
      if (trialIdx >= TOTAL_TRIALS) return;
      trialLockRef.current = false;
      updateLockedContainerBounds();

      const rect = containerRef.current?.getBoundingClientRect();
      const width = Math.max(300, rect && rect.width > 100 ? rect.width : containerBounds.width);
      const height = Math.max(300, rect && rect.height > 100 ? rect.height : containerBounds.height);
      const orientation = width >= height ? 'landscape' : 'portrait';
      const { movementPattern, bubbleSizePx, speedPxPerSec } = settingsRef.current;
      const decoySpeed = speedPxPerSec * 0.9;
      const decoyCount = Math.max(0, Math.min(3, settingsRef.current.decoyCount));
      const tier = getDeviceTier(width, height);

      if (decoysEpochRef.current !== sessionEpoch || decoysRef.current.length !== decoyCount) {
        decoysEpochRef.current = sessionEpoch;
        decoysRef.current = spawnPursuitDecoys(
          decoyCount,
          movementPattern,
          width,
          height,
          bubbleSizePx,
          decoySpeed,
          Math.random() * 100 + sessionEpoch,
          orientation,
          tier,
        );
      }

      targetSeedRef.current = pickPursuitTargetSeed(
        decoysRef.current,
        movementPattern,
        width,
        height,
        bubbleSizePx,
        speedPxPerSec,
        trialIdx,
        orientation,
        tier,
      );
      elapsedSecRef.current = 0;
      setTrialStartTime(performance.now());
      setElapsedSec(0);
    },
    [updateLockedContainerBounds, sessionEpoch, containerBounds.width, containerBounds.height],
  );

  useEffect(() => {
    if (!gameStarted || isResultsOpen) return;
    if (currentTrialIndex >= TOTAL_TRIALS) return;
    startTrial(currentTrialIndex);
  }, [currentTrialIndex, gameStarted, isResultsOpen, sessionEpoch, startTrial]);

  // Timeout handler (logged as miss / timeout, auto advance)
  useEffect(() => {
    if (isMenuOpen || playBlocked || isResultsOpen || !trialStartTime) {
      return;
    }

    if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    if (settings.trialTimeoutSec <= 0) return;

    const remainingMs = Math.max(0, settings.trialTimeoutSec * 1000 - elapsedSec * 1000);
    timeoutTimerRef.current = setTimeout(() => {
      handleTrialEnd('timeout', { x: 0, y: 0 });
    }, remainingMs);

    return () => {
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    };
  }, [
    currentTrialIndex,
    isMenuOpen,
    isSettingsOpen,
    isResultsOpen,
    trialStartTime,
    settings.trialTimeoutSec,
    playBlocked,
  ]);

  // 60 FPS Continuous Animation Loop using requestAnimationFrame
  useEffect(() => {
    if (isMenuOpen || playBlocked || isResultsOpen || !trialStartTime) {
      return;
    }

    let lastTime = performance.now();

    const loop = (now: number) => {
      const deltaSec = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      elapsedSecRef.current += deltaSec;
      const current = settingsRef.current;
      const decoySpeed = current.speedPxPerSec * 0.9;
      const orientationNow = containerBounds.width >= containerBounds.height ? 'landscape' : 'portrait';
      const target = getMovementPath(
        current.movementPattern,
        elapsedSecRef.current,
        containerBounds.width,
        containerBounds.height,
        current.bubbleSizePx,
        current.speedPxPerSec,
        0,
        targetSeedRef.current,
        orientationNow,
        deviceTier,
      );
      decoysRef.current = resolvePursuitDecoyCollisions(
        decoysRef.current.map((decoy) =>
          stepPursuitBody(
            decoy,
            deltaSec,
            containerBounds.width,
            containerBounds.height,
            current.bubbleSizePx,
            decoySpeed,
          ),
        ),
        target,
        current.bubbleSizePx,
        decoySpeed,
      );
      setElapsedSec(elapsedSecRef.current);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isMenuOpen, playBlocked, isResultsOpen, trialStartTime, containerBounds.width, containerBounds.height, deviceTier]);

  // Calculate current target state
  const orientation = containerBounds.width >= containerBounds.height ? 'landscape' : 'portrait';

  const targetState = getMovementPath(
    settings.movementPattern,
    elapsedSec,
    containerBounds.width,
    containerBounds.height,
    settings.bubbleSizePx,
    settings.speedPxPerSec,
    0, // element index 0 = target
    targetSeedRef.current,
    orientation,
    deviceTier
  );

  const decoyStates = decoysRef.current;

  // Handle Trial Completion
  const handleTrialEnd = (
    outcome: 'correct' | 'timeout',
    tapPos: { x: number; y: number }
  ) => {
    if (!gameStarted || isResultsOpen || playBlocked || trialLockRef.current) return;
    trialLockRef.current = true;
    if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);

    const now = performance.now();
    const reactionTimeMs = trialStartTime
      ? Math.max(100, Math.round(now - trialStartTime))
      : settings.trialTimeoutSec * 1000;

    const trackingErrorPx =
      outcome === 'timeout'
        ? Math.round(containerBounds.width * 0.25)
        : calculateTrackingError(tapPos.x, tapPos.y, targetState.x, targetState.y);

    const vectorAlignment = calculateAnticipationVsLag(
      tapPos.x,
      tapPos.y,
      targetState.x,
      targetState.y,
      targetState.vx,
      targetState.vy
    );

    if (outcome === 'correct') {
      playCorrectSoundAndHaptic();
    } else {
      playMissPressSoundAndHaptic();
    }

    const metric: PursuitTrialMetric = {
      trialIndex: currentTrialIndex,
      blockIndex: 0,
      outcome,
      reactionTimeMs,
      trackingErrorPx,
      anticipationRatio: vectorAlignment.ratio,
      targetPositionAtTap: { x: Math.round(targetState.x), y: Math.round(targetState.y) },
      tapPosition: tapPos,
    };

    trialMetricsRef.current.push(metric);

    if (trialMetricsRef.current.length >= TOTAL_TRIALS) {
      completeSession();
      return;
    }
    setCurrentTrialIndex((prev) => prev + 1);
  };

  const handleFieldMiss = () => {
    if (!gameStarted || isResultsOpen || playBlocked || isMenuOpen) return;
    missCountRef.current += 1;
    playMissPressSoundAndHaptic();
  };

  const handleWrongTap = () => {
    if (!gameStarted || isResultsOpen || playBlocked || isMenuOpen || trialLockRef.current) return;
    wrongTapCountRef.current += 1;
    playWrongSoundAndHaptic();
  };

  const completeSession = () => {
    const allTrials = trialMetricsRef.current;
    const correctCount = allTrials.filter((t) => t.outcome === 'correct').length;
    const wrongTaps = wrongTapCountRef.current;
    const timeouts = allTrials.filter((t) => t.outcome === 'timeout').length;
    const misses = missCountRef.current;
    const metrics = buildSessionMetrics({
      correct: correctCount,
      wrongTaps,
      misses,
      timeouts,
      reactionMs: allTrials.filter((t) => t.outcome === 'correct').map((t) => t.reactionTimeMs),
    });

    const avgTrackingErrorPx =
      allTrials.length > 0
        ? Math.round(allTrials.reduce((sum, t) => sum + t.trackingErrorPx, 0) / allTrials.length)
        : 0;

    const anticipationRatios = allTrials.map((t) => t.anticipationRatio);
    const avgAnticipation =
      anticipationRatios.length > 0
        ? anticipationRatios.reduce((a, b) => a + b, 0) / anticipationRatios.length
        : 0;

    const anticipationVsLagScore =
      avgAnticipation > 0.1
        ? `Optimal Anticipation (${Math.round((avgAnticipation + 1) * 50)}% Leading)`
        : avgAnticipation < -0.1
        ? `Lagging Pursuit (${Math.round((1 - avgAnticipation) * 50)}% Trailing)`
        : `Balanced Pursuit (Centered)`;

    const starRating = Math.max(1, Math.min(5, Math.ceil((metrics.accuracy / 100) * 5)));

    const resultData: PursuitSessionResultData = {
      patientName: settings.patientName,
      sessionId: Date.now(),
      date: new Date().toISOString(),
      gameName: `Pursuit — ${pursuitPatternName(settings.movementPattern)}`,
      stimuliCount: allTrials.length,
      letterSize: 1.5,
      speed: `${settings.speedPxPerSec} px/s`,
      durationSec: Math.round(allTrials.reduce((sum, t) => sum + t.reactionTimeMs, 0) / 1000),
      clicksTotal: correctCount + wrongTaps + misses,
      correct: correctCount,
      ...metrics,
      endedBy: 'cleared',
      movementPattern: settings.movementPattern,
      decoyCount: settings.decoyCount,
      speedPxPerSec: settings.speedPxPerSec,
      avgTrackingErrorPx,
      anticipationVsLagScore,
      blockMetrics: [],
      starRating,
      ...clinicalColorSessionFields(settings.bgColor || CLINICAL_INK, settings.targetColor, settings.contrastSensitivity ?? 1),
    };

    setSessionResults(resultData);
    setIsResultsOpen(true);
  };

  const beginPlay = () => {
    trialMetricsRef.current = [];
    missCountRef.current = 0;
    wrongTapCountRef.current = 0;
    trialLockRef.current = false;
    setCurrentTrialIndex(0);
    setIsResultsOpen(false);
    decoysEpochRef.current = -1;
    decoysRef.current = [];
    elapsedSecRef.current = 0;
    setTrialStartTime(null);
    setElapsedSec(0);
    setSessionEpoch((n) => n + 1);
    setGameStarted(true);
  };

  const handleReset = () => {
    trialMetricsRef.current = [];
    missCountRef.current = 0;
    wrongTapCountRef.current = 0;
    trialLockRef.current = false;
    setCurrentTrialIndex(0);
    decoysEpochRef.current = -1;
    decoysRef.current = [];
    elapsedSecRef.current = 0;
    setIsResultsOpen(false);
    setTrialStartTime(null);
    setElapsedSec(0);
    setGameStarted(false);
    setIsSettingsOpen(true);
  };

  const handleReplay = () => {
    beginPlay();
  };

  const handleApplyClinicalSettings = (applied: AppliedClinicalSettings) => {
    setSettings((prev) => ({
      ...prev,
      patientName: applied.patientName || prev.patientName,
      bubbleSizePx: applied.bubbleSize || prev.bubbleSizePx,
      movementPattern: lockedPattern,
      targetColor: applied.pursuitTargetColor || prev.targetColor,
      decoyCount: applied.pursuitDecoyCount ?? prev.decoyCount,
      speedPxPerSec: applied.pursuitSpeedPxPerSec || prev.speedPxPerSec,
      trialTimeoutSec: applied.pursuitTrialTimeoutSec ?? prev.trialTimeoutSec,
      bgColor: applied.bgColor || prev.bgColor || CLINICAL_INK,
      contrastSensitivity: applied.contrastSensitivity ?? prev.contrastSensitivity ?? 1,
    }));
    setIsSettingsOpen(false);
    beginPlay();
  };

  const fieldColor = settings.bgColor || CLINICAL_INK;
  const paintedTarget = getContrastAdjustedColor(
    settings.targetColor,
    fieldColor,
    settings.contrastSensitivity ?? 1,
  );
  const paintedDecoy = getContrastAdjustedColor(
    paintedTarget,
    fieldColor,
    settings.decoySalience,
  );

  // Menu settings summary
  const settingsSummary: ClinicalSettingSummaryItem[] = [
    { label: 'Patient Name', value: settings.patientName },
    { label: 'Movement Pattern', value: pursuitPatternName(settings.movementPattern) },
    { label: 'Decoy Count', value: `${activeDecoyCount} Decoys` },
    { label: 'Pursuit Speed', value: `${settings.speedPxPerSec} px/s` },
    { label: 'Bubble Diameter', value: `${settings.bubbleSizePx}px` },
    { label: 'Trial Timeout', value: settings.trialTimeoutSec > 0 ? `${settings.trialTimeoutSec}s` : 'Off' },
    ...clinicalColorSummaryItems(
      settings.bgColor || CLINICAL_INK,
      settings.targetColor,
      settings.contrastSensitivity ?? 1,
    ),
  ];

  return (
    <div ref={containerRef} className={styles.gameContainer} style={{ backgroundColor: fieldColor }}>
      {!gameStarted && !showHowToPlay && !isSettingsOpen && !isResultsOpen ? (
        <ClickToStartOverlay
          accentModuleId="pursuit"
          title="Pursuit"
          onStart={beginPlay}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onExit={onExit}
        />
      ) : null}
      {gameStarted && !isResultsOpen ? (
        <div
          className="absolute top-12 left-1/2 -translate-x-1/2 z-50 font-bold pointer-events-none"
          style={{ color: isDarkClinicalBg(fieldColor) ? '#F8FAFC' : '#1A2A32' }}
        >
          Trial {Math.min(currentTrialIndex + 1, TOTAL_TRIALS)}/{TOTAL_TRIALS}
        </div>
      ) : null}

      {/* BARE FIELD CANVAS WITH MOVING BUBBLES */}
      <div
        className={styles.canvas}
        style={{ backgroundColor: fieldColor }}
        onPointerDown={(e) => {
          if (e.target !== e.currentTarget) return;
          handleFieldMiss();
        }}
      >
        {/* TARGET BUBBLE (High Luminance, Bright Color) */}
        {!isResultsOpen && gameStarted && (
          <div
            className={styles.targetBubble}
            style={{
              left: `${targetState.x}px`,
              top: `${targetState.y}px`,
              width: `${settings.bubbleSizePx}px`,
              height: `${settings.bubbleSizePx}px`,
              backgroundColor: paintedTarget,
              border: 'none',
              boxShadow: 'none',
              touchAction: 'none',
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              const rect = containerRef.current?.getBoundingClientRect();
              const tapX = rect ? e.clientX - rect.left : e.clientX;
              const tapY = rect ? e.clientY - rect.top : e.clientY;
              handleTrialEnd('correct', { x: tapX, y: tapY });
            }}
          />
        )}

        {/* DECOY BUBBLES (Dimmer, Lower Saturation of Similar Hue) */}
        {!isResultsOpen &&
          gameStarted &&
          decoyStates.map((decoy, idx) => (
            <div
              key={idx}
              className={styles.decoyBubble}
              style={{
                left: `${decoy.x}px`,
                top: `${decoy.y}px`,
                width: `${settings.bubbleSizePx}px`,
                height: `${settings.bubbleSizePx}px`,
                backgroundColor: paintedDecoy,
                opacity: 1,
                border: 'none',
                touchAction: 'none',
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                handleWrongTap();
              }}
            />
          ))}
      </div>

      <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-50 flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity duration-200">
        <FullscreenToggleButton />
        <button
          type="button"
          onClick={() => setIsMenuOpen(true)}
          className="w-11 h-11 flex items-center justify-center cursor-pointer active:scale-95 text-slate-300"
          title="Settings menu"
        >
          <SlidersIcon className="w-5 h-5" />
        </button>
      </div>

      {/* MENU DRAWER */}
      <GameMenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onOpenHowToPlay={openHowToPlay}
        onQuit={onExit}
        onReset={handleReset}
        onOpenSettings={() => {
          setIsMenuOpen(false);
          setIsSettingsOpen(true);
        }}
        resetButtonLabel="Restart Session"
        sessionInProgress={gameStarted && !isSettingsOpen && !isResultsOpen}
        settingsSummary={settingsSummary}
      />

      {/* CLINICAL SETTINGS MODAL */}
      <HowToPlayManual
        moduleId="pursuit"
        isOpen={showHowToPlay}
        mode={howToPlayMode}
        onContinue={finishHowToPlay}
        onClose={closeHowToPlay}
      />
      <ClinicalSettingsModal
        accentModuleId="pursuit"
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onApply={handleApplyClinicalSettings}
        patientName={settings.patientName}
        letterSize={1.5}
        bubbleSize={settings.bubbleSizePx}
        showPursuitControls={true}
        pursuitMovementPattern={settings.movementPattern}
        pursuitTargetColor={settings.targetColor}
        pursuitDecoyCount={settings.decoyCount}
        pursuitSpeedPxPerSec={settings.speedPxPerSec}
        pursuitTrialTimeoutSec={settings.trialTimeoutSec}
        bgColor={fieldColor}
        contrastSensitivity={settings.contrastSensitivity ?? 1}
        sessionLocked={gameStarted && !isResultsOpen}
      />

      {/* SESSION RESULTS MODAL */}
      {sessionResults && (
        <GameResultsModal
          isOpen={isResultsOpen}
          onClose={() => {
            setIsResultsOpen(false);
            onExit();
          }}
          onReplay={handleReplay}
          data={sessionResults}
        />
      )}
    </div>
  );
};
