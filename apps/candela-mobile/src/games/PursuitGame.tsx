import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  PursuitBlockMetric,
  PursuitMovementPattern,
  PursuitSessionResultData,
  PursuitSettings,
  PursuitTrialMetric,
  calculateAnticipationVsLag,
  calculateTrackingError,
  getDeviceTier,
  getMovementPath,
  pursuitPatternName,
  resolvePursuitPattern,
} from '@candela/shared/rn';
import { ClinicalSettingsModal, type AppliedClinicalSettings } from '../components/ClinicalSettingsModal';
import { GameMenuDrawer } from '../components/GameMenuDrawer';
import { PursuitResultsModal } from '../components/PursuitResultsModal';
import { hapticCorrect, hapticWrong } from '../lib/haptics';
import { sessionDisplayName, useAuth } from '../lib/auth-context';
import { useLayout } from '../lib/layout';

const TOTAL_TRIALS = 20;
const TRIALS_PER_BLOCK = 5;
const TOTAL_BLOCKS = 4;

export function PursuitGame({
  onExit,
  movementPattern = 'linear_bounce',
}: {
  onExit: () => void;
  movementPattern?: PursuitMovementPattern | string;
}) {
  const lockedPattern = resolvePursuitPattern(movementPattern);
  const { session } = useAuth();
  const { width, height, s, fs } = useLayout();
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
    blocksCount: TOTAL_BLOCKS,
    orientation: 'auto',
  });
  const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
  const [isBlockPaused, setIsBlockPaused] = useState(false);
  const [pausedBlockIndex, setPausedBlockIndex] = useState(0);
  const [trialStartTime, setTrialStartTime] = useState<number | null>(null);
  const [containerBounds, setContainerBounds] = useState({ width, height });
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [sessionResults, setSessionResults] = useState<PursuitSessionResultData | null>(null);
  const trialMetricsRef = useRef<PursuitTrialMetric[]>([]);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seedRef = useRef(1);
  const targetStateRef = useRef({ x: 0, y: 0, vx: 0, vy: 0 });

  useEffect(() => {
    setSettings((prev) => (prev.movementPattern === lockedPattern ? prev : { ...prev, movementPattern: lockedPattern }));
  }, [lockedPattern]);

  useEffect(() => {
    const name = session?.user.name?.trim();
    if (name) setSettings((prev) => ({ ...prev, patientName: name }));
  }, [session?.user.name]);

  const deviceTier = getDeviceTier(width, height);
  const currentBlockIndex = Math.floor(currentTrialIndex / TRIALS_PER_BLOCK);
  const activeDecoyCount = Math.min(3, currentBlockIndex === 0 ? 1 : Math.min(settings.decoyCount, currentBlockIndex + 1));

  const completeSession = useCallback(() => {
    const allTrials = trialMetricsRef.current;
    const correctCount = allTrials.filter((t) => t.outcome === 'correct').length;
    const accuracy = Math.round((correctCount / Math.max(1, allTrials.length)) * 100);
    const avgReactionSec =
      allTrials.length > 0 ? allTrials.reduce((sum, t) => sum + t.reactionTimeMs, 0) / allTrials.length / 1000 : 0;
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
    const blockMetrics: PursuitBlockMetric[] = Array.from({ length: TOTAL_BLOCKS }, (_, bIdx) => {
      const bTrials = allTrials.filter((t) => t.blockIndex === bIdx);
      return {
        blockIndex: bIdx,
        accuracyPercent: Math.round((bTrials.filter((t) => t.outcome === 'correct').length / Math.max(1, bTrials.length)) * 100),
        avgTrackingErrorPx:
          bTrials.length > 0 ? Math.round(bTrials.reduce((sum, t) => sum + t.trackingErrorPx, 0) / bTrials.length) : 0,
        avgReactionTimeMs:
          bTrials.length > 0 ? Math.round(bTrials.reduce((sum, t) => sum + t.reactionTimeMs, 0) / bTrials.length) : 0,
        trials: bTrials,
      };
    });
    setSessionResults({
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
      starRating: Math.max(1, Math.min(5, Math.ceil((accuracy / 100) * 5))),
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
          seedRef.current = Math.random() * 100 + trialIdx;
          setTrialStartTime(Date.now());
          setElapsedSec(0);
        }, 1500);
        return;
      }
      seedRef.current = Math.random() * 100 + trialIdx;
      setTrialStartTime(Date.now());
      setElapsedSec(0);
    },
    [isBlockPaused, completeSession],
  );

  useEffect(() => {
    if (!isSettingsOpen) startTrial(currentTrialIndex);
  }, [currentTrialIndex, isSettingsOpen]);

  useEffect(() => {
    if (isBlockPaused || isMenuOpen || isSettingsOpen || isResultsOpen || !trialStartTime) return;
    if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    if (settings.trialTimeoutSec <= 0) return;
    timeoutTimerRef.current = setTimeout(() => handleTrialEnd('timeout', { x: 0, y: 0 }), settings.trialTimeoutSec * 1000);
    return () => {
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    };
  }, [currentTrialIndex, isBlockPaused, isMenuOpen, isSettingsOpen, isResultsOpen, trialStartTime, settings.trialTimeoutSec]);

  useEffect(() => {
    if (isBlockPaused || isMenuOpen || isSettingsOpen || isResultsOpen || !trialStartTime) return;
    let lastTime = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      setElapsedSec((prev) => prev + (now - lastTime) / 1000);
      lastTime = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isBlockPaused, isMenuOpen, isSettingsOpen, isResultsOpen, trialStartTime]);

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

  const handleTrialEnd = (outcome: 'correct' | 'incorrect' | 'timeout', tapPos: { x: number; y: number }) => {
    if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    const now = Date.now();
    const reactionTimeMs = trialStartTime ? Math.max(100, now - trialStartTime) : settings.trialTimeoutSec * 1000;
    const ts = targetStateRef.current;
    const trackingErrorPx =
      outcome === 'timeout' ? Math.round(containerBounds.width * 0.25) : calculateTrackingError(tapPos.x, tapPos.y, ts.x, ts.y);
    const vectorAlignment = calculateAnticipationVsLag(tapPos.x, tapPos.y, ts.x, ts.y, ts.vx, ts.vy);
    if (outcome === 'correct') void hapticCorrect();
    else void hapticWrong();
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
  };

  const size = settings.bubbleSizePx;

  return (
    <View
      style={{ flex: 1, backgroundColor: '#05070F' }}
      onLayout={(e) => setContainerBounds({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {isBlockPaused ? (
        <View style={{ ...absoluteFill, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: fs(22), fontWeight: '800' }}>Block {pausedBlockIndex + 1} ready</Text>
        </View>
      ) : null}
      {!isSettingsOpen && !isResultsOpen && !isBlockPaused ? (
        <>
          <Pressable
            onPress={(e) => handleTrialEnd('correct', { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY })}
            style={{
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: settings.targetColor,
              left: targetState.x - size / 2,
              top: targetState.y - size / 2,
            }}
          />
          {decoyStates.map((decoy, idx) => (
            <Pressable
              key={idx}
              onPress={(e) => handleTrialEnd('incorrect', { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY })}
              style={{
                position: 'absolute',
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: settings.targetColor,
                opacity: settings.decoySalience,
                left: decoy.x - size / 2,
                top: decoy.y - size / 2,
              }}
            />
          ))}
        </>
      ) : null}
      <Text style={{ position: 'absolute', top: s(48), alignSelf: 'center', color: '#fff', fontWeight: '700' }}>
        Trial {Math.min(currentTrialIndex + 1, TOTAL_TRIALS)}/{TOTAL_TRIALS}
      </Text>
      <Pressable onPress={() => setIsMenuOpen(true)} style={{ position: 'absolute', bottom: s(24), right: s(16), backgroundColor: '#121626', padding: s(12), borderRadius: 22 }}>
        <Text style={{ color: '#fff' }}>☰</Text>
      </Pressable>
      <ClinicalSettingsModal
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
          }));
          setIsSettingsOpen(false);
          trialMetricsRef.current = [];
          setCurrentTrialIndex(0);
        }}
      />
      {sessionResults ? (
        <PursuitResultsModal
          isOpen={isResultsOpen}
          data={sessionResults}
          onClose={onExit}
          onReplay={() => {
            setIsResultsOpen(false);
            trialMetricsRef.current = [];
            setCurrentTrialIndex(0);
          }}
        />
      ) : null}
      <GameMenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onQuit={onExit}
        onReset={() => {
          trialMetricsRef.current = [];
          setCurrentTrialIndex(0);
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
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
