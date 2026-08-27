import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DEFAULT_PATTERN_MATCH_BG,
  DEFAULT_PATTERN_MATCH_CELL_COUNT,
  DEFAULT_PATTERN_MATCH_CHAR_COLOR,
  DEFAULT_PATTERN_MATCH_CODE_LENGTH,
  DEFAULT_PATTERN_MATCH_FLASH_MS,
  DEFAULT_PATTERN_MATCH_HARDNESS,
  DEFAULT_PATTERN_MATCH_LETTER_SIZE,
  DEFAULT_PATTERN_MATCH_ROUNDS,
  DEFAULT_PATTERN_MATCH_TIME_LIMIT_SEC,
  buildPatternMatchField,
  generatePatternMatchTarget,
  getDeviceTier,
  patternMatchAccuracy,
  patternMatchDeviceDefaults,
  patternMatchFlashLabel,
  patternMatchHardnessLabel,
  patternMatchStimulusFromLevelId,
  reactionStatsFromMs,
  type PatternMatchCell,
  type PatternMatchHardness,
  type PatternMatchSessionResultData,
  type PatternMatchStimulusMode,
} from '@candela/shared/rn';
import { ClinicalSettingsModal, type AppliedClinicalSettings } from '../components/ClinicalSettingsModal';
import { ClickToStartOverlay } from '../components/ClickToStartOverlay';
import { GameMenuDrawer } from '../components/GameMenuDrawer';
import { GameResultsModal } from '../components/GameResultsModal';
import { SlidersIcon } from '../components/icons';
import { sessionDisplayName, useAuth } from '../lib/auth-context';
import { hapticCorrect, hapticWrong } from '../lib/haptics';
import { useLayout } from '../lib/layout';
import { useGameSessionLock } from '../lib/use-game-session-lock';

type Phase = 'idle' | 'encode' | 'search';

export function PatternMatchGame({
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
  const defaults = useMemo(() => patternMatchDeviceDefaults(), []);
  const stimulusMode = useMemo(
    () => patternMatchStimulusFromLevelId(levelId) as PatternMatchStimulusMode,
    [levelId],
  );
  const levelTitle = 'Hold the Code';
  const levelHint =
    stimulusMode === 'compound'
      ? 'Compound — memorize the letter–number code, then tap every exact match.'
      : 'Standard — memorize the flashed code, then tap every exact match. Near-miss codes are wrong.';
  const { requestExit } = useGameSessionLock(onExit);

  const [gameStarted, setGameStarted] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [resultsData, setResultsData] = useState<PatternMatchSessionResultData | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const [patientName, setPatientName] = useState(() => sessionDisplayName(session));
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

  const [currentRound, setCurrentRound] = useState(1);
  const [targetCode, setTargetCode] = useState('');
  const [cells, setCells] = useState<PatternMatchCell[]>([]);
  const [poppingIds, setPoppingIds] = useState<Set<string>>(new Set());
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
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
  const encodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    roundsPerSessionRef.current = roundsPerSession;
  }, [roundsPerSession]);

  const remainingMatches = useMemo(
    () => cells.filter((c) => c.isMatch && !poppingIds.has(c.id)).length,
    [cells, poppingIds],
  );

  useEffect(() => {
    return () => {
      if (encodeTimerRef.current) clearTimeout(encodeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!gameStarted || startTime == null || phase !== 'search' || isSettingsOpen || isMenuOpen || isResultsOpen) {
      return;
    }
    const id = setInterval(() => {
      setDurationSec(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [gameStarted, startTime, phase, isSettingsOpen, isMenuOpen, isResultsOpen]);

  const finishSession = useCallback(
    (endedBy: 'cleared' | 'timeout') => {
      if (endingRef.current) return;
      endingRef.current = true;
      const stats = statsRef.current;
      if (endedBy === 'timeout') {
        stats.roundsCompleted = Math.max(stats.roundsCompleted, currentRoundRef.current);
      }
      const reaction = reactionStatsFromMs(stats.reactions);
      const elapsed =
        startTimeRef.current != null
          ? Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000))
          : durationSec;

      const data: PatternMatchSessionResultData = {
        patientName,
        sessionId: Date.now(),
        date: new Date().toISOString(),
        gameName: 'Hold the Code',
        stimuliCount: stats.matchesConfigured,
        letterSize,
        speed: timeLimitSec > 0 ? `${timeLimitSec}s` : 'Untimed',
        durationSec: elapsed,
        clicksTotal: stats.clicks,
        correct: stats.correct,
        wrong: stats.wrong,
        accuracy: patternMatchAccuracy(stats.correct, stats.wrong),
        avgReactionSec: reaction.avgSec,
        medianReactionSec: reaction.medianSec,
        targetCode: stats.targetCode,
        codeLength,
        matchesConfigured: stats.matchesConfigured,
        matchesFound: stats.correct,
        matchesRemaining: Math.max(0, stats.matchesConfigured - stats.correct),
        flashMs,
        timeLimitSec,
        roundsConfigured: roundsPerSessionRef.current,
        roundsCompleted: stats.roundsCompleted,
        stimulusMode,
        endedBy,
        deviceTier,
      };
      setResultsData(data);
      setIsResultsOpen(true);
      setGameStarted(false);
      setPhase('idle');
      setTimeLeft(0);
    },
    [patientName, letterSize, timeLimitSec, codeLength, flashMs, deviceTier, durationSec, stimulusMode],
  );

  useEffect(() => {
    if (!gameStarted || phase !== 'search' || isSettingsOpen || isResultsOpen || isMenuOpen) return;
    if (timeLimitSec <= 0) return;
    if (timeLeft <= 0) {
      finishSession('timeout');
      return;
    }
    const t = setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [gameStarted, phase, isSettingsOpen, isResultsOpen, isMenuOpen, timeLimitSec, timeLeft, finishSession]);

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
        setCorrectCount(0);
        setWrongCount(0);
        setDurationSec(0);
        const now = Date.now();
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
      setTargetShownAt(Date.now());
      setTimeLeft(limit > 0 ? limit : 0);
      setPhase('search');
      setGameStarted(true);
    },
    [],
  );

  const launchRound = useCallback(
    (
      round: number,
      resetSession = false,
      overrides?: {
        codeLength?: number;
        flashMs?: number;
        cellCount?: number;
        hardness?: PatternMatchHardness;
        timeLimitSec?: number;
      },
    ) => {
      endingRef.current = false;
      if (encodeTimerRef.current) clearTimeout(encodeTimerRef.current);
      const len = overrides?.codeLength ?? codeLength;
      const flash = overrides?.flashMs ?? flashMs;
      const cellsN = overrides?.cellCount ?? cellCount;
      const hard = overrides?.hardness ?? hardness;
      const limit = overrides?.timeLimitSec ?? timeLimitSec;
      const code = generatePatternMatchTarget(len, stimulusMode);
      const packed = buildPatternMatchField({
        target: code,
        cellCount: cellsN,
        hardness: hard,
        stimulusMode,
      });
      if (!packed.some((c) => c.isMatch)) {
        setNotification('Could not build field — try again.');
        setTimeout(() => setNotification(null), 2500);
        return;
      }
      currentRoundRef.current = round;
      setCurrentRound(round);
      setIsSettingsOpen(false);
      setTargetCode(code);
      setGameStarted(true);
      if (flash <= 0) {
        beginSearchPhase(code, packed, limit, { resetSession });
        return;
      }
      setPhase('encode');
      setCells([]);
      encodeTimerRef.current = setTimeout(() => {
        if (!endingRef.current) beginSearchPhase(code, packed, limit, { resetSession });
      }, flash);
    },
    [codeLength, cellCount, hardness, flashMs, timeLimitSec, stimulusMode, beginSearchPhase],
  );

  const startGame = useCallback(
    (overrides?: {
      codeLength?: number;
      flashMs?: number;
      cellCount?: number;
      hardness?: PatternMatchHardness;
      timeLimitSec?: number;
    }) => {
      launchRound(1, true, overrides);
    },
    [launchRound],
  );

  const onBoardCleared = useCallback(() => {
    statsRef.current.roundsCompleted = currentRoundRef.current;
    if (currentRoundRef.current >= roundsPerSessionRef.current) {
      finishSession('cleared');
      return;
    }
    hapticCorrect();
    launchRound(currentRoundRef.current + 1, false);
  }, [finishSession, launchRound]);

  const onCellPress = useCallback(
    (cell: PatternMatchCell) => {
      if (!gameStarted || phase !== 'search' || isResultsOpen || poppingIds.has(cell.id)) return;
      const now = Date.now();
      statsRef.current.clicks += 1;
      if (cell.isMatch) {
        hapticCorrect();
        if (targetShownAt != null) {
          statsRef.current.reactions.push(Math.max(0, now - targetShownAt));
        }
        setTargetShownAt(now);
        statsRef.current.correct += 1;
        setCorrectCount(statsRef.current.correct);
        setPoppingIds((prev) => new Set(prev).add(cell.id));
        setTimeout(() => {
          setCells((prev) => {
            const next = prev.filter((c) => c.id !== cell.id);
            if (!next.some((c) => c.isMatch)) {
              setTimeout(() => onBoardCleared(), 40);
            }
            return next;
          });
          setPoppingIds((prev) => {
            const n = new Set(prev);
            n.delete(cell.id);
            return n;
          });
        }, 180);
        return;
      }
      hapticWrong();
      statsRef.current.wrong += 1;
      setWrongCount(statsRef.current.wrong);
      setWrongIds((prev) => new Set(prev).add(cell.id));
      setTimeout(() => {
        setWrongIds((prev) => {
          const n = new Set(prev);
          n.delete(cell.id);
          return n;
        });
      }, 280);
    },
    [gameStarted, phase, isResultsOpen, poppingIds, targetShownAt, onBoardCleared],
  );

  const commitSettings = (settings: AppliedClinicalSettings) => {
    const nextLength = settings.patternMatchCodeLength ?? codeLength;
    const nextFlash = settings.patternMatchFlashMs ?? flashMs;
    const nextCells = settings.patternMatchCellCount ?? cellCount;
    const nextHard = settings.patternMatchHardness ?? hardness;
    const nextLetter = settings.letterSize ?? letterSize;
    const nextRounds = settings.patternMatchRounds ?? roundsPerSession;
    const nextTime = settings.timeLimitSec ?? timeLimitSec;
    const nextBg = settings.bgColor || engineBgColor;
    const nextChar = settings.shapeColor || charColor;

    setPatientName(settings.patientName);
    setCodeLength(nextLength);
    setFlashMs(nextFlash);
    setCellCount(nextCells);
    setHardness(nextHard);
    setLetterSize(nextLetter);
    setRoundsPerSession(nextRounds);
    roundsPerSessionRef.current = nextRounds;
    setTimeLimitSec(nextTime);
    setEngineBgColor(nextBg);
    setCharColor(nextChar);

    return {
      codeLength: nextLength,
      flashMs: nextFlash,
      cellCount: nextCells,
      hardness: nextHard,
      letterSize: nextLetter,
      rounds: nextRounds,
      timeLimitSec: nextTime,
    };
  };

  const showHoldCode = flashMs <= 0 && phase === 'search' && !!targetCode;

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

      {!gameStarted && !isSettingsOpen && !isResultsOpen ? (
        <ClickToStartOverlay
          title={levelTitle}
          hint={levelHint}
          onStart={startGame}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onExit={requestExit}
        />
      ) : null}

      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: s(16), paddingBottom: s(88) }}>
        {phase === 'encode' && targetCode ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Text style={{ color: 'rgba(248,250,252,0.55)', fontWeight: '800', letterSpacing: 2, fontSize: fs(12) }}>
              HOLD THIS CODE
            </Text>
            <Text
              style={{
                color: charColor,
                fontWeight: '900',
                fontSize: fs(letterSize * 28),
                letterSpacing: 10,
                fontVariant: ['tabular-nums'],
              }}
            >
              {targetCode}
            </Text>
          </View>
        ) : null}

        {phase === 'search' ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            {showHoldCode ? (
              <Text
                style={{
                  color: charColor,
                  textAlign: 'center',
                  fontWeight: '900',
                  fontSize: fs(letterSize * 18),
                  letterSpacing: 6,
                  marginBottom: 12,
                }}
              >
                {targetCode}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {cells.map((cell) => {
                const isPopping = poppingIds.has(cell.id);
                const isWrong = wrongIds.has(cell.id);
                return (
                  <Pressable
                    key={cell.id}
                    onPress={() => onCellPress(cell)}
                    style={{
                      width: `${100 / 3 - 2}%` as unknown as number,
                      minWidth: (width - s(48)) / 3 - 8,
                      paddingVertical: s(14),
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: isWrong ? '#fb7185' : 'rgba(148,163,184,0.35)',
                      backgroundColor: isPopping ? 'transparent' : 'rgba(15,23,42,0.45)',
                      opacity: isPopping ? 0.2 : 1,
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: charColor,
                        fontWeight: '800',
                        fontSize: fs(letterSize * 14),
                        letterSpacing: 3,
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {cell.code}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </View>

      {gameStarted && phase === 'search' ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: insets.top,
            left: 0,
            right: 0,
            padding: 12,
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          <Text style={{ color: 'rgba(226,232,240,0.8)', fontWeight: '600', fontSize: fs(12) }}>
            Round {currentRound}/{roundsPerSession} · {remainingMatches} left · {correctCount} found
            {wrongCount > 0 ? ` · ${wrongCount} wrong` : ''}
          </Text>
          <Text style={{ color: '#fb7185', fontWeight: '800', fontSize: fs(12) }}>
            {timeLimitSec > 0 ? `${timeLeft}s` : `${durationSec}s`}
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={() => setIsMenuOpen(true)}
        style={{ position: 'absolute', bottom: insets.bottom + 20, right: 16, padding: 10 }}
      >
        <SlidersIcon size={22} color="#cbd5e1" />
      </Pressable>

      <GameMenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onQuit={requestExit}
        onReset={() => {
          endingRef.current = true;
          if (encodeTimerRef.current) clearTimeout(encodeTimerRef.current);
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
          { label: 'Code length', value: String(codeLength) },
          { label: 'Flash', value: patternMatchFlashLabel(flashMs) },
          { label: 'Field', value: String(cellCount) },
          { label: 'Hardness', value: patternMatchHardnessLabel(hardness) },
          { label: 'Rounds', value: String(roundsPerSession) },
        ]}
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
        sampleSymbol={stimulusMode === 'compound' ? 'A3B' : '331'}
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
