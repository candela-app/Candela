import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DEFAULT_LOCATION_MEMORY_BG,
  DEFAULT_LOCATION_MEMORY_CHAR_COLOR,
  DEFAULT_LOCATION_MEMORY_EXPLORE_SEC,
  DEFAULT_LOCATION_MEMORY_GRID_SIZE,
  DEFAULT_LOCATION_MEMORY_LETTER_SIZE,
  DEFAULT_LOCATION_MEMORY_RECALL_SEC,
  DEFAULT_LOCATION_MEMORY_ROUNDS,
  LOCATION_MEMORY_MISMATCH_MS,
  buildLocationMemoryBoard,
  buildLocationMemoryPairsBoard,
  buildLocationMemoryRecallQueue,
  getDeviceTier,
  locationMemoryAccuracy,
  locationMemoryActiveCellsFromLevelId,
  locationMemoryDeviceDefaults,
  locationMemoryExploreLabel,
  locationMemoryGridLabel,
  locationMemoryModeFromLevelId,
  locationMemoryPairCount,
  locationMemoryRecallLabel,
  reactionStatsFromMs,
  type LocationMemoryCell,
  type LocationMemorySessionResultData,
  useHowToPlayGate,
  usePauseShiftedClock,
} from '@candela/shared/rn';
import { ClinicalSettingsModal, type AppliedClinicalSettings } from '../components/ClinicalSettingsModal';
import { HowToPlayManual } from '../components/HowToPlayManual';
import { ClickToStartOverlay } from '../components/ClickToStartOverlay';
import { GameMenuDrawer } from '../components/GameMenuDrawer';
import { GameResultsModal } from '../components/GameResultsModal';
import { SlidersIcon } from '../components/icons';
import { sessionDisplayName, useAuth } from '../lib/auth-context';
import { hapticCorrect, hapticOpen, hapticWrong } from '../lib/haptics';
import { useLayout } from '../lib/layout';
import { useGameSessionLock } from '../lib/use-game-session-lock';

type Phase = 'idle' | 'explore' | 'recall' | 'match';

export function LocationMemoryGame({
  onExit,
  levelId = 'standard',
}: {
  onExit?: () => void;
  levelId?: string;
}) {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const { width, s, fs } = useLayout();
  const deviceTier = useMemo(() => getDeviceTier(width), [width]);
  const defaults = useMemo(() => locationMemoryDeviceDefaults(), []);
  const playMode = useMemo(() => locationMemoryModeFromLevelId(levelId), [levelId]);
  const isPairs = playMode === 'pairs';
  const levelActiveCells = useMemo(() => locationMemoryActiveCellsFromLevelId(levelId), [levelId]);
  const levelTitle = levelId === 'match' ? 'Match Pairs' : levelId === 'practice' ? 'Practice' : 'Full Grid';
  const levelHint = isPairs
    ? 'Tap one box, then another. Matching numbers stay open — clear every pair.'
    : levelId === 'practice'
      ? 'Explore numbered boxes one at a time, then recall each location.'
      : 'Explore the grid one cell at a time, then find every number from memory.';
  const { requestExit } = useGameSessionLock(onExit);

  const [gameStarted, setGameStarted] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const { showHowToPlay, howToPlayMode, isSettingsOpen, setIsSettingsOpen, finishHowToPlay, openHowToPlay, closeHowToPlay, playBlocked, isMenuOpen, setIsMenuOpen } = useHowToPlayGate();
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [resultsData, setResultsData] = useState<LocationMemorySessionResultData | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const [patientName, setPatientName] = useState(() => sessionDisplayName(session));
  const [activeCells, setActiveCells] = useState(levelActiveCells);
  const [gridSize, setGridSize] = useState(defaults.gridSize || DEFAULT_LOCATION_MEMORY_GRID_SIZE);
  const [roundsPerSession, setRoundsPerSession] = useState(defaults.rounds || DEFAULT_LOCATION_MEMORY_ROUNDS);
  const [exploreSec, setExploreSec] = useState(defaults.exploreSec ?? DEFAULT_LOCATION_MEMORY_EXPLORE_SEC);
  const [recallSec, setRecallSec] = useState(defaults.recallSec ?? DEFAULT_LOCATION_MEMORY_RECALL_SEC);
  const [letterSize, setLetterSize] = useState(defaults.letterSize || DEFAULT_LOCATION_MEMORY_LETTER_SIZE);
  const [engineBgColor, setEngineBgColor] = useState(DEFAULT_LOCATION_MEMORY_BG);
  const [charColor, setCharColor] = useState(DEFAULT_LOCATION_MEMORY_CHAR_COLOR);

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
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
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

  const currentTarget = recallQueue[recallIndex] ?? null;
  const targetsRemaining = Math.max(0, recallQueue.length - recallIndex);
  const minExploresBeforeRecall = Math.min(activeCells, Math.max(1, Math.ceil(activeCells * 0.5)));
  const gridCols = gridSize;
  const gridGap = s(8);
  const boardWidth = Math.min(width - s(32), isPairs ? width - s(28) : s(400));
  const cellSize = Math.max(
    s(48),
    (boardWidth - gridGap * Math.max(0, gridCols - 1)) / Math.max(1, gridCols),
  );
  const pairsTotal = useMemo(() => locationMemoryPairCount(cells), [cells]);
  const pairsFound = Math.floor(matchedIds.size / 2);

  const cellRows = useMemo(() => {
    const rows: LocationMemoryCell[][] = [];
    for (let r = 0; r < gridCols; r++) {
      rows.push(cells.slice(r * gridCols, r * gridCols + gridCols));
    }
    return rows;
  }, [cells, gridCols]);

  const gridShellStyle = {
    width: boardWidth,
    alignSelf: 'center' as const,
    gap: gridGap,
  };
  const gridRowStyle = {
    flexDirection: 'row' as const,
    gap: gridGap,
    width: boardWidth,
  };

  useEffect(() => {
    if (!gameStarted || startTime == null || playBlocked || isMenuOpen || isResultsOpen) return;
    const id = setInterval(() => setDurationSec(Math.max(0, Math.floor((Date.now() - startTime) / 1000))), 1000);
    return () => clearInterval(id);
  }, [gameStarted, startTime, playBlocked, isMenuOpen, isResultsOpen]);

  const finishSession = useCallback(
    (endedBy: 'cleared' | 'timeout') => {
      if (endingRef.current) return;
      endingRef.current = true;
      if (mismatchTimerRef.current) clearTimeout(mismatchTimerRef.current);
      const stats = statsRef.current;
      if (endedBy === 'timeout') {
        stats.roundsCompleted = Math.max(stats.roundsCompleted, currentRoundRef.current - 1);
      }
      const reaction = reactionStatsFromMs(stats.reactions);
      const elapsed =
        startTimeRef.current != null
          ? Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000))
          : durationSec;

      setResultsData({
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
        wrong: stats.wrong,
        accuracy: locationMemoryAccuracy(stats.correct, stats.wrong),
        avgReactionSec: reaction.avgSec,
        medianReactionSec: reaction.medianSec,
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
      });
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
      setIsSettingsOpen(false);
      setPhase(isPairs ? 'match' : 'explore');
      setGameStarted(true);
      setExploreTimeLeft(!isPairs && exploreSec > 0 ? exploreSec : 0);
      setSessionTimeLeft(isPairs && recallSec > 0 ? recallSec * Math.max(1, targetCount) : 0);
      setMatchedIds(new Set());
      setWrongIds(new Set());
      setTargetShownAt(Date.now());

      if (resetSession) {
        statsRef.current = {
          clicks: 0,
          correct: 0,
          wrong: 0,
          reactions: [],
          targetsConfigured: targetCount,
          roundsCompleted: 0,
        };
        setCorrectCount(0);
        setWrongCount(0);
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

  const startGame = useCallback(() => launchRound(1, true), [launchRound]);

  const onRoundComplete = useCallback(() => {
    statsRef.current.roundsCompleted = currentRoundRef.current;
    if (currentRoundRef.current >= roundsPerSessionRef.current) {
      finishSession('cleared');
      return;
    }
    hapticCorrect();
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

  const onExploreCell = (cell: LocationMemoryCell) => {
    if (phase !== 'explore' || isResultsOpen) return;
    void hapticOpen();
    setOpenIndex(cell.index);
    if (!exploredSetRef.current.has(cell.index)) {
      exploredSetRef.current.add(cell.index);
      setExploredCount(exploredSetRef.current.size);
    }
  };

  const onRecallCell = (cell: LocationMemoryCell) => {
    if (phase !== 'recall' || currentTarget == null || isResultsOpen || matchedIds.has(cell.id)) return;
    const now = Date.now();
    statsRef.current.clicks += 1;
    if (cell.value === currentTarget) {
      hapticCorrect();
      if (targetShownAt != null) statsRef.current.reactions.push(Math.max(0, now - targetShownAt));
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
    hapticWrong();
    statsRef.current.wrong += 1;
    setWrongCount(statsRef.current.wrong);
    setWrongIds(new Set([cell.id]));
    setTimeout(() => setWrongIds(new Set()), 320);
  };

  const onMatchCell = (cell: LocationMemoryCell) => {
    if (phase !== 'match' || isResultsOpen || lockBoard || cell.value == null) return;
    if (matchedIds.has(cell.id) || flipIds.includes(cell.id)) return;

    const now = Date.now();
    statsRef.current.clicks += 1;

    if (flipIds.length === 0) {
      void hapticOpen();
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
        hapticWrong();
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

      hapticCorrect();
      if (targetShownAt != null) statsRef.current.reactions.push(Math.max(0, now - targetShownAt));
      statsRef.current.correct += 1;
      setCorrectCount(statsRef.current.correct);
      const nextMatched = new Set(matchedIds);
      nextMatched.add(firstId);
      nextMatched.add(cell.id);
      setMatchedIds(nextMatched);
      setFlipIds([]);
      setTargetShownAt(Date.now());

      if (cells.filter((c) => c.value != null && !nextMatched.has(c.id)).length === 0) {
        onRoundComplete();
      }
    }
  };

  const commitSettings = (settings: AppliedClinicalSettings) => {
    setPatientName(settings.patientName);
    if (settings.letterSize != null) setLetterSize(settings.letterSize);
    if (settings.bgColor) setEngineBgColor(settings.bgColor);
    if (settings.shapeColor) setCharColor(settings.shapeColor);
    if (settings.locationMemoryActiveCells != null) setActiveCells(settings.locationMemoryActiveCells);
    if (settings.locationMemoryGridSize != null) setGridSize(settings.locationMemoryGridSize);
    if (settings.locationMemoryRounds != null) {
      setRoundsPerSession(settings.locationMemoryRounds);
      roundsPerSessionRef.current = settings.locationMemoryRounds;
    }
    if (settings.locationMemoryExploreSec != null) setExploreSec(settings.locationMemoryExploreSec);
    if (settings.locationMemoryRecallSec != null) setRecallSec(settings.locationMemoryRecallSec);
  };

  const renderCell = (cell: LocationMemoryCell) => {
    if (phase === 'explore') {
      if (openIndex !== cell.index) return '?';
      if (cell.value == null) return '—';
      return String(cell.value);
    }
    if (phase === 'match') {
      const revealed = matchedIds.has(cell.id) || flipIds.includes(cell.id);
      if (!revealed) return '?';
      if (cell.value == null) return '—';
      return String(cell.value);
    }
    if (matchedIds.has(cell.id) && cell.value != null) return String(cell.value);
    return '?';
  };

  const canBeginRecall = exploredCount >= minExploresBeforeRecall || exploreSec <= 0;

  return (
    <View style={{ flex: 1, backgroundColor: engineBgColor, paddingTop: insets.top }}>
      {notification ? (
        <View
          style={{
            position: 'absolute',
            top: insets.top + 12,
            right: 16,
            zIndex: 50,
            backgroundColor: 'rgba(5,150,105,0.92)',
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: fs(13) }}>{notification}</Text>
        </View>
      ) : null}

      {!gameStarted && !showHowToPlay && !isSettingsOpen && !isResultsOpen ? (
        <ClickToStartOverlay
          title={`Location Memory — ${levelTitle}`}
          hint={levelHint}
          onStart={startGame}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onExit={requestExit}
        />
      ) : null}

      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: s(16), paddingBottom: s(88) }}>
        {gameStarted && phase === 'explore' ? (
          <>
            <Text style={{ color: 'rgba(248,250,252,0.6)', textAlign: 'center', fontWeight: '800', letterSpacing: 1, fontSize: fs(12), marginBottom: s(12) }}>
              EXPLORE — one box open at a time{exploreSec > 0 ? ` · ${exploreTimeLeft}s` : ''}
            </Text>
            <View style={gridShellStyle}>
              {cellRows.map((row, rowIdx) => (
                <View key={`explore-row-${rowIdx}`} style={gridRowStyle}>
                  {row.map((cell) => {
                    const isOpen = openIndex === cell.index;
                    const isExplored = !isOpen && exploredSetRef.current.has(cell.index);
                    return (
                      <Pressable
                        key={cell.id}
                        onPress={() => onExploreCell(cell)}
                        style={{
                          width: cellSize,
                          height: cellSize,
                          borderRadius: 14,
                          borderWidth: isOpen ? 4 : isExplored ? 3 : 2,
                          borderColor: isOpen ? '#FACC15' : isExplored ? '#38BDF8' : '#CBD5E1',
                          backgroundColor: isOpen
                            ? '#FACC15'
                            : isExplored
                              ? 'rgba(14,116,144,0.85)'
                              : '#FFFFFF',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: cell.value == null && !isOpen ? 0.75 : 1,
                          transform: [{ scale: isOpen ? 1.06 : 1 }],
                          shadowColor: '#0F172A',
                          shadowOpacity: isOpen ? 0.35 : 0.18,
                          shadowRadius: isOpen ? 12 : 4,
                          elevation: isOpen ? 8 : 3,
                        }}
                      >
                        <Text
                          style={{
                            color: isOpen ? '#0F172A' : isExplored ? '#F8FAFC' : '#0F172A',
                            fontWeight: '900',
                            fontSize: fs(letterSize * (isOpen ? 22 : 16)),
                          }}
                        >
                          {renderCell(cell)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
            <Pressable
              onPress={beginRecallPhase}
              disabled={!canBeginRecall}
              style={{
                marginTop: s(20),
                alignSelf: 'center',
                backgroundColor: canBeginRecall ? '#F59E0B' : '#78716C',
                paddingHorizontal: s(20),
                paddingVertical: s(12),
                borderRadius: 12,
              }}
            >
              <Text style={{ color: '#0F172A', fontWeight: '800', fontSize: fs(13) }}>
                Begin Recall ({exploredCount}/{activeCells})
              </Text>
            </Pressable>
          </>
        ) : null}

        {gameStarted && phase === 'recall' && currentTarget != null ? (
          <>
            <Text style={{ color: 'rgba(248,250,252,0.6)', textAlign: 'center', fontWeight: '800', letterSpacing: 1, fontSize: fs(12), marginBottom: s(8) }}>
              Round {currentRound}/{roundsPerSession} · FIND{recallSec > 0 ? ` · ${recallTimeLeft}s` : ''}
            </Text>
            <Text
              style={{
                color: '#0F172A',
                backgroundColor: '#FACC15',
                overflow: 'hidden',
                textAlign: 'center',
                fontWeight: '900',
                fontSize: fs(letterSize * 34),
                marginBottom: s(16),
                alignSelf: 'center',
                paddingHorizontal: s(18),
                paddingVertical: s(8),
                borderRadius: 16,
                borderWidth: 3,
                borderColor: '#0F172A',
                minWidth: s(72),
              }}
            >
              {currentTarget}
            </Text>
            <View style={gridShellStyle}>
              {cellRows.map((row, rowIdx) => (
                <View key={`recall-row-${rowIdx}`} style={gridRowStyle}>
                  {row.map((cell) => {
                    const isWrong = wrongIds.has(cell.id);
                    const isMatched = matchedIds.has(cell.id);
                    return (
                      <Pressable
                        key={cell.id}
                        onPress={() => onRecallCell(cell)}
                        disabled={matchedIds.has(cell.id)}
                        style={{
                          width: cellSize,
                          height: cellSize,
                          borderRadius: 14,
                          borderWidth: isWrong || isMatched ? 4 : 2,
                          borderColor: isWrong ? '#FB7185' : isMatched ? '#34D399' : '#CBD5E1',
                          backgroundColor: isWrong
                            ? 'rgba(127,29,29,0.85)'
                            : isMatched
                              ? 'rgba(6,78,59,0.85)'
                              : '#FFFFFF',
                          alignItems: 'center',
                          justifyContent: 'center',
                          shadowColor: '#0F172A',
                          shadowOpacity: 0.18,
                          shadowRadius: 4,
                          elevation: 3,
                        }}
                      >
                        <Text
                          style={{
                            color: isWrong || isMatched ? '#F8FAFC' : '#0F172A',
                            fontWeight: '900',
                            fontSize: fs(letterSize * 16),
                          }}
                        >
                          {renderCell(cell)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </>
        ) : null}

        {gameStarted && phase === 'match' ? (
          <>
            <Text style={{ color: 'rgba(248,250,252,0.6)', textAlign: 'center', fontWeight: '800', letterSpacing: 1, fontSize: fs(12), marginBottom: s(12) }}>
              Round {currentRound}/{roundsPerSession} · MATCH PAIRS
              {sessionTimeLeft > 0 ? ` · ${sessionTimeLeft}s` : ''}
            </Text>
            <View style={gridShellStyle}>
              {cellRows.map((row, rowIdx) => (
                <View key={`match-row-${rowIdx}`} style={gridRowStyle}>
                  {row.map((cell) => {
                    const revealed = matchedIds.has(cell.id) || flipIds.includes(cell.id);
                    const isWrong = wrongIds.has(cell.id);
                    const isMatched = matchedIds.has(cell.id);
                    const isOpenReveal = revealed && !isWrong && !isMatched;
                    return (
                      <Pressable
                        key={cell.id}
                        onPress={() => onMatchCell(cell)}
                        disabled={matchedIds.has(cell.id) || lockBoard || cell.value == null}
                        style={{
                          width: cellSize,
                          height: cellSize,
                          borderRadius: 14,
                          borderWidth: isOpenReveal || isWrong || isMatched ? 4 : 2,
                          borderColor: isWrong
                            ? '#FB7185'
                            : isMatched
                              ? '#34D399'
                              : isOpenReveal
                                ? '#FACC15'
                                : '#CBD5E1',
                          backgroundColor: isWrong
                            ? 'rgba(127,29,29,0.85)'
                            : isMatched
                              ? 'rgba(6,78,59,0.85)'
                              : isOpenReveal
                                ? '#FACC15'
                                : '#FFFFFF',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: cell.value == null ? 0.7 : 1,
                          transform: [{ scale: isOpenReveal ? 1.04 : 1 }],
                          shadowColor: '#0F172A',
                          shadowOpacity: 0.18,
                          shadowRadius: 4,
                          elevation: 3,
                        }}
                      >
                        <Text
                          style={{
                            color: isWrong || isMatched ? '#F8FAFC' : '#0F172A',
                            fontWeight: '900',
                            fontSize: fs(letterSize * (isOpenReveal ? 18 : 15)),
                          }}
                        >
                          {renderCell(cell)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </>
        ) : null}
      </View>

      {gameStarted ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: insets.top, left: 0, right: 0, padding: 12, flexDirection: 'row', justifyContent: 'space-between' }}
        >
          <Text style={{ color: 'rgba(226,232,240,0.85)', fontWeight: '600', fontSize: fs(12) }}>
            {phase === 'match'
              ? `${pairsFound}/${pairsTotal} pairs · ${wrongCount} misses`
              : phase === 'recall'
                ? `${targetsRemaining} left · ${correctCount} found${wrongCount > 0 ? ` · ${wrongCount} wrong` : ''}`
                : `Explored ${exploredCount}/${activeCells}`}
          </Text>
          <Text style={{ color: '#FBBF24', fontWeight: '800', fontSize: fs(12) }}>{durationSec}s</Text>
        </View>
      ) : null}

      <Pressable onPress={() => setIsMenuOpen(true)} style={{ position: 'absolute', bottom: insets.bottom + 20, right: 16, padding: 10 }}>
        <SlidersIcon size={22} color="#cbd5e1" />
      </Pressable>

      <GameMenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onOpenHowToPlay={openHowToPlay}
        onQuit={requestExit}
        onReset={() => {
          if (mismatchTimerRef.current) clearTimeout(mismatchTimerRef.current);
          setGameStarted(false);
          setPhase('idle');
          setCells([]);
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
                { label: 'Cells', value: String(activeCells) },
                { label: 'Explore', value: locationMemoryExploreLabel(exploreSec) },
              ]),
          { label: isPairs ? 'Timer' : 'Recall', value: locationMemoryRecallLabel(recallSec) },
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
        onApply={(settings) => {
          const wasPlaying = gameStarted && !isResultsOpen;
          commitSettings(settings);
          setNotification('Settings Applied Successfully!');
          setTimeout(() => setNotification(null), 2500);
          setIsSettingsOpen(false);
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
