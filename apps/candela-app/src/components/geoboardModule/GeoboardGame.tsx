'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  AppliedClinicalSettings,
  GeoboardBoardId,
  GeoboardComplexityTier,
  GeoboardProtocol,
  GeoboardTrialMetric,
  GeoboardSessionResultData,
  GeoboardPattern,
  GEOBOARD_BOARDS,
  getBoardPatterns,
  applyTransformToPattern,
  getGeoboardGridDots,
  getGeoboardDotPositions,
  findNearestGeoboardDot,
  evaluateDrawing,
  evaluateBeginnerPractice,
  evaluateHalfFieldAccuracy,
  getGeoboardStarRating,
  getContrastAdjustedColor,
  getPenColorName,
  isBeginnerLineBoard,
  lockBeginnerGeoboardProtocol,
  patternShowsModel,
  patternStartsWithMemorize,
  ClinicalSettingsModal,
  playCorrectSoundAndHaptic,
  playWrongSoundAndHaptic,
  playSuccessSoundAndHaptic,
  playMissPressSoundAndHaptic,
  getDeviceTier,
} from '@candela/shared';
import { GameMenuDrawer } from '../shared/GameMenuDrawer';
import { GameResultsModal } from '../shared/GameResultsModal';
import { ArrowLeftIcon, ArrowRightIcon, SlidersIcon } from '../icons/VectorIcons';
import styles from './GeoboardGame.module.css';

// TODO: device-config — grid dimensions become part of the device profile later.
const GRID_SIZE = 5;
const DOT_COUNT = GRID_SIZE * GRID_SIZE;
const DOT_POSITIONS = getGeoboardDotPositions(GRID_SIZE, GRID_SIZE);

const SNAP_RADIUS_PERCENT = 9;
const FEEDBACK_DURATION_MS = 1300;
const SESSION_TIME_CAP_SEC = 600;

// Ink is sampled rather than recorded at full pointer rate: below this spacing
// (in board percent) a move adds nothing visible but does cost a path rebuild.
const INK_MIN_SPACING_PERCENT = 0.6;
// A press that never travels this far is treated as a stray touch, not a stroke.
const INK_MIN_STROKE_PERCENT = 1.5;

// Default palette: a white board with a black model is the maximum-contrast
// pairing and matches the printed geoboard the patient already knows, with an
// amber pen so the patient's own work reads as separate from the target.
const THERAPY_BG_COLOR = '#FFFFFF';
const THERAPY_MODEL_COLOR = '#000000';
const THERAPY_PEN_COLOR = '#FBBF24';

type GeoboardGameState = 'settings' | 'memorize' | 'play' | 'feedback' | 'results';

interface InkPoint {
  x: number;
  y: number;
}

/**
 * One pen-down to pen-up gesture: the raw ink the patient produced, plus the
 * dots that ink ran through. The ink is what gets displayed; the dot list is
 * what gets scored.
 */
interface PenStroke {
  points: InkPoint[];
  dots: number[];
}

/** Quadratic smoothing through point midpoints, so finger jitter reads as ink. */
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

interface TrialFeedback {
  correct: boolean;
  message: string;
}

interface GeoboardGameProps {
  boardId?: GeoboardBoardId;
  onExit?: () => void;
}

export function GeoboardGame({ boardId = 1, onExit }: GeoboardGameProps) {
  const board = GEOBOARD_BOARDS[boardId];

  const [gameState, setGameState] = useState<GeoboardGameState>('settings');

  const [protocol, setProtocol] = useState<GeoboardProtocol>(() =>
    lockBeginnerGeoboardProtocol(
      {
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
        pegSizeScale: 1,
      },
      boardId,
    ),
  );

  // Fixed playlist for the chosen board, resolved when the session starts.
  const [playlist, setPlaylist] = useState<GeoboardPattern[]>([]);
  const [trialIndex, setTrialIndex] = useState<number>(0);

  const [targetSegments, setTargetSegments] = useState<Array<[number, number]>>([]);
  const [answerDotsVisible, setAnswerDotsVisible] = useState<boolean[]>(new Array(DOT_COUNT).fill(true));
  const [strokes, setStrokes] = useState<PenStroke[]>([]);
  const [selectedDot, setSelectedDot] = useState<number | null>(null);

  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [memorizeTimeLeft, setMemorizeTimeLeft] = useState<number>(0);
  const [feedback, setFeedback] = useState<TrialFeedback | null>(null);

  const [trials, setTrials] = useState<GeoboardTrialMetric[]>([]);
  const [resultsData, setResultsData] = useState<GeoboardSessionResultData | null>(null);

  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [uiHighContrast, setUiHighContrast] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(true);
  const [isAssistiveOpen, setIsAssistiveOpen] = useState<boolean>(false);
  const [fatigueWarning, setFatigueWarning] = useState<boolean>(false);

  // Drawing interaction refs — kept out of state so pointer moves stay cheap.
  // The live stroke is drawn by writing straight to the SVG path element, which
  // keeps a 60Hz pen from re-rendering the whole board on every sample.
  const isStrokingRef = useRef<boolean>(false);
  const strokeRef = useRef<PenStroke | null>(null);
  const livePathRef = useRef<SVGPathElement | null>(null);
  const sessionStartRef = useRef<number>(0);
  const trialStartRef = useRef<number>(0);
  const firstDotAtRef = useRef<number | null>(null);
  const correctionsRef = useRef<number>(0);
  const tapSequenceRef = useRef<Array<{ dotIndex: number; timestamp: number }>>([]);
  const metronomeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layoutRef = useRef<HTMLDivElement>(null);

  const currentPattern = playlist[trialIndex] ?? null;
  const patternCount = playlist.length || getBoardPatterns(boardId, protocol.alphabetVariant).length;

  // Scoring still works on dot pairs; they are now a read-out of where the ink
  // travelled rather than something the patient produces by tapping.
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
    [protocol.shapeColor, protocol.bgColor, protocol.contrastSensitivity]
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(getDeviceTier() === 'mobile');
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    return () => {
      if (metronomeIntervalRef.current) clearInterval(metronomeIntervalRef.current);
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  // --- Metronome ---------------------------------------------------------

  const playMetronomeTick = useCallback(() => {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    try {
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1000, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch {
      // Audio is a comfort cue, never a hard failure.
    }
  }, []);

  useEffect(() => {
    if (gameState === 'play' && protocol.metronomeEnabled) {
      metronomeIntervalRef.current = setInterval(playMetronomeTick, 60000 / protocol.bpm);
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
  }, [gameState, protocol.metronomeEnabled, protocol.bpm, playMetronomeTick]);

  // --- Trial lifecycle ---------------------------------------------------

  const loadTrial = useCallback(
    (index: number, list: GeoboardPattern[], activeProtocol: GeoboardProtocol) => {
      const pattern = list[index];
      if (!pattern) return;

      const transformed = applyTransformToPattern(pattern.segments, activeProtocol.transform, GRID_SIZE, GRID_SIZE);
      setTargetSegments(transformed);
      setAnswerDotsVisible(getGeoboardGridDots(transformed, activeProtocol.matrixTier, GRID_SIZE, GRID_SIZE));

      setStrokes([]);
      setSelectedDot(null);
      setFeedback(null);
      strokeRef.current = null;
      isStrokingRef.current = false;
      if (livePathRef.current) livePathRef.current.setAttribute('d', '');
      firstDotAtRef.current = null;
      correctionsRef.current = 0;
      tapSequenceRef.current = [];

      setTimeLeft(activeProtocol.timeLimitSec);

      if (patternStartsWithMemorize(pattern, activeProtocol.memoryMode)) {
        setMemorizeTimeLeft(activeProtocol.memorizeSec);
        setGameState('memorize');
      } else {
        trialStartRef.current = performance.now();
        setGameState('play');
      }
    },
    []
  );

  const startSession = useCallback(
    (activeProtocol: GeoboardProtocol) => {
      const locked = lockBeginnerGeoboardProtocol({ ...activeProtocol, boardId }, boardId);
      const list = getBoardPatterns(boardId, locked.alphabetVariant);
      setProtocol(locked);
      setPlaylist(list);
      setTrials([]);
      setTrialIndex(0);
      setResultsData(null);
      setFatigueWarning(false);
      sessionStartRef.current = performance.now();
      loadTrial(0, list, locked);
    },
    [boardId, loadTrial]
  );

  // Memorize countdown
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

  // In stacked portrait layouts the model sits above the fold, so each new pattern
  // returns the view to the top rather than leaving the patient parked on the
  // answer board with the reference off screen.
  useEffect(() => {
    const el = layoutRef.current;
    if (!el || (gameState !== 'memorize' && gameState !== 'play')) return;
    if (el.scrollTop === 0) return;
    el.scrollTo({ top: 0, behavior: 'smooth' });
  }, [trialIndex, gameState]);

  // --- Scoring -----------------------------------------------------------

  const buildTrialMetric = useCallback(
    (
      pattern: GeoboardPattern,
      drawn: Array<[number, number]>,
      target: Array<[number, number]>,
      outcome: { correct: boolean; errorType: GeoboardTrialMetric['errorType'] },
      timedOut: boolean
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
    [trialIndex, protocol.matrixTier, protocol.transform]
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
        { leftMatched: 0, leftTotal: 0, rightMatched: 0, rightTotal: 0 }
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
          1 as GeoboardComplexityTier
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

      // TODO: persist once DB is configured — the summary above is the record a
      // session row would store, pen colour included.
      playSuccessSoundAndHaptic();
      setResultsData(summary);
      setGameState('results');
    },
    [board, boardId, protocol]
  );

  const checkFatigue = useCallback((history: GeoboardTrialMetric[]) => {
    if (history.length < 6) return;
    const first3 = history.slice(0, 3);
    const last3 = history.slice(-3);
    const avgRTFirst = first3.reduce((acc, t) => acc + t.reactionTimeMs, 0) / 3;
    const avgRTLast = last3.reduce((acc, t) => acc + t.reactionTimeMs, 0) / 3;
    const recentAccuracy = history.slice(-4).filter((t) => t.correct).length / 4;

    if (avgRTLast > 1.8 * avgRTFirst || recentAccuracy < 0.4) {
      setFatigueWarning(true);
    }
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
    [trials, trialIndex, playlist, protocol, checkFatigue, finishSession, loadTrial]
  );

  const handleDone = useCallback(() => {
    if (gameState !== 'play' || !currentPattern) return;

    const evaluation =
      currentPattern.task === 'copy'
        ? evaluateBeginnerPractice(drawnSegments, targetSegments, GRID_SIZE, GRID_SIZE)
        : evaluateDrawing(drawnSegments, targetSegments, GRID_SIZE, GRID_SIZE);
    const metric = buildTrialMetric(currentPattern, drawnSegments, targetSegments, evaluation, false);

    let message = 'Nice work — that matches.';
    if (!evaluation.correct) {
      if (currentPattern.task === 'copy') {
        message =
          evaluation.errorType === 'wrong-shape'
            ? 'Draw a standing or steep line like the one already on the board.'
            : 'Draw that line on other dots on this board.';
      } else if (evaluation.errorType === 'wrong-dot') message = 'A line reached a dot that is not part of the shape.';
      else if (evaluation.errorType === 'incomplete') message = 'Some lines of the shape are still missing.';
      else message = 'The lines form a different shape.';
    }

    if (evaluation.correct) playSuccessSoundAndHaptic();
    else playWrongSoundAndHaptic();

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
        timedOut
      );
      playMissPressSoundAndHaptic();
      commitTrial(metric, timedOut ? 'Time is up for this pattern.' : 'Pattern skipped.');
    },
    [currentPattern, drawnSegments, targetSegments, buildTrialMetric, commitTrial]
  );

  // Per-pattern countdown. The tick and the expiry reaction are separate effects so
  // that drawing a line (which rebuilds handleSkip) cannot silently restart the clock.
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

  // --- Freehand pen drawing ----------------------------------------------
  // The pen lays down ink wherever the finger or stylus goes. A connection is
  // recorded when that ink runs through a dot, so lines are never drawn for the
  // patient — they are read back out of what the patient actually drew.

  const pointFromEvent = (e: React.PointerEvent<HTMLDivElement>): InkPoint => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  };

  const renderLiveInk = () => {
    if (livePathRef.current) {
      livePathRef.current.setAttribute('d', strokeRef.current ? inkPath(strokeRef.current.points) : '');
    }
  };

  /** Records a dot the ink just ran through, keeping the planning-time metrics. */
  const captureDot = (dot: number) => {
    const stroke = strokeRef.current;
    if (!stroke) return;
    if (stroke.dots[stroke.dots.length - 1] === dot) return;

    const now = performance.now();
    if (firstDotAtRef.current === null) firstDotAtRef.current = now;
    tapSequenceRef.current = [...tapSequenceRef.current, { dotIndex: dot, timestamp: now }];

    stroke.dots.push(dot);
    if (stroke.dots.length > 1) playCorrectSoundAndHaptic();
    setSelectedDot(dot);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (gameState !== 'play') return;

    e.currentTarget.setPointerCapture(e.pointerId);

    const point = pointFromEvent(e);
    strokeRef.current = { points: [point], dots: [] };
    isStrokingRef.current = true;

    const dot = findNearestGeoboardDot(point.x, point.y, answerDotsVisible, SNAP_RADIUS_PERCENT, GRID_SIZE, GRID_SIZE);
    if (dot !== null) captureDot(dot);

    renderLiveInk();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (gameState !== 'play' || !isStrokingRef.current) return;

    const stroke = strokeRef.current;
    if (!stroke) return;

    const point = pointFromEvent(e);
    const last = stroke.points[stroke.points.length - 1];
    if (Math.hypot(point.x - last.x, point.y - last.y) < INK_MIN_SPACING_PERCENT) return;

    stroke.points.push(point);
    renderLiveInk();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isStrokingRef.current) return;
    isStrokingRef.current = false;

    const stroke = strokeRef.current;
    if (stroke) {
      const point = pointFromEvent(e);
      stroke.points.push(point);
      const endDot = findNearestGeoboardDot(point.x, point.y, answerDotsVisible, SNAP_RADIUS_PERCENT * 1.35, GRID_SIZE, GRID_SIZE);
      if (endDot !== null) captureDot(endDot);
    }
    strokeRef.current = null;
    renderLiveInk();

    if (!stroke) return;

    const travelled = stroke.points.reduce((acc, point, idx) => {
      if (idx === 0) return acc;
      const prev = stroke.points[idx - 1];
      return acc + Math.hypot(point.x - prev.x, point.y - prev.y);
    }, 0);

    if (travelled < INK_MIN_STROKE_PERCENT || stroke.dots.length < 2) return;

    setStrokes((prev) => [...prev, stroke]);
  };

  const handleUndo = () => {
    if (strokes.length === 0) return;
    correctionsRef.current += 1;
    setStrokes((prev) => prev.slice(0, -1));
    setSelectedDot(null);
    playMissPressSoundAndHaptic();
  };

  const handleClear = () => {
    if (strokes.length === 0) return;
    correctionsRef.current += 1;
    setStrokes([]);
    setSelectedDot(null);
    strokeRef.current = null;
    renderLiveInk();
    playMissPressSoundAndHaptic();
  };

  // --- Settings ----------------------------------------------------------

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
      pegSizeScale: applied.pegSizeScale ?? protocol.pegSizeScale ?? 1,
    };

    const locked = lockBeginnerGeoboardProtocol(next, boardId);
    setProtocol(locked);
    setIsSettingsOpen(false);
    startSession(locked);
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
    // Settings gate the board, so backing out returns to the board picker.
    if (gameState === 'settings' && onExit) onExit();
  };

  const handleReplay = () => {
    setResultsData(null);
    setGameState('settings');
    setIsSettingsOpen(true);
  };

  // --- Rendering helpers -------------------------------------------------

  // Coordinates are board percentages, so every canvas uses a 0-100 viewBox and
  // a non-scaling stroke to keep line weights in device pixels.
  const renderLines = (
    segments: Array<[number, number]>,
    color: string,
    strokeWidth: number = 5,
    opacity: number = 1
  ) =>
    segments.map(([s, e], idx) => (
      <line
        key={`${s}-${e}-${idx}`}
        x1={DOT_POSITIONS[s].x}
        y1={DOT_POSITIONS[s].y}
        x2={DOT_POSITIONS[e].x}
        y2={DOT_POSITIONS[e].y}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeOpacity={opacity}
        vectorEffect="non-scaling-stroke"
      />
    ));

  const isPlayingPhase = gameState === 'memorize' || gameState === 'play' || gameState === 'feedback';
  const showModel = patternShowsModel(currentPattern, protocol.memoryMode, gameState);
  const practiceOnReference = currentPattern?.task === 'copy';
  const modelInteractive = practiceOnReference && gameState === 'play';
  const drawInteractive = !practiceOnReference && gameState === 'play';
  const beginnerBoard = isBeginnerLineBoard(boardId);

  const transformLabel = protocol.transform.replace(/_/g, ' ');

  const drawingHint = practiceOnReference
    ? 'Practice the same standing or steep line on other pegs on the reference board.'
    : isMobile
      ? 'Draw from peg to peg with your finger or stylus.'
      : 'Press and draw from one peg to another.';

  const drawingPointerProps = {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerUp,
    style: { backgroundColor: protocol.bgColor, touchAction: 'none' as const },
  };

  const inkSvg = (
    <g>
      {renderLines(drawnSegments, protocol.penColor, 2, 0.3)}
      {strokes.map((stroke, idx) => (
        <path
          key={`stroke-${idx}`}
          d={inkPath(stroke.points)}
          fill="none"
          stroke={protocol.penColor}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <path
        ref={livePathRef}
        fill="none"
        stroke={protocol.penColor}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );

  const openFromDock = (action: () => void) => () => {
    setIsAssistiveOpen(false);
    action();
  };

  return (
    <div
      ref={layoutRef}
      className={`${styles.mainLayout} ${uiHighContrast ? styles.highContrast : ''} ${isPlayingPhase ? styles.playClean : ''}`}
    >
      <header className={styles.header}>
        <div>
          <h2 className={styles.headerTitle}>{board.shortLabel}</h2>
          {isPlayingPhase && currentPattern ? (
            <p className={styles.headerSub}>
              Pattern {trialIndex + 1} of {playlist.length} · {currentPattern.name}
              {protocol.transform !== 'duplicate' && ` · ${transformLabel}`}
            </p>
          ) : (
            <p className={styles.headerSub}>{board.focus}</p>
          )}
        </div>
        <div className={styles.headerControls}>
          {isPlayingPhase && protocol.timeLimitSec > 0 && (
            <span className={`${styles.headerTimer} ${timeLeft <= 10 ? styles.headerTimerLow : ''}`}>
              {timeLeft}s
            </span>
          )}
          <button
            onClick={() => setUiHighContrast(!uiHighContrast)}
            className={`${styles.iconBtn} ${uiHighContrast ? styles.iconBtnActive : ''}`}
            title="Toggle accessibility high contrast"
          >
            A
          </button>
          <button onClick={() => setIsSettingsOpen(true)} className={styles.iconBtn} title="Clinician protocol settings">
            <SlidersIcon className="w-5 h-5" />
          </button>
          <button onClick={() => setIsMenuOpen(true)} className={styles.iconBtn} title="Session menu">
            Menu
          </button>
          <button onClick={onExit} className={`${styles.iconBtn} ${styles.exitBtn}`} title="Exit session">
            Exit
          </button>
        </div>
      </header>

      {gameState === 'settings' && !isSettingsOpen && (
        <div className={styles.setupContainer}>
          <h1 className={styles.setupTitle}>{board.shortLabel}</h1>
          <p className={styles.setupSub}>
            {board.description} This board runs {patternCount} patterns in order, then opens the session report.
          </p>
          <button onClick={() => setIsSettingsOpen(true)} className={styles.startBtn}>
            Open Settings
          </button>
        </div>
      )}

      {isPlayingPhase && currentPattern && (
        <main className={styles.gameplayContainer}>
          {/* The progress bar carries the session position on its own; the
              pattern name, transform and clock live in the header on wide
              screens and in the control dock everywhere else. */}
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${(trialIndex / Math.max(playlist.length, 1)) * 100}%` }}
            />
          </div>

          {fatigueWarning && (
            <div className={styles.fatigueBanner}>
              Fatigue signs detected — reaction times are climbing. A short break is fine at any point.
            </div>
          )}

          <div
            className={styles.gridsContainer}
            style={{ '--peg-scale': String(protocol.pegSizeScale ?? 1) } as React.CSSProperties}
          >
            {/* MODEL GRID
                Unlabelled to keep the height for the boards themselves — the
                model is the non-interactive one, and memory mode announces
                itself through its own overlay. */}
            <div className={`${styles.gridColumn} ${styles.snapBoard}`}>
              <div
                className={styles.gridWrapper}
                role={modelInteractive ? 'group' : 'img'}
                aria-label={
                  modelInteractive
                    ? 'Reference board — practice the line on other pegs'
                    : showModel
                      ? `Model pattern: ${currentPattern.name}`
                      : 'Model hidden — draw from memory'
                }
                {...(modelInteractive ? drawingPointerProps : { style: { backgroundColor: protocol.bgColor } })}
              >
                {showModel ? (
                  <>
                    <svg className={styles.canvasLayer} viewBox="0 0 100 100" preserveAspectRatio="none">
                      {renderLines(currentPattern.segments, modelColor)}
                      {practiceOnReference ? inkSvg : null}
                    </svg>
                    <div className={styles.pegsOverlay}>
                      {new Array(DOT_COUNT).fill(null).map((_, idx) => (
                        <div key={`model-cell-${idx}`} className={styles.pegCell}>
                          <div
                            className={`${styles.peg} ${
                              modelInteractive && (idx === selectedDot || touchedDots.has(idx)) ? styles.pegActive : ''
                            } ${modelInteractive ? '' : styles.pegStatic}`}
                          />
                        </div>
                      ))}
                    </div>
                    <div className={styles.trialBadge} aria-hidden>
                      {trialIndex + 1}/{playlist.length}
                      {protocol.timeLimitSec > 0 ? `  ·  ${timeLeft}s` : ''}
                    </div>
                  </>
                ) : (
                  <div className={styles.hiddenModelOverlay}>
                    <span className={styles.hiddenModelIcon}>◍</span>
                    <span>{gameState === 'memorize' ? `Memorize · ${memorizeTimeLeft}s` : 'Model hidden — draw from memory'}</span>
                  </div>
                )}

                {gameState === 'memorize' && (
                  <div className={styles.memoryFlashOverlay}>
                    <div className={styles.flashIcon}>◉</div>
                    <h3 className={styles.memoryTitle}>Memorize the pattern</h3>
                    <p className={styles.memorySub}>
                      Hides in <strong>{memorizeTimeLeft}s</strong>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Pull-tab lives in the gap between the two boards, on the right.
                The panel itself is position:fixed so opening it never shoves
                the answer board down. */}
            <div className={styles.assistiveDock}>
              {isAssistiveOpen && (
                <div className={styles.assistivePanel} role="dialog" aria-label="Session controls">
                  <div className={styles.assistivePanelHeader}>
                    <span>{board.shortLabel}</span>
                    <button
                      type="button"
                      onClick={() => setIsAssistiveOpen(false)}
                      className={styles.assistiveClose}
                      aria-label="Close controls"
                    >
                      ✕
                    </button>
                  </div>

                  {isPlayingPhase && currentPattern && (
                    <div className={styles.assistiveMeta}>
                      <span className={styles.assistiveMetaRow}>
                        <span>Pattern</span>
                        <strong>
                          {trialIndex + 1} of {playlist.length}
                        </strong>
                      </span>
                      <span className={styles.assistiveMetaRow}>
                        <span>Now drawing</span>
                        <strong>{currentPattern.name}</strong>
                      </span>
                      <span className={styles.assistiveMetaRow}>
                        <span>Grid dots</span>
                        <strong>
                          {answerDotsVisible.filter(Boolean).length} / {DOT_COUNT}
                        </strong>
                      </span>
                      {protocol.transform !== 'duplicate' && (
                        <span className={styles.assistiveMetaRow}>
                          <span>Transform</span>
                          <strong>{transformLabel}</strong>
                        </span>
                      )}
                      {protocol.timeLimitSec > 0 && (
                        <span className={styles.assistiveMetaRow}>
                          <span>Time left</span>
                          <strong>{timeLeft}s</strong>
                        </span>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setUiHighContrast(!uiHighContrast)}
                    className={`${styles.assistiveItem} ${uiHighContrast ? styles.assistiveItemOn : ''}`}
                    aria-pressed={uiHighContrast}
                  >
                    <span>High Contrast</span>
                    <span className={styles.assistiveState}>{uiHighContrast ? 'On' : 'Off'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={openFromDock(() => setIsSettingsOpen(true))}
                    className={styles.assistiveItem}
                  >
                    <span className={styles.assistiveItemLabel}>
                      <SlidersIcon className="w-4 h-4" />
                      Clinical Settings
                    </span>
                  </button>

                  <button type="button" onClick={openFromDock(() => setIsMenuOpen(true))} className={styles.assistiveItem}>
                    <span>Session Menu</span>
                  </button>

                  <button
                    type="button"
                    onClick={openFromDock(() => onExit?.())}
                    className={`${styles.assistiveItem} ${styles.assistiveItemExit}`}
                  >
                    <span>Exit Session</span>
                  </button>

                  {isPlayingPhase && <p className={styles.assistiveHint}>{drawingHint}</p>}
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsAssistiveOpen((prev) => !prev)}
                className={`${styles.assistiveHandle} ${isAssistiveOpen ? styles.assistiveHandleOpen : ''}`}
                aria-expanded={isAssistiveOpen}
                aria-label={isAssistiveOpen ? 'Hide session controls' : 'Show session controls'}
                title={isAssistiveOpen ? 'Hide controls' : 'Pull for controls'}
              >
                {isAssistiveOpen ? (
                  <ArrowRightIcon className="w-5 h-5" />
                ) : (
                  <ArrowLeftIcon className="w-5 h-5" />
                )}

                {isPlayingPhase && protocol.timeLimitSec > 0 && (
                  <span className={`${styles.orbTimer} ${timeLeft <= 10 ? styles.orbTimerLow : ''}`}>
                    {timeLeft}
                  </span>
                )}
              </button>
            </div>

            {/* ANSWER GRID */}
            <div className={`${styles.gridColumn} ${styles.snapBoard} ${styles.snapAnswer}`}>
              <div
                className={styles.gridWrapper}
                role="group"
                aria-label={
                  drawInteractive
                    ? 'Your board — draw the pattern here'
                    : practiceOnReference
                      ? 'Drawing board — used after practice'
                      : 'Your board'
                }
                {...(drawInteractive ? drawingPointerProps : { style: { backgroundColor: protocol.bgColor } })}
              >
                <svg className={styles.canvasLayer} viewBox="0 0 100 100" preserveAspectRatio="none">
                  {practiceOnReference ? null : inkSvg}
                </svg>

                <div className={styles.pegsOverlay}>
                  {new Array(DOT_COUNT).fill(null).map((_, idx) => (
                    <div key={`answer-cell-${idx}`} className={styles.pegCell}>
                      <div
                        className={`${styles.peg} ${
                          idx === selectedDot || touchedDots.has(idx) ? styles.pegActive : ''
                        } ${!answerDotsVisible[idx] ? styles.pegHidden : ''}`}
                      />
                    </div>
                  ))}
                </div>

                {gameState === 'feedback' && feedback && (
                  <div className={`${styles.feedbackOverlay} ${feedback.correct ? styles.feedbackOk : styles.feedbackBad}`}>
                    <div className={styles.feedbackIcon}>{feedback.correct ? '✓' : '✕'}</div>
                    <p className={styles.feedbackText}>{feedback.message}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {gameState === 'play' && (
            <div className={styles.actionRow}>
              <button onClick={handleUndo} className={`${styles.btn} ${styles.btnUndo}`} disabled={strokes.length === 0}>
                Undo Stroke
              </button>
              <button onClick={handleClear} className={`${styles.btn} ${styles.btnClear}`} disabled={strokes.length === 0}>
                Clear Board
              </button>
              <button onClick={() => handleSkip(false)} className={`${styles.btn} ${styles.btnClear}`}>
                Skip
              </button>
              <button onClick={handleDone} className={`${styles.btn} ${styles.btnSubmit}`}>
                Done
              </button>
            </div>
          )}

          <p className={styles.hintText}>{drawingHint}</p>
        </main>
      )}

      <GameMenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onQuit={() => {
          if (onExit) onExit();
        }}
        onReset={() => {
          setIsMenuOpen(false);
          startSession(protocol);
        }}
        onOpenSettings={() => {
          setIsMenuOpen(false);
          setIsSettingsOpen(true);
        }}
        resetButtonLabel="Restart Board"
        sessionInProgress={isPlayingPhase}
        settingsSummary={[
          { label: 'Patient', value: protocol.patientName },
          { label: 'Board', value: board.shortLabel },
          ...(board.supportsLetterCase
            ? [{ label: 'Letter Case', value: protocol.alphabetVariant === 'lowercase' ? 'Lowercase' : 'Uppercase' }]
            : []),
          ...(beginnerBoard
            ? [{ label: 'Rules', value: 'Practice on the reference, then draw on your own' }]
            : [
                { label: 'Matrix', value: `${answerDotsVisible.filter(Boolean).length} dots` },
                { label: 'Transform', value: protocol.transform.replace(/_/g, ' ') },
                { label: 'Memory Mode', value: protocol.memoryMode ? `On · ${protocol.memorizeSec}s` : 'Off' },
              ]),
          { label: 'Time Limit', value: protocol.timeLimitSec > 0 ? `${protocol.timeLimitSec}s` : 'Off' },
          { label: 'Ocularity', value: protocol.ocularity === 'Both' ? 'Binocular' : `${protocol.ocularity} eye` },
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
        geoboardBoardName={board.shortLabel}
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
        pegSizeScale={protocol.pegSizeScale ?? 1}
      />

      {gameState === 'results' && resultsData && (
        <GameResultsModal
          isOpen
          onClose={() => {
            if (onExit) onExit();
          }}
          onReplay={handleReplay}
          data={resultsData}
        />
      )}
    </div>
  );
}
