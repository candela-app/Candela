import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  PursuitMovementPattern,
  PursuitSessionResultData,
  PursuitSettings,
  PursuitTrialMetric,
  ElementState,
  calculateAnticipationVsLag,
  calculateTrackingError,
  getContrastAdjustedColor,
  getDeviceTier,
  getMovementPath,
  pickPursuitTargetSeed,
  resolvePursuitDecoyCollisions,
  spawnPursuitDecoys,
  stepPursuitBody,
  pursuitPatternName,
  resolvePursuitPattern,
  useHowToPlayGate,
  usePauseShiftedClock,
  buildSessionMetrics,
  clinicalColorSessionFields,
  MODULE_CTA,
} from '@candela/shared/rn';
import { ClinicalSettingsModal, type AppliedClinicalSettings } from '../components/ClinicalSettingsModal';
import { HowToPlayManual } from '../components/HowToPlayManual';
import { GameMenuDrawer } from '../components/GameMenuDrawer';
import { GameResultsModal } from '../components/GameResultsModal';
import { hapticCorrect, hapticMiss, hapticWrong } from '../lib/haptics';
import { sessionDisplayName, useAuth } from '../lib/auth-context';
import { useGameSessionLock } from '../lib/use-game-session-lock';
import { SlidersIcon } from '../components/icons';
import { useLayout } from '../lib/layout';

const TOTAL_TRIALS = 20;

export function PursuitGame({
  onExit,
  movementPattern = 'linear_bounce',
}: {
  onExit: () => void;
  movementPattern?: PursuitMovementPattern | string;
}) {
  const lockedPattern = resolvePursuitPattern(movementPattern);
  const { session } = useAuth();
  const { width, height, s } = useLayout();
  const [settings, setSettings] = useState<PursuitSettings>({
    patientName: sessionDisplayName(session),
    movementPattern: lockedPattern,
    bubbleSizePx: 100,
    targetColor: '#00E5FF',
    decoyCount: 2,
    decoySalience: 0.35,
    speedPxPerSec: 110,
    trialTimeoutSec: 0,
    totalTrials: TOTAL_TRIALS,
    blocksCount: 1,
    orientation: 'auto',
    bgColor: '#05070F',
    contrastSensitivity: 1,
  });
  const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const [trialStartTime, setTrialStartTime] = useState<number | null>(null);
  const [containerBounds, setContainerBounds] = useState({ width, height });
  const [elapsedSec, setElapsedSec] = useState(0);
  const { showHowToPlay, howToPlayMode, isSettingsOpen, setIsSettingsOpen, finishHowToPlay, openHowToPlay, closeHowToPlay, playBlocked, isMenuOpen, setIsMenuOpen } = useHowToPlayGate();
  const [gameStarted, setGameStarted] = useState(false);
  const { requestExit } = useGameSessionLock(onExit);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [sessionResults, setSessionResults] = useState<PursuitSessionResultData | null>(null);
  const sessionFrozen = playBlocked || isResultsOpen;
  usePauseShiftedClock(sessionFrozen, Boolean(gameStarted && trialStartTime != null), (delta) => {
    setTrialStartTime((prev) => (prev == null ? prev : prev + delta));
  }, trialStartTime);
  const trialMetricsRef = useRef<PursuitTrialMetric[]>([]);
  const missCountRef = useRef(0);
  const wrongTapCountRef = useRef(0);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetSeedRef = useRef(1);
  const decoysRef = useRef<ElementState[]>([]);
  const decoysEpochRef = useRef(-1);
  const elapsedSecRef = useRef(0);
  const trialLockRef = useRef(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const targetStateRef = useRef({ x: 0, y: 0, vx: 0, vy: 0 });

  useEffect(() => {
    setSettings((prev) => (prev.movementPattern === lockedPattern ? prev : { ...prev, movementPattern: lockedPattern }));
  }, [lockedPattern]);

  useEffect(() => {
    const name = session?.user.name?.trim();
    if (name) setSettings((prev) => ({ ...prev, patientName: name }));
  }, [session?.user.name]);

  const deviceTier = getDeviceTier(width, height);
  const activeDecoyCount = Math.max(0, Math.min(3, settings.decoyCount));

  const completeSession = useCallback(() => {
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
      allTrials.length > 0 ? Math.round(allTrials.reduce((sum, t) => sum + t.trackingErrorPx, 0) / allTrials.length) : 0;
    const avgAnticipation =
      allTrials.length > 0 ? allTrials.reduce((a, t) => a + t.anticipationRatio, 0) / allTrials.length : 0;
    const anticipationVsLagScore =
      avgAnticipation > 0.1
        ? `Optimal Anticipation (${Math.round((avgAnticipation + 1) * 50)}% Leading)`
        : avgAnticipation < -0.1
          ? `Lagging Pursuit (${Math.round((1 - avgAnticipation) * 50)}% Trailing)`
          : 'Balanced Pursuit (Centered)';
    setSessionResults({
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
      starRating: Math.max(1, Math.min(5, Math.ceil((metrics.accuracy / 100) * 5))),
      ...clinicalColorSessionFields(settings.bgColor || '#05070F', settings.targetColor, settings.contrastSensitivity ?? 1),
    });
    setIsResultsOpen(true);
  }, [settings]);

  const startTrial = useCallback((trialIdx: number) => {
    if (trialIdx >= TOTAL_TRIALS) return;
    trialLockRef.current = false;
    const { movementPattern, bubbleSizePx, speedPxPerSec, decoyCount } = settingsRef.current;
    const width = Math.max(300, containerBounds.width);
    const height = Math.max(300, containerBounds.height);
    const orientationNow = width >= height ? 'landscape' : 'portrait';
    const decoySpeed = speedPxPerSec * 0.9;
    const count = Math.max(0, Math.min(3, decoyCount));
    const tier = getDeviceTier(width, height);

    if (decoysEpochRef.current !== sessionEpoch || decoysRef.current.length !== count) {
      decoysEpochRef.current = sessionEpoch;
      decoysRef.current = spawnPursuitDecoys(
        count,
        movementPattern,
        width,
        height,
        bubbleSizePx,
        decoySpeed,
        Math.random() * 100 + sessionEpoch,
        orientationNow,
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
      orientationNow,
      tier,
    );
    elapsedSecRef.current = 0;
    setTrialStartTime(performance.now());
    setElapsedSec(0);
  }, [containerBounds.width, containerBounds.height, sessionEpoch]);

  useEffect(() => {
    if (!gameStarted || isResultsOpen) return;
    if (currentTrialIndex >= TOTAL_TRIALS) return;
    startTrial(currentTrialIndex);
  }, [currentTrialIndex, gameStarted, isResultsOpen, sessionEpoch, startTrial]);

  useEffect(() => {
    if (isMenuOpen || playBlocked || isResultsOpen || !trialStartTime) return;
    if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    if (settings.trialTimeoutSec <= 0) return;
    timeoutTimerRef.current = setTimeout(() => handleTrialEnd('timeout', { x: 0, y: 0 }), Math.max(0, settings.trialTimeoutSec * 1000 - elapsedSec * 1000));
    return () => {
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    };
  }, [currentTrialIndex, isMenuOpen, playBlocked, isResultsOpen, trialStartTime, settings.trialTimeoutSec]);

  useEffect(() => {
    if (isMenuOpen || playBlocked || isResultsOpen || !trialStartTime) return;
    let lastTime = performance.now();
    let raf = 0;
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
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isMenuOpen, playBlocked, isResultsOpen, trialStartTime, containerBounds.width, containerBounds.height, deviceTier]);

  const orientation = containerBounds.width >= containerBounds.height ? 'landscape' : 'portrait';
  const targetState = getMovementPath(
    settings.movementPattern,
    elapsedSec,
    containerBounds.width,
    containerBounds.height,
    settings.bubbleSizePx,
    settings.speedPxPerSec,
    0,
    targetSeedRef.current,
    orientation,
    deviceTier,
  );
  targetStateRef.current = targetState;
  const decoyStates = decoysRef.current;

  const handleTrialEnd = (outcome: 'correct' | 'timeout', tapPos: { x: number; y: number }) => {
    if (!gameStarted || isResultsOpen || playBlocked || trialLockRef.current) return;
    trialLockRef.current = true;
    if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    const now = performance.now();
    const reactionTimeMs = trialStartTime ? Math.max(100, now - trialStartTime) : settings.trialTimeoutSec * 1000;
    const ts = targetStateRef.current;
    const trackingErrorPx =
      outcome === 'timeout' ? Math.round(containerBounds.width * 0.25) : calculateTrackingError(tapPos.x, tapPos.y, ts.x, ts.y);
    const vectorAlignment = calculateAnticipationVsLag(tapPos.x, tapPos.y, ts.x, ts.y, ts.vx, ts.vy);
    if (outcome === 'correct') void hapticCorrect();
    else void hapticMiss();
    trialMetricsRef.current.push({
      trialIndex: currentTrialIndex,
      blockIndex: 0,
      outcome,
      reactionTimeMs,
      trackingErrorPx,
      anticipationRatio: vectorAlignment.ratio,
      targetPositionAtTap: { x: Math.round(ts.x), y: Math.round(ts.y) },
      tapPosition: tapPos,
    });
    if (trialMetricsRef.current.length >= TOTAL_TRIALS) {
      completeSession();
      return;
    }
    setCurrentTrialIndex((prev) => prev + 1);
  };

  const handleWrongTap = () => {
    if (!gameStarted || isResultsOpen || playBlocked || trialLockRef.current) return;
    wrongTapCountRef.current += 1;
    void hapticWrong();
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

  const size = settings.bubbleSizePx;
  const fieldColor = settings.bgColor || '#05070F';
  const paintedTarget = getContrastAdjustedColor(settings.targetColor, fieldColor, settings.contrastSensitivity ?? 1);
  const paintedDecoy = getContrastAdjustedColor(paintedTarget, fieldColor, settings.decoySalience);

  return (
    <View
      style={{ flex: 1, backgroundColor: fieldColor }}
      onLayout={(e) => setContainerBounds({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {gameStarted && !isSettingsOpen && !isResultsOpen ? (
        <>
          <Pressable
            onPress={() => {
              if (playBlocked) return;
              missCountRef.current += 1;
              void hapticMiss();
            }}
            style={absoluteFill}
          />
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              handleTrialEnd('correct', {
                x: targetState.x - size / 2 + e.nativeEvent.locationX,
                y: targetState.y - size / 2 + e.nativeEvent.locationY,
              });
            }}
            style={{
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: paintedTarget,
              left: targetState.x - size / 2,
              top: targetState.y - size / 2,
            }}
          />
          {decoyStates.map((decoy, idx) => (
            <Pressable
              key={idx}
              onPress={(e) => {
                e.stopPropagation();
                handleWrongTap();
              }}
              style={{
                position: 'absolute',
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: paintedDecoy,
                opacity: 1,
                left: decoy.x - size / 2,
                top: decoy.y - size / 2,
              }}
            />
          ))}
        </>
      ) : null}
      {gameStarted && !isResultsOpen ? (
        <Text style={{ position: 'absolute', top: s(48), alignSelf: 'center', color: '#fff', fontWeight: '700' }}>
          Trial {Math.min(currentTrialIndex + 1, TOTAL_TRIALS)}/{TOTAL_TRIALS}
        </Text>
      ) : null}
      {!gameStarted && !showHowToPlay && !isSettingsOpen && !isResultsOpen ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#06070D',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 40,
            gap: 12,
          }}
        >
          <Pressable
            onPress={beginPlay}
            style={{ backgroundColor: MODULE_CTA.pursuit.bar, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 999 }}
          >
            <Text style={{ color: MODULE_CTA.pursuit.ink, fontWeight: '900', fontSize: 20 }}>Click to Start</Text>
          </Pressable>
          <Pressable onPress={() => setIsSettingsOpen(true)}>
            <Text style={{ color: '#CBD5E1', fontWeight: '700' }}>Edit Clinical Settings</Text>
          </Pressable>
        </View>
      ) : null}
      <Pressable
        onPress={() => setIsMenuOpen(true)}
        style={{
          position: 'absolute',
          bottom: s(24),
          right: s(16),
          width: s(44),
          height: s(44),
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'transparent',
          zIndex: 50,
        }}
      >
        <SlidersIcon size={22} color="#94A3B8" />
      </Pressable>
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
        showPursuitControls
        patientName={settings.patientName}
        letterSize={1.5}
        bubbleSize={settings.bubbleSizePx}
        pursuitMovementPattern={settings.movementPattern}
        pursuitTargetColor={settings.targetColor}
        pursuitDecoyCount={settings.decoyCount}
        pursuitSpeedPxPerSec={settings.speedPxPerSec}
        pursuitTrialTimeoutSec={settings.trialTimeoutSec}
        bgColor={fieldColor}
        contrastSensitivity={settings.contrastSensitivity ?? 1}
        onApply={(applied: AppliedClinicalSettings) => {
          setSettings((prev) => ({
            ...prev,
            patientName: applied.patientName || prev.patientName,
            bubbleSizePx: applied.bubbleSize || prev.bubbleSizePx,
            movementPattern: lockedPattern,
            targetColor: applied.pursuitTargetColor || prev.targetColor,
            decoyCount: applied.pursuitDecoyCount ?? prev.decoyCount,
            speedPxPerSec: applied.pursuitSpeedPxPerSec || prev.speedPxPerSec,
            trialTimeoutSec: applied.pursuitTrialTimeoutSec ?? prev.trialTimeoutSec,
            bgColor: applied.bgColor || prev.bgColor,
            contrastSensitivity: applied.contrastSensitivity ?? prev.contrastSensitivity ?? 1,
          }));
          setIsSettingsOpen(false);
          beginPlay();
        }}
        sessionLocked={gameStarted && !isResultsOpen}
      />
      {sessionResults ? (
        <GameResultsModal
          isOpen={isResultsOpen}
          data={sessionResults}
          onClose={requestExit}
          onReplay={beginPlay}
        />
      ) : null}
      <GameMenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onOpenHowToPlay={openHowToPlay}
        onQuit={requestExit}
        onReset={() => {
          trialMetricsRef.current = [];
          missCountRef.current = 0;
          wrongTapCountRef.current = 0;
          trialLockRef.current = false;
          decoysEpochRef.current = -1;
          decoysRef.current = [];
          elapsedSecRef.current = 0;
          setCurrentTrialIndex(0);
          setTrialStartTime(null);
          setElapsedSec(0);
          setSessionEpoch((n) => n + 1);
          setGameStarted(false);
          setIsSettingsOpen(true);
        }}
        onOpenSettings={() => {
          setIsMenuOpen(false);
          setIsSettingsOpen(true);
        }}
        resetButtonLabel="Restart Session"
        sessionInProgress={gameStarted && !isResultsOpen}
        settingsSummary={[
          { label: 'Patient Name', value: settings.patientName },
          { label: 'Movement Pattern', value: pursuitPatternName(settings.movementPattern) },
          { label: 'Decoy Count', value: `${activeDecoyCount} Decoys` },
          { label: 'Pursuit Speed', value: `${settings.speedPxPerSec} px/s` },
          { label: 'Bubble Diameter', value: `${settings.bubbleSizePx}px` },
          { label: 'Trial Timeout', value: settings.trialTimeoutSec > 0 ? `${settings.trialTimeoutSec}s` : 'Off' },
        ]}
      />
    </View>
  );
}

const absoluteFill = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };
