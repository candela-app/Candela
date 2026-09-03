'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppliedClinicalSettings,
  ClinicalSettingsModal,
  DEFAULT_LOCATION_MEMORY_BG,
  DEFAULT_LOCATION_MEMORY_CHAR_COLOR,
  DEFAULT_LOCATION_MEMORY_EXPLORE_SEC,
  DEFAULT_LOCATION_MEMORY_GRID_SIZE,
  DEFAULT_LOCATION_MEMORY_LETTER_SIZE,
  DEFAULT_LOCATION_MEMORY_RECALL_SEC,
  DEFAULT_LOCATION_MEMORY_ROUNDS,
  LOCATION_MEMORY_MISMATCH_MS,
  clinicalColorSessionFields,
  getContrastAdjustedColor,
  buildLocationMemoryBoard,
  buildLocationMemoryPairsBoard,
  buildLocationMemoryRecallQueue,
  getDeviceTier,
  locationMemoryActiveCellsFromLevelId,
  locationMemoryDeviceDefaults,
  locationMemoryExploreLabel,
  locationMemoryGridLabel,
  locationMemoryModeFromLevelId,
  locationMemoryPairCount,
  locationMemoryRecallLabel,
  playOpenTapSoundAndHaptic,
  playWhooshSoundAndHaptic,
  requestFullScreenSafe,
  type LocationMemoryCell,
  type LocationMemorySessionResultData,
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
import styles from './LocationMemoryGame.module.css';

interface LocationMemoryGameProps {
  onExit?: () => void;
  levelId?: string;
}

type Phase = 'idle' | 'explore' | 'recall' | 'match';

function sessionPatientName(session: { user?: { name?: string | null } } | null | undefined): string {
  const name = session?.user?.name?.trim();
  return name && name.length > 0 ? name : 'Demo Patient';
}

export function LocationMemoryGame({ onExit, levelId = 'standard' }: LocationMemoryGameProps) {
  const { session } = useAuth();
  const deviceTier = useMemo(() => getDeviceTier(), []);
  const defaults = useMemo(() => locationMemoryDeviceDefaults(), []);
  const playMode = useMemo(() => locationMemoryModeFromLevelId(levelId), [levelId]);
  const isPairs = playMode === 'pairs';
  const levelActiveCells = useMemo(
    () => locationMemoryActiveCellsFromLevelId(levelId),
    [levelId],
  );
  const levelTitle = levelId === 'match' ? 'Match Pairs' : levelId === 'practice' ? 'Practice' : 'Full Grid';
  const levelHint = isPairs
    ? 'Tap a box to reveal it, then tap another. Matching numbers stay open — clear the whole board.'
    : levelId === 'practice'
      ? 'Open boxes one at a time to learn where each number lives — then find them all from memory.'
      : 'Explore the grid, then recall every number’s location.';

  const [gameStarted, setGameStarted] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const { showHowToPlay, howToPlayMode, isSettingsOpen, setIsSettingsOpen, finishHowToPlay, openHowToPlay, closeHowToPlay, playBlocked, isMenuOpen, setIsMenuOpen } = useHowToPlayGate();
  useGameSessionLock(true);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [resultsData, setResultsData] = useState<LocationMemorySessionResultData | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const [patientName, setPatientName] = useState(() => sessionPatientName(session));
  const [activeCells, setActiveCells] = useState(levelActiveCells || defaults.activeCells);
  const [gridSize, setGridSize] = useState(defaults.gridSize || DEFAULT_LOCATION_MEMORY_GRID_SIZE);
  const [roundsPerSession, setRoundsPerSession] = useState(defaults.rounds || DEFAULT_LOCATION_MEMORY_ROUNDS);
  const [exploreSec, setExploreSec] = useState(defaults.exploreSec ?? DEFAULT_LOCATION_MEMORY_EXPLORE_SEC);
  const [recallSec, setRecallSec] = useState(defaults.recallSec ?? DEFAULT_LOCATION_MEMORY_RECALL_SEC);
  const [letterSize, setLetterSize] = useState(defaults.letterSize || DEFAULT_LOCATION_MEMORY_LETTER_SIZE);
  const [engineBgColor, setEngineBgColor] = useState(DEFAULT_LOCATION_MEMORY_BG);
  const [charColor, setCharColor] = useState(DEFAULT_LOCATION_MEMORY_CHAR_COLOR);
  const [contrastSensitivity, setContrastSensitivity] = useState(1);
  const displayCharColor = getContrastAdjustedColor(charColor, engineBgColor, contrastSensitivity);

  const [currentRound, setCurrentRound] = useState(1);
  const [cells, setCells] = useState<LocationMemoryCell[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [flipIds, setFlipIds] = useState<string[]>([]);
  const [lockBoard, setLockBoard] = useState(false);
  const [recallQueue, setRecallQueue] = useState<number[]>([]);
  const [recallIndex, setRecallIndex] = useState(0);
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [exploreTimeLeft, setExploreTimeLeft] = useState(0);
  const [recallTimeLeft, setRecallTimeLeft] = useState(0);
  const [sessionTimeLeft, setSessionTimeLeft] = useState(0);
  const [exploredCount, setExploredCount] = useState(0);

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
  const exploredSetRef = useRef<Set<number>>(new Set());
  const mismatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statsRef = useRef({
    clicks: 0,
    correct: 0,
    wrong: 0,
    reactions: [] as number[],
    targetsConfigured: 0,
    roundsCompleted: 0,
  });
  const startTimeRef = useRef<number | null>(null);

  const sessionFrozen = playBlocked || isResultsOpen;
  usePauseShiftedClock(sessionFrozen, Boolean(gameStarted && startTime != null), (delta) => {
    setStartTime((prev) => (prev == null ? prev : prev + delta));
    if (startTimeRef.current != null) startTimeRef.current += delta;
  }, startTime);

  useEffect(() => {
    roundsPerSessionRef.current = roundsPerSession;
  }, [roundsPerSession]);

  useEffect(() => {
    setActiveCells(levelActiveCells);
  }, [levelActiveCells]);

  useEffect(() => {
    return () => {
      if (mismatchTimerRef.current) clearTimeout(mismatchTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!gameStarted || startTime == null || playBlocked || isMenuOpen || isResultsOpen) return;
    const id = setInterval(() => {
      setDurationSec(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [gameStarted, startTime, playBlocked, isMenuOpen, isResultsOpen]);

  const currentTarget = recallQueue[recallIndex] ?? null;
  const targetsRemaining = Math.max(0, recallQueue.length - recallIndex);
  const minExploresBeforeRecall = Math.min(activeCells, Math.max(1, Math.ceil(activeCells * 0.5)));
  const pairsTotal = useMemo(() => locationMemoryPairCount(cells), [cells]);
  const pairsFound = Math.floor(matchedIds.size / 2);
  const gridCols = gridSize;

  const finishSession = useCallback(
    (endedBy: 'cleared' | 'timeout') => {
      if (endingRef.current) return;
      endingRef.current = true;
      if (mismatchTimerRef.current) clearTimeout(mismatchTimerRef.current);
      const stats = statsRef.current;
      if (endedBy === 'timeout') {
        stats.roundsCompleted = Math.max(stats.roundsCompleted, currentRoundRef.current - 1);
      }
      const elapsed =
        startTimeRef.current != null
          ? Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000))
          : durationSec;

      const data: LocationMemorySessionResultData = {
        patientName,
        sessionId: Date.now(),
        date: new Date().toISOString(),
        gameName: 'Location Memory',
        stimuliCount: stats.targetsConfigured,
        letterSize,
        speed: isPairs
          ? recallSec > 0
            ? `${recallSec}s`
            : 'Untimed'
          : recallSec > 0
            ? `${recallSec}s/target`
            : 'Untimed',
        durationSec: elapsed,
        clicksTotal: stats.clicks,
        correct: stats.correct,
        ...buildSessionMetrics({
          correct: stats.correct,
          wrongTaps: stats.wrong,
          reactionMs: stats.reactions,
        }),
        activeCellsConfigured: isPairs ? cells.length : activeCells,
        targetsConfigured: stats.targetsConfigured,
        targetsFound: stats.correct,
        exploreSec: isPairs ? 0 : exploreSec,
        recallSecPerTarget: recallSec,
        roundsConfigured: roundsPerSessionRef.current,
        roundsCompleted: stats.roundsCompleted,
        playMode,
        endedBy,
        deviceTier,
        ...clinicalColorSessionFields(engineBgColor, charColor, contrastSensitivity),
      };
      setResultsData(data);
      setIsResultsOpen(true);
      setGameStarted(false);
      setPhase('idle');
    },
    [
      patientName,
      letterSize,
      recallSec,
      activeCells,
      exploreSec,
      deviceTier,
      durationSec,
      isPairs,
      playMode,
      cells.length,
      engineBgColor,
      charColor,
      contrastSensitivity,
    ],
  );

  const beginRecallPhase = useCallback(() => {
    setOpenIndex(null);
    const queue = buildLocationMemoryRecallQueue(cells);
    setRecallQueue(queue);
    setRecallIndex(0);
    setWrongIds(new Set());
    setMatchedIds(new Set());
    setPhase('recall');
    setTargetShownAt(Date.now());
    setRecallTimeLeft(recallSec > 0 ? recallSec : 0);
  }, [cells, recallSec]);

  const launchRound = useCallback(
    (round: number, resetSession = false) => {
      endingRef.current = false;
      if (mismatchTimerRef.current) clearTimeout(mismatchTimerRef.current);
      const board = isPairs
        ? buildLocationMemoryPairsBoard(gridSize)
        : buildLocationMemoryBoard(activeCells, gridSize);
      const targetCount = isPairs
        ? locationMemoryPairCount(board)
        : board.filter((c) => c.value != null).length;
      currentRoundRef.current = round;
      setCurrentRound(round);
      setCells(board);
      setOpenIndex(null);
      setFlipIds([]);
      setLockBoard(false);
      setExploredCount(0);
      exploredSetRef.current = new Set();
      setRecallQueue([]);
      setRecallIndex(0);
      setWrongIds(new Set());
      setMatchedIds(new Set());
      setIsSettingsOpen(false);
      setIsResultsOpen(false);
      setResultsData(null);
      setPhase(isPairs ? 'match' : 'explore');
      setGameStarted(true);
      setExploreTimeLeft(!isPairs && exploreSec > 0 ? exploreSec : 0);
      setSessionTimeLeft(isPairs && recallSec > 0 ? recallSec * Math.max(1, targetCount) : 0);
      setTargetShownAt(Date.now());

      if (resetSession) {
        statsRef.current = {
          clicks: 0,
          correct: 0,
          wrong: 0,
          reactions: [] as number[],
          targetsConfigured: targetCount,
          roundsCompleted: 0,
        };
        setClicks(0);
        setCorrectCount(0);
        setWrongCount(0);
        setReactionTimes([]);
        const now = Date.now();
        setStartTime(now);
        startTimeRef.current = now;
        setDurationSec(0);
      } else {
        statsRef.current.targetsConfigured += targetCount;
      }
    },
    [activeCells, exploreSec, gridSize, isPairs, recallSec],
  );

  const startGame = useCallback(() => {
    launchRound(1, true);
  }, [launchRound]);

  const onRoundComplete = useCallback(() => {
    statsRef.current.roundsCompleted = currentRoundRef.current;
    if (currentRoundRef.current >= roundsPerSessionRef.current) {
      finishSession('cleared');
      return;
    }
    playWhooshSoundAndHaptic();
    launchRound(currentRoundRef.current + 1, false);
  }, [finishSession, launchRound]);

  useEffect(() => {
    if (!gameStarted || phase !== 'explore' || exploreSec <= 0 || playBlocked) return;
    if (exploreTimeLeft <= 0) {
      beginRecallPhase();
      return;
    }
    const t = setTimeout(() => setExploreTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [gameStarted, phase, exploreSec, exploreTimeLeft, beginRecallPhase, playBlocked]);

  useEffect(() => {
    if (!gameStarted || phase !== 'recall' || recallSec <= 0 || playBlocked) return;
    if (recallTimeLeft <= 0) {
      finishSession('timeout');
      return;
    }
    const t = setTimeout(() => setRecallTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [gameStarted, phase, recallSec, recallTimeLeft, finishSession, playBlocked]);

  useEffect(() => {
    if (!gameStarted || phase !== 'match' || recallSec <= 0 || playBlocked) return;
    if (sessionTimeLeft <= 0) {
      finishSession('timeout');
      return;
    }
    const t = setTimeout(() => setSessionTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [gameStarted, phase, recallSec, sessionTimeLeft, finishSession, playBlocked]);

  const onExploreCell = useCallback(
    (cell: LocationMemoryCell) => {
      if (phase !== 'explore' || isResultsOpen) return;
      playOpenTapSoundAndHaptic();
      setOpenIndex(cell.index);
      if (!exploredSetRef.current.has(cell.index)) {
        exploredSetRef.current.add(cell.index);
        setExploredCount(exploredSetRef.current.size);
      }
    },
    [phase, isResultsOpen],
  );

  const onRecallCell = useCallback(
    (cell: LocationMemoryCell) => {
      if (phase !== 'recall' || currentTarget == null || isResultsOpen || matchedIds.has(cell.id)) return;
      const now = Date.now();
      statsRef.current.clicks += 1;
      setClicks(statsRef.current.clicks);

      if (cell.value === currentTarget) {
        playWhooshSoundAndHaptic();
        if (targetShownAt != null) {
          const rt = Math.max(0, Math.round(now - targetShownAt));
          statsRef.current.reactions.push(rt);
          setReactionTimes((prev) => [...prev, rt]);
        }
        statsRef.current.correct += 1;
        setCorrectCount(statsRef.current.correct);
        setMatchedIds((prev) => new Set(prev).add(cell.id));
        const nextIndex = recallIndex + 1;
        if (nextIndex >= recallQueue.length) {
          onRoundComplete();
          return;
        }
        setRecallIndex(nextIndex);
        setTargetShownAt(now);
        setRecallTimeLeft(recallSec > 0 ? recallSec : 0);
        setWrongIds(new Set());
        return;
      }

      playWhooshSoundAndHaptic();
      statsRef.current.wrong += 1;
      setWrongCount(statsRef.current.wrong);
      setWrongIds(new Set([cell.id]));
      setTimeout(() => setWrongIds(new Set()), 320);
    },
    [
      phase,
      currentTarget,
      isResultsOpen,
      matchedIds,
      targetShownAt,
      recallIndex,
      recallQueue.length,
      recallSec,
      onRoundComplete,
    ],
  );

  const onMatchCell = useCallback(
    (cell: LocationMemoryCell) => {
      if (phase !== 'match' || isResultsOpen || lockBoard || cell.value == null) return;
      if (matchedIds.has(cell.id) || flipIds.includes(cell.id)) return;

      const now = Date.now();
      statsRef.current.clicks += 1;
      setClicks(statsRef.current.clicks);

      if (flipIds.length === 0) {
        playOpenTapSoundAndHaptic();
        setFlipIds([cell.id]);
        setTargetShownAt(now);
        return;
      }

      if (flipIds.length === 1) {
        const firstId = flipIds[0]!;
        const first = cells.find((c) => c.id === firstId);
        const nextFlips = [firstId, cell.id];
        setFlipIds(nextFlips);

        if (!first || first.value !== cell.value) {
          playWhooshSoundAndHaptic();
          statsRef.current.wrong += 1;
          setWrongCount(statsRef.current.wrong);
          setWrongIds(new Set(nextFlips));
          setLockBoard(true);
          mismatchTimerRef.current = setTimeout(() => {
            setFlipIds([]);
            setWrongIds(new Set());
            setLockBoard(false);
            setTargetShownAt(Date.now());
          }, LOCATION_MEMORY_MISMATCH_MS);
          return;
        }

        playWhooshSoundAndHaptic();
        if (targetShownAt != null) {
          const rt = Math.max(0, Math.round(now - targetShownAt));
          statsRef.current.reactions.push(rt);
          setReactionTimes((prev) => [...prev, rt]);
        }
        statsRef.current.correct += 1;
        setCorrectCount(statsRef.current.correct);
        const nextMatched = new Set(matchedIds);
        nextMatched.add(firstId);
        nextMatched.add(cell.id);
        setMatchedIds(nextMatched);
        setFlipIds([]);
        setTargetShownAt(Date.now());

        const remaining = cells.filter((c) => c.value != null && !nextMatched.has(c.id));
        if (remaining.length === 0) {
          onRoundComplete();
        }
      }
    },
    [phase, isResultsOpen, lockBoard, matchedIds, flipIds, cells, targetShownAt, onRoundComplete],
  );

  const commitSettings = useCallback((newSettings: AppliedClinicalSettings) => {
    setPatientName(newSettings.patientName);
    if (newSettings.letterSize != null) setLetterSize(newSettings.letterSize);
    if (newSettings.bgColor) setEngineBgColor(newSettings.bgColor);
    if (newSettings.shapeColor) setCharColor(newSettings.shapeColor);
    if (newSettings.contrastSensitivity != null) setContrastSensitivity(newSettings.contrastSensitivity);
    if (newSettings.locationMemoryActiveCells != null) setActiveCells(newSettings.locationMemoryActiveCells);
    if (newSettings.locationMemoryGridSize != null) setGridSize(newSettings.locationMemoryGridSize);
    if (newSettings.locationMemoryRounds != null) setRoundsPerSession(newSettings.locationMemoryRounds);
    if (newSettings.locationMemoryExploreSec != null) setExploreSec(newSettings.locationMemoryExploreSec);
    if (newSettings.locationMemoryRecallSec != null) setRecallSec(newSettings.locationMemoryRecallSec);
  }, []);

  const canBeginRecall = exploredCount >= minExploresBeforeRecall || exploreSec <= 0;

  const renderCellContent = (cell: LocationMemoryCell) => {
    if (phase === 'explore') {
      const isOpen = openIndex === cell.index;
      if (!isOpen) return <span className={styles.cellClosedLabel}>?</span>;
      if (cell.value == null) return <span className={styles.cellClosedLabel}>—</span>;
      return cell.value;
    }
    if (phase === 'match') {
      const revealed = matchedIds.has(cell.id) || flipIds.includes(cell.id);
      if (!revealed) return <span className={styles.cellClosedLabel}>?</span>;
      if (cell.value == null) return <span className={styles.cellClosedLabel}>—</span>;
      return cell.value;
    }
    if (matchedIds.has(cell.id) && cell.value != null) return cell.value;
    return <span className={styles.cellClosedLabel}>?</span>;
  };

  const avgReactionMs =
    reactionTimes.length > 0
      ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
      : 0;

  return (
    <div className={styles.shell} style={{ backgroundColor: engineBgColor }}>
      {notification ? <div className={styles.notification}>{notification}</div> : null}

      {!gameStarted && !showHowToPlay && !isSettingsOpen && !isResultsOpen ? (
        <ClickToStartOverlay
          title={`Location Memory — ${levelTitle}`}
          hint={levelHint}
          onStart={startGame}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onExit={onExit}
        />
      ) : null}

      <div className={styles.playField}>
        {gameStarted && phase === 'explore' ? (
          <>
            <p className={styles.phaseBanner}>
              Explore — tap boxes to peek (one open at a time)
              {exploreSec > 0 ? ` · ${exploreTimeLeft}s` : ''}
            </p>
            <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}>
              {cells.map((cell) => {
                const isOpen = openIndex === cell.index;
                const isExplored = !isOpen && exploredSetRef.current.has(cell.index);
                return (
                  <button
                    key={cell.id}
                    type="button"
                    className={`${styles.cell} ${isOpen ? styles.cellOpen : ''} ${isExplored ? styles.cellExplored : ''} ${cell.value == null ? styles.cellBlank : ''}`}
                    style={{
                      fontSize: `${letterSize * (isOpen ? 2.15 : 1.75)}rem`,
                      color: isOpen ? '#0F172A' : displayCharColor,
                    }}
                    onClick={() => onExploreCell(cell)}
                    aria-pressed={isOpen}
                    aria-label={
                      isOpen
                        ? cell.value != null
                          ? `Open box, number ${cell.value}`
                          : 'Open box, blank'
                        : isExplored
                          ? 'Explored box'
                          : 'Closed box'
                    }
                  >
                    {renderCellContent(cell)}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className={styles.beginRecallBtn}
              disabled={!canBeginRecall}
              onClick={beginRecallPhase}
            >
              Begin Recall ({exploredCount}/{activeCells} explored)
            </button>
          </>
        ) : null}

        {gameStarted && phase === 'recall' && currentTarget != null ? (
          <>
            <p className={styles.phaseBanner}>
              Round {currentRound}/{roundsPerSession} · Find this number
              {recallSec > 0 ? ` · ${recallTimeLeft}s` : ''}
            </p>
            <p className={styles.recallTarget} style={{ fontSize: `${letterSize * 2.4}rem` }}>
              {currentTarget}
            </p>
            <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}>
              {cells.map((cell) => (
                <button
                  key={cell.id}
                  type="button"
                  className={`${styles.cell} ${wrongIds.has(cell.id) ? styles.cellWrong : ''} ${matchedIds.has(cell.id) ? styles.cellCorrect : ''}`}
                  style={{ fontSize: `${letterSize * 1.75}rem`, color: displayCharColor }}
                  onClick={() => onRecallCell(cell)}
                  disabled={matchedIds.has(cell.id)}
                >
                  {renderCellContent(cell)}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {gameStarted && phase === 'match' ? (
          <>
            <p className={styles.phaseBanner}>
              Round {currentRound}/{roundsPerSession} · Match pairs
              {sessionTimeLeft > 0 ? ` · ${sessionTimeLeft}s` : ''}
            </p>
            <div
              className={styles.grid}
              style={{
                gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
                width: 'min(88vmin, 94vw)',
              }}
            >
              {cells.map((cell) => {
                const revealed = matchedIds.has(cell.id) || flipIds.includes(cell.id);
                const isWrong = wrongIds.has(cell.id);
                const isMatched = matchedIds.has(cell.id);
                return (
                  <button
                    key={cell.id}
                    type="button"
                    className={`${styles.cell} ${revealed && !isWrong && !isMatched ? styles.cellOpen : ''} ${isWrong ? styles.cellWrong : ''} ${isMatched ? styles.cellCorrect : ''} ${cell.value == null ? styles.cellBlank : ''}`}
                    style={{
                      fontSize: `${letterSize * (revealed ? 1.75 : 1.4)}rem`,
                      color: revealed && !isWrong && !isMatched ? '#0F172A' : displayCharColor,
                    }}
                    onClick={() => onMatchCell(cell)}
                    disabled={matchedIds.has(cell.id) || lockBoard || cell.value == null}
                  >
                    {renderCellContent(cell)}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}
      </div>

      {gameStarted ? (
        <div className={styles.hud}>
          <span className={styles.hudText}>
            {phase === 'match'
              ? `${pairsFound}/${pairsTotal} pairs · ${wrongCount} misses`
              : phase === 'recall'
                ? `${targetsRemaining} left · ${correctCount} found${wrongCount > 0 ? ` · ${wrongCount} misses` : ''}`
                : `Explored ${exploredCount}/${activeCells}`}
          </span>
          <span className={styles.hudAccent}>{durationSec}s</span>
        </div>
      ) : null}

      <div className="absolute bottom-5 right-4 z-20 flex items-center gap-2">
        <FullscreenToggleButton />
        <button type="button" className={styles.menuFab} onClick={() => setIsMenuOpen(true)} aria-label="Menu">
          <SlidersIcon className="w-6 h-6" />
        </button>
      </div>

      <GameMenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onOpenHowToPlay={openHowToPlay}
        onQuit={() => onExit?.()}
        onReset={() => {
          endingRef.current = true;
          if (mismatchTimerRef.current) clearTimeout(mismatchTimerRef.current);
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
          { label: 'Level', value: levelTitle },
          { label: 'Grid', value: locationMemoryGridLabel(gridSize) },
          ...(isPairs
            ? [{ label: 'Mode', value: 'Match pairs' }]
            : [
                { label: 'Active cells', value: String(activeCells) },
                { label: 'Explore', value: locationMemoryExploreLabel(exploreSec) },
              ]),
          { label: isPairs ? 'Session timer' : 'Recall / target', value: locationMemoryRecallLabel(recallSec) },
          { label: 'Rounds', value: String(roundsPerSession) },
        ]}
      />

      <HowToPlayManual
        moduleId="location_memory"
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
          commitSettings(newSettings);
          setNotification('Settings Applied Successfully!');
          setTimeout(() => setNotification(null), 2500);
          setIsSettingsOpen(false);
          requestFullScreenSafe();
          if (wasPlaying) startGame();
        }}
        patientName={patientName}
        letterSize={letterSize}
        bubbleSize={80}
        showLetterSizeControl={false}
        showLocationMemoryControls
        locationMemoryActiveCells={activeCells}
        locationMemoryGridSize={gridSize}
        locationMemoryRounds={roundsPerSession}
        locationMemoryExploreSec={exploreSec}
        locationMemoryRecallSec={recallSec}
        bgColor={engineBgColor}
        shapeColor={charColor}
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
            onExit?.();
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
