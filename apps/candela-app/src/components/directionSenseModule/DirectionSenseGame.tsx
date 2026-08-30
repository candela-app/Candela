'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppliedClinicalSettings,
  ClinicalSettingsModal,
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
  buildDirectionSenseTrial,
  buildDirectionSenseStraightenTrial,
  clampDirectionSenseChoiceCount,
  clampDirectionSenseShapeSize,
  clampDirectionSenseTimeLimitSec,
  clampDirectionSenseTrials,
  clampDirectionSenseTurnDirection,
  directionSenseAccuracy,
  directionSenseCurvedArrowPath,
  directionSenseArrowTransform,
  directionSenseDeltaDeg,
  directionSenseDeviceDefaults,
  directionSenseLevelIsStraighten,
  directionSenseLevelLabel,
  directionSenseModeFromLevelId,
  directionSensePoseTransform,
  directionSenseTurnDirectionLabel,
  isDirectionSenseUpright,
  playWhooshSoundAndHaptic,
  playSviMoveWhoosh,
  playWrongSoundAndHaptic,
  pointerAngleDeg,
  DIRECTION_SENSE_TRAIL_HOLD_MS,
  directionSenseTrailArrowPoints,
  directionSenseTrailPolyline,
  resetDirectionSenseMoveCue,
  shouldAppendTrailPoint,
  takeDirectionSenseMoveCue,
  clinicalColorSessionFields,
  getContrastAdjustedColor,
  reactionStatsFromMs,
  requestFullScreenSafe,
  getDeviceTier,
  type DirectionSenseOption,
  type DirectionSensePose,
  type DirectionSenseSessionResultData,
  type DirectionSenseTrailPoint,
  type DirectionSenseTrial,
  type DirectionSenseTurnDirection,
  useHowToPlayGate,
  usePauseShiftedClock,
} from '@candela/shared';
import { sessionDisplayName, useAuth } from '@/lib/auth-context';
import { GameMenuDrawer } from '../shared/GameMenuDrawer';
import { FullscreenToggleButton } from '../shared/FullscreenToggleButton';
import { GameResultsModal } from '../shared/GameResultsModal';
import { useGameSessionLock } from '../shared/useGameSessionLock';
import { ClickToStartOverlay } from '../shared/ClickToStartOverlay';
import { HowToPlayManual } from '../shared/HowToPlayManual';
import { SlidersIcon } from '../icons/VectorIcons';
import styles from './DirectionSenseGame.module.css';

interface DirectionSenseGameProps {
  onExit?: () => void;
  /** MODULE_LEVELS id: `face` | `flip` | `straighten` (`mixed` alias). */
  levelId?: string;
}

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
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <path
        d={DIRECTION_SENSE_SHAPE_PATHS[shapeId]}
        fill="none"
        stroke={color}
        strokeWidth={DIRECTION_SENSE_SHAPE_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={transform}
      />
    </svg>
  );
}

export function DirectionSenseGame({ onExit, levelId = 'face' }: DirectionSenseGameProps) {
  const { session } = useAuth();
  const defaults = useMemo(() => directionSenseDeviceDefaults(), []);
  const deviceTier = useMemo(() => getDeviceTier(), []);
  const isStraighten = directionSenseLevelIsStraighten(levelId);
  const lockedMode = directionSenseModeFromLevelId(levelId);
  const levelTitle = directionSenseLevelLabel(levelId);

  const [gameStarted, setGameStarted] = useState(false);
  const { showHowToPlay, howToPlayMode, isSettingsOpen, setIsSettingsOpen, finishHowToPlay, openHowToPlay, closeHowToPlay, playBlocked, isMenuOpen, setIsMenuOpen } = useHowToPlayGate();
  useGameSessionLock(true);
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
  const [contrastSensitivity, setContrastSensitivity] = useState(1);
  const displayShapeColor = getContrastAdjustedColor(shapeColor, engineBgColor, contrastSensitivity);

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
  const rotatePadRef = useRef<HTMLDivElement | null>(null);
  const rotateDegRef = useRef(0);
  const dragRef = useRef({ active: false, lastAngle: 0 });
  const moveCueRef = useRef({ accumDeg: 0, lastAtMs: 0 });
  const trailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trailFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const name = session?.user?.name?.trim();
    if (!name) return;
    setPatientName((prev) => (prev === name ? prev : name));
  }, [session?.user?.name]);

  useEffect(() => {
    cfgRef.current = { choiceCount, trialsConfigured, isStraighten, lockedMode, turnDirection };
  }, [choiceCount, trialsConfigured, isStraighten, lockedMode, turnDirection]);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      if (trailTimerRef.current) clearTimeout(trailTimerRef.current);
      if (trailFadeTimerRef.current) clearTimeout(trailFadeTimerRef.current);
    };
  }, []);

  const avgReactionMs = reactionTimes.length
    ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
    : 0;

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
    if (settings.contrastSensitivity != null) setContrastSensitivity(settings.contrastSensitivity);
    return {
      choiceCount: nextChoice,
      trialsConfigured: nextTrials,
      shapeSizePx: nextSize,
      timeLimitSec: nextTime,
      turnDirection: nextTurn,
    };
  }, [choiceCount, patientName, shapeSizePx, timeLimitSec, trialsConfigured, turnDirection]);

  const finishSession = useCallback(
    (endedBy: 'cleared' | 'timeout', stats: {
      correct: number;
      wrong: number;
      clicks: number;
      faceErrors: number;
      flipErrors: number;
      reactions: number[];
      startedAt: number | null;
      completedTrials: number;
    }) => {
      const duration = stats.startedAt ? Math.max(1, Math.round((Date.now() - stats.startedAt) / 1000)) : durationSec;
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
        ...clinicalColorSessionFields(engineBgColor, shapeColor, contrastSensitivity),
      };
      setResultsData(data);
      setIsResultsOpen(true);
      setGameStarted(false);
      setTrial(null);
    },
    [choiceCount, deviceTier, durationSec, isStraighten, lockedMode, patientName, shapeSizePx, timeLimitSec, trialsConfigured, engineBgColor, shapeColor, contrastSensitivity],
  );

  const spawnTrial = useCallback(
    (index: number, choice: number) => {
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
      setStraightenOk(false);
      setTrailPoints([]);
      setTrailFading(false);
      if (trailTimerRef.current) clearTimeout(trailTimerRef.current);
      if (trailFadeTimerRef.current) clearTimeout(trailFadeTimerRef.current);
      const start = next.startDeg ?? 0;
      rotateDegRef.current = start;
      setRotateDeg(start);
      trialShownAtRef.current = Date.now();
    },
    [],
  );

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
      void requestFullScreenSafe();
    },
    [choiceCount, spawnTrial, timeLimitSec, trialsConfigured],
  );

  useEffect(() => {
    if (!gameStarted || !startTime || isResultsOpen || playBlocked) return;
    const id = window.setInterval(() => {
      setDurationSec(Math.max(1, Math.round((Date.now() - startTime) / 1000)));
    }, 500);
    return () => window.clearInterval(id);
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
    const id = window.setTimeout(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => window.clearTimeout(id);
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
      void playWhooshSoundAndHaptic();
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
      void playWrongSoundAndHaptic();
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
    void playWhooshSoundAndHaptic();
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

  const onRotatePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isStraighten || !gameStarted || locked || !trial) return;
    event.preventDefault();
    const el = rotatePadRef.current;
    if (!el) return;
    el.setPointerCapture(event.pointerId);
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    dragRef.current = {
      active: true,
      lastAngle: pointerAngleDeg(event.clientX, event.clientY, cx, cy),
    };
    resetDirectionSenseMoveCue(moveCueRef.current);
    if (trailTimerRef.current) clearTimeout(trailTimerRef.current);
    if (trailFadeTimerRef.current) clearTimeout(trailFadeTimerRef.current);
    setTrailFading(false);
    setTrailPoints([{ x: event.clientX - rect.left, y: event.clientY - rect.top }]);
  };

  const onRotatePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const el = rotatePadRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const ang = pointerAngleDeg(event.clientX, event.clientY, cx, cy);
    const delta = directionSenseDeltaDeg(dragRef.current.lastAngle, ang);
    dragRef.current.lastAngle = ang;
    const next = rotateDegRef.current + delta;
    rotateDegRef.current = next;
    setRotateDeg(next);
    if (takeDirectionSenseMoveCue(moveCueRef.current, Math.abs(delta), Date.now())) {
      playSviMoveWhoosh();
    }
    const pt = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    setTrailPoints((prev) => {
      const last = prev[prev.length - 1];
      if (!shouldAppendTrailPoint(last, pt)) return prev;
      const nextPts = [...prev, pt];
      return nextPts.length > 240 ? nextPts.slice(-240) : nextPts;
    });
  };

  const onRotatePointerUp = () => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    if (trailTimerRef.current) clearTimeout(trailTimerRef.current);
    if (trailFadeTimerRef.current) clearTimeout(trailFadeTimerRef.current);
    trailTimerRef.current = setTimeout(() => {
      setTrailFading(true);
      trailFadeTimerRef.current = setTimeout(() => {
        setTrailPoints([]);
        setTrailFading(false);
      }, 400);
    }, DIRECTION_SENSE_TRAIL_HOLD_MS);
    if (isDirectionSenseUpright(rotateDegRef.current)) {
      completeStraighten();
    }
  };

  const trailArrow = directionSenseTrailArrowPoints(trailPoints);

  return (
    <div className={styles.shell} style={{ backgroundColor: engineBgColor }}>
      {notification ? <div className={styles.toast}>✓ {notification}</div> : null}

      {!gameStarted && !showHowToPlay && !isSettingsOpen && !isResultsOpen ? (
        <ClickToStartOverlay
          title={levelTitle}
          onStart={() => startGame()}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onExit={onExit}
        />
      ) : null}

      {gameStarted && trial ? (
        <div className={styles.playField}>
          <div className={styles.hud}>
            <div>
              Trial <strong>{trialIndex + 1}</strong> / {trialsConfigured}
            </div>
            {timeLimitSec > 0 ? (
              <div>
                Time <strong>{timeLeft}s</strong>
              </div>
            ) : null}
          </div>

          <div className={styles.fabCluster}>
            <FullscreenToggleButton />
            <button
              type="button"
              className={styles.settingsBtn}
              aria-label="Open menu"
              onClick={() => setIsMenuOpen(true)}
            >
              <SlidersIcon size={22} color="#94A3B8" />
            </button>
          </div>

          <div className={styles.probeRow}>
            {isStraighten ? (
              <>
                <div className={styles.referenceCard}>
                  <ShapeGlyph
                    shapeId={trial.shapeId}
                    pose={trial.probe}
                    color={displayShapeColor}
                    size={shapeSizePx}
                  />
                </div>
                <div
                  ref={rotatePadRef}
                  className={[
                    styles.rotatePad,
                    straightenOk ? styles.rotatePadOk : '',
                    locked ? styles.rotatePadLocked : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{ ['--rotate-pad-border' as string]: displayShapeColor }}
                  role="slider"
                  aria-label="Rotate the letter until it matches the reference"
                  aria-valuemin={0}
                  aria-valuemax={360}
                  aria-valuenow={Math.round(((rotateDeg % 360) + 360) % 360)}
                  onPointerDown={onRotatePointerDown}
                  onPointerMove={onRotatePointerMove}
                  onPointerUp={onRotatePointerUp}
                  onPointerCancel={onRotatePointerUp}
                >
                  <div className={styles.rotateGlyph}>
                    <ShapeGlyph
                      shapeId={trial.shapeId}
                      rotationDeg={rotateDeg}
                      color={displayShapeColor}
                      size={Math.round(shapeSizePx * 3.2)}
                    />
                  </div>
                  {trailPoints.length > 1 ? (
                    <svg
                      className={`${styles.trailSvg} ${trailFading ? styles.trailFading : ''}`}
                      aria-hidden
                    >
                      <polyline
                        points={directionSenseTrailPolyline(trailPoints)}
                        fill="none"
                        stroke="#38BDF8"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {trailArrow ? (
                        <polygon
                          points={trailArrow}
                          fill="#38BDF8"
                        />
                      ) : null}
                    </svg>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <div className={styles.probeCard}>
                  <ShapeGlyph shapeId={trial.shapeId} pose={trial.probe} color={displayShapeColor} size={shapeSizePx} />
                </div>
                <div className={styles.arrowCard} aria-hidden>
                  <svg
                    width={Math.round(shapeSizePx * 0.52)}
                    height={Math.round(shapeSizePx * 0.52)}
                    viewBox="0 0 100 100"
                  >
                    <path
                      d={directionSenseCurvedArrowPath(trial.turnDeg, trial.turnDirection)}
                      fill="none"
                      stroke={DEFAULT_DIRECTION_SENSE_ARROW_COLOR}
                      strokeWidth={DIRECTION_SENSE_ARROW_STROKE_WIDTH}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      transform={directionSenseArrowTransform(trial.turnDirection)}
                    />
                  </svg>
                </div>
              </>
            )}
          </div>

          {!isStraighten ? (
          <div className={styles.options}>
            {trial.options.map((opt) => {
              const isFeedback = feedbackId === opt.id;
              const className = [
                styles.optionCard,
                isFeedback && feedbackCorrect ? styles.optionCorrect : '',
                isFeedback && feedbackCorrect === false ? styles.optionWrong : '',
                feedbackId && opt.isCorrect && feedbackCorrect === false ? styles.optionCorrect : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={className}
                  disabled={locked}
                  onClick={() => handleOption(opt)}
                  aria-label="Answer option"
                >
                  <ShapeGlyph
                    shapeId={trial.shapeId}
                    pose={opt.pose}
                    color={displayShapeColor}
                    size={Math.round(shapeSizePx * 0.92)}
                  />
                </button>
              );
            })}
          </div>
          ) : null}
        </div>
      ) : null}

      <GameMenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onOpenHowToPlay={openHowToPlay}
        onQuit={() => {
          setIsMenuOpen(false);
          if (onExit) onExit();
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
          { label: 'Level', value: <span className="text-sky-400 font-bold">{levelTitle}</span> },
          ...(isStraighten
            ? []
            : [
                {
                  label: 'Turn',
                  value: (
                    <span className="text-sky-400 font-bold">{directionSenseTurnDirectionLabel(turnDirection)}</span>
                  ),
                },
                { label: 'Choices', value: <span className="text-sky-400 font-bold">{choiceCount}</span> },
              ]),
          { label: 'Trials', value: <span className="text-sky-400 font-bold">{trialsConfigured}</span> },
          { label: 'Shape Size', value: <span className="text-sky-400 font-bold">{shapeSizePx}px</span> },
          {
            label: 'Time Limit',
            value:
              timeLimitSec > 0 ? (
                <span className="text-sky-400 font-bold">{timeLimitSec}s</span>
              ) : (
                <span className="text-emerald-400 font-bold">Off</span>
              ),
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
        onApply={(newSettings) => {
          const wasPlaying = gameStarted && !isResultsOpen;
          const next = commitSettings(newSettings);
          setNotification('Settings Applied Successfully!');
          setTimeout(() => setNotification(null), 2500);
          setIsSettingsOpen(false);
          requestFullScreenSafe();
          if (wasPlaying) startGame(next);
        }}
        patientName={patientName}
        letterSize={1.8}
        bubbleSize={80}
        showLetterSizeControl={false}
        showDirectionSenseControls
        directionSenseChoiceCount={choiceCount}
        directionSenseTrials={trialsConfigured}
        directionSenseShapeSizePx={shapeSizePx}
        directionSenseTurnDirection={turnDirection}
        timeLimitSec={timeLimitSec}
        bgColor={engineBgColor}
        shapeColor={shapeColor}
        contrastSensitivity={contrastSensitivity}
        sessionLocked={gameStarted && !isResultsOpen}
        extraStats={
          <div className="grid grid-cols-3 text-center bg-[#282828] p-3 rounded-xl gap-2 border border-gray-800">
            <div>
              <div className="text-xs text-gray-400">Reaction</div>
              <div className="font-bold text-white text-base">{avgReactionMs}ms</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Duration</div>
              <div className="font-bold text-white text-base">{durationSec}s</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Clicks</div>
              <div className="font-bold text-white text-base">{clicks}</div>
            </div>
          </div>
        }
      />

      {resultsData ? (
        <GameResultsModal
          isOpen={isResultsOpen}
          onClose={() => {
            setIsResultsOpen(false);
            if (onExit) onExit();
          }}
          onReplay={() => {
            setIsResultsOpen(false);
            startGame();
          }}
          data={resultsData}
        />
      ) : null}
    </div>
  );
}
