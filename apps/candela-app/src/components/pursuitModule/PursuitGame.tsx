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
  resolvePursuitPattern,
  pursuitPatternName,
} from '@candela/shared';
import { GameMenuDrawer, ClinicalSettingSummaryItem } from '../shared/GameMenuDrawer';
import { PursuitResultsModal } from './PursuitResultsModal';
import { SlidersIcon } from '../icons/VectorIcons';
import styles from './PursuitGame.module.css';

interface PursuitGameProps {
  onExit: () => void;
  initialMovementPattern?: PursuitMovementPattern | string;
}

const TOTAL_TRIALS = 20;
const TRIALS_PER_BLOCK = 5;
const TOTAL_BLOCKS = 4;

export const PursuitGame: React.FC<PursuitGameProps> = ({ onExit, initialMovementPattern = 'linear_bounce' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lockedPattern = resolvePursuitPattern(initialMovementPattern);

  // --- Clinical Settings State ---
  const [settings, setSettings] = useState<PursuitSettings>({
    patientName: 'Demo Patient',
    movementPattern: lockedPattern,
    bubbleSizePx: 100,
    targetColor: '#00E5FF',
    decoyCount: 2, // 1 target + 2 decoys = 3 total elements (scalable 2-4)
    decoySalience: 0.35, // 35% opacity/salience for decoys
    speedPxPerSec: 110,
    trialTimeoutSec: 0,
    totalTrials: TOTAL_TRIALS,
    blocksCount: TOTAL_BLOCKS,
    orientation: 'auto',
  });

  useEffect(() => {
    setSettings((prev) => (prev.movementPattern === lockedPattern ? prev : { ...prev, movementPattern: lockedPattern }));
  }, [lockedPattern]);

  // --- Session & Trial Execution State ---
  const [currentTrialIndex, setCurrentTrialIndex] = useState<number>(0);
  const [isBlockPaused, setIsBlockPaused] = useState<boolean>(false);
  const [pausedBlockIndex, setPausedBlockIndex] = useState<number>(0);
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

  // Menu & Results Modals
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(true);
  const [isResultsOpen, setIsResultsOpen] = useState<boolean>(false);
  const [sessionResults, setSessionResults] = useState<PursuitSessionResultData | null>(null);

  // Animation frame ref & Timeout timer ref
  const animFrameRef = useRef<number | null>(null);
  const timeoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const seedRef = useRef<number>(1);

  // Detect device tier
  const deviceTier = getDeviceTier(
    typeof window !== 'undefined' ? window.innerWidth : 1024,
    typeof window !== 'undefined' ? window.innerHeight : 768
  );

  // Calculate current block index (0 to 3)
  const currentBlockIndex = Math.floor(currentTrialIndex / TRIALS_PER_BLOCK);

  // Scaled decoy count by block / difficulty tier:
  // Entry block (Block 0): 1 target + 1 decoy (2 total)
  // Higher blocks: 1 target + 2-3 decoys (capped at max 4 total elements on screen)
  const activeDecoyCount = Math.min(
    3,
    currentBlockIndex === 0 ? 1 : Math.min(settings.decoyCount, currentBlockIndex + 1)
  );

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

  // Initialize trial
  const startTrial = useCallback(
    (trialIdx: number) => {
      if (trialIdx >= TOTAL_TRIALS) {
        completeSession();
        return;
      }

      // Check for block transition (between blocks 0->1, 1->2, 2->3)
      if (trialIdx > 0 && trialIdx % TRIALS_PER_BLOCK === 0 && !isBlockPaused) {
        setIsBlockPaused(true);
        setPausedBlockIndex(Math.floor(trialIdx / TRIALS_PER_BLOCK));
        setTimeout(() => {
          setIsBlockPaused(false);
          updateLockedContainerBounds();
          seedRef.current = Math.random() * 100 + trialIdx;
          setTrialStartTime(Date.now());
          setElapsedSec(0);
        }, 1500);
        return;
      }

      updateLockedContainerBounds();
      seedRef.current = Math.random() * 100 + trialIdx;
      setTrialStartTime(Date.now());
      setElapsedSec(0);
    },
    [isBlockPaused, updateLockedContainerBounds]
  );

  // Setup trial on mount or trial index change
  useEffect(() => {
    startTrial(currentTrialIndex);
  }, [currentTrialIndex]);

  // Timeout handler (logged as miss / timeout, auto advance)
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
  ]);

  // 60 FPS Continuous Animation Loop using requestAnimationFrame
  useEffect(() => {
    if (isBlockPaused || isMenuOpen || isSettingsOpen || isResultsOpen || !trialStartTime) {
      return;
    }

    let lastTime = performance.now();

    const loop = (now: number) => {
      const deltaSec = (now - lastTime) / 1000;
      lastTime = now;

      setElapsedSec((prev) => prev + deltaSec);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isBlockPaused, isMenuOpen, isSettingsOpen, isResultsOpen, trialStartTime]);

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
    seedRef.current,
    orientation,
    deviceTier
  );

  // Calculate decoy states
  const decoyStates = Array.from({ length: activeDecoyCount }, (_, idx) =>
    getMovementPath(
      settings.movementPattern,
      elapsedSec,
      containerBounds.width,
      containerBounds.height,
      settings.bubbleSizePx,
      settings.speedPxPerSec * 0.9,
      idx + 1, // decoy index 1..3
      seedRef.current + (idx + 1) * 1.5,
      orientation,
      deviceTier
    )
  );

  // Handle Trial Completion
  const handleTrialEnd = (
    outcome: 'correct' | 'incorrect' | 'timeout',
    tapPos: { x: number; y: number }
  ) => {
    if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);

    const now = Date.now();
    const reactionTimeMs = trialStartTime ? Math.max(100, now - trialStartTime) : settings.trialTimeoutSec * 1000;

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
      playWrongSoundAndHaptic();
    }

    const metric: PursuitTrialMetric = {
      trialIndex: currentTrialIndex,
      blockIndex: currentBlockIndex,
      outcome,
      reactionTimeMs,
      trackingErrorPx,
      anticipationRatio: vectorAlignment.ratio,
      targetPositionAtTap: { x: Math.round(targetState.x), y: Math.round(targetState.y) },
      tapPosition: tapPos,
    };

    trialMetricsRef.current.push(metric);

    // Advance trial
    setCurrentTrialIndex((prev) => prev + 1);
  };

  // Complete Session & Aggregate Metrics
  const completeSession = () => {
    const allTrials = trialMetricsRef.current;
    const correctCount = allTrials.filter((t) => t.outcome === 'correct').length;
    const accuracy = Math.round((correctCount / Math.max(1, allTrials.length)) * 100);

    const avgReactionSec =
      allTrials.length > 0
        ? allTrials.reduce((sum, t) => sum + t.reactionTimeMs, 0) / allTrials.length / 1000
        : 0;

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

    // Aggregate Block Metrics
    const blockMetrics: PursuitBlockMetric[] = Array.from({ length: TOTAL_BLOCKS }, (_, bIdx) => {
      const bTrials = allTrials.filter((t) => t.blockIndex === bIdx);
      const bCorrect = bTrials.filter((t) => t.outcome === 'correct').length;
      const bAcc = Math.round((bCorrect / Math.max(1, bTrials.length)) * 100);
      const bErr =
        bTrials.length > 0
          ? Math.round(bTrials.reduce((sum, t) => sum + t.trackingErrorPx, 0) / bTrials.length)
          : 0;
      const bRx =
        bTrials.length > 0
          ? Math.round(bTrials.reduce((sum, t) => sum + t.reactionTimeMs, 0) / bTrials.length)
          : 0;

      return {
        blockIndex: bIdx,
        accuracyPercent: bAcc,
        avgTrackingErrorPx: bErr,
        avgReactionTimeMs: bRx,
        trials: bTrials,
      };
    });

    const starRating = Math.max(1, Math.min(5, Math.ceil((accuracy / 100) * 5)));

    const resultData: PursuitSessionResultData = {
      patientName: settings.patientName,
      sessionId: Date.now(),
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      gameName: `Pursuit — ${pursuitPatternName(settings.movementPattern)}`,
      stimuliCount: allTrials.length,
      letterSize: 1.5,
      speed: `${settings.speedPxPerSec} px/s`,
      durationSec: Math.round(allTrials.reduce((sum, t) => sum + t.reactionTimeMs, 0) / 1000),
      clicksTotal: allTrials.length,
      correct: correctCount,
      wrong: allTrials.length - correctCount,
      accuracy,
      avgReactionSec,
      movementPattern: settings.movementPattern,
      decoyCount: settings.decoyCount,
      speedPxPerSec: settings.speedPxPerSec,
      avgTrackingErrorPx,
      anticipationVsLagScore,
      blockMetrics,
      starRating,
    };

    setSessionResults(resultData);
    setIsResultsOpen(true);
  };

  const handleReset = () => {
    trialMetricsRef.current = [];
    setCurrentTrialIndex(0);
    setIsBlockPaused(false);
    setIsResultsOpen(false);
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
    }));
    setIsSettingsOpen(false);
    handleReset();
  };

  // Menu settings summary
  const settingsSummary: ClinicalSettingSummaryItem[] = [
    { label: 'Patient Name', value: settings.patientName },
    { label: 'Movement Pattern', value: pursuitPatternName(settings.movementPattern) },
    { label: 'Decoy Count', value: `${activeDecoyCount} Decoys` },
    { label: 'Pursuit Speed', value: `${settings.speedPxPerSec} px/s` },
    { label: 'Bubble Diameter', value: `${settings.bubbleSizePx}px` },
    { label: 'Trial Timeout', value: settings.trialTimeoutSec > 0 ? `${settings.trialTimeoutSec}s` : 'Off' },
  ];

  return (
    <div ref={containerRef} className={styles.gameContainer}>
      {!isBlockPaused && !isResultsOpen ? (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 text-white font-bold pointer-events-none">
          Trial {Math.min(currentTrialIndex + 1, TOTAL_TRIALS)}/{TOTAL_TRIALS}
        </div>
      ) : null}

      {/* BLOCK TRANSITION OVERLAY (1.5s neutral pause) */}
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
              Track the bright moving target bubble and ignore dim decoys.
            </p>
          </div>
        </div>
      )}

      {/* BARE FIELD CANVAS WITH MOVING BUBBLES */}
      <div className={styles.canvas}>
        {/* TARGET BUBBLE (High Luminance, Bright Color) */}
        {!isBlockPaused && !isResultsOpen && (
          <div
            className={styles.targetBubble}
            style={{
              left: `${targetState.x}px`,
              top: `${targetState.y}px`,
              width: `${settings.bubbleSizePx}px`,
              height: `${settings.bubbleSizePx}px`,
              backgroundColor: settings.targetColor,
              border: 'none',
              boxShadow: 'none',
              touchAction: 'none',
            }}
            onClick={(e) => {
              const rect = containerRef.current?.getBoundingClientRect();
              const tapX = rect ? e.clientX - rect.left : e.clientX;
              const tapY = rect ? e.clientY - rect.top : e.clientY;
              handleTrialEnd('correct', { x: tapX, y: tapY });
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const touch = e.touches[0] || e.changedTouches[0];
              const rect = containerRef.current?.getBoundingClientRect();
              const tapX = rect && touch ? touch.clientX - rect.left : targetState.x;
              const tapY = rect && touch ? touch.clientY - rect.top : targetState.y;
              handleTrialEnd('correct', { x: tapX, y: tapY });
            }}
          />
        )}

        {/* DECOY BUBBLES (Dimmer, Lower Saturation of Similar Hue) */}
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
                opacity: settings.decoySalience, // Dim salience
                border: 'none',
                touchAction: 'none',
              }}
              onClick={(e) => {
                const rect = containerRef.current?.getBoundingClientRect();
                const tapX = rect ? e.clientX - rect.left : e.clientX;
                const tapY = rect ? e.clientY - rect.top : e.clientY;
                handleTrialEnd('incorrect', { x: tapX, y: tapY });
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const touch = e.touches[0] || e.changedTouches[0];
                const rect = containerRef.current?.getBoundingClientRect();
                const tapX = rect && touch ? touch.clientX - rect.left : decoy.x;
                const tapY = rect && touch ? touch.clientY - rect.top : decoy.y;
                handleTrialEnd('incorrect', { x: tapX, y: tapY });
              }}
            />
          ))}
      </div>

      <button
        type="button"
        onClick={() => setIsMenuOpen(true)}
        className="absolute bottom-6 right-4 z-50 w-11 h-11 rounded-full bg-[#121626] text-white flex items-center justify-center cursor-pointer active:scale-95"
        title="Settings menu"
      >
        <SlidersIcon className="w-5 h-5" />
      </button>

      {/* MENU DRAWER */}
      <GameMenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onQuit={onExit}
        onReset={handleReset}
        onOpenSettings={() => setIsSettingsOpen(true)}
        sessionInProgress={!isSettingsOpen && !isResultsOpen}
        settingsSummary={settingsSummary}
      />

      {/* CLINICAL SETTINGS MODAL */}
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
      />

      {/* SESSION RESULTS MODAL */}
      {sessionResults && (
        <PursuitResultsModal
          isOpen={isResultsOpen}
          onClose={() => {
            setIsResultsOpen(false);
            onExit();
          }}
          onReplay={handleReset}
          data={sessionResults}
        />
      )}
    </div>
  );
};
