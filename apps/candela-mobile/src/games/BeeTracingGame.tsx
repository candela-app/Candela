import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, PanResponder, Pressable, Text, View } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Polyline } from 'react-native-svg';
import {
  BeePathType,
  BeeSessionResultData,
  BeeTracingSettings,
  PathPoint,
  RoundResultData,
  evaluateTracingMetrics,
  findNearestPathPointInWindow,
  generateBeePath,
  beeHeadingDeg,
  lerpHeadingDeg,
  resolveBeePathType,
  resolveOrientation,
  DEFAULT_BEE_TARGET_DOT_COLOR,
  reactionStatsFromMs,
  type GeneratedPath,
} from '@candela/shared/rn';
import { BeeResultsModal } from '../components/BeeResultsModal';
import { BeeSettingsModal } from '../components/BeeSettingsModal';
import { useGameSessionLock } from '../lib/use-game-session-lock';
import { GameMenuDrawer } from '../components/GameMenuDrawer';
import { ReplayIcon, SlidersIcon } from '../components/icons';
import { hapticCorrect, hapticWrong } from '../lib/haptics';
import { startBeeBuzz, stopBeeBuzz } from '../lib/sfx';
import { useAuth } from '../lib/auth-context';
import { useLayout } from '../lib/layout';

const PATH_WIDTH_NARROW = 12;
const FLOWER_REACH_PX = 26;
/** Invisible hit corridor so kids can stay near the path without tracing it perfectly. */
const INVISIBLE_CORRIDOR_PX = 72;
const CORRIDOR_SEARCH_WINDOW = 80;

const DEFAULT_SETTINGS: BeeTracingSettings = {
  patientName: 'Demo Patient',
  tracingMode: 'active',
  pathType: 'auto',
  toleranceBandPx: PATH_WIDTH_NARROW,
  beeSpeedSec: 5,
  pathComplexity: 'medium',
  colorTheme: 'dark',
  targetDotColor: DEFAULT_BEE_TARGET_DOT_COLOR,
  audioEnabled: true,
  inputSensitivity: 'auto',
  roundsPerSet: 10,
  orientation: 'auto',
};

const PATH_PROGRESSION: BeePathType[] = ['straight', 'curve', 'zigzag', 'wave', 'spiral', 'branching', 'dotted'];
const BEE_SIZE = 84;
const BEE_GRAB_RADIUS = 70;
const SETTINGS_ICON_SIZE = 44;

const BEE_THEMES = {
  dark: {
    bg: '#0C121C',
    path: '#E2B93B',
    trace: '#4AA8A4',
    ui: '#E7EEF5',
    muted: '#9AA8B5',
    flower: '#E56B9A',
  },
  standard: {
    bg: '#F2F5F3',
    path: '#1F6F6A',
    trace: '#2E6B9A',
    ui: '#1A2A32',
    muted: '#4A5C66',
    flower: '#C44B78',
  },
} as const;

function beeTheme(theme: BeeTracingSettings['colorTheme']) {
  return theme === 'dark' ? BEE_THEMES.dark : BEE_THEMES.standard;
}

function pinBeeTailToPlayBottom(generated: GeneratedPath, height: number, beeSize: number): GeneratedPath {
  if (generated.orientation !== 'portrait' || generated.points.length < 2) return generated;
  const start = generated.startPoint;
  const end = generated.endPoint;
  if (generated.pathType === 'spiral' || start.y < height * 0.55) return generated;
  const oldSpan = end.y - start.y;
  if (Math.abs(oldSpan) < 1) return generated;
  const newStartY = height - beeSize / 2;
  const newEndY = end.y;
  const mapY = (y: number) => newStartY + ((y - start.y) / oldSpan) * (newEndY - newStartY);
  const points = generated.points.map((p) => ({ x: p.x, y: mapY(p.y) }));
  const svgPathD = points.reduce((d, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${d} L ${p.x} ${p.y}`), '');
  const distractorPoints = generated.distractorPoints?.map((p) => ({ x: p.x, y: mapY(p.y) }));
  const distractorPoint = generated.distractorPoint
    ? { x: generated.distractorPoint.x, y: mapY(generated.distractorPoint.y) }
    : undefined;
  const distractorSvgPathD = distractorPoints?.length
    ? distractorPoints.reduce((d, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${d} L ${p.x} ${p.y}`), '')
    : generated.distractorSvgPathD;
  return {
    ...generated,
    points,
    startPoint: { x: start.x, y: newStartY },
    endPoint: { x: end.x, y: newEndY },
    svgPathD,
    distractorPoint,
    distractorPoints,
    distractorSvgPathD,
  };
}

export function BeeTracingGame({
  onExit,
  initialPathType = 'straight',
}: {
  onExit: () => void;
  initialPathType?: string;
}) {
  const { session } = useAuth();
  const { s, fs, isTablet } = useLayout();
  const lockPortrait = !isTablet;
  const insets = useSafeAreaInsets();
  const lockedPathType = resolveBeePathType(initialPathType);
  const [settings, setSettings] = useState<BeeTracingSettings>({
    ...DEFAULT_SETTINGS,
    pathType: lockedPathType,
    orientation: lockPortrait ? 'portrait' : DEFAULT_SETTINGS.orientation,
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);
  const [beeHeading, setBeeHeading] = useState(0);
  const { requestExit } = useGameSessionLock(onExit);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [currentRoundNumber, setCurrentRoundNumber] = useState(1);
  const [roundResults, setRoundResults] = useState<RoundResultData[]>([]);
  const [currentPath, setCurrentPath] = useState<GeneratedPath | null>(null);
  const [beePos, setBeePos] = useState<PathPoint>({ x: 100, y: 100 });
  const [isTracing, setIsTracing] = useState(false);
  const [isGuidedDemoRunning, setIsGuidedDemoRunning] = useState(false);
  const [userTracePoints, setUserTracePoints] = useState<PathPoint[]>([]);
  const [demoTrail, setDemoTrail] = useState<PathPoint[]>([]);
  const [hasDemoPlayed, setHasDemoPlayed] = useState(false);
  const [userTimestamps, setUserTimestamps] = useState<number[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [roundSuccessCelebration, setRoundSuccessCelebration] = useState(false);
  const [bounds, setBounds] = useState({ w: 360, h: 640 });
  const currentPathIndexRef = useRef(0);
  const roundStartTimeRef = useRef(performance.now());
  const reactionReadyAtRef = useRef<number | null>(null);
  const roundReactionMsRef = useRef<number | null>(null);
  const beePosRef = useRef(beePos);
  const tracingRef = useRef(false);
  const pathRef = useRef<GeneratedPath | null>(null);
  const playOriginRef = useRef({ x: 0, y: 0 });
  const playViewRef = useRef<View>(null);
  const guidedRef = useRef(false);
  const roundSuccessRef = useRef(false);
  const settingsRef = useRef(settings);
  const completeRoundRef = useRef<() => void>(() => undefined);
  const beeScale = useRef(new Animated.Value(1)).current;
  const heldRef = useRef(false);
  const demoTokenRef = useRef(0);

  const leaveGame = () => {
    demoTokenRef.current += 1;
    tracingRef.current = false;
    setBeeHeld(false);
    void stopBeeBuzz();
    requestExit();
  };

  const setBeeHeld = (held: boolean) => {
    if (heldRef.current === held) return;
    heldRef.current = held;
    const allowZoom = pathRef.current?.pathType !== 'spiral';
    Animated.spring(beeScale, {
      toValue: held && allowZoom ? 1.7 : 1,
      friction: 6,
      tension: 70,
      useNativeDriver: true,
    }).start();
  };

  const startPathBuzz = () => {
    if (settingsRef.current.audioEnabled) void startBeeBuzz();
  };

  const stopPathBuzz = () => {
    void stopBeeBuzz();
  };

  const fingerOnBee = (x: number, y: number) => {
    const radius = (BEE_SIZE / 2) * (heldRef.current ? 1.7 : 1) + 6;
    return Math.hypot(x - beePosRef.current.x, y - beePosRef.current.y) <= radius;
  };

  const buzzIfFingerOnBee = (x: number, y: number) => {
    if (tracingRef.current && fingerOnBee(x, y)) startPathBuzz();
    else stopPathBuzz();
  };

  useEffect(() => {
    beePosRef.current = beePos;
    const path = pathRef.current;
    if (!path) return;
    const lookAhead = path.pathType === 'spiral' || path.pathType === 'curve' || path.pathType === 'wave' ? 8 : 4;
    const target = beeHeadingDeg(path.points, currentPathIndexRef.current, lookAhead);
    setBeeHeading((prev) => lerpHeadingDeg(prev, target, path.pathType === 'spiral' ? 0.2 : 0.34));
  }, [beePos]);
  useEffect(() => {
    tracingRef.current = isTracing;
  }, [isTracing]);
  useEffect(() => {
    pathRef.current = currentPath;
  }, [currentPath]);
  useEffect(() => {
    guidedRef.current = isGuidedDemoRunning;
  }, [isGuidedDemoRunning]);
  useEffect(() => {
    roundSuccessRef.current = roundSuccessCelebration;
  }, [roundSuccessCelebration]);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    const name = session?.user.name?.trim();
    if (name) setSettings((prev) => ({ ...prev, patientName: name }));
  }, [session?.user.name]);
  useEffect(() => {
    if (!lockPortrait) return;
    setSettings((prev) => (prev.orientation === 'portrait' ? prev : { ...prev, orientation: 'portrait' }));
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    return () => {
      void ScreenOrientation.unlockAsync();
    };
  }, [lockPortrait]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void stopBeeBuzz();
    });
    return () => {
      sub.remove();
      demoTokenRef.current += 1;
      void stopBeeBuzz();
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const runGuidedDemo = (generated: GeneratedPath) => {
    demoTokenRef.current += 1;
    const token = demoTokenRef.current;
    guidedRef.current = true;
    setIsGuidedDemoRunning(true);
    setHasDemoPlayed(false);
    setIsTracing(false);
    tracingRef.current = false;
    setBeeHeld(false);
    setUserTracePoints([generated.startPoint]);
    setUserTimestamps([Date.now()]);
    setDemoTrail([generated.startPoint]);
    setBeePos(generated.startPoint);
    beePosRef.current = generated.startPoint;
    currentPathIndexRef.current = 0;
    reactionReadyAtRef.current = null;
    roundReactionMsRef.current = null;
    const duration = Math.max(250, settingsRef.current.beeSpeedSec * 1000);
    const startTime = Date.now();
    const animate = () => {
      if (token !== demoTokenRef.current) return;
      const progress = Math.min(1, (Date.now() - startTime) / duration);
      const last = Math.max(0, generated.points.length - 1);
      const ptIndex = Math.min(last, Math.floor(progress * last));
      const pt = generated.points[ptIndex] || generated.startPoint;
      currentPathIndexRef.current = ptIndex;
      beePosRef.current = pt;
      setBeePos(pt);
      setDemoTrail(generated.points.slice(0, ptIndex + 1));
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        stopPathBuzz();
        guidedRef.current = false;
        setIsGuidedDemoRunning(false);
        setHasDemoPlayed(true);
        setBeePos(generated.startPoint);
        beePosRef.current = generated.startPoint;
        setDemoTrail(generated.points);
        reactionReadyAtRef.current = performance.now();
        roundReactionMsRef.current = null;
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
        targetPathType = settings.pathType as BeePathType;
      }
      const resolvedOrientation = lockPortrait
        ? 'portrait'
        : resolveOrientation(settings.orientation || 'auto', w, h);
      const generatedRaw = generateBeePath(
        targetPathType,
        w,
        h,
        tier,
        settings.pathComplexity,
        resolvedOrientation,
      );
      const generated =
        settings.pathComplexity === 'short'
          ? generatedRaw
          : pinBeeTailToPlayBottom(generatedRaw, h, BEE_SIZE);
      setCurrentPath(generated);
      setBeePos(generated.startPoint);
      setUserTracePoints([generated.startPoint]);
      setUserTimestamps([Date.now()]);
      setDemoTrail([]);
      setHasDemoPlayed(false);
      setRoundSuccessCelebration(false);
      roundSuccessRef.current = false;
      currentPathIndexRef.current = 0;
      if (generated.pathType === 'spiral') beeScale.setValue(1);
      roundStartTimeRef.current = performance.now();
      roundReactionMsRef.current = null;
      if (settings.tracingMode === 'guided') {
        reactionReadyAtRef.current = null;
        runGuidedDemo(generated);
      } else {
        reactionReadyAtRef.current = performance.now();
      }
    },
    [settings.pathType, settings.tracingMode, settings.pathComplexity, settings.orientation, settings.beeSpeedSec, lockPortrait],
  );

  useEffect(() => {
    if (isSettingsOpen || !gameStarted) return;
    initRoundPath(currentRoundNumber, bounds.w, bounds.h);
  }, [currentRoundNumber, isSettingsOpen, gameStarted, initRoundPath, bounds.w, bounds.h]);

  const handleRoundCompletion = () => {
    if (roundSuccessRef.current || !currentPath) return;
    roundSuccessRef.current = true;
    setIsTracing(false);
    setBeeHeld(false);
    stopPathBuzz();
    setRoundSuccessCelebration(true);
    void hapticCorrect();
    showToast('Flower Reached! Great Job!');
    const completionTimeSec = Math.max(
      1,
      Math.round((performance.now() - roundStartTimeRef.current) / 1000),
    );
    const corridorPx = Math.max(settings.toleranceBandPx, INVISIBLE_CORRIDOR_PX);
    const metrics = evaluateTracingMetrics(userTracePoints, currentPath.points, corridorPx, userTimestamps);
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
      if (finishedRound >= settings.roundsPerSet) setIsResultsOpen(true);
      else setCurrentRoundNumber((prev) => (prev === finishedRound ? prev + 1 : prev));
    }, 1800);
  };
  completeRoundRef.current = handleRoundCompletion;

  const touchInPlay = (pageX: number, pageY: number) => ({
    x: pageX - playOriginRef.current.x,
    y: pageY - playOriginRef.current.y,
  });

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        const path = pathRef.current;
        if (!path || guidedRef.current || roundSuccessRef.current) return;
        playViewRef.current?.measureInWindow((x, y) => {
          playOriginRef.current = { x, y };
        });
        const { x, y } = touchInPlay(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
        const distToBee = Math.hypot(x - beePosRef.current.x, y - beePosRef.current.y);
        const distToStart = Math.hypot(x - path.startPoint.x, y - path.startPoint.y);
        const isStart = currentPathIndexRef.current === 0;
        if (distToBee <= BEE_GRAB_RADIUS || (isStart && distToStart <= BEE_GRAB_RADIUS)) {
          if (roundReactionMsRef.current == null && reactionReadyAtRef.current != null) {
            roundReactionMsRef.current = Math.max(0, Math.round(performance.now() - reactionReadyAtRef.current));
          }
          tracingRef.current = true;
          setIsTracing(true);
          setBeeHeld(true);
          setDemoTrail([]);
          buzzIfFingerOnBee(x, y);
        }
      },
      onPanResponderMove: (evt) => {
        const path = pathRef.current;
        if (!path || guidedRef.current || roundSuccessRef.current) return;
        const { x, y } = touchInPlay(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
        const currentPt = { x, y };
        if (!tracingRef.current) {
          if (Math.hypot(x - beePosRef.current.x, y - beePosRef.current.y) <= BEE_GRAB_RADIUS) {
            if (roundReactionMsRef.current == null && reactionReadyAtRef.current != null) {
              roundReactionMsRef.current = Math.max(0, Math.round(performance.now() - reactionReadyAtRef.current));
            }
            tracingRef.current = true;
            setIsTracing(true);
            setBeeHeld(true);
            setDemoTrail([]);
          } else return;
        }
        const { nearestPoint, distance, index } = findNearestPathPointInWindow(
          currentPt,
          path.points,
          currentPathIndexRef.current,
          CORRIDOR_SEARCH_WINDOW,
        );
        const cfg = settingsRef.current;
        const corridorPx = Math.max(cfg.toleranceBandPx, INVISIBLE_CORRIDOR_PX);
        if (distance > corridorPx) {
          stopPathBuzz();
          void hapticWrong();
          showToast('Stay on the path!');
          const snapPoint = path.points[currentPathIndexRef.current] || nearestPoint;
          beePosRef.current = snapPoint;
          setBeePos(snapPoint);
          setUserTracePoints((prev) => [...prev, snapPoint]);
          setUserTimestamps((prev) => [...prev, Date.now()]);
        } else {
          currentPathIndexRef.current = Math.max(currentPathIndexRef.current, index);
          const lerpFactor = cfg.beeSpeedSec >= 10 ? 0.45 : cfg.beeSpeedSec >= 5 ? 0.85 : 1;
          const nextPos = {
            x: beePosRef.current.x + (nearestPoint.x - beePosRef.current.x) * lerpFactor,
            y: beePosRef.current.y + (nearestPoint.y - beePosRef.current.y) * lerpFactor,
          };
          beePosRef.current = nextPos;
          setBeePos(nextPos);
          setUserTracePoints((prev) => [...prev, currentPt]);
          setUserTimestamps((prev) => [...prev, Date.now()]);
          buzzIfFingerOnBee(x, y);
          const bee = beePosRef.current;
          const distBeeToFlower = Math.hypot(bee.x - path.endPoint.x, bee.y - path.endPoint.y);
          const minRequiredIndex = Math.floor(path.points.length * 0.85);
          if (distBeeToFlower <= FLOWER_REACH_PX && currentPathIndexRef.current >= minRequiredIndex) {
            completeRoundRef.current();
          }
        }
      },
      onPanResponderRelease: () => {
        tracingRef.current = false;
        setIsTracing(false);
        setBeeHeld(false);
        stopPathBuzz();
      },
      onPanResponderTerminate: () => {
        tracingRef.current = false;
        setIsTracing(false);
        setBeeHeld(false);
        stopPathBuzz();
      },
    }),
  ).current;

  const sessionData = (): BeeSessionResultData => {
    const avgAcc = roundResults.length
      ? Math.round(roundResults.reduce((a, r) => a + r.accuracyPercent, 0) / roundResults.length)
      : 100;
    const totalDuration = roundResults.reduce((a, r) => a + r.completionTimeSec, 0);
    const totalDeviations = roundResults.reduce((a, r) => a + r.deviationCount, 0);
    const totalRecovery = roundResults.reduce((a, r) => a + r.avgRecoveryTimeSec, 0);
    const horizontalRounds = roundResults.filter((r) => r.orientation === 'landscape');
    const verticalRounds = roundResults.filter((r) => r.orientation === 'portrait');
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
      pathType: String(settings.pathType),
      tracingMode: settings.tracingMode,
      colorTheme: settings.colorTheme,
      toleranceBandPx: settings.toleranceBandPx,
      deviationCount: totalDeviations,
      avgRecoveryTimeSec: roundResults.length ? Math.round((totalRecovery / roundResults.length) * 10) / 10 : 0,
      roundsCompleted: roundResults.length,
      roundResults,
      horizontalAccuracyPercent:
        horizontalRounds.length > 0
          ? Math.round(horizontalRounds.reduce((a, r) => a + r.accuracyPercent, 0) / horizontalRounds.length)
          : undefined,
      verticalAccuracyPercent:
        verticalRounds.length > 0
          ? Math.round(verticalRounds.reduce((a, r) => a + r.accuracyPercent, 0) / verticalRounds.length)
          : undefined,
    };
  };

  const theme = beeTheme(settings.colorTheme);
  const isSpiral = currentPath?.pathType === 'spiral';
  const pathWidth = isSpiral ? PATH_WIDTH_NARROW : settings.toleranceBandPx;
  const dottedDash = currentPath?.dashArray
    ? `${Math.max(2, Math.round(pathWidth * 0.2))} ${Math.max(16, Math.round(pathWidth * 1.8))}`
    : undefined;
  const isGuided = settings.tracingMode === 'guided';
  const chromeStack = SETTINGS_ICON_SIZE + (isGuided ? SETTINGS_ICON_SIZE : 0);
  const points = currentPath?.points.map((p) => `${p.x},${p.y}`).join(' ') || '';
  const trace = userTracePoints.map((p) => `${p.x},${p.y}`).join(' ');
  const demo = demoTrail.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View
        ref={playViewRef}
        collapsable={false}
        style={{ flex: 1, marginBottom: insets.bottom + chromeStack }}
        onLayout={(e) => {
          const { width: w, height: h } = e.nativeEvent.layout;
          setBounds({ w, h });
          playViewRef.current?.measureInWindow((x, y) => {
            playOriginRef.current = { x, y };
          });
        }}
        {...pan.panHandlers}
      >
        {bounds.w > 0 && bounds.h > 0 ? (
          <Svg width={bounds.w} height={bounds.h} viewBox={`0 0 ${bounds.w} ${bounds.h}`}>
            {currentPath?.distractorPoints && currentPath.distractorPoints.length > 1 ? (
              <Polyline
                points={currentPath.distractorPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={theme.path}
                strokeWidth={pathWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.28}
              />
            ) : null}
            {currentPath?.svgPathD ? (
              <Path
                d={currentPath.svgPathD}
                fill="none"
                stroke={theme.path}
                strokeWidth={pathWidth}
                strokeDasharray={dottedDash}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.95}
              />
            ) : points ? (
              <Polyline
                points={points}
                fill="none"
                stroke={theme.path}
                strokeWidth={pathWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            {demo ? (
              <Polyline
                points={demo}
                fill="none"
                stroke={theme.trace}
                strokeWidth={Math.max(8, Math.round(pathWidth * 0.4))}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            {trace && demoTrail.length <= 1 ? (
              <Polyline
                points={trace}
                fill="none"
                stroke={theme.trace}
                strokeWidth={Math.max(8, Math.round(pathWidth * 0.4))}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            {currentPath?.distractorPoint ? (
              <Circle cx={currentPath.distractorPoint.x} cy={currentPath.distractorPoint.y} r={16} fill={settings.targetDotColor || DEFAULT_BEE_TARGET_DOT_COLOR} opacity={0.35} />
            ) : null}
            {currentPath ? <Circle cx={currentPath.endPoint.x} cy={currentPath.endPoint.y} r={18} fill={settings.targetDotColor || DEFAULT_BEE_TARGET_DOT_COLOR} /> : null}
          </Svg>
        ) : null}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: BEE_SIZE,
            height: BEE_SIZE,
            left: beePos.x - BEE_SIZE / 2,
            top: beePos.y - BEE_SIZE / 2,
            transform: [{ rotate: `${beeHeading}deg` }],
          }}
        >
          <Animated.Image
            source={require('@candela/shared/assets/bee.png')}
            style={{
              width: BEE_SIZE,
              height: BEE_SIZE,
              transform: [{ scale: beeScale }],
            }}
          />
        </View>
      </View>
      {toastMessage ? (
        <View style={{ position: 'absolute', top: s(48), alignSelf: 'center', backgroundColor: '#111827', padding: s(10), borderRadius: s(12) }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{toastMessage}</Text>
        </View>
      ) : null}
      <Text style={{ position: 'absolute', top: s(52), right: s(16), color: theme.ui, fontWeight: '700', fontSize: fs(13) }}>
        Round {currentRoundNumber}/{settings.roundsPerSet}
      </Text>
      {!gameStarted && !isSettingsOpen && !isResultsOpen ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(6,7,13,0.96)',
            alignItems: 'center',
            justifyContent: 'center',
            gap: s(12),
            zIndex: 40,
          }}
        >
          <Pressable
            onPress={() => setGameStarted(true)}
            style={{ backgroundColor: '#34D399', paddingHorizontal: s(28), paddingVertical: s(14), borderRadius: 999 }}
          >
            <Text style={{ color: '#022c22', fontWeight: '900', fontSize: fs(20) }}>Click to Start</Text>
          </Pressable>
          <Pressable onPress={() => setIsSettingsOpen(true)}>
            <Text style={{ color: '#CBD5E1', fontWeight: '700' }}>Edit Clinical Settings</Text>
          </Pressable>
        </View>
      ) : null}
      {isGuided && currentPath ? (
        <Pressable
          onPress={() => {
            if (roundSuccessCelebration) return;
            runGuidedDemo(currentPath);
          }}
          accessibilityRole="button"
          accessibilityLabel={hasDemoPlayed ? 'Replay demo' : 'Play demo'}
          style={{
            position: 'absolute',
            bottom: insets.bottom + SETTINGS_ICON_SIZE,
            right: s(16),
            width: SETTINGS_ICON_SIZE,
            height: SETTINGS_ICON_SIZE,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'transparent',
            opacity: isGuidedDemoRunning ? 0.45 : 1,
          }}
        >
          <ReplayIcon size={22} color={theme.muted} />
        </Pressable>
      ) : null}
      <Pressable
        onPress={() => setIsMenuOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Settings menu"
        style={{
          position: 'absolute',
          bottom: insets.bottom,
          right: s(16),
          width: SETTINGS_ICON_SIZE,
          height: SETTINGS_ICON_SIZE,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'transparent',
        }}
      >
        <SlidersIcon size={22} color={theme.muted} />
      </Pressable>
      <BeeSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        sessionInProgress={gameStarted && !isResultsOpen}
        onApply={(next) => {
          const wasPlaying = gameStarted && !isResultsOpen;
          setSettings({
            ...next,
            pathType: lockedPathType,
            orientation: lockPortrait ? 'portrait' : next.orientation,
          });
          setIsSettingsOpen(false);
          setCurrentRoundNumber(1);
          setRoundResults([]);
          if (wasPlaying) setGameStarted(true);
        }}
      />
      <BeeResultsModal
        isOpen={isResultsOpen}
        data={sessionData()}
        onClose={leaveGame}
        onReplay={() => {
          setIsResultsOpen(false);
          setCurrentRoundNumber(1);
          setRoundResults([]);
        }}
      />
      <GameMenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onQuit={leaveGame}
        onReset={() => {
          void stopBeeBuzz();
          setCurrentRoundNumber(1);
          setRoundResults([]);
          initRoundPath(1, bounds.w, bounds.h);
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        resetButtonLabel="Reset Level"
        settingsSummary={[
          { label: 'Patient', value: settings.patientName },
          { label: 'Mode', value: settings.tracingMode },
          { label: 'Path', value: String(settings.pathType) },
          { label: 'Path Width', value: `${settings.toleranceBandPx}px` },
          { label: 'Rounds', value: `${currentRoundNumber}/${settings.roundsPerSet}` },
        ]}
      />
    </View>
  );
}
