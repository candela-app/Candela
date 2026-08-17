import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import {
  GEOBOARD_BOARDS,
  GeoboardBoardId,
  GeoboardComplexityTier,
  GeoboardPattern,
  GeoboardProtocol,
  GeoboardSessionResultData,
  GeoboardTrialMetric,
  applyTransformToPattern,
  evaluateDrawing,
  evaluateHalfFieldAccuracy,
  findNearestGeoboardDot,
  getBoardPatterns,
  getContrastAdjustedColor,
  getGeoboardGridDots,
  getGeoboardDotPositions,
  getGeoboardStarRating,
  getPenColorName,
} from '@candela/shared/rn';
import { ClinicalSettingsModal, type AppliedClinicalSettings } from '../components/ClinicalSettingsModal';
import { GameMenuDrawer } from '../components/GameMenuDrawer';
import { GameResultsModal } from '../components/GameResultsModal';
import { hapticCorrect, hapticWrong } from '../lib/haptics';
import { useLayout } from '../lib/layout';
import { colors } from '../lib/theme';

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

function renderLines(segments: Array<[number, number]>, color: string, strokeWidth = 5, opacity = 1) {
  return segments.map(([from, to], idx) => (
    <Line
      key={`${from}-${to}-${idx}`}
      x1={DOT_POSITIONS[from].x}
      y1={DOT_POSITIONS[from].y}
      x2={DOT_POSITIONS[to].x}
      y2={DOT_POSITIONS[to].y}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeOpacity={opacity}
    />
  ));
}

export function GeoboardGame({ boardId = 1, onExit }: { boardId?: GeoboardBoardId; onExit?: () => void }) {
  const board = GEOBOARD_BOARDS[boardId];
  const { fs, s } = useLayout();

  const [gameState, setGameState] = useState<GeoboardGameState>('settings');
  const [protocol, setProtocol] = useState<GeoboardProtocol>({
    patientName: 'Demo Patient',
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
  });

  const [playlist, setPlaylist] = useState<GeoboardPattern[]>([]);
  const [trialIndex, setTrialIndex] = useState(0);
  const [targetSegments, setTargetSegments] = useState<Array<[number, number]>>([]);
  const [answerDotsVisible, setAnswerDotsVisible] = useState<boolean[]>(new Array(DOT_COUNT).fill(true));
  const [strokes, setStrokes] = useState<PenStroke[]>([]);
  const [liveStroke, setLiveStroke] = useState<PenStroke | null>(null);
  const [selectedDot, setSelectedDot] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [memorizeTimeLeft, setMemorizeTimeLeft] = useState(0);
  const [feedback, setFeedback] = useState<TrialFeedback | null>(null);
  const [trials, setTrials] = useState<GeoboardTrialMetric[]>([]);
  const [resultsData, setResultsData] = useState<GeoboardSessionResultData | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [fatigueWarning, setFatigueWarning] = useState(false);
  const [boardLayout, setBoardLayout] = useState({ width: 300, height: 300 });

  const isStrokingRef = useRef(false);
  const strokeRef = useRef<PenStroke | null>(null);
  const sessionStartRef = useRef(0);
  const trialStartRef = useRef(0);
  const firstDotAtRef = useRef<number | null>(null);
  const correctionsRef = useRef(0);
  const tapSequenceRef = useRef<Array<{ dotIndex: number; timestamp: number }>>([]);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSkipRef = useRef<(timedOut: boolean) => void>(() => {});

  const currentPattern = playlist[trialIndex] ?? null;
  const patternCount = playlist.length || getBoardPatterns(boardId, protocol.alphabetVariant).length;

  const drawnSegments = useMemo(() => {
    const allStrokes = liveStroke ? [...strokes, liveStroke] : strokes;
    const seen = new Set<string>();
    const segments: Array<[number, number]> = [];
    for (const stroke of allStrokes) {
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
  }, [strokes, liveStroke]);

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

  const loadTrial = useCallback((index: number, list: GeoboardPattern[], activeProtocol: GeoboardProtocol) => {
    const pattern = list[index];
    if (!pattern) return;
    const transformed = applyTransformToPattern(pattern.segments, activeProtocol.transform, GRID_SIZE, GRID_SIZE);
    setTargetSegments(transformed);
    setAnswerDotsVisible(getGeoboardGridDots(transformed, activeProtocol.matrixTier, GRID_SIZE, GRID_SIZE));
    setStrokes([]);
    setLiveStroke(null);
    setSelectedDot(null);
    setFeedback(null);
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
      trialStartRef.current = Date.now();
      setGameState('play');
    }
  }, []);

  const startSession = useCallback(
    (activeProtocol: GeoboardProtocol) => {
      const list = getBoardPatterns(boardId, activeProtocol.alphabetVariant);
      setPlaylist(list);
      setTrials([]);
      setTrialIndex(0);
      setResultsData(null);
      setFatigueWarning(false);
      sessionStartRef.current = Date.now();
      loadTrial(0, list, activeProtocol);
    },
    [boardId, loadTrial],
  );

  const buildTrialMetric = useCallback(
    (
      pattern: GeoboardPattern,
      drawn: Array<[number, number]>,
      target: Array<[number, number]>,
      outcome: { correct: boolean; errorType: GeoboardTrialMetric['errorType'] },
      timedOut: boolean,
    ): GeoboardTrialMetric => {
      const now = Date.now();
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
      const durationSec = Math.round((Date.now() - sessionStartRef.current) / 1000);
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
        date: new Date().toLocaleDateString('en-GB'),
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
      const sessionElapsedSec = (Date.now() - sessionStartRef.current) / 1000;
      const isLast = trialIndex + 1 >= playlist.length;
      const hitTimeCap = sessionElapsedSec >= SESSION_TIME_CAP_SEC;
      feedbackTimeoutRef.current = setTimeout(() => {
        if (isLast || hitTimeCap) finishSession(history, isLast ? 'completed' : 'incomplete');
        else {
          const nextIndex = trialIndex + 1;
          setTrialIndex(nextIndex);
          loadTrial(nextIndex, playlist, protocol);
        }
      }, FEEDBACK_DURATION_MS);
    },
    [trials, trialIndex, playlist, protocol, checkFatigue, finishSession, loadTrial],
  );

  const handleDone = useCallback(() => {
    if (gameState !== 'play' || !currentPattern) return;
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
      const evaluation = evaluateDrawing(drawnSegments, targetSegments, GRID_SIZE, GRID_SIZE);
      const metric = buildTrialMetric(
        currentPattern,
        drawnSegments,
        targetSegments,
        { correct: false, errorType: evaluation.correct ? 'incomplete' : evaluation.errorType },
        timedOut,
      );
      void hapticWrong();
      commitTrial(metric, timedOut ? 'Time is up for this pattern.' : 'Pattern skipped.');
    },
    [currentPattern, drawnSegments, targetSegments, buildTrialMetric, commitTrial],
  );

  useEffect(() => {
    handleSkipRef.current = handleSkip;
  }, [handleSkip]);

  useEffect(() => {
    if (gameState !== 'memorize') return;
    const timer = setInterval(() => setMemorizeTimeLeft((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [gameState]);

  useEffect(() => {
    if (gameState !== 'memorize' || memorizeTimeLeft > 0) return;
    trialStartRef.current = Date.now();
    setGameState('play');
  }, [gameState, memorizeTimeLeft]);

  useEffect(() => {
    if (gameState !== 'play' || protocol.timeLimitSec <= 0) return;
    const timer = setInterval(() => setTimeLeft((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [gameState, protocol.timeLimitSec, trialIndex]);

  useEffect(() => {
    if (gameState !== 'play' || protocol.timeLimitSec <= 0 || timeLeft > 0) return;
    handleSkipRef.current(true);
  }, [gameState, protocol.timeLimitSec, timeLeft]);

  useEffect(
    () => () => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    },
    [],
  );

  const pointFromTouch = (x: number, y: number) => ({
    x: (x / boardLayout.width) * 100,
    y: (y / boardLayout.height) * 100,
  });

  const captureDot = (dot: number) => {
    const stroke = strokeRef.current;
    if (!stroke || stroke.dots[stroke.dots.length - 1] === dot) return;
    const now = Date.now();
    if (firstDotAtRef.current === null) firstDotAtRef.current = now;
    tapSequenceRef.current = [...tapSequenceRef.current, { dotIndex: dot, timestamp: now }];
    stroke.dots.push(dot);
    if (stroke.dots.length > 1) void hapticCorrect();
    setSelectedDot(dot);
    setLiveStroke({ ...stroke, dots: [...stroke.dots] });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => gameState === 'play',
        onMoveShouldSetPanResponder: () => gameState === 'play',
        onPanResponderGrant: (evt) => {
          if (gameState !== 'play') return;
          const { locationX, locationY } = evt.nativeEvent;
          const point = pointFromTouch(locationX, locationY);
          strokeRef.current = { points: [point], dots: [] };
          isStrokingRef.current = true;
          setLiveStroke(strokeRef.current);
          const dot = findNearestGeoboardDot(point.x, point.y, answerDotsVisible, SNAP_RADIUS_PERCENT, GRID_SIZE, GRID_SIZE);
          if (dot !== null) captureDot(dot);
        },
        onPanResponderMove: (evt) => {
          if (!isStrokingRef.current) return;
          const stroke = strokeRef.current;
          if (!stroke) return;
          const { locationX, locationY } = evt.nativeEvent;
          const point = pointFromTouch(locationX, locationY);
          const last = stroke.points[stroke.points.length - 1];
          if (Math.hypot(point.x - last.x, point.y - last.y) < INK_MIN_SPACING_PERCENT) return;
          stroke.points.push(point);
          setLiveStroke({ points: [...stroke.points], dots: [...stroke.dots] });
          const dot = findNearestGeoboardDot(point.x, point.y, answerDotsVisible, SNAP_RADIUS_PERCENT, GRID_SIZE, GRID_SIZE);
          if (dot !== null) captureDot(dot);
        },
        onPanResponderRelease: () => {
          if (!isStrokingRef.current) return;
          isStrokingRef.current = false;
          const stroke = strokeRef.current;
          strokeRef.current = null;
          setLiveStroke(null);
          if (!stroke) return;
          const travelled = stroke.points.reduce((acc, point, idx) => {
            if (idx === 0) return acc;
            const prev = stroke.points[idx - 1];
            return acc + Math.hypot(point.x - prev.x, point.y - prev.y);
          }, 0);
          if (travelled >= INK_MIN_STROKE_PERCENT) setStrokes((prev) => [...prev, stroke]);
        },
      }),
    [gameState, answerDotsVisible, boardLayout.width, boardLayout.height],
  );

  const handleApplySettings = (applied: AppliedClinicalSettings) => {
    const next: GeoboardProtocol = {
      ...protocol,
      boardId,
      patientName: applied.patientName || protocol.patientName,
      alphabetVariant: applied.alphabetVariant ?? protocol.alphabetVariant,
      bpm: applied.bpm ?? protocol.bpm,
      metronomeEnabled: applied.metronomeEnabled ?? protocol.metronomeEnabled,
      matrixTier: applied.matrixTier ?? protocol.matrixTier,
      memoryMode: applied.memoryMode ?? protocol.memoryMode,
      memorizeSec: applied.memorizeSec ?? protocol.memorizeSec,
      transform: applied.transform ?? protocol.transform,
      ocularity: applied.ocularity ?? protocol.ocularity,
      timeLimitSec: applied.timeLimitSec ?? protocol.timeLimitSec,
      contrastSensitivity: applied.contrastSensitivity ?? protocol.contrastSensitivity,
      bgColor: applied.bgColor || protocol.bgColor,
      shapeColor: applied.shapeColor || protocol.shapeColor,
      penColor: applied.penColor || protocol.penColor,
    };
    setProtocol(next);
    setIsSettingsOpen(false);
    startSession(next);
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
    if (gameState === 'settings' && onExit) onExit();
  };

  const handleUndo = () => {
    if (strokes.length === 0) return;
    correctionsRef.current += 1;
    setStrokes((prev) => prev.slice(0, -1));
    setSelectedDot(null);
  };

  const handleClear = () => {
    if (strokes.length === 0) return;
    correctionsRef.current += 1;
    setStrokes([]);
    setSelectedDot(null);
    strokeRef.current = null;
    setLiveStroke(null);
  };

  const onBoardLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBoardLayout({ width, height });
  };

  const isPlayingPhase = gameState === 'memorize' || gameState === 'play' || gameState === 'feedback';
  const showModel = !protocol.memoryMode || gameState === 'memorize';

  const renderBoard = (interactive: boolean) => (
    <View
      onLayout={onBoardLayout}
      {...(interactive ? panResponder.panHandlers : {})}
      style={{
        aspectRatio: 1,
        backgroundColor: protocol.bgColor,
        borderRadius: s(12),
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        marginBottom: s(12),
      }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute' }}>
        {showModel && currentPattern ? renderLines(currentPattern.segments, modelColor) : null}
        {interactive ? renderLines(drawnSegments, protocol.penColor, 2, 0.3) : null}
        {interactive
          ? [...strokes, ...(liveStroke ? [liveStroke] : [])].map((stroke, idx) => (
              <Path
                key={`stroke-${idx}`}
                d={inkPath(stroke.points)}
                fill="none"
                stroke={protocol.penColor}
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))
          : null}
      </Svg>
      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap' }}>
        {new Array(DOT_COUNT).fill(null).map((_, idx) => {
          const pos = DOT_POSITIONS[idx];
          const visible = interactive ? answerDotsVisible[idx] : true;
          const active = interactive && (idx === selectedDot || touchedDots.has(idx));
          if (!visible) return null;
          return (
            <View
              key={idx}
              style={{
                position: 'absolute',
                left: `${pos.x - 2.5}%`,
                top: `${pos.y - 2.5}%`,
                width: '5%',
                height: '5%',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: s(10),
                  height: s(10),
                  borderRadius: s(5),
                  backgroundColor: active ? protocol.penColor : '#9CA3AF',
                }}
              />
            </View>
          );
        })}
      </View>
      {gameState === 'memorize' && interactive ? (
        <View style={{ ...StyleSheetAbsoluteFill, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: fs(18), fontWeight: '800' }}>Memorize the pattern</Text>
          <Text style={{ fontSize: fs(14), color: colors.muted, marginTop: s(6) }}>Hides in {memorizeTimeLeft}s</Text>
        </View>
      ) : null}
      {gameState === 'feedback' && feedback && interactive ? (
        <View
          style={{
            ...StyleSheetAbsoluteFill,
            backgroundColor: feedback.correct ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: s(16),
          }}
        >
          <Text style={{ fontSize: fs(28), fontWeight: '900', color: feedback.correct ? '#059669' : '#DC2626' }}>
            {feedback.correct ? '✓' : '✕'}
          </Text>
          <Text style={{ fontSize: fs(14), fontWeight: '600', textAlign: 'center', marginTop: s(8) }}>{feedback.message}</Text>
        </View>
      ) : null}
      {!showModel && interactive && gameState === 'play' ? (
        <View style={{ ...StyleSheetAbsoluteFill, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: fs(16), fontWeight: '700' }}>Model hidden — draw from memory</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: s(16),
          paddingVertical: s(12),
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.white,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: fs(18), fontWeight: '800' }}>{board.name}</Text>
          {isPlayingPhase && currentPattern ? (
            <Text style={{ fontSize: fs(12), color: colors.muted }}>
              Pattern {trialIndex + 1} of {playlist.length} · {currentPattern.name}
            </Text>
          ) : (
            <Text style={{ fontSize: fs(12), color: colors.muted }}>{board.focus}</Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: s(8) }}>
          {isPlayingPhase && protocol.timeLimitSec > 0 ? (
            <Text style={{ fontWeight: '800', color: timeLeft <= 10 ? colors.red : colors.ink }}>{timeLeft}s</Text>
          ) : null}
          <Pressable onPress={() => setIsSettingsOpen(true)} style={{ padding: s(8), backgroundColor: '#F3F4F6', borderRadius: s(8) }}>
            <Text style={{ fontWeight: '700', fontSize: fs(12) }}>Settings</Text>
          </Pressable>
          <Pressable onPress={() => setIsMenuOpen(true)} style={{ padding: s(8), backgroundColor: '#F3F4F6', borderRadius: s(8) }}>
            <Text style={{ fontWeight: '700', fontSize: fs(12) }}>Menu</Text>
          </Pressable>
          <Pressable onPress={onExit} style={{ padding: s(8), backgroundColor: '#FEF2F2', borderRadius: s(8) }}>
            <Text style={{ fontWeight: '700', fontSize: fs(12), color: colors.red }}>Exit</Text>
          </Pressable>
        </View>
      </View>

      {gameState === 'settings' && !isSettingsOpen ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: s(24) }}>
          <Text style={{ fontSize: fs(24), fontWeight: '800', marginBottom: s(8) }}>{board.shortLabel}</Text>
          <Text style={{ fontSize: fs(14), color: colors.muted, textAlign: 'center', marginBottom: s(20) }}>
            {board.description} This board runs {patternCount} patterns in order, then opens the session report.
          </Text>
          <Pressable onPress={() => setIsSettingsOpen(true)} style={{ backgroundColor: colors.blue, borderRadius: s(12), paddingHorizontal: s(24), paddingVertical: s(14) }}>
            <Text style={{ color: colors.white, fontWeight: '800' }}>Open Settings</Text>
          </Pressable>
        </View>
      ) : null}

      {isPlayingPhase && currentPattern ? (
        <ScrollView contentContainerStyle={{ padding: s(16), paddingBottom: s(40) }}>
          <View style={{ height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, marginBottom: s(12) }}>
            <View style={{ height: 4, width: `${(trialIndex / Math.max(playlist.length, 1)) * 100}%`, backgroundColor: '#14B8A6', borderRadius: 2 }} />
          </View>
          {fatigueWarning ? (
            <Text style={{ fontSize: fs(12), color: '#B45309', backgroundColor: '#FFFBEB', padding: s(10), borderRadius: s(10), marginBottom: s(12) }}>
              Fatigue signs detected — a short break is fine at any point.
            </Text>
          ) : null}
          <Text style={{ fontSize: fs(13), fontWeight: '700', marginBottom: s(6) }}>Model</Text>
          {renderBoard(false)}
          <Text style={{ fontSize: fs(13), fontWeight: '700', marginBottom: s(6) }}>Your board</Text>
          {renderBoard(true)}
          {gameState === 'play' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8) }}>
              <Pressable onPress={handleUndo} disabled={strokes.length === 0} style={{ flex: 1, minWidth: '45%', backgroundColor: '#F3F4F6', borderRadius: s(10), padding: s(12), opacity: strokes.length === 0 ? 0.5 : 1 }}>
                <Text style={{ textAlign: 'center', fontWeight: '700' }}>Undo Stroke</Text>
              </Pressable>
              <Pressable onPress={handleClear} disabled={strokes.length === 0} style={{ flex: 1, minWidth: '45%', backgroundColor: '#F3F4F6', borderRadius: s(10), padding: s(12), opacity: strokes.length === 0 ? 0.5 : 1 }}>
                <Text style={{ textAlign: 'center', fontWeight: '700' }}>Clear Board</Text>
              </Pressable>
              <Pressable onPress={() => handleSkip(false)} style={{ flex: 1, minWidth: '45%', backgroundColor: '#F3F4F6', borderRadius: s(10), padding: s(12) }}>
                <Text style={{ textAlign: 'center', fontWeight: '700' }}>Skip</Text>
              </Pressable>
              <Pressable onPress={handleDone} style={{ flex: 1, minWidth: '45%', backgroundColor: colors.blue, borderRadius: s(10), padding: s(12) }}>
                <Text style={{ textAlign: 'center', fontWeight: '700', color: colors.white }}>Done</Text>
              </Pressable>
            </View>
          ) : null}
          <Text style={{ fontSize: fs(12), color: colors.muted, marginTop: s(12), textAlign: 'center' }}>
            Draw with your finger or stylus — dots light up as your line runs through them.
          </Text>
        </ScrollView>
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
        ]}
      />

      <ClinicalSettingsModal
        isOpen={isSettingsOpen}
        onClose={handleCloseSettings}
        onApply={handleApplySettings}
        patientName={protocol.patientName}
        letterSize={1}
        bubbleSize={90}
        showGeoboardControls
        geoboardBoardId={boardId}
        geoboardBoardName={board.name}
        geoboardSupportsLetterCase={board.supportsLetterCase}
        geoboardPatternCount={patternCount}
        alphabetVariant={protocol.alphabetVariant}
        bpm={protocol.bpm}
        metronomeEnabled={protocol.metronomeEnabled}
        matrixTier={protocol.matrixTier}
        memoryMode={protocol.memoryMode}
        memorizeSec={protocol.memorizeSec}
        transform={protocol.transform}
        ocularity={protocol.ocularity}
        timeLimitSec={protocol.timeLimitSec}
        contrastSensitivity={protocol.contrastSensitivity}
        bgColor={protocol.bgColor}
        shapeColor={protocol.shapeColor}
        penColor={protocol.penColor}
      />

      {gameState === 'results' && resultsData ? (
        <GameResultsModal
          isOpen
          onClose={() => onExit?.()}
          onReplay={() => {
            setResultsData(null);
            setGameState('settings');
            setIsSettingsOpen(true);
          }}
          data={resultsData}
        />
      ) : null}
    </View>
  );
}

const StyleSheetAbsoluteFill = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};
