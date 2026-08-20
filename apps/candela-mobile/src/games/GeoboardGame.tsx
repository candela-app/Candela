import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PanResponder, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Path } from 'react-native-svg';
import {
  GEOBOARD_BOARDS,
  applyTransformToPattern,
  evaluateDrawing,
  evaluateHalfFieldAccuracy,
  findNearestGeoboardDot,
  getBoardPatterns,
  getContrastAdjustedColor,
  getGeoboardDotPositions,
  getGeoboardGridDots,
  getGeoboardStarRating,
  getPenColorName,
  type GeoboardBoardId,
  type GeoboardComplexityTier,
  type GeoboardPattern,
  type GeoboardProtocol,
  type GeoboardSessionResultData,
  type GeoboardTrialMetric,
} from '@candela/shared/rn';
import { GameMenuDrawer } from '../components/GameMenuDrawer';
import { GameResultsModal } from '../components/GameResultsModal';
import { GeoboardSettingsModal } from '../components/GeoboardSettingsModal';
import { CheckIcon, ClearIcon, ReplayIcon, SkipIcon, SlidersIcon, UndoIcon } from '../components/icons';
import { hapticCorrect, hapticLight, hapticMiss, hapticWrong } from '../lib/haptics';
import { playDotJoin, playMetronomeTick } from '../lib/sfx';
import { sessionDisplayName, useAuth } from '../lib/auth-context';
import { useLayout } from '../lib/layout';

const GRID_SIZE = 5;
const DOT_COUNT = GRID_SIZE * GRID_SIZE;
const DOT_POSITIONS = getGeoboardDotPositions(GRID_SIZE, GRID_SIZE);
const SNAP_RADIUS_PERCENT = 9;
const FEEDBACK_DURATION_MS = 1300;
const SESSION_TIME_CAP_SEC = 600;
const INK_MIN_SPACING_PERCENT = 0.6;
const INK_MIN_STROKE_PERCENT = 1.5;
const THERAPY_BG_COLOR = '#FFFFFF';
const THERAPY_MODEL_COLOR = '#000000';
const THERAPY_PEN_COLOR = '#FBBF24';
const THERAPY_DOT_COLOR = '#111827';
const THERAPY_DOT_ACTIVE_COLOR = '#0284C7';
const SETTINGS_ICON_SIZE = 44;

type GeoboardGameState = 'settings' | 'memorize' | 'play' | 'feedback' | 'results';

interface InkPoint {
  x: number;
  y: number;
}

interface PenStroke {
  points: InkPoint[];
  dots: number[];
}

interface TrialFeedback {
  correct: boolean;
  message: string;
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
  });
  const [playlist, setPlaylist] = useState<GeoboardPattern[]>([]);
  const [trialIndex, setTrialIndex] = useState(0);
  const [targetSegments, setTargetSegments] = useState<Array<[number, number]>>([]);
  const [answerDotsVisible, setAnswerDotsVisible] = useState<boolean[]>(new Array(DOT_COUNT).fill(true));
  const [strokes, setStrokes] = useState<PenStroke[]>([]);
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
  const [fatigueWarning, setFatigueWarning] = useState(false);
  const [modelLayout, setModelLayout] = useState({ w: 0, h: 0 });
  const [drawLayout, setDrawLayout] = useState({ w: 0, h: 0 });

  const isStrokingRef = useRef(false);
  const strokeRef = useRef<PenStroke | null>(null);
  const sessionStartRef = useRef(0);
  const trialStartRef = useRef(0);
  const firstDotAtRef = useRef<number | null>(null);
  const correctionsRef = useRef(0);
  const tapSequenceRef = useRef<Array<{ dotIndex: number; timestamp: number }>>([]);
  const metronomeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answerOriginRef = useRef({ x: 0, y: 0, w: 1, h: 1 });
  const answerViewRef = useRef<View>(null);
  const gameStateRef = useRef(gameState);
  const answerDotsRef = useRef(answerDotsVisible);
  const demoTokenRef = useRef(0);
  const demoRunningRef = useRef(false);
  const demoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentPattern = playlist[trialIndex] ?? null;
  const patternCount = playlist.length || getBoardPatterns(boardId, protocol.alphabetVariant).length;

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);
  useEffect(() => {
    answerDotsRef.current = answerDotsVisible;
  }, [answerDotsVisible]);
  useEffect(() => {
    const name = session?.user.name?.trim();
    if (name) setProtocol((prev) => ({ ...prev, patientName: name }));
  }, [session?.user.name]);

  const drawnSegments = useMemo(() => {
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
  }, [strokes]);

  const touchedDots = useMemo(() => {
    const dots = new Set<number>();
    for (const [from, to] of drawnSegments) {
      dots.add(from);
      dots.add(to);
    }
    return dots;
  }, [drawnSegments]);

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
      setStrokes([]);
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
      if (activeProtocol.memoryMode) {
        setMemorizeTimeLeft(activeProtocol.memorizeSec);
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
      const list = getBoardPatterns(boardId, activeProtocol.alphabetVariant);
      setPlaylist(list);
      setTrials([]);
      setTrialIndex(0);
      setResultsData(null);
      setFatigueWarning(false);
      sessionStartRef.current = performance.now();
      loadTrial(0, list, activeProtocol);
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
        avgReactionSec: parseFloat((avg((t) => t.reactionTimeMs) / 1000).toFixed(2)),
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
    const evaluation = evaluateDrawing(drawnSegments, targetSegments, GRID_SIZE, GRID_SIZE);
    const metric = buildTrialMetric(currentPattern, drawnSegments, targetSegments, evaluation, false);
    let message = 'Nice work — that matches.';
    if (!evaluation.correct) {
      if (evaluation.errorType === 'wrong-dot') message = 'A line reached a dot that is not part of the shape.';
      else if (evaluation.errorType === 'incomplete') message = 'Some lines of the shape are still missing.';
      else message = 'The lines form a different shape.';
    }
    if (evaluation.correct) void hapticCorrect();
    else void hapticWrong();
    commitTrial(metric, message);
  }, [gameState, currentPattern, drawnSegments, targetSegments, buildTrialMetric, commitTrial]);

  const handleSkip = useCallback(
    (timedOut: boolean) => {
      if (!currentPattern) return;
      demoTokenRef.current += 1;
      demoRunningRef.current = false;
      setIsDemoRunning(false);
      setDemoInkD('');
      const evaluation = evaluateDrawing(drawnSegments, targetSegments, GRID_SIZE, GRID_SIZE);
      const metric = buildTrialMetric(
        currentPattern,
        drawnSegments,
        targetSegments,
        { correct: false, errorType: evaluation.correct ? 'incomplete' : evaluation.errorType },
        timedOut,
      );
      void hapticMiss();
      commitTrial(metric, timedOut ? 'Time is up for this pattern.' : 'Pattern skipped.');
    },
    [currentPattern, drawnSegments, targetSegments, buildTrialMetric, commitTrial],
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

  const pointFromPage = (pageX: number, pageY: number): InkPoint => {
    const origin = answerOriginRef.current;
    return {
      x: ((pageX - origin.x) / origin.w) * 100,
      y: ((pageY - origin.y) / origin.h) * 100,
    };
  };

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

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => gameStateRef.current === 'play' && !demoRunningRef.current,
      onMoveShouldSetPanResponder: () => gameStateRef.current === 'play' && !demoRunningRef.current,
      onPanResponderGrant: (evt) => {
        if (gameStateRef.current !== 'play' || demoRunningRef.current) return;
        answerViewRef.current?.measureInWindow((x, y, w, h) => {
          answerOriginRef.current = { x, y, w, h };
        });
        const point = pointFromPage(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
        strokeRef.current = { points: [point], dots: [] };
        isStrokingRef.current = true;
        setLiveDots([]);
        const dot = findNearestGeoboardDot(point.x, point.y, answerDotsRef.current, SNAP_RADIUS_PERCENT, GRID_SIZE, GRID_SIZE);
        if (dot !== null) captureDot(dot);
        setLiveInkD(inkPath([point]));
      },
      onPanResponderMove: (evt) => {
        if (gameStateRef.current !== 'play' || !isStrokingRef.current || demoRunningRef.current) return;
        const stroke = strokeRef.current;
        if (!stroke) return;
        const point = pointFromPage(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
        const last = stroke.points[stroke.points.length - 1];
        if (Math.hypot(point.x - last.x, point.y - last.y) < INK_MIN_SPACING_PERCENT) return;
        stroke.points.push(point);
        setLiveInkD(inkPath(stroke.points));
        const dot = findNearestGeoboardDot(point.x, point.y, answerDotsRef.current, SNAP_RADIUS_PERCENT, GRID_SIZE, GRID_SIZE);
        if (dot !== null) captureDot(dot);
      },
      onPanResponderRelease: () => {
        if (!isStrokingRef.current) return;
        isStrokingRef.current = false;
        const stroke = strokeRef.current;
        strokeRef.current = null;
        setLiveInkD('');
        setLiveDots([]);
        if (!stroke) return;
        const travelled = stroke.points.reduce((acc, point, idx) => {
          if (idx === 0) return acc;
          const prev = stroke.points[idx - 1];
          return acc + Math.hypot(point.x - prev.x, point.y - prev.y);
        }, 0);
        if (travelled < INK_MIN_STROKE_PERCENT) return;
        setStrokes((prev) => [...prev, stroke]);
      },
      onPanResponderTerminate: () => {
        isStrokingRef.current = false;
        strokeRef.current = null;
        setLiveInkD('');
        setLiveDots([]);
      },
    }),
  ).current;

  const handleUndo = () => {
    if (demoRunningRef.current || strokes.length === 0) return;
    correctionsRef.current += 1;
    setStrokes((prev) => prev.slice(0, -1));
    setSelectedDot(null);
    setLiveDots([]);
    void hapticMiss();
  };

  const handleClear = () => {
    if (demoRunningRef.current || strokes.length === 0) return;
    correctionsRef.current += 1;
    setStrokes([]);
    setSelectedDot(null);
    setLiveDots([]);
    strokeRef.current = null;
    setLiveInkD('');
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
    const applied = { ...next, boardId };
    setProtocol(applied);
    setIsSettingsOpen(false);
    startSession(applied);
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
    if (gameState === 'settings' && onExit) onExit();
  };

  const handleReplay = () => {
    setResultsData(null);
    setGameState('settings');
    setIsSettingsOpen(true);
  };

  const isPlayingPhase = gameState === 'memorize' || gameState === 'play' || gameState === 'feedback';
  const showModel = !protocol.memoryMode || gameState === 'memorize';
  const sideBySide = isTablet && width > height;
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

  const idleDotColor = protocol.dotColor || THERAPY_DOT_COLOR;
  const activeDotColor = protocol.dotActiveColor || THERAPY_DOT_ACTIVE_COLOR;

  const renderPegs = (interactive: boolean, layout: { w: number; h: number }) => {
    const pegSize = Math.max(12, Math.round(Math.min(layout.w || width, layout.h || width) * 0.07));
    return DOT_POSITIONS.map((dot, idx) => {
      const hidden = interactive && !answerDotsVisible[idx];
      const active = idx === selectedDot || touchedDots.has(idx) || liveDots.includes(idx);
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
            borderWidth: 2,
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
  }: {
    svgChildren: ReactNode;
    overlay?: ReactNode;
    interactive: boolean;
    layout: { w: number; h: number };
    onSize: (next: { w: number; h: number }) => void;
  }) => (
    <View
      ref={interactive ? answerViewRef : undefined}
      collapsable={false}
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        if (w !== layout.w || h !== layout.h) onSize({ w, h });
        if (interactive) {
          answerViewRef.current?.measureInWindow((x, y, mw, mh) => {
            answerOriginRef.current = { x, y, w: mw, h: mh };
          });
        }
      }}
      {...(interactive ? pan.panHandlers : {})}
      style={{
        flex: 1,
        alignSelf: 'stretch',
        width: '100%',
        borderRadius: 0,
        borderWidth: 2,
        borderColor: '#0F172A',
        backgroundColor: protocol.bgColor,
        overflow: 'hidden',
      }}
    >
      {layout.w > 0 && layout.h > 0 ? (
        <Svg width={layout.w} height={layout.h} viewBox="0 0 100 100" preserveAspectRatio="none">
          {svgChildren}
        </Svg>
      ) : null}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        {renderPegs(interactive, layout)}
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
      hitSlop={10}
      style={{
        width: SETTINGS_ICON_SIZE,
        height: SETTINGS_ICON_SIZE,
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
            onPress={() => setIsSettingsOpen(true)}
            style={{ backgroundColor: '#0D9488', borderRadius: s(12), paddingHorizontal: s(20), paddingVertical: s(12), marginTop: s(16) }}
          >
            <Text style={{ color: '#fff', fontWeight: '800' }}>Open Settings</Text>
          </Pressable>
        </View>
      ) : null}

      {isPlayingPhase && currentPattern ? (
        <View style={{ flex: 1, flexDirection: sideBySide ? 'row' : 'column' }}>
          <View style={{ flex: 1 }}>
            {boardFrame({
              interactive: false,
              layout: modelLayout,
              onSize: setModelLayout,
              svgChildren: showModel ? renderLines(currentPattern.segments, modelColor, modelStroke) : null,
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
              flexWrap: sideBySide ? 'nowrap' : 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: s(8),
              paddingHorizontal: s(8),
              paddingVertical: s(8),
              minHeight: sideBySide ? undefined : s(52),
              width: sideBySide ? s(80) : undefined,
              backgroundColor: '#0B1220',
            }}
          >
            {gameState === 'play' ? (
              <>
                {actionBtn(
                  <ReplayIcon size={20} color="#64748B" />,
                  isDemoRunning ? 'Replay demo' : 'Play demo',
                  runPatternDemo,
                )}
                {actionBtn(<UndoIcon size={20} color="#64748B" />, 'Undo', handleUndo, isDemoRunning || strokes.length === 0)}
                {actionBtn(<ClearIcon size={20} color="#64748B" />, 'Clear', handleClear, isDemoRunning || strokes.length === 0)}
                {actionBtn(<SkipIcon size={20} color="#64748B" />, 'Skip', () => handleSkip(false))}
                {actionBtn(<CheckIcon size={20} color="#64748B" />, 'Done', handleDone, isDemoRunning)}
              </>
            ) : null}
            <Pressable
              onPress={() => setIsMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Settings menu"
              style={{
                width: SETTINGS_ICON_SIZE,
                height: SETTINGS_ICON_SIZE,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SlidersIcon size={20} color="#64748B" />
            </Pressable>
          </View>

          <View style={{ flex: 1 }}>
            {boardFrame({
              interactive: true,
              layout: drawLayout,
              onSize: setDrawLayout,
              svgChildren: (
                <>
                  {renderLines(drawnSegments, protocol.penColor, inkStroke * 0.55, 0.35)}
                  {strokes.map((stroke, idx) => (
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
                  {liveInkD ? (
                    <Path
                      d={liveInkD}
                      fill="none"
                      stroke={protocol.penColor}
                      strokeWidth={inkStroke}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : null}
                  {demoInkD ? (
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
              ),
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
        onQuit={() => onExit?.()}
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
          { label: 'Matrix', value: `${answerDotsVisible.filter(Boolean).length} dots` },
          { label: 'Transform', value: protocol.transform.replace(/_/g, ' ') },
          { label: 'Memory Mode', value: protocol.memoryMode ? `On · ${protocol.memorizeSec}s` : 'Off' },
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
        patternCount={patternCount}
      />

      {resultsData ? (
        <GameResultsModal isOpen={gameState === 'results'} data={resultsData} onClose={() => onExit?.()} onReplay={handleReplay} />
      ) : null}
    </View>
  );
}
