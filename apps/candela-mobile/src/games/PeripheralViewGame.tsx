import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Defs, Polygon, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';
import {
  buildHexHive,
  clampBatchesPerSession,
  clampHexSizePx,
  clampStimuliCount,
  DEFAULT_PERIPHERAL_BG_COLOR,
  DEFAULT_PERIPHERAL_BUBBLE_TYPE,
  DEFAULT_PERIPHERAL_FIXATION_COLOR,
  DEFAULT_PERIPHERAL_LETTER_SIZE,
  DEFAULT_PERIPHERAL_STIMULUS_COLOR,
  eligibleCellIds,
  getDeviceTier,
  hexVertices,
  isPeripheralLandscape,
  fixationTriangleVertices,
  peripheralDeviceDefaults,
  peripheralFieldLabel,
  peripheralHexPaint,
  peripheralHexRenderRadius,
  peripheralLetterColor,
  peripheralLetterFontPx,
  peripheralSessionAccuracy,
  clampPeripheralLetterSize,
  clampPeripheralTargetTimeoutSec,
  resolvePeripheralField,
  spawnBatch,
  reactionStatsFromMs,
  type HexCell,
  type PeripheralBubbleType,
  type PeripheralField,
  type PeripheralSessionResultData,
  type PeripheralTrialOutcome,
} from '@candela/shared/rn';
import { ClinicalSettingsModal } from '../components/ClinicalSettingsModal';
import { GameResultsModal } from '../components/GameResultsModal';
import { ResetConfirmDialog } from '../components/ResetConfirmDialog';
import { ChevronUpIcon, ReplayIcon, SlidersIcon, VolumeIcon } from '../components/icons';
import { hapticCorrect, hapticWrong } from '../lib/haptics';
import { sessionDisplayName, useAuth } from '../lib/auth-context';
import { useGameSessionLock } from '../lib/use-game-session-lock';
import { useLayout } from '../lib/layout';
import { speak, stopSpeaking } from '../lib/speech';

export function PeripheralViewGame({
  field: fieldProp = 'both',
  onExit,
}: {
  field?: string;
  onExit?: () => void;
}) {
  const field = resolvePeripheralField(fieldProp) as PeripheralField;
  const { session } = useAuth();
  const { width, height, s, fs } = useLayout();
  const deviceTier = useMemo(() => getDeviceTier(width, height), [width, height]);
  const defaults = useMemo(() => peripheralDeviceDefaults(deviceTier), [deviceTier]);

  const [gameStarted, setGameStarted] = useState(false);
  const [isAssistiveTouchOpen, setIsAssistiveTouchOpen] = useState(false);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [resultsData, setResultsData] = useState<PeripheralSessionResultData | null>(null);
  const [patientName, setPatientName] = useState(sessionDisplayName(session));
  const [letterSize, setLetterSize] = useState(DEFAULT_PERIPHERAL_LETTER_SIZE);
  const [targetTimeoutSec, setTargetTimeoutSec] = useState(0);
  const [hexSizePx, setHexSizePx] = useState(defaults.hexSizePx);
  const [stimuliCount, setStimuliCount] = useState(defaults.stimuliCount);
  const [batchesPerSession, setBatchesPerSession] = useState(defaults.batchesPerSession);
  const [stimulusColor, setStimulusColor] = useState(DEFAULT_PERIPHERAL_STIMULUS_COLOR);
  const [engineBgColor, setEngineBgColor] = useState(DEFAULT_PERIPHERAL_BG_COLOR);
  const [bubbleType, setBubbleType] = useState<PeripheralBubbleType>(DEFAULT_PERIPHERAL_BUBBLE_TYPE);
  const { requestExit } = useGameSessionLock(onExit);

  const [playArea, setPlayArea] = useState({ w: width, h: height });
  const [cells, setCells] = useState<HexCell[]>([]);
  const [activeMap, setActiveMap] = useState<Record<string, string>>({});
  const [currentTarget, setCurrentTarget] = useState('');
  const [poppingIds, setPoppingIds] = useState<Set<string>>(new Set());
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());
  const [batchIndex, setBatchIndex] = useState(0);
  const [clicks, setClicks] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [targetShownAt, setTargetShownAt] = useState<number | null>(null);

  const batchIndexRef = useRef(0);
  const statsRef = useRef({
    clicks: 0,
    correct: 0,
    wrong: 0,
    reactions: [] as number[],
    trials: [] as PeripheralSessionResultData['trials'],
    stimuliPresented: 0,
  });
  const startTimeRef = useRef<number | null>(null);
  const cellsRef = useRef<HexCell[]>([]);
  const playAreaRef = useRef(playArea);
  const currentTargetRef = useRef('');
  const isSettingsOpenRef = useRef(isSettingsOpen);
  const batchesPerSessionRef = useRef(batchesPerSession);
  const gameStartedRef = useRef(gameStarted);
  const wasLandscapeRef = useRef(false);
  const activeMapRef = useRef<Record<string, string>>({});
  const targetTimeoutSecRef = useRef(targetTimeoutSec);
  const targetTimeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const isLandscape = isPeripheralLandscape(width, height);

  useEffect(() => {
    const name = session?.user.name?.trim();
    if (name) setPatientName(name);
  }, [session?.user.name]);

  useEffect(() => () => stopSpeaking(), []);

  useEffect(() => {
    if (isLandscape) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isLandscape, rotateAnim]);

  useEffect(() => {
    startTimeRef.current = startTime;
  }, [startTime]);

  useEffect(() => {
    setStimuliCount((prev) => clampStimuliCount(prev, deviceTier));
  }, [deviceTier]);

  const recordTrial = useCallback((outcome: PeripheralTrialOutcome, reactionMs: number | null) => {
    const sessionStart = startTimeRef.current;
    statsRef.current.trials.push({
      batchIndex: batchIndexRef.current,
      targetLetter: currentTargetRef.current,
      outcome,
      reactionMs: reactionMs != null ? Math.round(reactionMs) : null,
      atMs: sessionStart != null ? Math.round(performance.now() - sessionStart) : 0,
    });
  }, []);

  useEffect(() => {
    batchIndexRef.current = batchIndex;
  }, [batchIndex]);

  useEffect(() => {
    batchesPerSessionRef.current = batchesPerSession;
  }, [batchesPerSession]);

  useEffect(() => {
    isSettingsOpenRef.current = isSettingsOpen;
  }, [isSettingsOpen]);

  useEffect(() => {
    gameStartedRef.current = gameStarted;
  }, [gameStarted]);

  useEffect(() => {
    activeMapRef.current = activeMap;
  }, [activeMap]);

  useEffect(() => {
    targetTimeoutSecRef.current = targetTimeoutSec;
  }, [targetTimeoutSec]);

  useEffect(() => {
    statsRef.current.clicks = clicks;
    statsRef.current.correct = correctCount;
    statsRef.current.wrong = wrongCount;
    statsRef.current.reactions = reactionTimes;
  }, [clicks, correctCount, wrongCount, reactionTimes]);

  useEffect(() => {
    playAreaRef.current = playArea;
  }, [playArea]);

  const clearBoard = useCallback(() => {
    setActiveMap({});
    setCurrentTarget('');
    currentTargetRef.current = '';
    setPoppingIds(new Set());
    setWrongIds(new Set());
    stopSpeaking();
  }, []);

  const speakTarget = useCallback((letter: string) => {
    if (!letter) return;
    speak(`target ${letter.toLowerCase()}`);
  }, []);

  const chooseNextTarget = useCallback(
    (map: Record<string, string>) => {
      const remaining = Array.from(new Set(Object.values(map)));
      if (remaining.length === 0) {
        setCurrentTarget('');
        currentTargetRef.current = '';
        return;
      }
      const next = remaining[Math.floor(Math.random() * remaining.length)];
      setCurrentTarget(next);
      currentTargetRef.current = next;
      setTargetShownAt(performance.now());
      if (!isSettingsOpenRef.current) {
        setTimeout(() => speakTarget(next), 350);
      }
    },
    [speakTarget],
  );

  const clearTargetTimeout = useCallback(() => {
    if (targetTimeoutTimerRef.current) {
      clearTimeout(targetTimeoutTimerRef.current);
      targetTimeoutTimerRef.current = null;
    }
  }, []);

  const handleTargetTimeout = useCallback(() => {
    if (!gameStartedRef.current || !currentTargetRef.current || isSettingsOpenRef.current) return;
    setClicks((prev) => prev + 1);
    setWrongCount((prev) => prev + 1);
    void hapticWrong();
    recordTrial('timeout', null);
    chooseNextTarget(activeMapRef.current);
  }, [chooseNextTarget, recordTrial]);

  const scheduleTargetTimeout = useCallback(() => {
    clearTargetTimeout();
    const sec = targetTimeoutSecRef.current;
    if (sec <= 0 || !gameStartedRef.current || !currentTargetRef.current || isSettingsOpenRef.current) return;
    targetTimeoutTimerRef.current = setTimeout(() => {
      handleTargetTimeout();
    }, sec * 1000);
  }, [clearTargetTimeout, handleTargetTimeout]);

  useEffect(() => {
    if (!gameStarted || !currentTarget || targetTimeoutSec <= 0 || isSettingsOpen) {
      clearTargetTimeout();
      return;
    }
    scheduleTargetTimeout();
    return clearTargetTimeout;
  }, [gameStarted, currentTarget, targetTimeoutSec, targetShownAt, isSettingsOpen, scheduleTargetTimeout, clearTargetTimeout]);

  useEffect(() => () => clearTargetTimeout(), [clearTargetTimeout]);

  const refillBatch = useCallback(
    (nextBatch: number, hive: HexCell[], areaW: number, areaH: number) => {
      if (!isPeripheralLandscape(areaW, areaH)) {
        clearBoard();
        return;
      }
      const eligible = eligibleCellIds(hive, field, areaW, areaH, hexSizePx);
      const map = spawnBatch(eligible, stimuliCount, Math.random, deviceTier);
      statsRef.current.stimuliPresented += Object.keys(map).length;
      setActiveMap(map);
      setBatchIndex(nextBatch);
      chooseNextTarget(map);
    },
    [chooseNextTarget, clearBoard, deviceTier, field, hexSizePx, stimuliCount],
  );

  // Rebuild hive on size change; drop stale pops in portrait; refill when landscape while session active.
  useEffect(() => {
    if (playArea.w <= 0 || playArea.h <= 0) return;
    const landscape = isPeripheralLandscape(playArea.w, playArea.h);
    const hive = landscape ? buildHexHive(playArea.w, playArea.h, hexSizePx) : [];
    setCells(hive);
    cellsRef.current = hive;

    if (!landscape) {
      clearBoard();
      wasLandscapeRef.current = false;
      return;
    }

    wasLandscapeRef.current = true;
    // Re-seed on size/hex change mid-session so pops never stick to a stale hive.
    if (gameStartedRef.current) {
      refillBatch(batchIndexRef.current, hive, playArea.w, playArea.h);
    }
  }, [playArea.w, playArea.h, hexSizePx, clearBoard, refillBatch]);

  const finishSession = useCallback(() => {
    void hapticCorrect();
    stopSpeaking();
    const { correct, wrong, reactions, trials, stimuliPresented } = statsRef.current;
    const totalDuration = startTime ? (performance.now() - startTime) / 1000 : 0;
    const { avgSec: avgReact, medianSec: medianReact } = reactionStatsFromMs(reactions);
    const data: PeripheralSessionResultData = {
      patientName,
      sessionId: Math.floor(1000 + Math.random() * 9000),
      date: new Date().toLocaleDateString('en-GB'),
      gameName: `Peripheral View (${peripheralFieldLabel(field)})`,
      stimuliCount: stimuliPresented,
      letterSize,
      speed: `${hexSizePx}px`,
      durationSec: Math.round(totalDuration),
      clicksTotal: correct + wrong,
      correct,
      wrong,
      accuracy: peripheralSessionAccuracy(correct, wrong),
      avgReactionSec: avgReact,
      medianReactionSec: medianReact,
      peripheralField: field,
      batchesConfigured: batchesPerSession,
      stimuliPerBatchConfigured: stimuliCount,
      stimuliPresentedTotal: stimuliPresented,
      targetTimeoutSec,
      bubbleType,
      deviceTier,
      trials,
    };
    // TODO: persist once DB is configured
    setResultsData(data);
    setIsResultsOpen(true);
    setTimeout(() => setGameStarted(false), 400);
  }, [batchesPerSession, bubbleType, deviceTier, field, hexSizePx, letterSize, patientName, startTime, stimuliCount, targetTimeoutSec]);

  const startGame = () => {
    const area = playAreaRef.current;
    if (!isPeripheralLandscape(area.w, area.h)) return;
    setGameStarted(true);
    setClicks(0);
    setCorrectCount(0);
    setWrongCount(0);
    setReactionTimes([]);
    setPoppingIds(new Set());
    setWrongIds(new Set());
    setStartTime(performance.now());
    setTargetShownAt(performance.now());
    statsRef.current = {
      clicks: 0,
      correct: 0,
      wrong: 0,
      reactions: [],
      trials: [],
      stimuliPresented: 0,
    };
    const hive = buildHexHive(area.w, area.h, hexSizePx);
    setCells(hive);
    cellsRef.current = hive;
    refillBatch(0, hive, area.w, area.h);
  };

  const handleHexPress = (cellId: string) => {
    if (!isLandscape || !gameStarted || !activeMap[cellId] || poppingIds.has(cellId) || !currentTarget) return;
    const letter = activeMap[cellId];
    setClicks((prev) => prev + 1);

    if (letter !== currentTarget) {
      void hapticWrong();
      setWrongCount((prev) => prev + 1);
      recordTrial('wrong', null);
      setWrongIds((prev) => new Set(prev).add(cellId));
      setTimeout(() => {
        setWrongIds((prev) => {
          const next = new Set(prev);
          next.delete(cellId);
          return next;
        });
      }, 280);
      return;
    }

    void hapticCorrect();
    setCorrectCount((prev) => prev + 1);
    const reactionMs = targetShownAt != null ? performance.now() - targetShownAt : null;
    if (reactionMs != null) {
      setReactionTimes((prev) => [...prev, reactionMs]);
    }
    recordTrial('correct', reactionMs);
    setPoppingIds((prev) => new Set(prev).add(cellId));

    setTimeout(() => {
      setActiveMap((prev) => {
        const next = { ...prev };
        delete next[cellId];
        const stillSameTarget = Object.values(next).some((v) => v === currentTargetRef.current);

        if (Object.keys(next).length === 0) {
          const nextBatch = batchIndexRef.current + 1;
          if (nextBatch < batchesPerSessionRef.current) {
            setTimeout(() => {
              refillBatch(nextBatch, cellsRef.current, playAreaRef.current.w, playAreaRef.current.h);
            }, 280);
          } else {
            setTimeout(() => finishSession(), 200);
          }
        } else if (!stillSameTarget) {
          setTimeout(() => chooseNextTarget(next), 400);
        }

        return next;
      });
      setPoppingIds((prev) => {
        const n = new Set(prev);
        n.delete(cellId);
        return n;
      });
    }, 220);
  };

  const handleMiss = () => {
    if (!isLandscape || !gameStarted) return;
    setClicks((prev) => prev + 1);
    setWrongCount((prev) => prev + 1);
    recordTrial('miss', null);
    void hapticWrong();
  };

  const fontPx = peripheralLetterFontPx(hexSizePx, letterSize);
  const letterColor = peripheralLetterColor({ bubbleType, stimulusColor });
  const fieldTitle = peripheralFieldLabel(field);
  const fabSize = s(36);
  const bottomPad = s(16);
  const rightPad = s(16);
  const rotateDeg = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });

  const resetSession = () => {
    setIsAssistiveTouchOpen(false);
    setIsHeaderExpanded(false);
    setGameStarted(false);
    clearBoard();
    setIsSettingsOpen(false);
  };

  const openSettings = () => {
    setIsAssistiveTouchOpen(false);
    setIsHeaderExpanded(false);
    setIsSettingsOpen(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: engineBgColor }}>
      {!isLandscape ? (
        <View
          style={{
            ...StyleSheetAbsolute,
            zIndex: 80,
            backgroundColor: 'rgba(6,7,13,0.98)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: s(28),
            gap: s(18),
          }}
        >
          <Animated.View
            style={{
              width: s(72),
              height: s(104),
              borderRadius: s(14),
              borderWidth: 3,
              borderColor: '#67E8F9',
              backgroundColor: 'rgba(15,23,42,0.9)',
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ rotate: rotateDeg }],
            }}
          >
            <View
              style={{
                width: s(18),
                height: s(4),
                borderRadius: 999,
                backgroundColor: '#67E8F9',
                position: 'absolute',
                bottom: s(10),
              }}
            />
          </Animated.View>
          <Text style={{ color: '#fff', fontSize: fs(22), fontWeight: '900', textAlign: 'center' }}>
            Rotate to landscape
          </Text>
          <Text style={{ color: '#94A3B8', fontSize: fs(14), fontWeight: '700', textAlign: 'center', maxWidth: s(320) }}>
            Peripheral View is played in landscape so left and right fields stay clear. Rotate your phone or tablet to
            continue.
          </Text>
          <Pressable
            onPress={() => requestExit()}
            style={{
              marginTop: s(8),
              paddingHorizontal: s(20),
              paddingVertical: s(12),
              borderRadius: s(12),
              borderWidth: 1,
              borderColor: '#334155',
              backgroundColor: 'rgba(15,23,42,0.9)',
            }}
          >
            <Text style={{ color: '#E2E8F0', fontWeight: '800', fontSize: fs(14) }}>Quit to dashboard</Text>
          </Pressable>
        </View>
      ) : null}

      {isLandscape && !gameStarted && !isSettingsOpen && !isResultsOpen ? (
        <View
          style={{
            ...StyleSheetAbsolute,
            zIndex: 50,
            backgroundColor: 'rgba(6,7,13,0.98)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: s(24),
            gap: s(14),
          }}
        >
          <Text style={{ color: '#fff', fontSize: fs(26), fontWeight: '900', textAlign: 'center' }}>
            Peripheral View · {fieldTitle}
          </Text>
          <Text style={{ color: '#94A3B8', fontSize: fs(14), fontWeight: '700', textAlign: 'center' }}>
            Tap the triangle to start · keep eyes on center
          </Text>
          <Pressable
            onPress={startGame}
            accessibilityRole="button"
            accessibilityLabel="Tap triangle to start therapy session"
            style={{
              width: s(160),
              height: s(160),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Svg width={s(160)} height={s(160)} viewBox="0 0 120 120">
              <Defs>
                <RadialGradient id="pvStartHalo" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor={DEFAULT_PERIPHERAL_FIXATION_COLOR} stopOpacity="0.55" />
                  <Stop offset="45%" stopColor={DEFAULT_PERIPHERAL_FIXATION_COLOR} stopOpacity="0.2" />
                  <Stop offset="100%" stopColor={DEFAULT_PERIPHERAL_FIXATION_COLOR} stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Circle cx={60} cy={62} r={54} fill="url(#pvStartHalo)" />
              <Circle cx={60} cy={62} r={32} fill={DEFAULT_PERIPHERAL_FIXATION_COLOR} opacity={0.22} />
              <Polygon
                points={fixationTriangleVertices(60, 62, 28)
                  .map((p) => `${p.x},${p.y}`)
                  .join(' ')}
                fill={DEFAULT_PERIPHERAL_FIXATION_COLOR}
                stroke="#FFFFFF"
                strokeWidth={2}
                strokeLinejoin="round"
                opacity={0.95}
              />
              <Polygon
                points={fixationTriangleVertices(60, 62, 15)
                  .map((p) => `${p.x},${p.y}`)
                  .join(' ')}
                fill="#FFFFFF"
                opacity={0.98}
              />
            </Svg>
          </Pressable>
          <Pressable onPress={() => setIsSettingsOpen(true)}>
            <Text style={{ color: '#CBD5E1', fontWeight: '700' }}>Edit Clinical Settings</Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        style={{ flex: 1, overflow: 'hidden' }}
        onPress={handleMiss}
        onLayout={(e) => {
          const { width: w, height: h } = e.nativeEvent.layout;
          if (w !== playArea.w || h !== playArea.h) setPlayArea({ w, h });
        }}
      >
        {isLandscape && gameStarted && playArea.w > 0 ? (
          <Svg width={playArea.w} height={playArea.h}>
            {cells.map((cell) => {
              const letter = activeMap[cell.id];
              const isActive = Boolean(letter);
              const isPopping = poppingIds.has(cell.id);
              const isWrong = wrongIds.has(cell.id);
              const paint = peripheralHexPaint({ bubbleType, isActive, stimulusColor });
              const hexR = peripheralHexRenderRadius(hexSizePx);
              const pts = hexVertices(cell.cx, cell.cy, hexR)
                .map((p) => `${p.x},${p.y}`)
                .join(' ');
              return (
                <Polygon
                  key={cell.id}
                  points={pts}
                  fill={paint.fill}
                  stroke={paint.stroke}
                  strokeWidth={paint.strokeWidth}
                  opacity={isPopping ? 0.35 : isWrong ? 0.7 : 1}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    if (isActive) handleHexPress(cell.id);
                    else handleMiss();
                  }}
                />
              );
            })}
            {cells.map((cell) => {
              const letter = activeMap[cell.id];
              if (!letter || poppingIds.has(cell.id)) return null;
              return (
                <SvgText
                  key={`t-${cell.id}`}
                  x={cell.cx}
                  y={cell.cy + fontPx * 0.35}
                  fill={bubbleType === 'boundary' ? peripheralLetterColor({ bubbleType, stimulusColor }) : letterColor}
                  fontSize={fontPx}
                  fontWeight="900"
                  textAnchor="middle"
                  onPress={() => handleHexPress(cell.id)}
                >
                  {letter}
                </SvgText>
              );
            })}
          </Svg>
        ) : null}

        {isLandscape && gameStarted ? (
          <Text
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: s(12),
              right: s(14),
              color: '#94A3B8',
              fontWeight: '700',
              fontSize: fs(13),
            }}
          >
            Batch {Math.min(batchIndex + 1, batchesPerSession)}/{batchesPerSession} · {Object.keys(activeMap).length}{' '}
            left
          </Text>
        ) : null}
      </Pressable>

      {isLandscape ? (
        <View
          style={{
            position: 'absolute',
            bottom: bottomPad,
            right: rightPad,
            zIndex: 40,
            flexDirection: 'row',
            alignItems: 'center',
            gap: s(8),
          }}
        >
          {gameStarted ? (
            <>
              <Pressable
                onPress={() => speakTarget(currentTarget)}
                hitSlop={8}
                style={{
                  width: fabSize,
                  height: fabSize,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                accessibilityLabel="Replay target"
              >
                <ReplayIcon size={18} color="rgba(148,163,184,0.4)" />
              </Pressable>
              <Pressable
                onPress={() => {
                  setIsAssistiveTouchOpen((prev) => !prev);
                  setIsHeaderExpanded(false);
                }}
                style={{
                  width: fabSize,
                  height: fabSize,
                  borderRadius: fabSize / 2,
                  backgroundColor: isAssistiveTouchOpen ? '#1A2035' : 'rgba(18,22,38,0.92)',
                  borderWidth: 2,
                  borderColor: isAssistiveTouchOpen ? '#60A5FA' : 'rgba(59,130,246,0.7)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                accessibilityLabel="Current target — open menu"
              >
                <Text style={{ color: stimulusColor, fontWeight: '900', fontSize: fs(14) }}>
                  {currentTarget || '—'}
                </Text>
                <View
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    width: s(14),
                    height: s(14),
                    borderRadius: s(7),
                    backgroundColor: '#2563EB',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: '#93C5FD',
                  }}
                >
                  <ChevronUpIcon size={8} color="#fff" />
                </View>
              </Pressable>
              <Pressable
                onPress={() => {
                  setIsHeaderExpanded((prev) => !prev);
                  setIsAssistiveTouchOpen(false);
                }}
                style={{
                  backgroundColor: 'rgba(18,22,38,0.92)',
                  borderWidth: 1,
                  borderColor: '#1F2937',
                  borderRadius: s(12),
                  paddingHorizontal: s(10),
                  paddingVertical: s(8),
                }}
              >
                <Text style={{ color: '#E5E7EB', fontWeight: '800', fontSize: fs(11) }}>
                  {isHeaderExpanded ? '▼ Hide Info' : '▲ View Info'}
                </Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={openSettings}
              style={{
                width: s(44),
                height: s(44),
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityLabel="Clinical settings"
            >
              <SlidersIcon size={22} color="#94A3B8" />
            </Pressable>
          )}
        </View>
      ) : null}

      {isLandscape && isAssistiveTouchOpen ? (
        <View
          style={{
            position: 'absolute',
            bottom: bottomPad + fabSize + s(16),
            right: rightPad + s(8),
            zIndex: 50,
            backgroundColor: 'rgba(18,22,38,0.96)',
            borderWidth: 1,
            borderColor: '#1F2937',
            borderRadius: s(24),
            padding: s(14),
            minWidth: s(210),
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: s(10) }}>
            <Text style={{ color: '#D1D5DB', fontWeight: '800', fontSize: fs(11), letterSpacing: 0.8 }}>
              CONTROLS
            </Text>
            <Pressable onPress={() => setIsAssistiveTouchOpen(false)}>
              <Text style={{ color: '#9CA3AF', fontWeight: '800' }}>✕</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => speakTarget(currentTarget)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#1A2035',
              borderWidth: 1,
              borderColor: 'rgba(59,130,246,0.4)',
              borderRadius: s(16),
              paddingHorizontal: s(12),
              paddingVertical: s(10),
              marginBottom: s(8),
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
              <Text style={{ color: '#9CA3AF', fontSize: fs(10), fontWeight: '700' }}>Target:</Text>
              <Text style={{ color: stimulusColor, fontWeight: '900', fontSize: fs(20) }}>
                {currentTarget || '—'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
              <VolumeIcon size={14} color="#60A5FA" />
              <Text style={{ color: '#60A5FA', fontWeight: '800', fontSize: fs(11) }}>Replay</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={openSettings}
            style={{
              backgroundColor: '#1F2937',
              borderRadius: s(16),
              paddingVertical: s(10),
              alignItems: 'center',
              marginBottom: s(8),
              flexDirection: 'row',
              justifyContent: 'center',
              gap: s(8),
            }}
          >
            <SlidersIcon size={16} color="#D1D5DB" />
            <Text style={{ color: '#D1D5DB', fontWeight: '800', fontSize: fs(12) }}>Settings</Text>
          </Pressable>
          <Pressable
            onPress={() => setConfirmReset(true)}
            style={{
              backgroundColor: '#1F2937',
              borderRadius: s(16),
              paddingVertical: s(10),
              alignItems: 'center',
              marginBottom: s(8),
            }}
          >
            <Text style={{ color: '#E5E7EB', fontWeight: '800', fontSize: fs(12) }}>Reset Session</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (gameStarted && !isResultsOpen) setConfirmQuit(true);
              else {
                setIsAssistiveTouchOpen(false);
                requestExit();
              }
            }}
            style={{ backgroundColor: '#B91C1C', borderRadius: s(16), paddingVertical: s(10), alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: fs(12) }}>Quit Game</Text>
          </Pressable>
        </View>
      ) : null}

      {isLandscape && isHeaderExpanded ? (
        <View
          style={{
            position: 'absolute',
            bottom: bottomPad + fabSize + s(16),
            right: rightPad,
            zIndex: 40,
            backgroundColor: 'rgba(18,22,38,0.96)',
            borderWidth: 1,
            borderColor: '#1F2937',
            borderRadius: s(18),
            padding: s(16),
            minWidth: s(250),
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: s(10) }}>
            <View>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: fs(13) }}>Session & Clinical Info</Text>
              <Text style={{ color: '#9CA3AF', fontSize: fs(11) }}>{fieldTitle}</Text>
            </View>
            <Pressable onPress={() => setIsHeaderExpanded(false)}>
              <Text style={{ color: '#9CA3AF', fontWeight: '800' }}>✕</Text>
            </Pressable>
          </View>
          <Text style={{ color: '#9CA3AF', fontSize: fs(10), fontWeight: '800', marginBottom: s(6) }}>
            CLINICAL PARAMETERS
          </Text>
          <InfoRow label="Patient" value={patientName} />
          <InfoRow label="Hex size" value={`${hexSizePx}px`} accent="#60A5FA" />
          <InfoRow label="Stimuli / batch" value={String(stimuliCount)} accent="#60A5FA" />
          <InfoRow label="Batches" value={String(batchesPerSession)} />
          <InfoRow label="Letter size" value={String(letterSize)} accent="#60A5FA" />
          <InfoRow label="Target timer" value={targetTimeoutSec > 0 ? `${targetTimeoutSec}s` : 'Off'} />
          <InfoRow label="Bubble type" value={bubbleType === 'boundary' ? 'Boundary' : 'Solid'} />
          <View style={{ height: 1, backgroundColor: '#1F2937', marginVertical: s(8) }} />
          <Text style={{ color: '#9CA3AF', fontSize: fs(10), fontWeight: '800', marginBottom: s(6) }}>LIVE METRICS</Text>
          <InfoRow label="Correct" value={String(correctCount)} accent="#34D399" />
          <InfoRow label="Wrong" value={String(wrongCount)} accent="#FB7185" />
          <InfoRow
            label="Batch"
            value={`${Math.min(batchIndex + 1, batchesPerSession)} / ${batchesPerSession}`}
          />
          {currentTarget ? <InfoRow label="Target" value={currentTarget} accent={stimulusColor} /> : null}
        </View>
      ) : null}

      <ResetConfirmDialog
        visible={confirmReset}
        confirmLabel="Reset Session"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          resetSession();
        }}
      />
      <ResetConfirmDialog
        visible={confirmQuit}
        title="Leave this game?"
        message="This session isn't finished yet. If you leave now, the current progress will be lost."
        confirmLabel="Leave"
        onCancel={() => setConfirmQuit(false)}
        onConfirm={() => {
          setConfirmQuit(false);
          setIsAssistiveTouchOpen(false);
          requestExit();
        }}
      />

      <ClinicalSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onApply={(newSettings) => {
          setPatientName(newSettings.patientName);
          if (newSettings.hexSizePx != null) setHexSizePx(clampHexSizePx(newSettings.hexSizePx));
          if (newSettings.stimuliCount != null) {
            setStimuliCount(clampStimuliCount(newSettings.stimuliCount, deviceTier));
          }
          if (newSettings.batchesPerSession != null) {
            setBatchesPerSession(clampBatchesPerSession(newSettings.batchesPerSession));
          }
          if (newSettings.stimulusColor) setStimulusColor(newSettings.stimulusColor);
          if (newSettings.bgColor) setEngineBgColor(newSettings.bgColor);
          if (newSettings.letterSize != null) setLetterSize(clampPeripheralLetterSize(newSettings.letterSize));
          if (newSettings.peripheralTargetTimeoutSec != null) {
            setTargetTimeoutSec(clampPeripheralTargetTimeoutSec(newSettings.peripheralTargetTimeoutSec));
          }
          if (newSettings.peripheralBubbleType) setBubbleType(newSettings.peripheralBubbleType);
          setIsSettingsOpen(false);
        }}
        patientName={patientName}
        letterSize={letterSize}
        bubbleSize={hexSizePx}
        showLetterSizeControl={false}
        showPeripheralViewControls
        hexSizePx={hexSizePx}
        stimuliCount={stimuliCount}
        batchesPerSession={batchesPerSession}
        stimulusColor={stimulusColor}
        bgColor={engineBgColor}
        peripheralTargetTimeoutSec={targetTimeoutSec}
        peripheralBubbleType={bubbleType}
        sampleSymbol="A"
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

const StyleSheetAbsolute = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
      <Text style={{ color: '#9CA3AF', fontSize: 12 }}>{label}</Text>
      <Text style={{ color: accent || '#fff', fontWeight: '700', fontSize: 12 }}>{value}</Text>
    </View>
  );
}
