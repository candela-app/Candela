import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, PanResponder, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import {
  BeePathType,
  BeeSessionResultData,
  BeeTracingSettings,
  PathPoint,
  RoundResultData,
  evaluateTracingMetrics,
  findNearestPathPointInWindow,
  generateBeePath,
  resolveOrientation,
  type GeneratedPath,
} from '@candela/shared/rn';
import { ClinicalSettingsModal } from '../components/ClinicalSettingsModal';
import { GameResultsModal } from '../components/GameResultsModal';
import { hapticCorrect, hapticWrong } from '../lib/haptics';
import { useLayout } from '../lib/layout';

const DEFAULT_SETTINGS: BeeTracingSettings = {
  patientName: 'Demo Patient',
  tracingMode: 'active',
  pathType: 'auto',
  toleranceBandPx: 40,
  beeSpeedSec: 5,
  pathComplexity: 'medium',
  colorTheme: 'dark',
  audioEnabled: true,
  inputSensitivity: 'auto',
  roundsPerSet: 7,
  orientation: 'auto',
};

const PATH_PROGRESSION: BeePathType[] = ['straight', 'curve', 'zigzag', 'wave', 'spiral', 'branching', 'dotted'];

export function BeeTracingGame({ onExit }: { onExit: () => void }) {
  const { s, fs } = useLayout();
  const [settings, setSettings] = useState<BeeTracingSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [currentRoundNumber, setCurrentRoundNumber] = useState(1);
  const [roundResults, setRoundResults] = useState<RoundResultData[]>([]);
  const [currentPath, setCurrentPath] = useState<GeneratedPath | null>(null);
  const [beePos, setBeePos] = useState<PathPoint>({ x: 100, y: 100 });
  const [isTracing, setIsTracing] = useState(false);
  const [isGuidedDemoRunning, setIsGuidedDemoRunning] = useState(false);
  const [userTracePoints, setUserTracePoints] = useState<PathPoint[]>([]);
  const [userTimestamps, setUserTimestamps] = useState<number[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [roundSuccessCelebration, setRoundSuccessCelebration] = useState(false);
  const [bounds, setBounds] = useState({ w: 360, h: 640 });
  const currentPathIndexRef = useRef(0);
  const roundStartTimeRef = useRef(Date.now());
  const beePosRef = useRef(beePos);
  const tracingRef = useRef(false);
  const pathRef = useRef<GeneratedPath | null>(null);

  useEffect(() => {
    beePosRef.current = beePos;
  }, [beePos]);
  useEffect(() => {
    tracingRef.current = isTracing;
  }, [isTracing]);
  useEffect(() => {
    pathRef.current = currentPath;
  }, [currentPath]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const runGuidedDemo = (generated: GeneratedPath) => {
    setIsGuidedDemoRunning(true);
    const duration = settings.beeSpeedSec * 1000;
    const startTime = Date.now();
    const animate = () => {
      const progress = Math.min(1, (Date.now() - startTime) / duration);
      const ptIndex = Math.floor(progress * (generated.points.length - 1));
      setBeePos(generated.points[ptIndex] || generated.startPoint);
      if (progress < 1) requestAnimationFrame(animate);
      else {
        setIsGuidedDemoRunning(false);
        setBeePos(generated.startPoint);
        showToast('Demo complete! Now trace the path!');
      }
    };
    requestAnimationFrame(animate);
  };

  const initRoundPath = useCallback(
    (roundNum: number, w: number, h: number) => {
      let targetPathType: BeePathType = 'straight';
      const tier = Math.min(5, Math.ceil(roundNum / 2));
      if (settings.pathType === 'auto') {
        targetPathType = PATH_PROGRESSION[(roundNum - 1) % PATH_PROGRESSION.length];
      } else if (settings.pathType === 'random') {
        targetPathType = PATH_PROGRESSION[Math.floor(Math.random() * PATH_PROGRESSION.length)];
      } else {
        targetPathType = settings.pathType;
      }
      const resolvedOrientation = resolveOrientation(settings.orientation || 'auto', w, h);
      const generated = generateBeePath(targetPathType, w, h, tier, settings.pathComplexity, resolvedOrientation);
      setCurrentPath(generated);
      setBeePos(generated.startPoint);
      setUserTracePoints([generated.startPoint]);
      setUserTimestamps([Date.now()]);
      setRoundSuccessCelebration(false);
      currentPathIndexRef.current = 0;
      roundStartTimeRef.current = Date.now();
      if (settings.tracingMode === 'guided') runGuidedDemo(generated);
    },
    [settings.pathType, settings.tracingMode, settings.pathComplexity, settings.orientation, settings.beeSpeedSec],
  );

  useEffect(() => {
    if (isSettingsOpen) return;
    initRoundPath(currentRoundNumber, bounds.w, bounds.h);
  }, [currentRoundNumber, isSettingsOpen, initRoundPath, bounds.w, bounds.h]);

  const handleRoundCompletion = () => {
    if (roundSuccessCelebration || !currentPath) return;
    setIsTracing(false);
    setRoundSuccessCelebration(true);
    void hapticCorrect();
    showToast('Flower Reached! Great Job!');
    const completionTimeSec = Math.max(1, Math.round((Date.now() - roundStartTimeRef.current) / 1000));
    const metrics = evaluateTracingMetrics(userTracePoints, currentPath.points, settings.toleranceBandPx, userTimestamps);
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
    setTimeout(() => {
      if (currentRoundNumber >= settings.roundsPerSet) setIsResultsOpen(true);
      else setCurrentRoundNumber((prev) => prev + 1);
    }, 1800);
  };

  const pan = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const path = pathRef.current;
        if (!path || isGuidedDemoRunning || roundSuccessCelebration) return;
        const x = evt.nativeEvent.locationX;
        const y = evt.nativeEvent.locationY;
        const distToBee = Math.hypot(x - beePosRef.current.x, y - beePosRef.current.y);
        const distToStart = Math.hypot(x - path.startPoint.x, y - path.startPoint.y);
        const isStart = currentPathIndexRef.current === 0;
        if (distToBee <= 60 || (isStart && distToStart <= 60)) {
          setIsTracing(true);
        }
      },
      onPanResponderMove: (evt) => {
        const path = pathRef.current;
        if (!path) return;
        const x = evt.nativeEvent.locationX;
        const y = evt.nativeEvent.locationY;
        const currentPt = { x, y };
        if (!tracingRef.current) {
          if (Math.hypot(x - beePosRef.current.x, y - beePosRef.current.y) <= 60) setIsTracing(true);
          else return;
        }
        const { nearestPoint, distance, index } = findNearestPathPointInWindow(
          currentPt,
          path.points,
          currentPathIndexRef.current,
          35,
        );
        if (distance > settings.toleranceBandPx) {
          void hapticWrong();
          showToast('Stay on the path!');
          const snapPoint = path.points[currentPathIndexRef.current] || nearestPoint;
          setBeePos(snapPoint);
          setUserTracePoints((prev) => [...prev, snapPoint]);
          setUserTimestamps((prev) => [...prev, Date.now()]);
        } else {
          currentPathIndexRef.current = Math.max(currentPathIndexRef.current, index);
          const lerpFactor = settings.beeSpeedSec >= 10 ? 0.18 : settings.beeSpeedSec >= 5 ? 0.5 : 1.0;
          const activeBeePos = {
            x: beePosRef.current.x + (currentPt.x - beePosRef.current.x) * lerpFactor,
            y: beePosRef.current.y + (currentPt.y - beePosRef.current.y) * lerpFactor,
          };
          setBeePos(activeBeePos);
          setUserTracePoints((prev) => [...prev, currentPt]);
          setUserTimestamps((prev) => [...prev, Date.now()]);
        }
        const distToFlower = Math.hypot(x - path.endPoint.x, y - path.endPoint.y);
        const hasTraversedPath = currentPathIndexRef.current >= Math.floor(path.points.length * 0.85);
        if (distToFlower <= 45 && hasTraversedPath) handleRoundCompletion();
      },
      onPanResponderRelease: () => setIsTracing(false),
    });

  const sessionData = (): BeeSessionResultData => {
    const avgAcc = roundResults.length
      ? Math.round(roundResults.reduce((a, r) => a + r.accuracyPercent, 0) / roundResults.length)
      : 100;
    const totalDuration = roundResults.reduce((a, r) => a + r.completionTimeSec, 0);
    const totalDeviations = roundResults.reduce((a, r) => a + r.deviationCount, 0);
    const totalRecovery = roundResults.reduce((a, r) => a + r.avgRecoveryTimeSec, 0);
    return {
      patientName: settings.patientName,
      sessionId: Date.now(),
      date: new Date().toLocaleDateString('en-GB'),
      gameName: 'Bee Path Tracing',
      stimuliCount: roundResults.length,
      letterSize: 1,
      speed: `${settings.beeSpeedSec}s`,
      durationSec: totalDuration,
      clicksTotal: roundResults.length,
      correct: roundResults.length,
      wrong: totalDeviations,
      accuracy: avgAcc,
      avgReactionSec: 0,
      pathType: String(settings.pathType),
      tracingMode: settings.tracingMode,
      colorTheme: settings.colorTheme,
      toleranceBandPx: settings.toleranceBandPx,
      deviationCount: totalDeviations,
      avgRecoveryTimeSec: roundResults.length ? totalRecovery / roundResults.length : 0,
      roundsCompleted: roundResults.length,
      roundResults,
    };
  };

  const bg = settings.colorTheme === 'dark' ? '#071018' : '#F4F7FC';
  const pathColor = settings.colorTheme === 'dark' ? '#FBBF24' : '#D97706';
  const points = currentPath?.points.map((p) => `${p.x},${p.y}`).join(' ') || '';
  const trace = userTracePoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <View
        style={{ flex: 1 }}
        onLayout={(e) => setBounds({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        {...pan.panHandlers}
      >
        <Svg width="100%" height="100%">
          {points ? <Polyline points={points} fill="none" stroke={pathColor} strokeWidth={6} strokeLinecap="round" /> : null}
          {trace ? <Polyline points={trace} fill="none" stroke="#38BDF8" strokeWidth={3} strokeLinecap="round" /> : null}
          {currentPath ? <Circle cx={currentPath.endPoint.x} cy={currentPath.endPoint.y} r={18} fill="#F472B6" /> : null}
        </Svg>
        <Image
          source={require('@candela/shared/assets/bee.png')}
          style={{
            position: 'absolute',
            width: s(56),
            height: s(56),
            left: beePos.x - s(28),
            top: beePos.y - s(28),
          }}
        />
      </View>
      {toastMessage ? (
        <View style={{ position: 'absolute', top: s(48), alignSelf: 'center', backgroundColor: '#111827', padding: s(10), borderRadius: s(12) }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{toastMessage}</Text>
        </View>
      ) : null}
      <Pressable onPress={onExit} style={{ position: 'absolute', top: s(48), left: s(16), backgroundColor: '#111827', padding: s(10), borderRadius: s(10) }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>Exit</Text>
      </Pressable>
      <Text style={{ position: 'absolute', top: s(52), right: s(16), color: '#fff', fontWeight: '700', fontSize: fs(13) }}>
        Round {currentRoundNumber}/{settings.roundsPerSet}
      </Text>
      <ClinicalSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        showBeeTracingControls
        patientName={settings.patientName}
        letterSize={1.8}
        bubbleSize={90}
        tracingMode={settings.tracingMode}
        pathType={settings.pathType}
        toleranceBandPx={settings.toleranceBandPx}
        colorTheme={settings.colorTheme}
        audioEnabled={settings.audioEnabled}
        roundsPerSet={settings.roundsPerSet}
        pathComplexity={settings.pathComplexity}
        beeSpeedSec={settings.beeSpeedSec}
        orientation={settings.orientation}
        onApply={(next) => {
          setSettings((prev) => ({
            ...prev,
            patientName: next.patientName,
            tracingMode: next.tracingMode || prev.tracingMode,
            pathType: (next.pathType as BeePathType) || prev.pathType,
            toleranceBandPx: next.toleranceBandPx || prev.toleranceBandPx,
            colorTheme: next.colorTheme || prev.colorTheme,
            audioEnabled: next.audioEnabled ?? prev.audioEnabled,
            roundsPerSet: next.roundsPerSet || prev.roundsPerSet,
            pathComplexity: next.pathComplexity || prev.pathComplexity,
            beeSpeedSec: next.beeSpeedSec || prev.beeSpeedSec,
            orientation: next.orientation || prev.orientation,
          }));
          setIsSettingsOpen(false);
          setCurrentRoundNumber(1);
          setRoundResults([]);
        }}
      />
      {isResultsOpen ? (
        <GameResultsModal
          isOpen={isResultsOpen}
          data={sessionData()}
          onClose={onExit}
          onReplay={() => {
            setIsResultsOpen(false);
            setCurrentRoundNumber(1);
            setRoundResults([]);
          }}
        />
      ) : null}
    </View>
  );
}
