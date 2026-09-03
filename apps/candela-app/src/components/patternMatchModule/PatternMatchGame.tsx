'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppliedClinicalSettings,
  ClinicalSettingsModal,
  DEFAULT_PATTERN_MATCH_BG,
  DEFAULT_PATTERN_MATCH_CELL_COUNT,
  DEFAULT_PATTERN_MATCH_CHAR_COLOR,
  DEFAULT_PATTERN_MATCH_CODE_LENGTH,
  DEFAULT_PATTERN_MATCH_FLASH_MS,
  DEFAULT_PATTERN_MATCH_HARDNESS,
  DEFAULT_PATTERN_MATCH_LETTER_SIZE,
  DEFAULT_PATTERN_MATCH_ROUNDS,
  DEFAULT_PATTERN_MATCH_TIME_LIMIT_SEC,
  clinicalColorSessionFields,
  getContrastAdjustedColor,
  buildPatternMatchField,
  generatePatternMatchTarget,
  getDeviceTier,
  patternMatchDeviceDefaults,
  patternMatchFlashLabel,
  patternMatchHardnessLabel,
  patternMatchStimulusFromLevelId,
  playMissPressSoundAndHaptic,
  playSuccessSoundAndHaptic,
  playWhooshSoundAndHaptic,
  playWrongSoundAndHaptic,
  requestFullScreenSafe,
  type PatternMatchCell,
  type PatternMatchHardness,
  type PatternMatchSessionResultData,
  type PatternMatchStimulusMode,
  useHowToPlayGate,
  usePauseShiftedClock,
  buildSessionMetrics,
} from '@candela/shared';
import { useAuth } from '@/lib/auth-context';
import { GameMenuDrawer } from '../shared/GameMenuDrawer';
import { FullscreenToggleButton } from '../shared/FullscreenToggleButton';
import { GameResultsModal } from '../shared/GameResultsModal';
import { useGameSessionLock } from '../shared/useGameSessionLock';
import { ClickToStartOverlay } from '../shared/ClickToStartOverlay';
import { HowToPlayManual } from '../shared/HowToPlayManual';
import { SlidersIcon } from '../icons/VectorIcons';
import styles from './PatternMatchGame.module.css';

interface PatternMatchGameProps {
  onExit?: () => void;
  /** MODULE_LEVELS id: `standard` (digits) or `compound` (alphanumeric). */
  levelId?: string;
}

type Phase = 'idle' | 'encode' | 'search';

function sessionPatientName(session: { user?: { name?: string | null } } | null | undefined): string {
  const name = session?.user?.name?.trim();
  return name && name.length > 0 ? name : 'Demo Patient';
}

export function PatternMatchGame({ onExit, levelId = 'standard' }: PatternMatchGameProps) {
  const { session } = useAuth();
  const deviceTier = useMemo(() => getDeviceTier(), []);
  const defaults = useMemo(() => patternMatchDeviceDefaults(), []);
  const stimulusMode = useMemo(
    () => patternMatchStimulusFromLevelId(levelId) as PatternMatchStimulusMode,
    [levelId],
  );
  const levelTitle = stimulusMode === 'compound' ? 'Compound' : 'Standard';
  const levelHint =
    stimulusMode === 'compound'
      ? 'Memorize the flashed letter–number code, then tap every exact match. Near-miss codes count as misses.'
      : 'Memorize the flashed digit code, then tap every exact match in the field. Near-miss codes count as misses.';

  const [gameStarted, setGameStarted] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const { showHowToPlay, howToPlayMode, isSettingsOpen, setIsSettingsOpen, finishHowToPlay, openHowToPlay, closeHowToPlay, playBlocked, isMenuOpen, setIsMenuOpen } = useHowToPlayGate();
  useGameSessionLock(true);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [resultsData, setResultsData] = useState<PatternMatchSessionResultData | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const [patientName, setPatientName] = useState(() => sessionPatientName(session));
  const [codeLength, setCodeLength] = useState(defaults.codeLength || DEFAULT_PATTERN_MATCH_CODE_LENGTH);
  const [flashMs, setFlashMs] = useState(defaults.flashMs ?? DEFAULT_PATTERN_MATCH_FLASH_MS);
  const [cellCount, setCellCount] = useState(defaults.cellCount || DEFAULT_PATTERN_MATCH_CELL_COUNT);
  const [hardness, setHardness] = useState<PatternMatchHardness>(
    defaults.hardness || DEFAULT_PATTERN_MATCH_HARDNESS,
  );
  const [letterSize, setLetterSize] = useState(defaults.letterSize || DEFAULT_PATTERN_MATCH_LETTER_SIZE);
  const [roundsPerSession, setRoundsPerSession] = useState(defaults.rounds || DEFAULT_PATTERN_MATCH_ROUNDS);
  const [timeLimitSec, setTimeLimitSec] = useState(DEFAULT_PATTERN_MATCH_TIME_LIMIT_SEC);
  const [engineBgColor, setEngineBgColor] = useState(DEFAULT_PATTERN_MATCH_BG);
  const [charColor, setCharColor] = useState(DEFAULT_PATTERN_MATCH_CHAR_COLOR);
  const [contrastSensitivity, setContrastSensitivity] = useState(1);
  const displayCharColor = getContrastAdjustedColor(charColor, engineBgColor, contrastSensitivity);

  const [currentRound, setCurrentRound] = useState(1);
  const [targetCode, setTargetCode] = useState('');
  const [cells, setCells] = useState<PatternMatchCell[]>([]);
  const [poppingIds, setPoppingIds] = useState<Set<string>>(new Set());
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(0);

  const [clicks, setClicks] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [targetShownAt, setTargetShownAt] = useState<number | null>(null);
  const [durationSec, setDurationSec] = useState(0);

  const endingRef = useRef(false);
  const currentRoundRef = useRef(1);
  const roundsPerSessionRef = useRef(roundsPerSession);
  const statsRef = useRef({
    clicks: 0,
    correct: 0,
    wrong: 0,
    reactions: [] as number[],
    matchesConfigured: 0,
    targetCode: '',
    roundsCompleted: 0,
  });
  const startTimeRef = useRef<number | null>(null);

  const sessionFrozen = playBlocked || isResultsOpen;
  usePauseShiftedClock(sessionFrozen, Boolean(gameStarted && startTime != null), (delta) => {
    setStartTime((prev) => (prev == null ? prev : prev + delta));
    if (startTimeRef.current != null) startTimeRef.current += delta;
    setTargetShownAt((prev) => (prev == null ? prev : prev + delta));
  }, startTime);
  const settingsRef = useRef({
    patientName,
    codeLength,
    flashMs,
    cellCount,
    hardness,
    letterSize,
    roundsPerSession,
    timeLimitSec,
    engineBgColor,
    charColor,
    contrastSensitivity,
  });

  useEffect(() => {
    settingsRef.current = {
      patientName,
      codeLength,
      flashMs,
      cellCount,
      hardness,
      letterSize,
      roundsPerSession,
      timeLimitSec,
      engineBgColor,
      charColor,
      contrastSensitivity,
    };
    roundsPerSessionRef.current = roundsPerSession;
  }, [
    patientName,
    codeLength,
    flashMs,
    cellCount,
    hardness,
    letterSize,
    roundsPerSession,
    timeLimitSec,
    engineBgColor,
    charColor,
    contrastSensitivity,
  ]);

  useEffect(() => {
    requestFullScreenSafe();
  }, []);

  useEffect(() => {
    if (!gameStarted || startTime === null || playBlocked || isMenuOpen || isResultsOpen) return;
    if (phase !== 'search') return;
    const interval = setInterval(() => {
      setDurationSec(Math.max(0, Math.floor((performance.now() - startTime) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [gameStarted, startTime, playBlocked, isMenuOpen, isResultsOpen, phase]);

  const remainingMatches = useMemo(
    () => cells.filter((c) => c.isMatch && !poppingIds.has(c.id)).length,
    [cells, poppingIds],
  );

  const finishSession = useCallback(
    (endedBy: 'cleared' | 'timeout') => {
      if (endingRef.current) return;
      endingRef.current = true;

      const stats = statsRef.current;
      const cfg = settingsRef.current;
      if (endedBy === 'timeout') {
        stats.roundsCompleted = Math.max(stats.roundsCompleted, currentRoundRef.current);
      }
      const matchesFound = stats.correct;
      const matchesRemaining = Math.max(0, stats.matchesConfigured - matchesFound);
      const elapsed =
        startTimeRef.current != null
          ? Math.max(1, Math.floor((performance.now() - startTimeRef.current) / 1000))
          : durationSec;

      if (endedBy === 'cleared') {
        playSuccessSoundAndHaptic();
      }

      const data: PatternMatchSessionResultData = {
        patientName: cfg.patientName,
        sessionId: Date.now(),
        date: new Date().toISOString(),
        gameName: 'Hold the Code',
        stimuliCount: stats.matchesConfigured,
        letterSize: cfg.letterSize,
        speed: cfg.timeLimitSec > 0 ? `${cfg.timeLimitSec}s` : 'Untimed',
        durationSec: elapsed,
        clicksTotal: stats.clicks,
        correct: stats.correct,
        ...buildSessionMetrics({
          correct: stats.correct,
          wrongTaps: stats.wrong,
          timeouts: endedBy === 'timeout' ? matchesRemaining : 0,
          reactionMs: stats.reactions,
        }),
        targetCode: stats.targetCode,
        codeLength: cfg.codeLength,
        matchesConfigured: stats.matchesConfigured,
        matchesFound,
        matchesRemaining,
        flashMs: cfg.flashMs,
        timeLimitSec: cfg.timeLimitSec,
        roundsConfigured: cfg.roundsPerSession,
        roundsCompleted: stats.roundsCompleted,
        stimulusMode,
        endedBy,
        deviceTier,
        ...clinicalColorSessionFields(cfg.engineBgColor, cfg.charColor, cfg.contrastSensitivity ?? 1),
      };

      setResultsData(data);
      setIsResultsOpen(true);
      setGameStarted(false);
      setPhase('idle');
      setTimeLeft(0);
    },
    [deviceTier, durationSec, stimulusMode],
  );

  useEffect(() => {
    if (!gameStarted || phase !== 'search' || playBlocked || isResultsOpen || isMenuOpen) return;
    if (timeLimitSec <= 0) return;
    if (timeLeft <= 0) {
      finishSession('timeout');
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [
    gameStarted,
    phase,
    playBlocked,
    isResultsOpen,
    isMenuOpen,
    timeLimitSec,
    timeLeft,
    finishSession,
  ]);

  const commitSettings = useCallback(
    (newSettings: AppliedClinicalSettings) => {
      const nextLength = newSettings.patternMatchCodeLength ?? codeLength;
      const nextFlash = newSettings.patternMatchFlashMs ?? flashMs;
      const nextCells = newSettings.patternMatchCellCount ?? cellCount;
      const nextHard = newSettings.patternMatchHardness ?? hardness;
      const nextLetter = newSettings.letterSize ?? letterSize;
      const nextRounds = newSettings.patternMatchRounds ?? roundsPerSession;
      const nextTime = newSettings.timeLimitSec ?? timeLimitSec;
      const nextBg = newSettings.bgColor || engineBgColor;
      const nextChar = newSettings.shapeColor || charColor;

      setPatientName(newSettings.patientName);
      setCodeLength(nextLength);
      setFlashMs(nextFlash);
      setCellCount(nextCells);
      setHardness(nextHard);
      setLetterSize(nextLetter);
      setRoundsPerSession(nextRounds);
      setTimeLimitSec(nextTime);
      setEngineBgColor(nextBg);
      setCharColor(nextChar);
      if (newSettings.contrastSensitivity != null) setContrastSensitivity(newSettings.contrastSensitivity);

      return {
        codeLength: nextLength,
        flashMs: nextFlash,
        cellCount: nextCells,
        hardness: nextHard,
        letterSize: nextLetter,
        roundsPerSession: nextRounds,
        timeLimitSec: nextTime,
      };
    },
    [
      codeLength,
      flashMs,
      cellCount,
      hardness,
      letterSize,
      roundsPerSession,
      timeLimitSec,
      engineBgColor,
      charColor,
    ],
  );

  const beginSearchPhase = useCallback(
    (code: string, packed: PatternMatchCell[], limit: number, opts?: { resetSession?: boolean }) => {
      const matchTotal = packed.filter((c) => c.isMatch).length;
      if (opts?.resetSession) {
        statsRef.current = {
          clicks: 0,
          correct: 0,
          wrong: 0,
          reactions: [],
          matchesConfigured: matchTotal,
          targetCode: code,
          roundsCompleted: 0,
        };
        setClicks(0);
        setCorrectCount(0);
        setWrongCount(0);
        setReactionTimes([]);
        setDurationSec(0);
        const now = performance.now();
        setStartTime(now);
        startTimeRef.current = now;
      } else {
        statsRef.current.matchesConfigured += matchTotal;
        statsRef.current.targetCode = code;
      }

      setTargetCode(code);
      setCells(packed);
      setPoppingIds(new Set());
      setWrongIds(new Set());
      setIsResultsOpen(false);
      setResultsData(null);

      setTargetShownAt(performance.now());
      setTimeLeft(limit > 0 ? limit : 0);
      setPhase('search');
      setGameStarted(true);
    },
    [],
  );

  const launchRound = useCallback(
    (
      round: number,
      overrides?: {
        codeLength?: number;
        flashMs?: number;
        cellCount?: number;
        hardness?: PatternMatchHardness;
        timeLimitSec?: number;
        roundsPerSession?: number;
      },
      resetSession = false,
    ) => {
      endingRef.current = false;
      const len = overrides?.codeLength ?? codeLength;
      const flash = overrides?.flashMs ?? flashMs;
      const count = overrides?.cellCount ?? cellCount;
      const hard = overrides?.hardness ?? hardness;
      const limit = overrides?.timeLimitSec ?? timeLimitSec;

      const code = generatePatternMatchTarget(len, stimulusMode);
      const packed = buildPatternMatchField({
        target: code,
        cellCount: count,
        hardness: hard,
        stimulusMode,
      });
      const matchTotal = packed.filter((c) => c.isMatch).length;

      if (packed.length === 0 || matchTotal === 0) {
        setNotification('Could not build field — try again.');
        setTimeout(() => setNotification(null), 2500);
        return;
      }

      currentRoundRef.current = round;
      setCurrentRound(round);
      setIsSettingsOpen(false);
      requestFullScreenSafe();
      setTargetCode(code);
      setGameStarted(true);

      if (flash <= 0) {
        beginSearchPhase(code, packed, limit, { resetSession });
        return;
      }

      setPhase('encode');
      setCells([]);
      window.setTimeout(() => {
        if (endingRef.current) return;
        beginSearchPhase(code, packed, limit, { resetSession });
      }, flash);
    },
    [codeLength, flashMs, cellCount, hardness, timeLimitSec, stimulusMode, beginSearchPhase],
  );

  const startGame = useCallback(
    (overrides?: {
      codeLength?: number;
      flashMs?: number;
      cellCount?: number;
      hardness?: PatternMatchHardness;
      timeLimitSec?: number;
      roundsPerSession?: number;
    }) => {
      if (overrides?.roundsPerSession != null) {
        setRoundsPerSession(overrides.roundsPerSession);
        roundsPerSessionRef.current = overrides.roundsPerSession;
      }
      launchRound(1, overrides, true);
    },
    [launchRound],
  );

  const onBoardCleared = useCallback(() => {
    statsRef.current.roundsCompleted = currentRoundRef.current;
    const totalRounds = roundsPerSessionRef.current;
    if (currentRoundRef.current >= totalRounds) {
      finishSession('cleared');
      return;
    }
    playSuccessSoundAndHaptic();
    launchRound(currentRoundRef.current + 1, undefined, false);
  }, [finishSession, launchRound]);

  const handleCellClick = useCallback(
    (cell: PatternMatchCell, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!gameStarted || phase !== 'search' || isResultsOpen || poppingIds.has(cell.id)) return;

      const now = performance.now();
      statsRef.current.clicks += 1;
      setClicks((c) => c + 1);

      if (cell.isMatch) {
        playWhooshSoundAndHaptic();
        if (targetShownAt != null) {
          const rt = Math.max(0, Math.round(now - targetShownAt));
          statsRef.current.reactions.push(rt);
          setReactionTimes([...statsRef.current.reactions]);
        }
        setTargetShownAt(now);

        statsRef.current.correct += 1;
        setCorrectCount(statsRef.current.correct);
        setPoppingIds((prev) => new Set(prev).add(cell.id));

        window.setTimeout(() => {
          setCells((prev) => {
            const next = prev.filter((c) => c.id !== cell.id);
            const still = next.some((c) => c.isMatch);
            if (!still) {
              window.setTimeout(() => onBoardCleared(), 40);
            }
            return next;
          });
          setPoppingIds((prev) => {
            const n = new Set(prev);
            n.delete(cell.id);
            return n;
          });
        }, 220);
        return;
      }

      playWrongSoundAndHaptic();
      statsRef.current.wrong += 1;
      setWrongCount(statsRef.current.wrong);
      setWrongIds((prev) => new Set(prev).add(cell.id));
      window.setTimeout(() => {
        setWrongIds((prev) => {
          const n = new Set(prev);
          n.delete(cell.id);
          return n;
        });
      }, 300);
    },
    [gameStarted, phase, isResultsOpen, poppingIds, targetShownAt, onBoardCleared],
  );

  const handleBackgroundClick = useCallback(() => {
    if (!gameStarted || phase !== 'search' || isResultsOpen) return;
    playMissPressSoundAndHaptic();
  }, [gameStarted, phase, isResultsOpen]);

  const avgReactionMs =
    reactionTimes.length > 0
      ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
      : 0;

  const showHoldCode = flashMs <= 0 && phase === 'search' && targetCode;

  return (
    <div className={styles.shell} style={{ backgroundColor: engineBgColor }}>
      {notification ? <div className={styles.toast}>✓ {notification}</div> : null}

      {!gameStarted && !showHowToPlay && !isSettingsOpen && !isResultsOpen ? (
        <ClickToStartOverlay
          title={levelTitle}
          hint={levelHint}
          onStart={startGame}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onExit={onExit}
        />
      ) : null}

      <div
        className={styles.playField}
        style={{ backgroundColor: engineBgColor }}
        onClick={handleBackgroundClick}
      >
        {phase === 'encode' && targetCode ? (
          <div className={styles.encodeBanner} style={{ backgroundColor: engineBgColor }}>
            <p className={styles.encodeLabel}>Hold this code</p>
            <p className={styles.encodeCode} style={{ color: displayCharColor, fontSize: `${letterSize * 2}rem` }}>
              {targetCode}
            </p>
          </div>
        ) : null}

        {phase === 'search' ? (
          <>
            {showHoldCode ? (
              <p className={styles.holdCode} style={{ color: displayCharColor, fontSize: `${letterSize}rem` }}>
                {targetCode}
              </p>
            ) : null}
            <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${cellCount <= 6 ? 2 : 3}, minmax(0, 1fr))` }}>
              {cells.map((cell) => {
                const isPopping = poppingIds.has(cell.id);
                const isWrong = wrongIds.has(cell.id);
                return (
                  <button
                    key={cell.id}
                    type="button"
                    className={`${styles.cell} ${isPopping ? styles.cellPop : ''} ${isWrong ? styles.cellShake : ''}`}
                    style={{ color: displayCharColor, fontSize: `${letterSize}rem` }}
                    onClick={(e) => handleCellClick(cell, e)}
                    aria-label={`Code ${cell.code}`}
                  >
                    {cell.code}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}
      </div>

      {gameStarted && phase === 'search' ? (
        <div className={styles.hud}>
          <div className={styles.hudLeft}>
            <p className={styles.hudSub}>
              Round {currentRound}/{roundsPerSession} · {remainingMatches} match
              {remainingMatches === 1 ? '' : 'es'} left · {correctCount} found
              {wrongCount > 0 ? ` · ${wrongCount} misses` : ''}
            </p>
          </div>
          <div className={styles.hudRight}>
            {timeLimitSec > 0 ? (
              <span className={`${styles.chip} ${styles.chipAccent} ${timeLeft <= 10 ? styles.chipLow : ''}`}>
                {timeLeft}s
              </span>
            ) : (
              <span className={styles.chip}>{durationSec}s</span>
            )}
          </div>
        </div>
      ) : null}

      <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-40 flex items-center gap-2">
        <FullscreenToggleButton />
        <button
          type="button"
          className={styles.menuBtn}
          onClick={() => setIsMenuOpen(true)}
          title="Settings menu"
        >
          <SlidersIcon className="w-5 h-5" />
        </button>
      </div>

      <GameMenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onOpenHowToPlay={openHowToPlay}
        onQuit={() => {
          if (onExit) onExit();
        }}
        onReset={() => {
          endingRef.current = true;
          setGameStarted(false);
          setPhase('idle');
          setCells([]);
          endingRef.current = false;
          setIsSettingsOpen(true);
        }}
        resetButtonLabel="Reset Game"
        onOpenSettings={() => setIsSettingsOpen(true)}
        sessionInProgress={gameStarted && !isResultsOpen}
        settingsSummary={[
          { label: 'Patient', value: patientName },
          { label: 'Code length', value: <span className="text-rose-400 font-bold">{codeLength}</span> },
          {
            label: 'Flash',
            value: <span className="text-rose-400 font-bold">{patternMatchFlashLabel(flashMs)}</span>,
          },
          { label: 'Field', value: <span className="text-rose-400 font-bold">{cellCount}</span> },
          {
            label: 'Hardness',
            value: <span className="text-rose-400 font-bold">{patternMatchHardnessLabel(hardness)}</span>,
          },
          { label: 'Rounds', value: <span className="text-rose-400 font-bold">{roundsPerSession}</span> },
          {
            label: 'Time Limit',
            value:
              timeLimitSec > 0 ? (
                <span className="text-rose-400 font-bold">{timeLimitSec}s</span>
              ) : (
                <span className="text-emerald-400 font-bold">Off</span>
              ),
          },
        ]}
      />

      <HowToPlayManual
        moduleId="pattern_match"
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
        letterSize={letterSize}
        bubbleSize={80}
        showLetterSizeControl={false}
        showPatternMatchControls
        patternMatchCodeLength={codeLength}
        patternMatchFlashMs={flashMs}
        patternMatchCellCount={cellCount}
        patternMatchHardness={hardness}
        patternMatchRounds={roundsPerSession}
        patternMatchStimulusMode={stimulusMode}
        timeLimitSec={timeLimitSec}
        bgColor={engineBgColor}
        shapeColor={charColor}
        contrastSensitivity={contrastSensitivity}
        sampleSymbol={stimulusMode === 'compound' ? 'A3B' : '331'}
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
