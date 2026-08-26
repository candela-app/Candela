import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { BackHandler, PanResponder, Pressable, Text, View, type GestureResponderEvent } from 'react-native';
import { useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Path } from 'react-native-svg';
import {
  GEOBOARD_BOARDS,
  applyTransformToPattern,
  evaluateDrawing,
  evaluateBeginnerPractice,
  evaluateHalfFieldAccuracy,
  getBoardPatterns,
  getContrastAdjustedColor,
  getGeoboardDotPositions,
  getGeoboardGridDots,
  geoboardPegPixelSize,
  getGeoboardStarRating,
  getPenColorName,
  isBeginnerLineBoard,
  lockBeginnerGeoboardProtocol,
  patternShowsModel,
  patternStartsWithMemorize,
  type GeoboardBoardId,
  type GeoboardComplexityTier,
  type GeoboardPattern,
  type GeoboardProtocol,
  type GeoboardSessionResultData,
  type GeoboardTrialMetric,
  reactionStatsFromMs,
} from '@candela/shared/rn';
import { GameMenuDrawer } from '../components/GameMenuDrawer';
import { GameResultsModal } from '../components/GameResultsModal';
import { GeoboardSettingsModal } from '../components/GeoboardSettingsModal';
import { CheckIcon, ClearIcon, ReplayIcon, SkipIcon, SlidersIcon, UndoIcon } from '../components/icons';
import { hapticCorrect, hapticLight, hapticMiss, hapticWrong } from '../lib/haptics';
import { playDotJoin, playMetronomeTick, preloadDotJoin } from '../lib/sfx';
import { sessionDisplayName, useAuth } from '../lib/auth-context';
import { useLayout } from '../lib/layout';

const GRID_SIZE = 5;
const DOT_COUNT = GRID_SIZE * GRID_SIZE;
const DOT_POSITIONS = getGeoboardDotPositions(GRID_SIZE, GRID_SIZE);
const FEEDBACK_DURATION_MS = 1300;
const SESSION_TIME_CAP_SEC = 600;
const INK_MIN_SPACING_PERCENT = 0.6;
const INK_MIN_STROKE_PERCENT = 1.5;
const THERAPY_BG_COLOR = '#FFFFFF';
const THERAPY_MODEL_COLOR = '#000000';
const THERAPY_PEN_COLOR = '#FBBF24';
const THERAPY_DOT_COLOR = '#111827';
const THERAPY_DOT_ACTIVE_COLOR = '#0284C7';
const BOARD_BORDER_WIDTH = 2;
const TOOLBAR_BUTTON_COUNT = 6;
const TOOLBAR_ICON_MAX = 44;
const TOOLBAR_ICON_MIN = 26;

type GeoboardGameState = 'settings' | 'memorize' | 'play' | 'feedback' | 'results';

interface InkPoint {
  x: number;
  y: number;
}

interface PenStroke {
  points: InkPoint[];
  dots: number[];
}

type InkBoard = 'model' | 'draw';

function segmentsFromStrokes(strokes: PenStroke[]): Array<[number, number]> {
  const seen = new Set<string>();
  const segments: Array<[number, number]> = [];
  for (const stroke of strokes) {
    for (let i = 1; i < stroke.dots.length; i += 1) {
      const from = stroke.dots[i - 1];
      const to = stroke.dots[i];
      if (from === to) continue;
      const seg: [number, number] = [Math.min(from, to), Math.max(from, to)];
      const key = `${seg[0]}-${seg[1]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      segments.push(seg);
    }
  }
  return segments;
}

function touchedFromSegments(segments: Array<[number, number]>): Set<number> {
  const dots = new Set<number>();
  for (const [from, to] of segments) {
    dots.add(from);
    dots.add(to);
  }
  return dots;
}

interface TrialFeedback {
  correct: boolean;
  message: string;
}

function pointFromBoardEvent(
  evt: GestureResponderEvent,
  origin: { x: number; y: number; w: number; h: number },
): InkPoint {
  const { locationX, locationY, pageX, pageY } = evt.nativeEvent;
  const inBoard = (value: number, size: number) => Number.isFinite(value) && value >= -48 && value <= size + 48;
  const localX = inBoard(locationX, origin.w) ? locationX : pageX - origin.x;
  const localY = inBoard(locationY, origin.h) ? locationY : pageY - origin.y;
  const innerW = Math.max(1, origin.w - BOARD_BORDER_WIDTH * 2);
  const innerH = Math.max(1, origin.h - BOARD_BORDER_WIDTH * 2);
  return {
    x: ((localX - BOARD_BORDER_WIDTH) / innerW) * 100,
    y: ((localY - BOARD_BORDER_WIDTH) / innerH) * 100,
  };
}

/** Snap to a peg. Used only at stroke start and end so ink does not join every peg it crosses. */
function hitTestGeoboardDot(
  xPercent: number,
  yPercent: number,
  visibleDots: boolean[],
  boardW: number,
  boardH: number,
  previousDot: number | null,
  radiusScale = 1,
): number | null {
  const innerW = Math.max(1, boardW - BOARD_BORDER_WIDTH * 2);
  const innerH = Math.max(1, boardH - BOARD_BORDER_WIDTH * 2);
  const px = (xPercent / 100) * innerW;
  const py = (yPercent / 100) * innerH;
  const cell = Math.min(innerW / GRID_SIZE, innerH / GRID_SIZE);
  const radius = cell * 0.45 * radiusScale;

  let bestIndex: number | null = null;
  let bestDistance = radius;

  for (const dot of DOT_POSITIONS) {
    if (visibleDots[dot.index] === false) continue;
    if (dot.index === previousDot) continue;
    const dx = (dot.x / 100) * innerW - px;
    const dy = (dot.y / 100) * innerH - py;
    const distance = Math.hypot(dx, dy);
    if (distance <= bestDistance) {
      bestDistance = distance;
      bestIndex = dot.index;
    }
  }

  return bestIndex;
}

function inkPath(points: InkPoint[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const only = points[0];
    return `M ${only.x} ${only.y} L ${only.x} ${only.y}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x} ${points[i].y} ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  return `${d} L ${last.x} ${last.y}`;
}

const DEMO_SAMPLE_STEP = 1.4;

function segmentsToChains(segments: Array<[number, number]>): number[][] {
  const remaining = segments.map(([from, to]) => [from, to] as [number, number]);
  const chains: number[][] = [];
  while (remaining.length > 0) {
    const first = remaining.shift();
    if (!first) break;
    const chain = [first[0], first[1]];
    let grew = true;
    while (grew) {
      grew = false;
      for (let i = remaining.length - 1; i >= 0; i -= 1) {
        const [from, to] = remaining[i];
        const head = chain[0];
        const tail = chain[chain.length - 1];
        if (from === tail) {
          chain.push(to);
          remaining.splice(i, 1);
          grew = true;
        } else if (to === tail) {
          chain.push(from);
          remaining.splice(i, 1);
          grew = true;
        } else if (from === head) {
          chain.unshift(to);
          remaining.splice(i, 1);
          grew = true;
        } else if (to === head) {
          chain.unshift(from);
          remaining.splice(i, 1);
          grew = true;
        }
      }
    }
    chains.push(chain);
  }
  return chains;
}

function sampleChain(dotIds: number[]): { points: InkPoint[]; joins: Array<{ index: number; dot: number }> } {
  const points: InkPoint[] = [];
  const joins: Array<{ index: number; dot: number }> = [];
  for (let k = 0; k < dotIds.length; k += 1) {
    const pos = DOT_POSITIONS[dotIds[k]];
    if (k === 0) {
      points.push({ x: pos.x, y: pos.y });
      continue;
    }
    const prev = points[points.length - 1];
    const dist = Math.hypot(pos.x - prev.x, pos.y - prev.y);
    const steps = Math.max(1, Math.round(dist / DEMO_SAMPLE_STEP));
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      points.push({
        x: prev.x + (pos.x - prev.x) * t,
        y: prev.y + (pos.y - prev.y) * t,
      });
    }
    joins.push({ index: points.length - 1, dot: dotIds[k] });
  }
  return { points, joins };
}

function demoInkFromProgress(chains: InkPoint[][], progress: number): string {
  let remaining = Math.max(0, progress);
  const visible: InkPoint[][] = [];
  for (const chain of chains) {
    if (remaining <= 0) break;
    const take = Math.min(chain.length, remaining);
    if (take > 0) visible.push(chain.slice(0, take));
    remaining -= take;
  }
  return visible.map((chain) => inkPath(chain)).join(' ');
}

export function GeoboardGame({
  boardId = 1,
  onExit,
}: {
  boardId?: GeoboardBoardId;
  onExit?: () => void;
}) {
  const board = GEOBOARD_BOARDS[boardId];
  const { session } = useAuth();
  const { s, fs, width, height, isTablet } = useLayout();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [gameState, setGameState] = useState<GeoboardGameState>('settings');
  const [protocol, setProtocol] = useState<GeoboardProtocol>({
    patientName: sessionDisplayName(session),
    boardId,
    alphabetVariant: 'uppercase',
    bpm: 60,
    metronomeEnabled: false,
    patternId: null,
    matrixTier: 1,
    complexityTier: 1,
    memoryMode: false,
    memorizeSec: 5,
    transform: 'duplicate',
    ocularity: 'Both',
    timeLimitSec: 0,
    contrastSensitivity: 1,
    bgColor: THERAPY_BG_COLOR,
    shapeColor: THERAPY_MODEL_COLOR,
    penColor: THERAPY_PEN_COLOR,
    dotColor: THERAPY_DOT_COLOR,
    dotActiveColor: THERAPY_DOT_ACTIVE_COLOR,
    pegSizeScale: 1,
  });
  const [playlist, setPlaylist] = useState<GeoboardPattern[]>([]);
  const [trialIndex, setTrialIndex] = useState(0);
  const [targetSegments, setTargetSegments] = useState<Array<[number, number]>>([]);
  const [answerDotsVisible, setAnswerDotsVisible] = useState<boolean[]>(new Array(DOT_COUNT).fill(true));
  const [modelStrokes, setModelStrokes] = useState<PenStroke[]>([]);
  const [drawStrokes, setDrawStrokes] = useState<PenStroke[]>([]);
  const [liveBoard, setLiveBoard] = useState<InkBoard | null>(null);
  const [selectedDot, setSelectedDot] = useState<number | null>(null);
  const [liveDots, setLiveDots] = useState<number[]>([]);
  const [liveInkD, setLiveInkD] = useState('');
  const [demoInkD, setDemoInkD] = useState('');
  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [memorizeTimeLeft, setMemorizeTimeLeft] = useState(0);
  const [feedback, setFeedback] = useState<TrialFeedback | null>(null);
  const [trials, setTrials] = useState<GeoboardTrialMetric[]>([]);
  const [resultsData, setResultsData] = useState<GeoboardSessionResultData | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [allowExit, setAllowExit] = useState(false);
  const [fatigueWarning, setFatigueWarning] = useState(false);
  const [modelLayout, setModelLayout] = useState({ w: 0, h: 0 });
  const [drawLayout, setDrawLayout] = useState({ w: 0, h: 0 });

  const isStrokingRef = useRef(false);
  const strokeRef = useRef<PenStroke | null>(null);
  const strokeBoardHistoryRef = useRef<InkBoard[]>([]);
  const sessionStartRef = useRef(0);
  const trialStartRef = useRef(0);
  const firstDotAtRef = useRef<number | null>(null);
  const correctionsRef = useRef(0);
  const tapSequenceRef = useRef<Array<{ dotIndex: number; timestamp: number }>>([]);
  const metronomeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modelOriginRef = useRef({ x: 0, y: 0, w: 1, h: 1 });
  const drawOriginRef = useRef({ x: 0, y: 0, w: 1, h: 1 });
  const modelViewRef = useRef<View>(null);
  const drawViewRef = useRef<View>(null);
  const gameStateRef = useRef(gameState);
  const answerDotsRef = useRef(answerDotsVisible);
  const demoTokenRef = useRef(0);
  const demoRunningRef = useRef(false);
  const demoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allowExitRef = useRef(false);

  const currentPattern = playlist[trialIndex] ?? null;
  const patternCount = playlist.length || getBoardPatterns(boardId, protocol.alphabetVariant).length;

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);
  useEffect(() => {
    allowExitRef.current = allowExit;
  }, [allowExit]);

  useEffect(() => {
    navigation.setOptions({
      gestureEnabled: false,
      fullScreenGestureEnabled: false,
    });
  }, [navigation]);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (allowExitRef.current) return;
      e.preventDefault();
    });
    return unsub;
  }, [navigation]);

  useEffect(() => {
    if (!allowExit) return;
    onExit?.();
  }, [allowExit, onExit]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (allowExitRef.current) return false;
      return true;
      return true;
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    answerDotsRef.current = answerDotsVisible;
  }, [answerDotsVisible]);
  useEffect(() => {
    const name = session?.user.name?.trim();
    if (name) setProtocol((prev) => ({ ...prev, patientName: name }));
  }, [session?.user.name]);
  useEffect(() => {
    void preloadDotJoin();
  }, []);

  const modelDrawnSegments = useMemo(() => segmentsFromStrokes(modelStrokes), [modelStrokes]);
  const drawDrawnSegments = useMemo(() => segmentsFromStrokes(drawStrokes), [drawStrokes]);
  const scoringSegments = useMemo(
    () => [...modelDrawnSegments, ...drawDrawnSegments],
    [modelDrawnSegments, drawDrawnSegments],
  );
  const modelTouchedDots = useMemo(() => touchedFromSegments(modelDrawnSegments), [modelDrawnSegments]);
  const drawTouchedDots = useMemo(() => touchedFromSegments(drawDrawnSegments), [drawDrawnSegments]);
  const hasInk = modelStrokes.length + drawStrokes.length > 0;

  const modelColor = useMemo(
    () => getContrastAdjustedColor(protocol.shapeColor, protocol.bgColor, protocol.contrastSensitivity),
    [protocol.shapeColor, protocol.bgColor, protocol.contrastSensitivity],
  );

  useEffect(() => {
    return () => {
      demoTokenRef.current += 1;
      if (metronomeIntervalRef.current) clearInterval(metronomeIntervalRef.current);
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      if (demoTimeoutRef.current) clearTimeout(demoTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (gameState === 'play' && protocol.metronomeEnabled) {
      metronomeIntervalRef.current = setInterval(() => {
        void playMetronomeTick();
      }, 60000 / protocol.bpm);
    } else if (metronomeIntervalRef.current) {
      clearInterval(metronomeIntervalRef.current);
      metronomeIntervalRef.current = null;
    }
    return () => {
      if (metronomeIntervalRef.current) {
        clearInterval(metronomeIntervalRef.current);
        metronomeIntervalRef.current = null;
      }
    };
  }, [gameState, protocol.metronomeEnabled, protocol.bpm]);

  const loadTrial = useCallback(
    (index: number, list: GeoboardPattern[], activeProtocol: GeoboardProtocol) => {
      const pattern = list[index];
      if (!pattern) return;
      const transformed = applyTransformToPattern(pattern.segments, activeProtocol.transform, GRID_SIZE, GRID_SIZE);
      setTargetSegments(transformed);
      setAnswerDotsVisible(getGeoboardGridDots(transformed, activeProtocol.matrixTier, GRID_SIZE, GRID_SIZE));
      setModelStrokes([]);
      setDrawStrokes([]);
      strokeBoardHistoryRef.current = [];
      setLiveBoard(null);
      setSelectedDot(null);
      setLiveDots([]);
      setFeedback(null);
      setLiveInkD('');
      demoTokenRef.current += 1;
      demoRunningRef.current = false;
      setIsDemoRunning(false);
      setDemoInkD('');
      if (demoTimeoutRef.current) {
        clearTimeout(demoTimeoutRef.current);
        demoTimeoutRef.current = null;
      }
      strokeRef.current = null;
      isStrokingRef.current = false;
      firstDotAtRef.current = null;
      correctionsRef.current = 0;
      tapSequenceRef.current = [];
      setTimeLeft(activeProtocol.timeLimitSec);
      if (patternStartsWithMemorize(pattern, activeProtocol.memoryMode)) {
        setMemorizeTimeLeft(Math.max(3, activeProtocol.memorizeSec || 5));
        setGameState('memorize');
      } else {
        trialStartRef.current = performance.now();
        setGameState('play');
      }
    },
    [],
  );

  const startSession = useCallback(
    (activeProtocol: GeoboardProtocol) => {
      const locked = lockBeginnerGeoboardProtocol(activeProtocol, boardId);
      const list = getBoardPatterns(boardId, locked.alphabetVariant);
      setPlaylist(list);
      setTrials([]);
      setTrialIndex(0);
      setResultsData(null);
      setFatigueWarning(false);
      sessionStartRef.current = performance.now();
      loadTrial(0, list, locked);
    },
    [boardId, loadTrial],
  );

  useEffect(() => {
    if (gameState !== 'memorize') return;
    const timer = setInterval(() => setMemorizeTimeLeft((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [gameState]);

  useEffect(() => {
    if (gameState !== 'memorize' || memorizeTimeLeft > 0) return;
    trialStartRef.current = performance.now();
    setGameState('play');
  }, [gameState, memorizeTimeLeft]);

  const buildTrialMetric = useCallback(
    (
      pattern: GeoboardPattern,
      drawn: Array<[number, number]>,
      target: Array<[number, number]>,
      outcome: { correct: boolean; errorType: GeoboardTrialMetric['errorType'] },
      timedOut: boolean,
    ): GeoboardTrialMetric => {
      const now = performance.now();
      return {
        trialIndex,
        patternId: pattern.id,
        patternName: pattern.name,
        complexityTier: pattern.complexityTier,
        matrixTier: protocol.matrixTier,
        transform: protocol.transform,
        dotTapSequence: tapSequenceRef.current,
        correct: outcome.correct,
        errorType: outcome.errorType,
        reactionTimeMs: now - trialStartRef.current,
        firstDotLatencyMs: firstDotAtRef.current !== null ? firstDotAtRef.current - trialStartRef.current : 0,
        corrections: correctionsRef.current,
        segmentsDrawn: drawn.length,
        segmentsTarget: target.length,
        halfField: evaluateHalfFieldAccuracy(drawn, target, GRID_SIZE, GRID_SIZE),
        timedOut,
        completed: !timedOut,
      };
    },
    [trialIndex, protocol.matrixTier, protocol.transform],
  );

  const finishSession = useCallback(
    (finalTrials: GeoboardTrialMetric[], status: 'completed' | 'incomplete') => {
      const durationSec = Math.round((performance.now() - sessionStartRef.current) / 1000);
      const attempted = finalTrials.length;
      const correctCount = finalTrials.filter((t) => t.correct).length;
      const wrongCount = attempted - correctCount;
      const accuracy = attempted > 0 ? Math.round((correctCount / attempted) * 100) : 0;
      const avg = (pick: (t: GeoboardTrialMetric) => number) =>
        attempted > 0 ? finalTrials.reduce((acc, t) => acc + pick(t), 0) / attempted : 0;
      const halfTotals = finalTrials.reduce(
        (acc, t) => ({
          leftMatched: acc.leftMatched + t.halfField.leftMatched,
          leftTotal: acc.leftTotal + t.halfField.leftTotal,
          rightMatched: acc.rightMatched + t.halfField.rightMatched,
          rightTotal: acc.rightTotal + t.halfField.rightTotal,
        }),
        { leftMatched: 0, leftTotal: 0, rightMatched: 0, rightTotal: 0 },
      );
      const summary: GeoboardSessionResultData = {
        patientName: protocol.patientName,
        sessionId: Date.now(),
        date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        gameName: `Geoboard — ${board.shortLabel}`,
        stimuliCount: attempted,
        letterSize: 1,
        speed: '1x',
        durationSec,
        clicksTotal: finalTrials.reduce((acc, t) => acc + t.dotTapSequence.length, 0),
        correct: correctCount,
        wrong: wrongCount,
        accuracy,
        avgReactionSec: reactionStatsFromMs(finalTrials.map((t) => t.reactionTimeMs)).avgSec,
        stimulusType: board.stimulusType,
        boardId,
        boardName: board.name,
        alphabetVariant: board.supportsLetterCase ? protocol.alphabetVariant : undefined,
        protocolSnapshot: protocol,
        trials: finalTrials,
        maxComplexityReached: finalTrials.reduce(
          (acc, t) => (t.complexityTier > acc ? t.complexityTier : acc),
          1 as GeoboardComplexityTier,
        ),
        maxMatrixReached: protocol.matrixTier,
        avgFirstDotLatencySec: parseFloat((avg((t) => t.firstDotLatencyMs) / 1000).toFixed(2)),
        totalCorrections: finalTrials.reduce((acc, t) => acc + t.corrections, 0),
        timeoutCount: finalTrials.filter((t) => t.timedOut).length,
        leftHalfAccuracy: halfTotals.leftTotal > 0 ? Math.round((halfTotals.leftMatched / halfTotals.leftTotal) * 100) : 0,
        rightHalfAccuracy: halfTotals.rightTotal > 0 ? Math.round((halfTotals.rightMatched / halfTotals.rightTotal) * 100) : 0,
        errorBreakdown: {
          wrongDot: finalTrials.filter((t) => t.errorType === 'wrong-dot').length,
          wrongShape: finalTrials.filter((t) => t.errorType === 'wrong-shape').length,
          incomplete: finalTrials.filter((t) => t.errorType === 'incomplete').length,
        },
        penColor: protocol.penColor,
        penColorName: getPenColorName(protocol.penColor),
        starRating: getGeoboardStarRating(accuracy),
        status,
      };
      // TODO: persist once DB is configured
      void hapticCorrect();
      setResultsData(summary);
      setGameState('results');
    },
    [board, boardId, protocol],
  );

  const checkFatigue = useCallback((history: GeoboardTrialMetric[]) => {
    if (history.length < 6) return;
    const first3 = history.slice(0, 3);
    const last3 = history.slice(-3);
    const avgRTFirst = first3.reduce((acc, t) => acc + t.reactionTimeMs, 0) / 3;
    const avgRTLast = last3.reduce((acc, t) => acc + t.reactionTimeMs, 0) / 3;
    const recentAccuracy = history.slice(-4).filter((t) => t.correct).length / 4;
    if (avgRTLast > 1.8 * avgRTFirst || recentAccuracy < 0.4) setFatigueWarning(true);
  }, []);

  const commitTrial = useCallback(
    (metric: GeoboardTrialMetric, message: string) => {
      const history = [...trials, metric];
      setTrials(history);
      checkFatigue(history);
      setFeedback({ correct: metric.correct, message });
      setGameState('feedback');
      const sessionElapsedSec = (performance.now() - sessionStartRef.current) / 1000;
      const isLast = trialIndex + 1 >= playlist.length;
      const hitTimeCap = sessionElapsedSec >= SESSION_TIME_CAP_SEC;
      feedbackTimeoutRef.current = setTimeout(() => {
        if (isLast || hitTimeCap) {
          finishSession(history, isLast ? 'completed' : 'incomplete');
        } else {
          const nextIndex = trialIndex + 1;
          setTrialIndex(nextIndex);
          loadTrial(nextIndex, playlist, protocol);
        }
      }, FEEDBACK_DURATION_MS);
    },
    [trials, trialIndex, playlist, protocol, checkFatigue, finishSession, loadTrial],
  );

  const handleDone = useCallback(() => {
    if (gameState !== 'play' || !currentPattern || demoRunningRef.current) return;
    const evaluation =
      currentPattern.task === 'copy' || currentPattern.task === 'recall'
        ? evaluateBeginnerPractice(scoringSegments, targetSegments, GRID_SIZE, GRID_SIZE)
        : evaluateDrawing(drawDrawnSegments, targetSegments, GRID_SIZE, GRID_SIZE);
    const metric = buildTrialMetric(
      currentPattern,
      currentPattern.task === 'copy' || currentPattern.task === 'recall' ? scoringSegments : drawDrawnSegments,
      targetSegments,
      evaluation,
      false,
    );
    let message = 'Nice work — that matches.';
    if (!evaluation.correct) {
      if (currentPattern.task === 'copy' || currentPattern.task === 'recall') {
        message =
          evaluation.errorType === 'wrong-shape'
            ? 'Draw standing or steep lines like the guide — fill every row or column.'
            : 'Finish every remaining row (steep) or column (standing) with a full line.';
      } else if (evaluation.errorType === 'wrong-dot') message = 'A line reached a dot that is not part of the shape.';
      else if (evaluation.errorType === 'incomplete') message = 'Some lines of the shape are still missing.';
      else message = 'The lines form a different shape.';
    }
    if (evaluation.correct) void hapticCorrect();
    else void hapticWrong();
    commitTrial(metric, message);
  }, [gameState, currentPattern, scoringSegments, drawDrawnSegments, targetSegments, buildTrialMetric, commitTrial]);

  const handleSkip = useCallback(
    (timedOut: boolean) => {
      if (!currentPattern) return;
      demoTokenRef.current += 1;
      demoRunningRef.current = false;
      setIsDemoRunning(false);
      setDemoInkD('');
      const drawn = currentPattern.task === 'copy' ? scoringSegments : drawDrawnSegments;
      const evaluation = evaluateDrawing(drawn, targetSegments, GRID_SIZE, GRID_SIZE);
      const metric = buildTrialMetric(
        currentPattern,
        drawn,
        targetSegments,
        { correct: false, errorType: evaluation.correct ? 'incomplete' : evaluation.errorType },
        timedOut,
      );
      void hapticMiss();
      commitTrial(metric, timedOut ? 'Time is up for this pattern.' : 'Pattern skipped.');
    },
    [currentPattern, scoringSegments, drawDrawnSegments, targetSegments, buildTrialMetric, commitTrial],
  );

  const handleSkipRef = useRef(handleSkip);
  useEffect(() => {
    handleSkipRef.current = handleSkip;
  }, [handleSkip]);

  useEffect(() => {
    if (gameState !== 'play' || protocol.timeLimitSec <= 0) return;
    const timer = setInterval(() => setTimeLeft((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [gameState, protocol.timeLimitSec, trialIndex]);

  useEffect(() => {
    if (gameState !== 'play' || protocol.timeLimitSec <= 0 || timeLeft > 0) return;
    handleSkipRef.current(true);
  }, [gameState, protocol.timeLimitSec, timeLeft]);

  const captureDot = (dot: number) => {
    const stroke = strokeRef.current;
    if (!stroke) return;
    if (stroke.dots[stroke.dots.length - 1] === dot) return;
    const now = performance.now();
    if (firstDotAtRef.current === null) firstDotAtRef.current = now;
    tapSequenceRef.current = [...tapSequenceRef.current, { dotIndex: dot, timestamp: now }];
    stroke.dots.push(dot);
    if (stroke.dots.length > 1) {
      void hapticLight();
      void playDotJoin();
    }
    setSelectedDot(dot);
    setLiveDots([...stroke.dots]);
  };

  const makeBoardPan = (
    originRef: { current: { x: number; y: number; w: number; h: number } },
    board: InkBoard,
  ) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => gameStateRef.current === 'play' && !demoRunningRef.current,
      onMoveShouldSetPanResponder: () => gameStateRef.current === 'play' && !demoRunningRef.current,
      onPanResponderGrant: (evt) => {
        if (gameStateRef.current !== 'play' || demoRunningRef.current) return;
        setLiveBoard(board);
        const origin = originRef.current;
        const point = pointFromBoardEvent(evt, origin);
        strokeRef.current = { points: [point], dots: [] };
        isStrokingRef.current = true;
        setLiveDots([]);
        const lastDot = strokeRef.current?.dots[strokeRef.current.dots.length - 1] ?? null;
        const dot = hitTestGeoboardDot(point.x, point.y, answerDotsRef.current, origin.w, origin.h, lastDot);
        if (dot !== null) captureDot(dot);
        setLiveInkD(inkPath([point]));
      },
      onPanResponderMove: (evt) => {
        if (gameStateRef.current !== 'play' || !isStrokingRef.current || demoRunningRef.current) return;
        const stroke = strokeRef.current;
        if (!stroke) return;
        const origin = originRef.current;
        const point = pointFromBoardEvent(evt, origin);
        const last = stroke.points[stroke.points.length - 1];
        if (Math.hypot(point.x - last.x, point.y - last.y) < INK_MIN_SPACING_PERCENT) return;
        stroke.points.push(point);
        setLiveInkD(inkPath(stroke.points));
      },
      onPanResponderRelease: (evt) => {
        if (!isStrokingRef.current) return;
        isStrokingRef.current = false;
        const stroke = strokeRef.current;
        if (stroke) {
          const origin = originRef.current;
          const point = pointFromBoardEvent(evt, origin);
          stroke.points.push(point);
          const lastDot = stroke.dots[stroke.dots.length - 1] ?? null;
          const endDot = hitTestGeoboardDot(point.x, point.y, answerDotsRef.current, origin.w, origin.h, lastDot, 1.35);
          if (endDot !== null) captureDot(endDot);
        }
        strokeRef.current = null;
        setLiveInkD('');
        setLiveDots([]);
        if (!stroke) {
          setLiveBoard(null);
          return;
        }
        const travelled = stroke.points.reduce((acc, point, idx) => {
          if (idx === 0) return acc;
          const prev = stroke.points[idx - 1];
          return acc + Math.hypot(point.x - prev.x, point.y - prev.y);
        }, 0);
        if (travelled < INK_MIN_STROKE_PERCENT || stroke.dots.length < 2) {
          setLiveBoard(null);
          return;
        }
        if (board === 'model') setModelStrokes((prev) => [...prev, stroke]);
        else setDrawStrokes((prev) => [...prev, stroke]);
        strokeBoardHistoryRef.current.push(board);
        setLiveBoard(null);
      },
      onPanResponderTerminate: () => {
        isStrokingRef.current = false;
        strokeRef.current = null;
        setLiveInkD('');
        setLiveDots([]);
        setLiveBoard(null);
      },
    });

  const modelPan = useRef(makeBoardPan(modelOriginRef, 'model')).current;
  const drawPan = useRef(makeBoardPan(drawOriginRef, 'draw')).current;

  const handleUndo = () => {
    if (demoRunningRef.current || !hasInk) return;
    const board = strokeBoardHistoryRef.current.pop();
    if (!board) return;
    correctionsRef.current += 1;
    if (board === 'model') setModelStrokes((prev) => prev.slice(0, -1));
    else setDrawStrokes((prev) => prev.slice(0, -1));
    setSelectedDot(null);
    setLiveDots([]);
    void hapticMiss();
  };

  const handleClear = () => {
    if (demoRunningRef.current || !hasInk) return;
    correctionsRef.current += 1;
    setModelStrokes([]);
    setDrawStrokes([]);
    strokeBoardHistoryRef.current = [];
    setSelectedDot(null);
    setLiveDots([]);
    strokeRef.current = null;
    setLiveInkD('');
    setLiveBoard(null);
    void hapticMiss();
  };

  const runPatternDemo = () => {
    if (gameStateRef.current !== 'play' || targetSegments.length === 0) return;
    if (demoTimeoutRef.current) {
      clearTimeout(demoTimeoutRef.current);
      demoTimeoutRef.current = null;
    }
    demoTokenRef.current += 1;
    const token = demoTokenRef.current;
    const chainDotIds = segmentsToChains(targetSegments);
    const chains = chainDotIds
      .map((dotIds) => ({ dotIds, ...sampleChain(dotIds) }))
      .filter((chain) => chain.points.length > 0);
    if (chains.length === 0) return;

    const sampled = chains.map((chain) => chain.points);
    const totalPoints = sampled.reduce((sum, points) => sum + points.length, 0);
    const vertexEvents: Array<{ index: number; dot: number; join: boolean }> = [];
    let offset = 0;
    for (const chain of chains) {
      if (chain.dotIds.length > 0) {
        vertexEvents.push({ index: offset, dot: chain.dotIds[0], join: false });
      }
      for (const join of chain.joins) {
        vertexEvents.push({ index: offset + join.index, dot: join.dot, join: true });
      }
      offset += chain.points.length;
    }

    demoRunningRef.current = true;
    setIsDemoRunning(true);
    setDemoInkD('');
    const firstDot = vertexEvents[0]?.dot;
    const lit = new Set<number>(typeof firstDot === 'number' ? [firstDot] : []);
    setLiveDots([...lit]);
    setSelectedDot(firstDot ?? null);

    const duration = Math.min(4500, Math.max(900, totalPoints * 22));
    const startTime = Date.now();
    let nextEvent = 0;

    const animate = () => {
      if (token !== demoTokenRef.current) return;
      const progress = Math.min(1, (Date.now() - startTime) / duration);
      const pointCount = Math.max(1, Math.floor(progress * totalPoints));
      setDemoInkD(demoInkFromProgress(sampled, pointCount));
      while (nextEvent < vertexEvents.length && vertexEvents[nextEvent].index <= pointCount - 1) {
        const event = vertexEvents[nextEvent];
        lit.add(event.dot);
        setLiveDots([...lit]);
        setSelectedDot(event.dot);
        if (event.join) {
          void hapticLight();
          void playDotJoin();
        }
        nextEvent += 1;
      }
      if (progress < 1) {
        requestAnimationFrame(animate);
        return;
      }
      setDemoInkD(demoInkFromProgress(sampled, totalPoints));
      demoTimeoutRef.current = setTimeout(() => {
        if (token !== demoTokenRef.current) return;
        setDemoInkD('');
        setLiveDots([]);
        setSelectedDot(null);
        demoRunningRef.current = false;
        setIsDemoRunning(false);
        demoTimeoutRef.current = null;
      }, 550);
    };
    requestAnimationFrame(animate);
  };

  const handleApplySettings = (next: GeoboardProtocol) => {
    const applied = lockBeginnerGeoboardProtocol({ ...next, boardId }, boardId);
    setProtocol(applied);
    setIsSettingsOpen(false);
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
  };

  const handleReplay = () => {
    setResultsData(null);
    setGameState('settings');
    setIsSettingsOpen(true);
  };

  const isPlayingPhase = gameState === 'memorize' || gameState === 'play' || gameState === 'feedback';
  const showModel = patternShowsModel(currentPattern, protocol.memoryMode, gameState);
  const practiceOnReference = currentPattern?.task === 'copy';
  const modelInteractive = practiceOnReference && gameState === 'play';
  const drawInteractive = gameState === 'play';
  const sideBySide = isTablet && width > height;
  const playPad = isPlayingPhase ? s(8) : 0;
  const toolbarAvail = Math.max(1, width - playPad * 2 - (sideBySide ? 0 : s(8)));
  const toolbarIconSize = sideBySide
    ? TOOLBAR_ICON_MAX
    : Math.max(
        TOOLBAR_ICON_MIN,
        Math.min(TOOLBAR_ICON_MAX, Math.floor(toolbarAvail / TOOLBAR_BUTTON_COUNT)),
      );
  const toolbarGlyphSize = Math.max(14, Math.round(toolbarIconSize * (18 / TOOLBAR_ICON_MAX)));
  const modelStroke = Math.max(2.8, 900 / Math.max(modelLayout.w || width, modelLayout.h || width));
  const inkStroke = Math.max(2.4, 780 / Math.max(drawLayout.w || width, drawLayout.h || width));

  const renderLines = (segments: Array<[number, number]>, color: string, strokeWidth = modelStroke, opacity = 1) =>
    segments.map(([start, end], idx) => (
      <Line
        key={`${start}-${end}-${idx}`}
        x1={DOT_POSITIONS[start].x}
        y1={DOT_POSITIONS[start].y}
        x2={DOT_POSITIONS[end].x}
        y2={DOT_POSITIONS[end].y}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeOpacity={opacity}
      />
    ));

  const makeInkLayer = (
    boardStrokes: PenStroke[],
    boardSegments: Array<[number, number]>,
    showLive: boolean,
    showDemo: boolean,
  ) => (
    <>
      {renderLines(boardSegments, protocol.penColor, inkStroke * 0.55, 0.35)}
      {boardStrokes.map((stroke, idx) => (
        <Path
          key={`stroke-${idx}`}
          d={inkPath(stroke.points)}
          fill="none"
          stroke={protocol.penColor}
          strokeWidth={inkStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {showLive && liveInkD ? (
        <Path
          d={liveInkD}
          fill="none"
          stroke={protocol.penColor}
          strokeWidth={inkStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {showDemo && demoInkD ? (
        <Path
          d={demoInkD}
          fill="none"
          stroke={protocol.penColor}
          strokeWidth={inkStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity={0.9}
        />
      ) : null}
    </>
  );

  const idleDotColor = protocol.dotColor || THERAPY_DOT_COLOR;
  const activeDotColor = protocol.dotActiveColor || THERAPY_DOT_ACTIVE_COLOR;

  const renderPegs = (
    interactive: boolean,
    layout: { w: number; h: number },
    touched: Set<number>,
    isLive: boolean,
  ) => {
    const pegSize = geoboardPegPixelSize(
      Math.min(layout.w || width, layout.h || width),
      protocol.pegSizeScale,
    );
    return DOT_POSITIONS.map((dot, idx) => {
      const hidden = interactive && !answerDotsVisible[idx];
      const active = touched.has(idx) || (isLive && (idx === selectedDot || liveDots.includes(idx)));
      if (hidden) return null;
      return (
        <View
          key={`${interactive ? 'a' : 'm'}-${idx}`}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: `${dot.x}%`,
            top: `${dot.y}%`,
            width: pegSize,
            height: pegSize,
            marginLeft: -pegSize / 2,
            marginTop: -pegSize / 2,
            borderRadius: pegSize / 2,
            backgroundColor: active ? activeDotColor : idleDotColor,
            borderWidth: pegSize >= 14 ? 2 : 1,
            borderColor: protocol.bgColor === '#FFFFFF' || protocol.bgColor === '#F2F5F3' ? '#E5E7EB' : '#94A3B8',
            opacity: interactive ? 1 : 0.92,
          }}
        />
      );
    });
  };

  const boardFrame = ({
    svgChildren,
    overlay,
    interactive,
    layout,
    onSize,
    viewRef,
    originRef,
    panHandlers,
    touchedDots,
    isLive,
  }: {
    svgChildren: ReactNode;
    overlay?: ReactNode;
    interactive: boolean;
    layout: { w: number; h: number };
    onSize: (next: { w: number; h: number }) => void;
    viewRef?: RefObject<View | null>;
    originRef?: { current: { x: number; y: number; w: number; h: number } };
    panHandlers?: ReturnType<typeof PanResponder.create>['panHandlers'];
    touchedDots: Set<number>;
    isLive: boolean;
  }) => (
    <View
      ref={interactive ? viewRef : undefined}
      collapsable={false}
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        if (w !== layout.w || h !== layout.h) onSize({ w, h });
        if (interactive && originRef && viewRef) {
          originRef.current = { ...originRef.current, w, h };
          viewRef.current?.measureInWindow((x, y, mw, mh) => {
            originRef.current = { x, y, w: mw || w, h: mh || h };
          });
        }
      }}
      {...(interactive && panHandlers ? panHandlers : {})}
      style={{
        flex: 1,
        alignSelf: 'stretch',
        width: '100%',
        borderRadius: 0,
        borderWidth: BOARD_BORDER_WIDTH,
        borderColor: '#0F172A',
        backgroundColor: protocol.bgColor,
        overflow: 'hidden',
      }}
    >
      {layout.w > 0 && layout.h > 0 ? (
        <Svg
          pointerEvents="none"
          width={Math.max(1, layout.w - BOARD_BORDER_WIDTH * 2)}
          height={Math.max(1, layout.h - BOARD_BORDER_WIDTH * 2)}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {svgChildren}
        </Svg>
      ) : null}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        {renderPegs(interactive, layout, touchedDots, isLive)}
      </View>
      {overlay}
    </View>
  );

  const actionBtn = (icon: ReactNode, label: string, onPress: () => void, disabled = false) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: toolbarIconSize,
        height: toolbarIconSize,
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.28 : 1,
      }}
    >
      {icon}
    </Pressable>
  );

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#0B1220',
        paddingTop: insets.top,
        paddingBottom: isPlayingPhase ? insets.bottom : insets.bottom,
        paddingHorizontal: isPlayingPhase ? s(8) : 0,
      }}
    >
      {gameState === 'settings' && !isSettingsOpen ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: s(24) }}>
          <Text style={{ color: '#fff', fontSize: fs(24), fontWeight: '800' }}>{board.shortLabel}</Text>
          <Pressable
            onPress={() => startSession(protocol)}
            style={{ backgroundColor: '#34D399', borderRadius: 999, paddingHorizontal: s(28), paddingVertical: s(14), marginTop: s(16) }}
          >
            <Text style={{ color: '#022c22', fontWeight: '900' }}>Click to Start</Text>
          </Pressable>
          <Pressable onPress={() => setIsSettingsOpen(true)} style={{ marginTop: s(12) }}>
            <Text style={{ color: '#94A3B8', fontWeight: '700' }}>Edit Clinical Settings</Text>
          </Pressable>
        </View>
      ) : null}

      {isPlayingPhase && currentPattern ? (
        <View style={{ flex: 1, flexDirection: sideBySide ? 'row' : 'column' }}>
          <View style={{ flex: 1 }}>
            {boardFrame({
              interactive: modelInteractive,
              layout: modelLayout,
              onSize: setModelLayout,
              viewRef: modelViewRef,
              originRef: modelOriginRef,
              panHandlers: modelPan.panHandlers,
              touchedDots: modelTouchedDots,
              isLive: liveBoard === 'model',
              svgChildren: (
                <>
                  {showModel ? renderLines(currentPattern.segments, modelColor, modelStroke) : null}
                  {practiceOnReference
                    ? makeInkLayer(modelStrokes, modelDrawnSegments, liveBoard === 'model', false)
                    : null}
                </>
              ),
              overlay: showModel ? (
                <Text
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    top: s(8),
                    right: s(10),
                    color: '#0F172A',
                    fontWeight: '800',
                    fontSize: fs(13),
                  }}
                >
                  {trialIndex + 1}/{playlist.length}
                  {protocol.timeLimitSec > 0 ? `  ·  ${timeLeft}s` : ''}
                </Text>
              ) : (
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(15,23,42,0.72)',
                  }}
                >
                  <Text style={{ color: '#E2E8F0', fontSize: fs(13), textAlign: 'center' }}>
                    {gameState === 'memorize' ? `Memorize · ${memorizeTimeLeft}s` : 'Model hidden'}
                  </Text>
                </View>
              ),
            })}
          </View>

          <View
            style={{
              flexDirection: sideBySide ? 'column' : 'row',
              flexWrap: 'nowrap',
              flexShrink: 0,
              alignItems: 'center',
              justifyContent: 'space-evenly',
              paddingHorizontal: sideBySide ? s(8) : 0,
              paddingVertical: sideBySide ? s(8) : s(4),
              height: sideBySide ? undefined : toolbarIconSize + s(8),
              width: sideBySide ? toolbarIconSize + s(16) : '100%',
              backgroundColor: '#0B1220',
            }}
          >
            {gameState === 'play' ? (
              <>
                {actionBtn(
                  <ReplayIcon size={toolbarGlyphSize} color="#64748B" />,
                  isDemoRunning ? 'Replay demo' : 'Play demo',
                  runPatternDemo,
                )}
                {actionBtn(
                  <UndoIcon size={toolbarGlyphSize} color="#64748B" />,
                  'Undo',
                  handleUndo,
                  isDemoRunning || !hasInk,
                )}
                {actionBtn(
                  <ClearIcon size={toolbarGlyphSize} color="#64748B" />,
                  'Clear',
                  handleClear,
                  isDemoRunning || !hasInk,
                )}
                {actionBtn(<SkipIcon size={toolbarGlyphSize} color="#64748B" />, 'Skip', () => handleSkip(false))}
                {actionBtn(<CheckIcon size={toolbarGlyphSize} color="#64748B" />, 'Done', handleDone, isDemoRunning)}
              </>
            ) : null}
            <Pressable
              onPress={() => setIsMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Settings menu"
              style={{
                width: toolbarIconSize,
                height: toolbarIconSize,
                flexShrink: 0,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SlidersIcon size={toolbarGlyphSize} color="#64748B" />
            </Pressable>
          </View>

          <View style={{ flex: 1 }}>
            {boardFrame({
              interactive: drawInteractive,
              layout: drawLayout,
              onSize: setDrawLayout,
              viewRef: drawViewRef,
              originRef: drawOriginRef,
              panHandlers: drawPan.panHandlers,
              touchedDots: drawTouchedDots,
              isLive: liveBoard === 'draw',
              svgChildren: makeInkLayer(drawStrokes, drawDrawnSegments, liveBoard === 'draw', true),
              overlay:
                gameState === 'feedback' && feedback ? (
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: feedback.correct ? 'rgba(16,185,129,0.22)' : 'rgba(244,63,94,0.22)',
                      padding: s(16),
                    }}
                  >
                    <Text style={{ color: feedback.correct ? '#10B981' : '#F43F5E', fontSize: fs(32), fontWeight: '800' }}>
                      {feedback.correct ? '✓' : '✕'}
                    </Text>
                    <Text style={{ color: '#0F172A', textAlign: 'center', marginTop: s(6), fontWeight: '700' }}>{feedback.message}</Text>
                  </View>
                ) : null,
            })}
          </View>
        </View>
      ) : null}

      <GameMenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onQuit={() => setAllowExit(true)}
        onReset={() => {
          setIsMenuOpen(false);
          startSession(protocol);
        }}
        onOpenSettings={() => {
          setIsMenuOpen(false);
          setIsSettingsOpen(true);
        }}
        resetButtonLabel="Restart Board"
        settingsSummary={[
          { label: 'Patient', value: protocol.patientName },
          { label: 'Board', value: board.shortLabel },
          ...(board.supportsLetterCase
            ? [{ label: 'Letter Case', value: protocol.alphabetVariant === 'lowercase' ? 'Lowercase' : 'Uppercase' }]
            : []),
          ...(isBeginnerLineBoard(boardId)
            ? [{ label: 'Rules', value: 'Copy the reference, then draw on your own' }]
            : [
                { label: 'Matrix', value: `${answerDotsVisible.filter(Boolean).length} dots` },
                { label: 'Transform', value: protocol.transform.replace(/_/g, ' ') },
                { label: 'Memory Mode', value: protocol.memoryMode ? `On · ${protocol.memorizeSec}s` : 'Off' },
              ]),
          { label: 'Time Limit', value: protocol.timeLimitSec > 0 ? `${protocol.timeLimitSec}s` : 'Off' },
          { label: 'Ocularity', value: protocol.ocularity === 'Both' ? 'Binocular' : `${protocol.ocularity} eye` },
        ]}
      />

      <GeoboardSettingsModal
        isOpen={isSettingsOpen}
        onClose={handleCloseSettings}
        onApply={handleApplySettings}
        protocol={protocol}
        boardName={board.shortLabel}
        supportsLetterCase={board.supportsLetterCase}
        beginnerLineBoard={isBeginnerLineBoard(boardId)}
        patternCount={patternCount}
      />

      {resultsData ? (
        <GameResultsModal isOpen={gameState === 'results'} data={resultsData} onClose={() => setAllowExit(true)} onReplay={handleReplay} />
      ) : null}
    </View>
  );
}
