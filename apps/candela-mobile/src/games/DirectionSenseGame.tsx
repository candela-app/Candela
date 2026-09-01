import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Polygon, Polyline } from 'react-native-svg';
import {
  DEFAULT_DIRECTION_SENSE_ARROW_COLOR,
  DEFAULT_DIRECTION_SENSE_BG,
  DEFAULT_DIRECTION_SENSE_CHOICE_COUNT,
  DEFAULT_DIRECTION_SENSE_SHAPE_COLOR,
  DEFAULT_DIRECTION_SENSE_SHAPE_SIZE,
  DEFAULT_DIRECTION_SENSE_TRIALS,
  DEFAULT_DIRECTION_SENSE_TURN_DIRECTION,
  DIRECTION_SENSE_ARROW_STROKE_WIDTH,
  DIRECTION_SENSE_SHAPE_PATHS,
  DIRECTION_SENSE_SHAPE_STROKE_WIDTH,
  buildDirectionSenseStraightenTrial,
  buildDirectionSenseTrial,
  clampDirectionSenseChoiceCount,
  clampDirectionSenseShapeSize,
  clampDirectionSenseTimeLimitSec,
  clampDirectionSenseTrials,
  clampDirectionSenseTurnDirection,
  directionSenseAccuracy,
  directionSenseArrowTransform,
  directionSenseCurvedArrowPath,
  directionSenseDeltaDeg,
  directionSenseDeviceDefaults,
  directionSenseLevelIsStraighten,
  directionSenseLevelLabel,
  directionSenseModeFromLevelId,
  directionSensePoseTransform,
  directionSenseTurnDirectionLabel,
  getDeviceTier,
  isDirectionSenseUpright,
  pointerAngleDeg,
  reactionStatsFromMs,
  DIRECTION_SENSE_TRAIL_HOLD_MS,
  directionSenseTrailArrowPoints,
  directionSenseRotateGlyphSize,
  directionSenseRotatePadSize,
  resetDirectionSenseMoveCue,
  directionSenseTrailPolyline,
  takeDirectionSenseMoveCue,
  shouldAppendTrailPoint,
  type DirectionSenseOption,
  type DirectionSensePose,
  type DirectionSenseSessionResultData,
  type DirectionSenseTrailPoint,
  type DirectionSenseTrial,
  type DirectionSenseTurnDirection,
  useHowToPlayGate,
  usePauseShiftedClock,
} from '@candela/shared/rn';
import { ClickToStartOverlay } from '../components/ClickToStartOverlay';
import { HowToPlayManual } from '../components/HowToPlayManual';
import { ClinicalSettingsModal, type AppliedClinicalSettings } from '../components/ClinicalSettingsModal';
import { GameMenuDrawer } from '../components/GameMenuDrawer';
import { GameResultsModal } from '../components/GameResultsModal';
import { SlidersIcon } from '../components/icons';
import { sessionDisplayName, useAuth } from '../lib/auth-context';
import { hapticCorrect, hapticMove, hapticWrong } from '../lib/haptics';
import { preloadMoveWhoosh } from '../lib/sfx';
import { useLayout } from '../lib/layout';
import { useGameSessionLock } from '../lib/use-game-session-lock';

function ShapeGlyph({
  shapeId,
  pose,
  rotationDeg,
  color,
  size,
}: {
  shapeId: DirectionSenseTrial['shapeId'];
  pose?: DirectionSensePose;
  rotationDeg?: number;
  color: string;
  size: number;
}) {
  const transform =
    rotationDeg != null
      ? `rotate(${rotationDeg} 50 50)`
      : directionSensePoseTransform(pose ?? { orientation: 0, flipH: false });
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path
        d={DIRECTION_SENSE_SHAPE_PATHS[shapeId]}
        fill="none"
        stroke={color}
        strokeWidth={DIRECTION_SENSE_SHAPE_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={transform}
      />
    </Svg>
  );
}

export function DirectionSenseGame({
  onExit,
  levelId = 'face',
}: {
  onExit?: () => void;
  levelId?: string;
}) {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const { width, height, s, fs } = useLayout();
  const defaults = useMemo(() => directionSenseDeviceDefaults(), []);
  const deviceTier = useMemo(() => getDeviceTier(width), [width]);
  const isStraighten = directionSenseLevelIsStraighten(levelId);
  const lockedMode = directionSenseModeFromLevelId(levelId);
  const levelTitle = directionSenseLevelLabel(levelId);
  const { requestExit } = useGameSessionLock(onExit);

  const [gameStarted, setGameStarted] = useState(false);
  const { showHowToPlay, howToPlayMode, isSettingsOpen, setIsSettingsOpen, finishHowToPlay, openHowToPlay, closeHowToPlay, playBlocked, isMenuOpen, setIsMenuOpen } = useHowToPlayGate();
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [resultsData, setResultsData] = useState<DirectionSenseSessionResultData | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const [patientName, setPatientName] = useState(() => sessionDisplayName(session));
  const [choiceCount, setChoiceCount] = useState(defaults.choiceCount || DEFAULT_DIRECTION_SENSE_CHOICE_COUNT);
  const [trialsConfigured, setTrialsConfigured] = useState(defaults.trials || DEFAULT_DIRECTION_SENSE_TRIALS);
  const [shapeSizePx, setShapeSizePx] = useState(defaults.shapeSizePx || DEFAULT_DIRECTION_SENSE_SHAPE_SIZE);
  const [turnDirection, setTurnDirection] = useState<DirectionSenseTurnDirection>(
    defaults.turnDirection || DEFAULT_DIRECTION_SENSE_TURN_DIRECTION,
  );
  const [timeLimitSec, setTimeLimitSec] = useState(0);
  const [engineBgColor, setEngineBgColor] = useState(DEFAULT_DIRECTION_SENSE_BG);
  const [shapeColor, setShapeColor] = useState(DEFAULT_DIRECTION_SENSE_SHAPE_COLOR);

  const [trialIndex, setTrialIndex] = useState(0);
  const [trial, setTrial] = useState<DirectionSenseTrial | null>(null);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [feedbackCorrect, setFeedbackCorrect] = useState<boolean | null>(null);
  const [locked, setLocked] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [rotateDeg, setRotateDeg] = useState(0);
  const [straightenOk, setStraightenOk] = useState(false);
  const [trailPoints, setTrailPoints] = useState<DirectionSenseTrailPoint[]>([]);
  const [trailFading, setTrailFading] = useState(false);

  const [clicks, setClicks] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [faceErrors, setFaceErrors] = useState(0);
  const [flipErrors, setFlipErrors] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  const sessionFrozen = playBlocked || isResultsOpen;
  usePauseShiftedClock(sessionFrozen, Boolean(gameStarted && startTime != null), (delta) => {
    setStartTime((prev) => (prev == null ? prev : prev + delta));
  }, startTime);
  const [durationSec, setDurationSec] = useState(0);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const trialShownAtRef = useRef<number | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cfgRef = useRef({ choiceCount, trialsConfigured, isStraighten, lockedMode, turnDirection });
  const rotateDegRef = useRef(0);
  const rotatePadRef = useRef<View>(null);
  const padLayoutRef = useRef({ x: 0, y: 0, w: 1, h: 1 });
  const dragAngleRef = useRef(0);
  const lockedRef = useRef(false);
  const isStraightenRef = useRef(isStraighten);
  const completeStraightenRef = useRef<() => void>(() => {});
  const trailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trailFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moveCueRef = useRef({ accumDeg: 0, lastAtMs: 0 });

  useEffect(() => {
    const name = session?.user?.name?.trim();
    if (!name) return;
    setPatientName((prev) => (prev === name ? prev : name));
  }, [session?.user?.name]);

  useEffect(() => {
    cfgRef.current = { choiceCount, trialsConfigured, isStraighten, lockedMode, turnDirection };
  }, [choiceCount, trialsConfigured, isStraighten, lockedMode, turnDirection]);

  useEffect(() => {
    if (!isStraighten) return;
    void preloadMoveWhoosh();
  }, [isStraighten]);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      if (trailTimerRef.current) clearTimeout(trailTimerRef.current);
      if (trailFadeTimerRef.current) clearTimeout(trailFadeTimerRef.current);
    };
  }, []);

  const commitSettings = useCallback((settings: AppliedClinicalSettings) => {
    const nextChoice = clampDirectionSenseChoiceCount(
      settings.directionSenseChoiceCount ?? choiceCount,
    );
    const nextTrials = clampDirectionSenseTrials(settings.directionSenseTrials ?? trialsConfigured);
    const nextSize = clampDirectionSenseShapeSize(settings.directionSenseShapeSizePx ?? shapeSizePx);
    const nextTurn = clampDirectionSenseTurnDirection(settings.directionSenseTurnDirection ?? turnDirection);
    const nextTime = clampDirectionSenseTimeLimitSec(settings.timeLimitSec ?? timeLimitSec);
    setPatientName(settings.patientName || patientName);
    setChoiceCount(nextChoice);
    setTrialsConfigured(nextTrials);
    setShapeSizePx(nextSize);
    setTurnDirection(nextTurn);
    setTimeLimitSec(nextTime);
    if (settings.bgColor) setEngineBgColor(settings.bgColor);
    if (settings.shapeColor) setShapeColor(settings.shapeColor);
    cfgRef.current = {
      ...cfgRef.current,
      choiceCount: nextChoice,
      trialsConfigured: nextTrials,
      turnDirection: nextTurn,
    };
    return {
      choiceCount: nextChoice,
      trialsConfigured: nextTrials,
      shapeSizePx: nextSize,
      timeLimitSec: nextTime,
      turnDirection: nextTurn,
    };
  }, [choiceCount, patientName, shapeSizePx, timeLimitSec, trialsConfigured, turnDirection]);

  const finishSession = useCallback(
    (
      endedBy: 'cleared' | 'timeout',
      stats: {
        correct: number;
        wrong: number;
        clicks: number;
        faceErrors: number;
        flipErrors: number;
        reactions: number[];
        startedAt: number | null;
        completedTrials: number;
      },
    ) => {
      const duration = stats.startedAt
        ? Math.max(1, Math.round((Date.now() - stats.startedAt) / 1000))
        : durationSec;
      const reaction = reactionStatsFromMs(stats.reactions);
      const data: DirectionSenseSessionResultData = {
        patientName,
        sessionId: Date.now(),
        date: new Date().toISOString(),
        gameName: 'Direction Sense',
        stimuliCount: stats.completedTrials,
        letterSize: shapeSizePx / 48,
        speed: timeLimitSec > 0 ? `${timeLimitSec}s` : 'Untimed',
        durationSec: duration,
        clicksTotal: stats.clicks,
        correct: stats.correct,
        wrong: stats.wrong,
        accuracy: directionSenseAccuracy(stats.correct, stats.correct + stats.wrong),
        avgReactionSec: reaction.avgSec,
        medianReactionSec: reaction.medianSec,
        trialsConfigured,
        trialsCompleted: stats.completedTrials,
        choiceCount,
        transformMode: isStraighten ? 'straighten' : lockedMode,
        endedBy,
        deviceTier,
        faceErrors: stats.faceErrors,
        flipErrors: stats.flipErrors,
      };
      setResultsData(data);
      setIsResultsOpen(true);
      setGameStarted(false);
      setTrial(null);
    },
    [
      choiceCount,
      deviceTier,
      durationSec,
      isStraighten,
      lockedMode,
      patientName,
      shapeSizePx,
      timeLimitSec,
      trialsConfigured,
    ],
  );

  const spawnTrial = useCallback((index: number, choice: number) => {
    const next = cfgRef.current.isStraighten
      ? buildDirectionSenseStraightenTrial()
      : buildDirectionSenseTrial({
          mode: cfgRef.current.lockedMode,
          choiceCount: choice,
          turnDirection: cfgRef.current.turnDirection,
        });
    setTrial(next);
    setTrialIndex(index);
    setFeedbackId(null);
    setFeedbackCorrect(null);
    setLocked(false);
    lockedRef.current = false;
    setStraightenOk(false);
    setTrailPoints([]);
    setTrailFading(false);
    if (trailTimerRef.current) clearTimeout(trailTimerRef.current);
    if (trailFadeTimerRef.current) clearTimeout(trailFadeTimerRef.current);
    const start = next.startDeg ?? 0;
    rotateDegRef.current = start;
    setRotateDeg(start);
    trialShownAtRef.current = Date.now();
  }, []);

  const startGame = useCallback(
    (override?: {
      choiceCount?: number;
      trialsConfigured?: number;
      timeLimitSec?: number;
      turnDirection?: DirectionSenseTurnDirection;
    }) => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      const choice = override?.choiceCount ?? choiceCount;
      const trials = override?.trialsConfigured ?? trialsConfigured;
      const limit = override?.timeLimitSec ?? timeLimitSec;
      if (override?.turnDirection) {
        cfgRef.current = { ...cfgRef.current, turnDirection: override.turnDirection };
      }
      cfgRef.current = { ...cfgRef.current, choiceCount: choice, trialsConfigured: trials };
      setClicks(0);
      setCorrectCount(0);
      setWrongCount(0);
      setFaceErrors(0);
      setFlipErrors(0);
      setReactionTimes([]);
      setDurationSec(0);
      setStartTime(Date.now());
      setTimeLeft(limit);
      setIsResultsOpen(false);
      setResultsData(null);
      setGameStarted(true);
      spawnTrial(0, choice);
    },
    [choiceCount, spawnTrial, timeLimitSec, trialsConfigured],
  );

  useEffect(() => {
    if (!gameStarted || !startTime || isResultsOpen || playBlocked) return;
    const id = setInterval(() => {
      setDurationSec(Math.max(1, Math.round((Date.now() - startTime) / 1000)));
    }, 500);
    return () => clearInterval(id);
  }, [gameStarted, isResultsOpen, startTime, playBlocked]);

  useEffect(() => {
    if (!gameStarted || timeLimitSec <= 0 || isResultsOpen || playBlocked) return;
    if (timeLeft <= 0) {
      finishSession('timeout', {
        correct: correctCount,
        wrong: wrongCount,
        clicks,
        faceErrors,
        flipErrors,
        reactions: reactionTimes,
        startedAt: startTime,
        completedTrials: trialIndex,
      });
      return;
    }
    const id = setTimeout(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearTimeout(id);
  }, [
    clicks,
    correctCount,
    faceErrors,
    finishSession,
    flipErrors,
    gameStarted,
    isResultsOpen,
    playBlocked,
    reactionTimes,
    startTime,
    timeLeft,
    timeLimitSec,
    trialIndex,
    wrongCount,
  ]);

  const handleOption = (option: DirectionSenseOption) => {
    if (!gameStarted || !trial || locked) return;
    setLocked(true);
    lockedRef.current = true;
    setClicks((c) => c + 1);
    setFeedbackId(option.id);
    setFeedbackCorrect(option.isCorrect);

    const shownAt = trialShownAtRef.current;
    if (shownAt) {
      const rt = Date.now() - shownAt;
      setReactionTimes((prev) => [...prev, rt]);
    }

    let nextCorrect = correctCount;
    let nextWrong = wrongCount;
    let nextFaceErr = faceErrors;
    let nextFlipErr = flipErrors;

    if (option.isCorrect) {
      nextCorrect += 1;
      setCorrectCount(nextCorrect);
      void hapticCorrect();
    } else {
      nextWrong += 1;
      setWrongCount(nextWrong);
      if (trial.mode === 'face') {
        nextFaceErr += 1;
        setFaceErrors(nextFaceErr);
      } else {
        nextFlipErr += 1;
        setFlipErrors(nextFlipErr);
      }
      void hapticWrong();
    }

    const nextIndex = trialIndex + 1;
    advanceTimerRef.current = setTimeout(() => {
      if (nextIndex >= trialsConfigured) {
        finishSession('cleared', {
          correct: nextCorrect,
          wrong: nextWrong,
          clicks: clicks + 1,
          faceErrors: nextFaceErr,
          flipErrors: nextFlipErr,
          reactions: shownAt ? [...reactionTimes, Date.now() - (shownAt || Date.now())] : reactionTimes,
          startedAt: startTime,
          completedTrials: nextIndex,
        });
      } else {
        spawnTrial(nextIndex, choiceCount);
      }
    }, option.isCorrect ? 450 : 900);
  };

  const completeStraighten = useCallback(() => {
    if (!gameStarted || locked || !trial) return;
    setLocked(true);
    lockedRef.current = true;
    setStraightenOk(true);
    rotateDegRef.current = 0;
    setRotateDeg(0);
    setClicks((c) => c + 1);
    const shownAt = trialShownAtRef.current;
    if (shownAt) {
      setReactionTimes((prev) => [...prev, Date.now() - shownAt]);
    }
    const nextCorrect = correctCount + 1;
    setCorrectCount(nextCorrect);
    void hapticCorrect();
    const nextIndex = trialIndex + 1;
    advanceTimerRef.current = setTimeout(() => {
      if (nextIndex >= trialsConfigured) {
        finishSession('cleared', {
          correct: nextCorrect,
          wrong: wrongCount,
          clicks: clicks + 1,
          faceErrors,
          flipErrors,
          reactions: shownAt ? [...reactionTimes, Date.now() - shownAt] : reactionTimes,
          startedAt: startTime,
          completedTrials: nextIndex,
        });
      } else {
        spawnTrial(nextIndex, choiceCount);
      }
    }, 450);
  }, [
    choiceCount,
    clicks,
    correctCount,
    faceErrors,
    finishSession,
    flipErrors,
    gameStarted,
    locked,
    reactionTimes,
    spawnTrial,
    startTime,
    trial,
    trialIndex,
    trialsConfigured,
    wrongCount,
  ]);

  useEffect(() => {
    completeStraightenRef.current = completeStraighten;
    lockedRef.current = locked;
    isStraightenRef.current = isStraighten;
  }, [completeStraighten, isStraighten, locked]);

  const rotatePan = useMemo(() => {
    const trailFromPage = (pageX: number, pageY: number) => {
      const { x, y } = padLayoutRef.current;
      return { x: pageX - x, y: pageY - y };
    };
    const holdThenFadeTrail = () => {
      if (trailTimerRef.current) clearTimeout(trailTimerRef.current);
      if (trailFadeTimerRef.current) clearTimeout(trailFadeTimerRef.current);
      trailTimerRef.current = setTimeout(() => {
        setTrailFading(true);
        trailFadeTimerRef.current = setTimeout(() => {
          setTrailPoints([]);
          setTrailFading(false);
        }, 400);
      }, DIRECTION_SENSE_TRAIL_HOLD_MS);
    };
    const endDrag = () => {
      holdThenFadeTrail();
      if (lockedRef.current) return;
      if (isDirectionSenseUpright(rotateDegRef.current)) {
        completeStraightenRef.current();
      }
    };
    const canDrag = () => isStraightenRef.current && !lockedRef.current;
    return PanResponder.create({
      onStartShouldSetPanResponder: canDrag,
      onStartShouldSetPanResponderCapture: canDrag,
      onMoveShouldSetPanResponder: canDrag,
      onMoveShouldSetPanResponderCapture: canDrag,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (evt) => {
        rotatePadRef.current?.measureInWindow((x, y, w, h) => {
          padLayoutRef.current = { x, y, w, h };
        });
        const { pageX, pageY } = evt.nativeEvent;
        const { x, y, w, h } = padLayoutRef.current;
        dragAngleRef.current = pointerAngleDeg(pageX, pageY, x + w / 2, y + h / 2);
        resetDirectionSenseMoveCue(moveCueRef.current);
        if (trailTimerRef.current) clearTimeout(trailTimerRef.current);
        if (trailFadeTimerRef.current) clearTimeout(trailFadeTimerRef.current);
        setTrailFading(false);
        setTrailPoints([trailFromPage(pageX, pageY)]);
      },
      onPanResponderMove: (evt) => {
        if (lockedRef.current) return;
        const { pageX, pageY } = evt.nativeEvent;
        const { x, y, w, h } = padLayoutRef.current;
        const ang = pointerAngleDeg(pageX, pageY, x + w / 2, y + h / 2);
        const delta = directionSenseDeltaDeg(dragAngleRef.current, ang);
        dragAngleRef.current = ang;
        const next = rotateDegRef.current + delta;
        rotateDegRef.current = next;
        setRotateDeg(next);
        if (takeDirectionSenseMoveCue(moveCueRef.current, Math.abs(delta), Date.now())) {
          void hapticMove();
        }
        const pt = trailFromPage(pageX, pageY);
        setTrailPoints((prev) => {
          const last = prev[prev.length - 1];
          if (!shouldAppendTrailPoint(last, pt)) return prev;
          const nextPts = [...prev, pt];
          return nextPts.length > 240 ? nextPts.slice(-240) : nextPts;
        });
      },
      onPanResponderRelease: endDrag,
      onPanResponderTerminate: endDrag,
    });
  }, []);

  const trailArrow = directionSenseTrailArrowPoints(trailPoints);
  const rotatePadSize = directionSenseRotatePadSize(Math.min(width, height));
  const rotateGlyphSize = directionSenseRotateGlyphSize(rotatePadSize);

  const optionBorder = (opt: DirectionSenseOption) => {
    const isFeedback = feedbackId === opt.id;
    if (isFeedback && feedbackCorrect) return 'rgba(52, 211, 153, 0.9)';
    if (isFeedback && feedbackCorrect === false) return 'rgba(248, 113, 113, 0.9)';
    if (feedbackId && opt.isCorrect && feedbackCorrect === false) return 'rgba(52, 211, 153, 0.9)';
    return 'rgba(148, 163, 184, 0.35)';
  };

  return (
    <View style={{ flex: 1, backgroundColor: engineBgColor }}>
      {notification ? (
        <View
          style={{
            position: 'absolute',
            top: insets.top + 12,
            right: 16,
            zIndex: 50,
            backgroundColor: 'rgba(5,150,105,0.92)',
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: fs(13) }}>{notification}</Text>
        </View>
      ) : null}

      {!gameStarted && !showHowToPlay && !isSettingsOpen && !isResultsOpen ? (
        <ClickToStartOverlay
          title={levelTitle}
          onStart={() => startGame()}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onExit={requestExit}
        />
      ) : null}

      {gameStarted && trial ? (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: s(16),
            paddingTop: insets.top + s(72),
            paddingBottom: insets.bottom + s(88),
            gap: s(16),
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: insets.top + 12,
              left: 12,
              zIndex: 30,
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: 'rgba(51, 65, 85, 0.9)',
              backgroundColor: 'rgba(15, 23, 42, 0.72)',
              gap: 6,
            }}
          >
            <Text style={{ color: '#cbd5e1', fontSize: fs(12) }}>
              Trial <Text style={{ fontWeight: '800', color: '#fff' }}>{trialIndex + 1}</Text> /{' '}
              {trialsConfigured}
            </Text>
            {timeLimitSec > 0 ? (
              <Text style={{ color: '#cbd5e1', fontSize: fs(12) }}>
                Time <Text style={{ fontWeight: '800', color: '#fff' }}>{timeLeft}s</Text>
              </Text>
            ) : null}
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: s(18),
              flexWrap: 'wrap',
            }}
          >
            {isStraighten ? (
              <>
                <View pointerEvents="none" style={{ padding: s(8) }}>
                  <ShapeGlyph
                    shapeId={trial.shapeId}
                    pose={trial.probe}
                    color={shapeColor}
                    size={shapeSizePx}
                  />
                </View>
                <View
                  ref={rotatePadRef}
                  collapsable={false}
                  onLayout={() => {
                    rotatePadRef.current?.measureInWindow((x, y, w, h) => {
                      padLayoutRef.current = { x, y, w, h };
                    });
                  }}
                  {...rotatePan.panHandlers}
                  accessibilityLabel="Rotate the letter until it matches the reference"
                  style={{
                    position: 'relative',
                    overflow: 'visible',
                    width: rotatePadSize,
                    height: rotatePadSize,
                    borderRadius: 999,
                    backgroundColor: 'rgba(15, 23, 42, 0.28)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: straightenOk ? shapeColor : 'transparent',
                    shadowOpacity: straightenOk ? 0.85 : 0,
                    shadowRadius: 6,
                    elevation: straightenOk ? 4 : 0,
                  }}
                >
                  <View pointerEvents="none">
                    <ShapeGlyph
                      shapeId={trial.shapeId}
                      rotationDeg={rotateDeg}
                      color={shapeColor}
                      size={rotateGlyphSize}
                    />
                  </View>
                  <Svg
                    pointerEvents="none"
                    width={rotatePadSize}
                    height={rotatePadSize}
                    style={{ position: 'absolute', left: 0, top: 0 }}
                  >
                    <Circle
                      cx={rotatePadSize / 2}
                      cy={rotatePadSize / 2}
                      r={rotatePadSize / 2 - 2}
                      fill="none"
                      stroke={shapeColor}
                      strokeWidth={2}
                      strokeDasharray={straightenOk ? undefined : '8 6'}
                    />
                  </Svg>
                  {trailPoints.length > 1 ? (
                    <Svg
                      pointerEvents="none"
                      width={rotatePadSize}
                      height={rotatePadSize}
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        opacity: trailFading ? 0 : 1,
                      }}
                    >
                      <Polyline
                        points={directionSenseTrailPolyline(trailPoints)}
                        fill="none"
                        stroke="#38BDF8"
                        strokeWidth={3.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {trailArrow ? <Polygon points={trailArrow} fill="#38BDF8" /> : null}
                    </Svg>
                  ) : null}
                </View>
              </>
            ) : (
              <>
                <View>
                  <ShapeGlyph
                    shapeId={trial.shapeId}
                    pose={trial.probe}
                    color={shapeColor}
                    size={shapeSizePx}
                  />
                </View>
                <View style={{ backgroundColor: 'transparent', padding: 0 }}>
                  <Svg
                    width={Math.round(shapeSizePx * 0.52)}
                    height={Math.round(shapeSizePx * 0.52)}
                    viewBox="0 0 100 100"
                  >
                    <Path
                      d={directionSenseCurvedArrowPath(trial.turnDeg, trial.turnDirection)}
                      fill="none"
                      stroke={DEFAULT_DIRECTION_SENSE_ARROW_COLOR}
                      strokeWidth={DIRECTION_SENSE_ARROW_STROKE_WIDTH}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      transform={directionSenseArrowTransform(trial.turnDirection)}
                    />
                  </Svg>
                </View>
              </>
            )}
          </View>

          {!isStraighten ? (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: s(12),
              width: '100%',
              maxWidth: 920,
              marginTop: s(48),
            }}
          >
            {trial.options.map((opt) => (
              <Pressable
                key={opt.id}
                disabled={locked}
                onPress={() => handleOption(opt)}
                accessibilityLabel="Answer option"
                style={{
                  borderRadius: 20,
                  borderWidth: 2,
                  borderColor: optionBorder(opt),
                  backgroundColor: 'rgba(15, 23, 42, 0.45)',
                  padding: s(12),
                  opacity: locked && feedbackId !== opt.id && !(opt.isCorrect && feedbackCorrect === false) ? 0.85 : 1,
                }}
              >
                <ShapeGlyph
                  shapeId={trial.shapeId}
                  pose={opt.pose}
                  color={shapeColor}
                  size={Math.round(shapeSizePx * 0.92)}
                />
              </Pressable>
            ))}
          </View>
          ) : null}
        </View>
      ) : null}

      {gameStarted && !isResultsOpen ? (
        <Pressable
          onPress={() => setIsMenuOpen(true)}
          style={{ position: 'absolute', bottom: insets.bottom + 20, right: 16, padding: 10, zIndex: 40 }}
          accessibilityLabel="Open menu"
        >
          <SlidersIcon size={22} color="#94A3B8" />
        </Pressable>
      ) : null}

      <GameMenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onOpenHowToPlay={openHowToPlay}
        onQuit={() => {
          setIsMenuOpen(false);
          requestExit();
        }}
        onReset={() => {
          setIsMenuOpen(false);
          startGame();
        }}
        resetButtonLabel="Reset Game"
        onOpenSettings={() => setIsSettingsOpen(true)}
        sessionInProgress={gameStarted && !isResultsOpen}
        settingsSummary={[
          { label: 'Patient', value: patientName },
          { label: 'Level', value: levelTitle },
          ...(isStraighten
            ? []
            : [
                { label: 'Turn', value: directionSenseTurnDirectionLabel(turnDirection) },
                { label: 'Choices', value: String(choiceCount) },
              ]),
          { label: 'Trials', value: String(trialsConfigured) },
          { label: 'Shape Size', value: `${shapeSizePx}px` },
          {
            label: 'Time Limit',
            value: timeLimitSec > 0 ? `${timeLimitSec}s` : 'Off',
          },
        ]}
      />

      <HowToPlayManual
        moduleId="direction_sense"
        isOpen={showHowToPlay}
        mode={howToPlayMode}
        onContinue={finishHowToPlay}
        onClose={closeHowToPlay}
      />
      <ClinicalSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onApply={(settings) => {
          const wasPlaying = gameStarted && !isResultsOpen;
          const next = commitSettings(settings);
          setNotification('Settings Applied Successfully!');
          setTimeout(() => setNotification(null), 2500);
          setIsSettingsOpen(false);
          if (wasPlaying) startGame(next);
        }}
        patientName={patientName}
        letterSize={1.8}
        bubbleSize={80}
        showLetterSizeControl={false}
        showDirectionSenseControls
        directionSenseStraightenMode={isStraighten}
        directionSenseChoiceCount={choiceCount}
        directionSenseTrials={trialsConfigured}
        directionSenseShapeSizePx={shapeSizePx}
        directionSenseTurnDirection={turnDirection}
        timeLimitSec={timeLimitSec}
        bgColor={engineBgColor}
        shapeColor={shapeColor}
        sessionLocked={gameStarted && !isResultsOpen}
      />

      {resultsData ? (
        <GameResultsModal
          isOpen={isResultsOpen}
          onClose={() => {
            setIsResultsOpen(false);
            requestExit();
          }}
          onReplay={() => {
            setIsResultsOpen(false);
            startGame();
          }}
          data={resultsData}
        />
      ) : null}
    </View>
  );
}
