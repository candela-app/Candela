'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  getDeviceTier,
  getMovementPath,
  calculateTrackingError,
  calculateAnticipationVsLag,
  playCorrectSoundAndHaptic,
  playWrongSoundAndHaptic,
  PursuitSettings,
  PursuitTrialMetric,
  PursuitBlockMetric,
  PursuitSessionResultData,
  PursuitMovementPattern,
  AppliedClinicalSettings,
  ClinicalSettingsModal,
  resolveLookPursuitPattern,
  pursuitPatternName,
  advanceLookDwell,
  createLookDwellState,
  resolveLookOverId,
  buildSessionMetrics,
} from '@candela/shared';
import { sessionDisplayName, useAuth } from '@/lib/auth-context';
import { useFaceLook } from '@/lib/use-face-look';
import { GameMenuDrawer, ClinicalSettingSummaryItem } from '../shared/GameMenuDrawer';
import { useGameSessionLock } from '../shared/useGameSessionLock';
import { ClickToStartOverlay } from '../shared/ClickToStartOverlay';
import { PursuitResultsModal } from '../pursuitModule/PursuitResultsModal';
import { SlidersIcon } from '../icons/VectorIcons';
import { GazeHoldGame } from './GazeHoldGame';
import styles from './LookPursuitGame.module.css';

interface LookPursuitGameProps {
  onExit: () => void;
  initialMovementPattern?: PursuitMovementPattern | string;
}

const TOTAL_TRIALS = 20;
const TRIALS_PER_BLOCK = 5;
const TOTAL_BLOCKS = 4;

export const LookPursuitGame: React.FC<LookPursuitGameProps> = ({
  onExit,
  initialMovementPattern = 'linear_bounce',
}) => {
  if (initialMovementPattern === 'stationary') {
    return <GazeHoldGame onExit={onExit} />;
  }
  const lockedPattern = resolveLookPursuitPattern(initialMovementPattern);
  return <LookPursuitMovingGame onExit={onExit} lockedPattern={lockedPattern} />;
};

const LookPursuitMovingGame: React.FC<{
  onExit: () => void;
  lockedPattern: PursuitMovementPattern;
}> = ({ onExit, lockedPattern }) => {
  const { session } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const look = useFaceLook(true);

  const [settings, setSettings] = useState<PursuitSettings>(() => ({
    patientName: sessionDisplayName(session),
    movementPattern: lockedPattern,
    bubbleSizePx: 100,
    targetColor: '#00E5FF',
    decoyCount: 2,
    decoySalience: 0.35,
    speedPxPerSec: 110,
    trialTimeoutSec: 0,
    totalTrials: TOTAL_TRIALS,
    blocksCount: TOTAL_BLOCKS,
    orientation: 'auto',
  }));

  useEffect(() => {
    setSettings((prev) => (prev.movementPattern === lockedPattern ? prev : { ...prev, movementPattern: lockedPattern }));
  }, [lockedPattern]);

  useEffect(() => {
    const name = session?.user?.name?.trim();
    if (!name) return;
    setSettings((prev) => (prev.patientName === name ? prev : { ...prev, patientName: name }));
  }, [session?.user?.name]);

  const [currentTrialIndex, setCurrentTrialIndex] = useState<number>(0);
  const [isBlockPaused, setIsBlockPaused] = useState<boolean>(false);
  const [pausedBlockIndex, setPausedBlockIndex] = useState<number>(0);
  const [trialStartTime, setTrialStartTime] = useState<number | null>(null);
  const [containerBounds, setContainerBounds] = useState<{ width: number; height: number }>({
    width: 1024,
    height: 768,
  });
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const trialMetricsRef = useRef<PursuitTrialMetric[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(true);
  const [gameStarted, setGameStarted] = useState(false);
  useGameSessionLock(true);
  const [isResultsOpen, setIsResultsOpen] = useState<boolean>(false);
  const [sessionResults, setSessionResults] = useState<PursuitSessionResultData | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seedRef = useRef<number>(1);
  const dwellRef = useRef(createLookDwellState());
  const endingRef = useRef(false);
  const targetStateRef = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const decoyStatesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number }>>([]);

  const deviceTier = getDeviceTier(
    typeof window !== 'undefined' ? window.innerWidth : 1024,
    typeof window !== 'undefined' ? window.innerHeight : 768,
  );
  const currentBlockIndex = Math.floor(currentTrialIndex / TRIALS_PER_BLOCK);
  const activeDecoyCount = Math.min(
    3,
    currentBlockIndex === 0 ? 1 : Math.min(settings.decoyCount, currentBlockIndex + 1),
  );

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

  const completeSession = useCallback(() => {
    const allTrials = trialMetricsRef.current;
    const correctCount = allTrials.filter((t) => t.outcome === 'correct').length;
    const wrongTaps = allTrials.filter((t) => t.outcome === 'incorrect').length;
    const timeouts = allTrials.filter((t) => t.outcome === 'timeout').length;
    const metrics = buildSessionMetrics({
      correct: correctCount,
      wrongTaps,
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
    const blockMetrics: PursuitBlockMetric[] = Array.from({ length: TOTAL_BLOCKS }, (_, bIdx) => {
      const bTrials = allTrials.filter((t) => t.blockIndex === bIdx);
      const bCorrect = bTrials.filter((t) => t.outcome === 'correct').length;
      return {
        blockIndex: bIdx,
        accuracyPercent: Math.round((bCorrect / Math.max(1, bTrials.length)) * 100),
        avgTrackingErrorPx:
          bTrials.length > 0
            ? Math.round(bTrials.reduce((sum, t) => sum + t.trackingErrorPx, 0) / bTrials.length)
            : 0,
        avgReactionTimeMs:
          bTrials.length > 0
            ? Math.round(bTrials.reduce((sum, t) => sum + t.reactionTimeMs, 0) / bTrials.length)
            : 0,
        trials: bTrials,
      };
    });
    setSessionResults({
      patientName: settings.patientName,
      sessionId: Date.now(),
      date: new Date().toISOString(),
      gameName: `Look Pursuit — ${pursuitPatternName(settings.movementPattern)}`,
      stimuliCount: allTrials.length,
      letterSize: 1.5,
      speed: `${settings.speedPxPerSec} px/s`,
      durationSec: Math.round(allTrials.reduce((sum, t) => sum + t.reactionTimeMs, 0) / 1000),
      clicksTotal: allTrials.length,
      correct: correctCount,
      ...metrics,
      movementPattern: settings.movementPattern,
      decoyCount: settings.decoyCount,
      speedPxPerSec: settings.speedPxPerSec,
      avgTrackingErrorPx,
      anticipationVsLagScore,
      blockMetrics,
      starRating: Math.max(1, Math.min(5, Math.ceil((metrics.accuracy / 100) * 5))),
    });
    setIsResultsOpen(true);
  }, [settings]);

  const startTrial = useCallback(
    (trialIdx: number) => {
      if (trialIdx >= TOTAL_TRIALS) {
        completeSession();
        return;
      }
      if (trialIdx > 0 && trialIdx % TRIALS_PER_BLOCK === 0 && !isBlockPaused) {
        setIsBlockPaused(true);
        setPausedBlockIndex(Math.floor(trialIdx / TRIALS_PER_BLOCK));
        setTimeout(() => {
          setIsBlockPaused(false);
          updateLockedContainerBounds();
          seedRef.current = Math.random() * 100 + trialIdx;
          endingRef.current = false;
          dwellRef.current = createLookDwellState();
          setTrialStartTime(performance.now());
          setElapsedSec(0);
        }, 1500);
        return;
      }
      updateLockedContainerBounds();
      seedRef.current = Math.random() * 100 + trialIdx;
      endingRef.current = false;
      dwellRef.current = createLookDwellState();
      setTrialStartTime(performance.now());
      setElapsedSec(0);
    },
    [isBlockPaused, updateLockedContainerBounds, completeSession],
  );

  useEffect(() => {
    if (isSettingsOpen || !gameStarted) return;
    startTrial(currentTrialIndex);
  }, [currentTrialIndex, isSettingsOpen, gameStarted, startTrial]);

  const handleTrialEnd = useCallback(
    (outcome: 'correct' | 'incorrect' | 'timeout', tapPos: { x: number; y: number }) => {
      if (endingRef.current) {
        return;
      }
      endingRef.current = true;
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
      const now = performance.now();
      const reactionTimeMs = trialStartTime ? Math.max(100, now - trialStartTime) : settings.trialTimeoutSec * 1000;
      const ts = targetStateRef.current;
      const trackingErrorPx =
        outcome === 'timeout'
          ? Math.round(containerBounds.width * 0.25)
          : calculateTrackingError(tapPos.x, tapPos.y, ts.x, ts.y);
      const vectorAlignment = calculateAnticipationVsLag(tapPos.x, tapPos.y, ts.x, ts.y, ts.vx, ts.vy);
      if (outcome === 'correct') {
        playCorrectSoundAndHaptic();
      } else {
        playWrongSoundAndHaptic();
      }
      trialMetricsRef.current.push({
        trialIndex: currentTrialIndex,
        blockIndex: currentBlockIndex,
        outcome,
        reactionTimeMs,
        trackingErrorPx,
        anticipationRatio: vectorAlignment.ratio,
        targetPositionAtTap: { x: Math.round(ts.x), y: Math.round(ts.y) },
        tapPosition: tapPos,
      });
      setCurrentTrialIndex((prev) => prev + 1);
    },
    [trialStartTime, settings.trialTimeoutSec, containerBounds.width, currentTrialIndex, currentBlockIndex],
  );

  useEffect(() => {
    if (isBlockPaused || isMenuOpen || isSettingsOpen || isResultsOpen || !trialStartTime) {
      return;
    }
    if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    if (settings.trialTimeoutSec <= 0) return;
    timeoutTimerRef.current = setTimeout(() => {
      handleTrialEnd('timeout', { x: 0, y: 0 });
    }, settings.trialTimeoutSec * 1000);
    return () => {
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    };
  }, [
    currentTrialIndex,
    isBlockPaused,
    isMenuOpen,
    isSettingsOpen,
    isResultsOpen,
    trialStartTime,
    settings.trialTimeoutSec,
    handleTrialEnd,
  ]);

  const orientation = containerBounds.width >= containerBounds.height ? 'landscape' : 'portrait';
  const targetState = getMovementPath(
    settings.movementPattern,
    elapsedSec,
    containerBounds.width,
    containerBounds.height,
    settings.bubbleSizePx,
    settings.speedPxPerSec,
    0,
    seedRef.current,
    orientation,
    deviceTier,
  );
  targetStateRef.current = targetState;
  const decoyStates = Array.from({ length: activeDecoyCount }, (_, idx) =>
    getMovementPath(
      settings.movementPattern,
      elapsedSec,
      containerBounds.width,
      containerBounds.height,
      settings.bubbleSizePx,
      settings.speedPxPerSec * 0.9,
      idx + 1,
      seedRef.current + (idx + 1) * 1.5,
      orientation,
      deviceTier,
    ),
  );
  decoyStatesRef.current = decoyStates;

  useEffect(() => {
    if (isBlockPaused || isMenuOpen || isSettingsOpen || isResultsOpen || !trialStartTime) {
      return;
    }
    let lastTime = performance.now();
    const loop = (now: number): void => {
      const deltaSec = (now - lastTime) / 1000;
      lastTime = now;
      const sample = look.sampleRef.current;
      if (!sample.faceLost) {
        setElapsedSec((prev) => prev + deltaSec);
        const lookX = sample.x * containerBounds.width;
        const lookY = sample.y * containerBounds.height;
        const overId = resolveLookOverId(
          lookX,
          lookY,
          targetStateRef.current,
          decoyStatesRef.current,
          settings.bubbleSizePx,
        );
        const fired = advanceLookDwell(dwellRef.current, overId, deltaSec * 1000);
        if (fired) {
          handleTrialEnd(fired === 'target' ? 'correct' : 'incorrect', { x: lookX, y: lookY });
        }
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [
    isBlockPaused,
    isMenuOpen,
    isSettingsOpen,
    isResultsOpen,
    trialStartTime,
    look.sampleRef,
    containerBounds.width,
    containerBounds.height,
    settings.bubbleSizePx,
    handleTrialEnd,
  ]);

  const resetSession = (openSettings: boolean): void => {
    trialMetricsRef.current = [];
    setCurrentTrialIndex(0);
    setIsBlockPaused(false);
    setIsResultsOpen(false);
    setGameStarted(false);
    setIsSettingsOpen(openSettings);
  };

  const handleReset = (): void => {
    resetSession(true);
  };

  const handleReplay = (): void => {
    trialMetricsRef.current = [];
    setCurrentTrialIndex(0);
    setIsBlockPaused(false);
    setIsResultsOpen(false);
    setGameStarted(true);
  };

  const handleApplyClinicalSettings = (applied: AppliedClinicalSettings): void => {
    setSettings((prev) => ({
      ...prev,
      patientName: applied.patientName || prev.patientName,
      bubbleSizePx: applied.bubbleSize || prev.bubbleSizePx,
      movementPattern: lockedPattern,
      targetColor: applied.pursuitTargetColor || prev.targetColor,
      decoyCount: applied.pursuitDecoyCount ?? prev.decoyCount,
      speedPxPerSec: applied.pursuitSpeedPxPerSec || prev.speedPxPerSec,
      trialTimeoutSec: applied.pursuitTrialTimeoutSec ?? prev.trialTimeoutSec,
    }));
    resetSession(false);
  };

  const settingsSummary: ClinicalSettingSummaryItem[] = [
    { label: 'Patient Name', value: settings.patientName },
    { label: 'Movement Pattern', value: pursuitPatternName(settings.movementPattern) },
    { label: 'Decoy Count', value: `${activeDecoyCount} Decoys` },
    { label: 'Pursuit Speed', value: `${settings.speedPxPerSec} px/s` },
    { label: 'Bubble Diameter', value: `${settings.bubbleSizePx}px` },
    { label: 'Trial Timeout', value: settings.trialTimeoutSec > 0 ? `${settings.trialTimeoutSec}s` : 'Off' },
  ];

  const lookPx =
    look.cursor && !look.faceLost
      ? { x: look.cursor.x * containerBounds.width, y: look.cursor.y * containerBounds.height }
      : null;

  return (
    <div ref={containerRef} className={styles.gameContainer}>
      <video id="look-pursuit-cam" ref={look.videoRef} className={styles.preview} muted playsInline />
      {!gameStarted && !isSettingsOpen && !isResultsOpen ? (
        <ClickToStartOverlay
          title="Look Pursuit"
          hint="Track the bright bubble with your eyes. Hold your look to pop it."
          onStart={() => setGameStarted(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onExit={onExit}
        />
      ) : null}
      {!isBlockPaused && !isResultsOpen ? (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 text-white font-bold pointer-events-none">
          Trial {Math.min(currentTrialIndex + 1, TOTAL_TRIALS)}/{TOTAL_TRIALS}
        </div>
      ) : null}
      {look.error ? <div className={styles.faceLost}>{look.error}</div> : null}
      {gameStarted && look.faceLost && !look.error ? <div className={styles.faceLost}>Face the camera</div> : null}

      {isBlockPaused && (
        <div className={styles.blockOverlay}>
          <div className={styles.blockCard}>
            <div className="text-cyan-400 text-xs font-black uppercase tracking-widest mb-2">
              Neutral Block Pause
            </div>
            <h3 className="text-3xl font-extrabold text-white mb-2">
              Block {pausedBlockIndex + 1} of {TOTAL_BLOCKS} Starting...
            </h3>
            <p className="text-sm text-gray-400">
              Look at the bright moving target bubble and ignore dim decoys.
            </p>
          </div>
        </div>
      )}

      <div className={styles.canvas}>
        {!isBlockPaused && !isResultsOpen && (
          <div
            className={styles.targetBubble}
            style={{
              left: `${targetState.x}px`,
              top: `${targetState.y}px`,
              width: `${settings.bubbleSizePx}px`,
              height: `${settings.bubbleSizePx}px`,
              backgroundColor: settings.targetColor,
            }}
          />
        )}
        {!isBlockPaused &&
          !isResultsOpen &&
          decoyStates.map((decoy, idx) => (
            <div
              key={idx}
              className={styles.decoyBubble}
              style={{
                left: `${decoy.x}px`,
                top: `${decoy.y}px`,
                width: `${settings.bubbleSizePx}px`,
                height: `${settings.bubbleSizePx}px`,
                backgroundColor: settings.targetColor,
                opacity: settings.decoySalience,
              }}
            />
          ))}
        {lookPx ? <div className={styles.lookCursor} style={{ left: lookPx.x, top: lookPx.y }} /> : null}
      </div>

      <button
        type="button"
        onClick={() => setIsMenuOpen(true)}
        className="absolute bottom-6 right-4 z-50 w-11 h-11 flex items-center justify-center cursor-pointer active:scale-95 text-slate-300"
        title="Settings menu"
      >
        <SlidersIcon className="w-5 h-5" />
      </button>

      <GameMenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onQuit={onExit}
        onReset={handleReset}
        onOpenSettings={() => setIsSettingsOpen(true)}
        sessionInProgress={gameStarted && !isSettingsOpen && !isResultsOpen}
        settingsSummary={settingsSummary}
      />

      <ClinicalSettingsModal
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
        sessionLocked={gameStarted && !isResultsOpen}
      />

      {sessionResults && (
        <PursuitResultsModal
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
