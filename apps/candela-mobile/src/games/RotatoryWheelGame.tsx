import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlphabetVariant,
  BRIGHT_COLORS,
  BubbleItem,
  DEFAULT_BASE_ANIMATION_DURATION,
  SPEED_PRESETS,
  GameMode,
  SessionResultData,
  createRotatorySession,
  nextRotatoryBatch,
  takeNextRotatorySymbol,
  makeRotatoryBubbleItem,
  beginRotatoryTrial,
  noteRotatoryWrong,
  completeRotatoryTrial,
  interruptRotatoryTrial,
  finalizeRotatoryOpenTrial,
  rotatoryDeckComplete,
  rotatoryWarmupComplete,
  advanceRotatoryToScored,
  summarizeRotatorySession,
  rotatoryBubbleValue,
  pickBalancedRotatoryTarget,
  placeInitialRotatoryPositions,
  nextRotatoryRefillPosition,
  rotatoryCueShouldSpeak,
  rotatoryCueShowsBanner,
  getDeviceTier,
  type RotatorySessionState,
  type RotatoryCueMode,
  type RotatoryHandUsed,
  DEFAULT_STIMULI_BUBBLE_COLOR,
  DEFAULT_BUBBLE_APPEARANCE,
  resolveBubblePaint,
  stimuliColorLabel,
  bubbleAppearanceLabel,
  wheelColorLabel,
  clinicalColorSessionFields,
  type BubbleAppearance,
  useHowToPlayGate,
  usePauseShiftedClock,
} from '@candela/shared/rn';
import { ClinicalSettingsModal } from '../components/ClinicalSettingsModal';
import { HowToPlayManual } from '../components/HowToPlayManual';
import { GameMenuDrawer } from '../components/GameMenuDrawer';
import { GameResultsModal } from '../components/GameResultsModal';
import { SlidersIcon, PlayIcon, PauseIcon, ChevronUpIcon, VolumeIcon, ReplayIcon } from '../components/icons';
import { ResetConfirmDialog } from '../components/ResetConfirmDialog';
import { sessionDisplayName, useAuth } from '../lib/auth-context';
import { useGameSessionLock } from '../lib/use-game-session-lock';
import { hapticCorrect, hapticMiss, hapticWrong } from '../lib/haptics';
import { useLayout } from '../lib/layout';
import { speak, stopSpeaking } from '../lib/speech';

interface RotatoryWheelGameProps {
  initialMode?: GameMode;
  initialVariant?: AlphabetVariant;
  onExit?: () => void;
}

export function RotatoryWheelGame({
  initialMode = 'alphabets',
  initialVariant = 'uppercase',
  onExit,
}: RotatoryWheelGameProps) {
  const { session } = useAuth();
  const { width, height, s, fs, isTablet } = useLayout();
  const insets = useSafeAreaInsets();
  const [mode] = useState<GameMode>(initialMode);
  const [variant] = useState<AlphabetVariant>(initialVariant);
  const [isPaused, setIsPaused] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [bubbles, setBubbles] = useState<BubbleItem[]>([]);
  const [currentTarget, setCurrentTarget] = useState('');
  const [targetColor, setTargetColor] = useState('#ff5722');
  const [patientName, setPatientName] = useState(sessionDisplayName(session));
  const [letterSize, setLetterSize] = useState(2.5);
  const [bubbleSize, setBubbleSize] = useState(() => (isTablet ? 100 : 80));
  const [wheelColor, setWheelColor] = useState('#000000');
  const [stimuliColor, setStimuliColor] = useState(DEFAULT_STIMULI_BUBBLE_COLOR);
  const [bubbleAppearance, setBubbleAppearance] = useState<BubbleAppearance>(DEFAULT_BUBBLE_APPEARANCE);
  const [cueMode, setCueMode] = useState<RotatoryCueMode>('both');
  const [handUsed, setHandUsed] = useState<RotatoryHandUsed>('unspecified');
  const [viewingDistanceCm, setViewingDistanceCm] = useState('');
  const { showHowToPlay, howToPlayMode, isSettingsOpen, setIsSettingsOpen, finishHowToPlay, openHowToPlay, closeHowToPlay, playBlocked, isMenuOpen, setIsMenuOpen } = useHowToPlayGate();
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const { requestExit } = useGameSessionLock(onExit);
  const [resultsData, setResultsData] = useState<SessionResultData | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
  const [isAssistiveTouchOpen, setIsAssistiveTouchOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [poppingActive, setPoppingActive] = useState(false);
  const [poppingIds, setPoppingIds] = useState<Set<string>>(new Set());
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());
  const [angle, setAngle] = useState(0);
  const [wheelPx, setWheelPx] = useState(Math.min(width, height) * 0.98);
  const [statsTick, setStatsTick] = useState(0);
  const [sessionGoal, setSessionGoal] = useState(26);

  const statsRef = useRef({
    clicks: 0,
    correctCount: 0,
    wrongCount: 0,
    startTime: null as number | null,
    reactionTimes: [] as number[],
    targetShownAt: null as number | null,
  });
  const sessionRef = useRef<RotatorySessionState | null>(null);
  const angleRef = useRef(0);
  const dealingRef = useRef(false);
  const hitLockRef = useRef(false);
  const bubbleSizeRef = useRef(bubbleSize);
  const stimuliColorRef = useRef(stimuliColor);
  const wheelPxRef = useRef(wheelPx);
  const bubblesRef = useRef<BubbleItem[]>([]);
  const cueModeRef = useRef(cueMode);
  const isGameStartedRef = useRef(false);
  bubbleSizeRef.current = bubbleSize;
  stimuliColorRef.current = stimuliColor;
  wheelPxRef.current = wheelPx;
  bubblesRef.current = bubbles;
  cueModeRef.current = cueMode;
  isGameStartedRef.current = isGameStarted;
  const isSettingsOpenRef = useRef(playBlocked);
  const currentTargetRef = useRef('');
  const pausedRef = useRef(isPaused);
  const engineFrozen = playBlocked || isPaused || isAssistiveTouchOpen || isResultsOpen;
  const assessmentLocked = isGameStarted && !isResultsOpen;
  usePauseShiftedClock(engineFrozen, isGameStarted, (delta) => {
    if (statsRef.current.startTime != null) statsRef.current.startTime += delta;
    if (statsRef.current.targetShownAt != null) statsRef.current.targetShownAt += delta;
    if (sessionRef.current?.openTrial) sessionRef.current.openTrial.targetShownAt += delta;
  }, statsRef.current.startTime);

  useEffect(() => {
    if (engineFrozen && isGameStarted && sessionRef.current?.openTrial) {
      interruptRotatoryTrial(sessionRef.current);
    }
  }, [engineFrozen, isGameStarted]);

  useEffect(() => {
    isSettingsOpenRef.current = playBlocked;
  }, [playBlocked]);
  useEffect(() => {
    pausedRef.current = isPaused;
  }, [isPaused]);
  useEffect(() => {
    const name = session?.user.name?.trim();
    if (!name) return;
    setPatientName((prev) => (prev === name ? prev : name));
  }, [session?.user.name]);

  const animationDurationSeconds = DEFAULT_BASE_ANIMATION_DURATION / speed;

  useEffect(() => {
    if (engineFrozen || isResultsOpen || !isGameStarted) return;
    let last = performance.now();
    let current = angle;
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      current = (current + (360 * dt) / (animationDurationSeconds * 1000)) % 360;
      angleRef.current = current;
      setAngle(current);
      raf = requestAnimationFrame(loop);
    };
    let raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineFrozen, isResultsOpen, isGameStarted, animationDurationSeconds]);

  const speakTarget = useCallback((text: string, currentMode: GameMode) => {
    if (!rotatoryCueShouldSpeak(cueModeRef.current)) return;
    speak(currentMode !== 'colors' ? `target ${text.toLowerCase()}` : text, {
      rate: 0.95,
      pitch: 1,
      language: 'en-US',
    });
  }, []);

  const bumpStats = () => setStatsTick((n) => n + 1);

  const chooseNextTarget = useCallback(
    (currentBubbles: BubbleItem[], currentMode: GameMode) => {
      if (!sessionRef.current || currentBubbles.length === 0) return;
      const nextTarget = pickBalancedRotatoryTarget(
        currentBubbles,
        currentMode,
        angleRef.current,
        sessionRef.current,
      );
      if (!nextTarget) return;
      setCurrentTarget(nextTarget);
      currentTargetRef.current = nextTarget;
      const now = performance.now();
      statsRef.current.targetShownAt = now;
      beginRotatoryTrial(sessionRef.current, {
        glyphId: nextTarget,
        bubbles: currentBubbles,
        wheelRotationDeg: angleRef.current,
        angularSpeedDegPerSec: (360 * speed) / DEFAULT_BASE_ANIMATION_DURATION,
        nowMs: now,
        sessionStartMs: statsRef.current.startTime,
      });
      if (currentMode === 'colors') {
        const colorObj = BRIGHT_COLORS.find((c) => c.name === nextTarget);
        setTargetColor(colorObj ? colorObj.code : '#ff5722');
      } else {
        setTargetColor('#ff5722');
      }
      if (!isSettingsOpenRef.current) {
        setTimeout(() => speakTarget(nextTarget, currentMode), 400);
      }
      hitLockRef.current = false;
      setPoppingActive(true);
    },
    [speakTarget, speed],
  );

  const resetStats = useCallback(() => {
    statsRef.current = {
      clicks: 0,
      correctCount: 0,
      wrongCount: 0,
      startTime: performance.now(),
      reactionTimes: [],
      targetShownAt: null,
    };
    setStatsTick((n) => n + 1);
  }, []);

  const dealNextBatch = useCallback(() => {
    if (dealingRef.current) return true;
    const session = sessionRef.current;
    if (!session) return false;
    dealingRef.current = true;
    const symbols = nextRotatoryBatch(session);
    if (!symbols) {
      dealingRef.current = false;
      return false;
    }
    setPoppingIds(new Set());
    setWrongIds(new Set());
    setPoppingActive(false);
    const containerSize =
      wheelPxRef.current > 40
        ? wheelPxRef.current
        : Math.min(width * 0.98, height * 0.98) || 500;
    const positions = placeInitialRotatoryPositions(symbols.length, {
      containerSize,
      bubbleSize: bubbleSizeRef.current,
    });
    const newBubbles: BubbleItem[] = symbols.map((symbol, i) =>
      makeRotatoryBubbleItem(symbol, mode, positions[i]!, stimuliColorRef.current, i),
    );
    setBubbles(newBubbles);
    setTimeout(() => {
      dealingRef.current = false;
      if (isGameStartedRef.current) chooseNextTarget(newBubbles, mode);
    }, 300);
    return true;
  }, [mode, width, height, chooseNextTarget]);

  const startNewSession = useCallback(() => {
    const deviceTier = getDeviceTier(width, height);
    const parsedDistance = Number.parseFloat(viewingDistanceCm);
    sessionRef.current = createRotatorySession(mode, variant, deviceTier, undefined, {
      cueMode,
      handUsed,
      viewingDistanceCm: Number.isFinite(parsedDistance) && parsedDistance > 0 ? parsedDistance : null,
    });
    setSessionGoal(sessionRef.current.deck.length + 3);
    dealingRef.current = false;
    hitLockRef.current = false;
    resetStats();
    setBubbles([]);
    dealNextBatch();
  }, [mode, variant, cueMode, handUsed, viewingDistanceCm, width, height, resetStats, dealNextBatch]);

  useEffect(() => {
    startNewSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, variant]);

  const finishSession = (opts?: { abandoned?: boolean }) => {
    const session = sessionRef.current;
    if (!session) return;
    setPoppingActive(false);
    if (opts?.abandoned) session.abandoned = true;
    if (session.openTrial) {
      finalizeRotatoryOpenTrial(session, {
        nowMs: performance.now(),
        wheelRotationDeg: angleRef.current,
      });
    }
    const st = statsRef.current.startTime;
    const totalTime = st ? (performance.now() - st) / 1000 : 0;
    const finalData = summarizeRotatorySession(session, {
      patientName,
      sessionId: Math.floor(1000 + Math.random() * 9000),
      date: new Date().toLocaleDateString('en-GB'),
      gameName: `Rotatory Wheel (${mode} - ${variant})`,
      letterSize,
      speed: `${speed}x`,
      durationSec: Math.round(totalTime),
      clicksTotal: statsRef.current.clicks,
      wrong: statsRef.current.wrongCount,
      screenWidthPx: width,
      screenHeightPx: height,
      orientation: width >= height ? 'landscape' : 'portrait',
      ...clinicalColorSessionFields(wheelColor, stimuliColor, 1),
    });
    setResultsData(finalData);
    setIsResultsOpen(true);
    setIsPaused(true);
    bumpStats();
  };

  const handleBubbleClick = (clickedBubble: BubbleItem) => {
    if (!poppingActive) return;
    const clickedValue = rotatoryBubbleValue(clickedBubble, mode);
    if (clickedValue === currentTarget && hitLockRef.current) return;
    statsRef.current.clicks += 1;
    if (clickedValue === currentTarget) {
      hitLockRef.current = true;
      void hapticCorrect();
      const now = performance.now();
      if (sessionRef.current) {
        const trial = completeRotatoryTrial(sessionRef.current, {
          tapLocalXPct: clickedBubble.x,
          tapLocalYPct: clickedBubble.y,
          wheelRotationDeg: angleRef.current,
          nowMs: now,
        });
        if (trial?.validForRt) statsRef.current.reactionTimes.push(trial.reactionMs);
      }
      statsRef.current.targetShownAt = null;
      statsRef.current.correctCount += 1;
      bumpStats();
      setPoppingIds((prev) => new Set(prev).add(clickedBubble.id));
      setTimeout(() => {
        let remaining = bubblesRef.current.filter((b) => b.id !== clickedBubble.id);
        if (sessionRef.current && rotatoryWarmupComplete(sessionRef.current) && sessionRef.current.phase === 'warmup') {
          advanceRotatoryToScored(sessionRef.current);
          dealingRef.current = false;
          dealNextBatch();
          return;
        }
        if (sessionRef.current && rotatoryDeckComplete(sessionRef.current)) {
          bubblesRef.current = remaining;
          setBubbles(remaining);
          setPoppingActive(false);
          void hapticCorrect();
          finishSession();
          return;
        }

        const avoid = new Set(remaining.map((b) => rotatoryBubbleValue(b, mode)));
        const nextSymbol = sessionRef.current
          ? takeNextRotatorySymbol(sessionRef.current, avoid)
          : null;
        if (nextSymbol) {
          const containerSize =
            wheelPxRef.current > 40
              ? wheelPxRef.current
              : Math.min(width * 0.98, height * 0.98) || 500;
          const pos = nextRotatoryRefillPosition(
            { x: clickedBubble.x, y: clickedBubble.y },
            remaining.map((b) => ({ x: b.x, y: b.y })),
            { containerSize, bubbleSize: bubbleSizeRef.current },
          );
          remaining = [
            ...remaining,
            makeRotatoryBubbleItem(
              nextSymbol,
              mode,
              pos,
              stimuliColorRef.current,
              sessionRef.current?.dealtCount ?? remaining.length,
            ),
          ];
        }

        bubblesRef.current = remaining;
        setBubbles(remaining);
        setPoppingIds(new Set());
        setPoppingActive(false);

        if (remaining.length === 0) {
          if (sessionRef.current?.phase === 'warmup') {
            advanceRotatoryToScored(sessionRef.current);
            dealingRef.current = false;
            dealNextBatch();
            return;
          }
          finishSession();
          return;
        }
        setTimeout(() => chooseNextTarget(remaining, mode), 200);
      }, 250);
    } else {
      void hapticWrong();
      if (sessionRef.current) noteRotatoryWrong(sessionRef.current, 'discrimination', { nowMs: performance.now() });
      statsRef.current.wrongCount += 1;
      bumpStats();
      setWrongIds((prev) => new Set(prev).add(clickedBubble.id));
      setTimeout(() => {
        setWrongIds((prev) => {
          const next = new Set(prev);
          next.delete(clickedBubble.id);
          return next;
        });
      }, 300);
    }
  };

  const handleWheelClick = () => {
    if (!engineFrozen && poppingActive) {
      statsRef.current.clicks += 1;
      statsRef.current.wrongCount += 1;
      if (sessionRef.current) noteRotatoryWrong(sessionRef.current, 'aim', { nowMs: performance.now() });
      bumpStats();
      void hapticMiss();
    }
  };

  const handleStartGame = () => {
    setIsGameStarted(true);
    setIsPaused(false);
    const now = performance.now();
    statsRef.current.clicks = 0;
    statsRef.current.wrongCount = 0;
    statsRef.current.correctCount = 0;
    statsRef.current.startTime = now;
    statsRef.current.reactionTimes = [];
    statsRef.current.targetShownAt = now;
    if (sessionRef.current) {
      sessionRef.current.cueMode = cueMode;
      sessionRef.current.handUsed = handUsed;
      const parsedDistance = Number.parseFloat(viewingDistanceCm);
      sessionRef.current.viewingDistanceCm =
        Number.isFinite(parsedDistance) && parsedDistance > 0 ? parsedDistance : null;
    }
    if (sessionRef.current?.openTrial) {
      sessionRef.current.openTrial.targetShownAt = now;
    } else if (bubblesRef.current.length) {
      chooseNextTarget(bubblesRef.current, mode);
    }
    bumpStats();
  };

  const openSettings = () => {
    setIsAssistiveTouchOpen(false);
    setIsPaused(true);
    stopSpeaking();
    setIsSettingsOpen(true);
  };

  const scaledBubble = bubbleSize;
  const letterPx = Math.round(16 * letterSize * (scaledBubble / 90));
  const modeTitle =
    mode === 'colors'
      ? 'Color Discriminant Wheel'
      : mode === 'numbers'
        ? 'Numeric Rotatory'
        : variant === 'lowercase'
          ? 'Lowercase Alphabets'
          : 'Uppercase Alphabets';
  const modeSubtitle =
    mode === 'colors'
      ? 'Color Discriminant Rotatory'
      : `${variant === 'lowercase' ? 'Lowercase' : 'Uppercase'} Rotatory`;
  const fabSize = s(40);
  const bottomPad = insets.bottom + s(12);
  const rightPad = s(12);

  void statsTick;

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A12' }}>
      {notification ? (
        <View
          style={{
            position: 'absolute',
            top: insets.top + s(12),
            right: s(16),
            zIndex: 300,
            backgroundColor: 'rgba(5,150,105,0.92)',
            paddingHorizontal: s(16),
            paddingVertical: s(10),
            borderRadius: s(16),
            borderWidth: 1,
            borderColor: 'rgba(52,211,153,0.35)',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: fs(13) }}>✓ {notification}</Text>
        </View>
      ) : null}

      {!isGameStarted && !showHowToPlay && !isSettingsOpen && !isResultsOpen ? (
        <View style={{ ...absoluteFill, alignItems: 'center', justifyContent: 'center', zIndex: 200, backgroundColor: 'rgba(6,7,13,0.98)' }}>
          <Text style={{ color: '#fff', fontSize: fs(26), fontWeight: '900', marginBottom: s(12) }}>{modeTitle}</Text>
          <Pressable
            onPress={handleStartGame}
            style={{ backgroundColor: '#34D399', borderRadius: 999, paddingHorizontal: s(28), paddingVertical: s(16) }}
          >
            <Text style={{ fontWeight: '900', fontSize: fs(20) }}>Click to Start</Text>
          </Pressable>
        </View>
      ) : null}

      <View
        onLayout={(e) => {
          const { width: w, height: h } = e.nativeEvent.layout;
          setWheelPx(Math.min(w, h) * 0.98);
        }}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: wheelPx,
            height: wheelPx,
            borderRadius: wheelPx / 2,
            backgroundColor: 'rgba(59,130,246,0.1)',
          }}
        />
        <Pressable
          onPress={handleWheelClick}
          style={{
            width: wheelPx,
            height: wheelPx,
            borderRadius: wheelPx / 2,
            backgroundColor: wheelColor,
            transform: [{ rotate: `${angle}deg` }],
            overflow: 'visible',
          }}
        >
          {bubbles.map((bubble) => {
            const popping = poppingIds.has(bubble.id);
            const wrong = wrongIds.has(bubble.id);
            const paint = resolveBubblePaint(bubbleAppearance, bubble.color || '#FFFFFF', {
              borderFill: 'transparent',
              solidBorderWidth: 0,
            });
            return (
              <Pressable
                key={bubble.id}
                onPress={() => handleBubbleClick(bubble)}
                style={{
                  position: 'absolute',
                  left: `${bubble.x}%`,
                  top: `${bubble.y}%`,
                  width: scaledBubble,
                  height: scaledBubble,
                  marginLeft: -scaledBubble / 2,
                  marginTop: -scaledBubble / 2,
                  borderRadius: scaledBubble / 2,
                  backgroundColor: paint.backgroundColor,
                  borderWidth: paint.borderWidth,
                  borderColor: paint.borderColor,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: popping ? 0.2 : 1,
                  transform: [{ scale: popping ? 0.4 : wrong ? 1.08 : 1 }, { rotate: `${-angle}deg` }],
                }}
              >
                <Text style={{ color: paint.textColor, fontWeight: '900', fontSize: letterPx }}>
                  {mode === 'colors' ? '' : bubble.symbol}
                </Text>
              </Pressable>
            );
          })}
        </Pressable>
      </View>

      {/* Bottom-right floating controls (matches website assistive-touch chrome).
          TODO: device-config — native fullscreen APIs are not used on RN; web has a fullscreen toggle here. */}
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
        <Pressable
          onPress={() => speakTarget(currentTarget, mode)}
          hitSlop={8}
          style={{
            width: fabSize,
            height: fabSize,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'transparent',
          }}
        >
          <ReplayIcon size={18} color="rgba(148,163,184,0.32)" />
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
        >
          {rotatoryCueShowsBanner(cueMode) ? (
            mode === 'colors' ? (
            <View
              style={{
                width: s(14),
                height: s(14),
                borderRadius: s(7),
                backgroundColor: targetColor,
                borderWidth: 1,
                borderColor: '#fff',
              }}
            />
          ) : (
            <Text style={{ color: targetColor, fontWeight: '900', fontSize: fs(14) }}>{currentTarget || '—'}</Text>
          )
          ) : (
            <Text style={{ color: '#BFDBFE', fontWeight: '800', fontSize: fs(9) }}>Listen</Text>
          )}
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
          onPress={() => setIsHeaderExpanded((prev) => !prev)}
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
      </View>

      {isAssistiveTouchOpen ? (
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
            <Text style={{ color: '#D1D5DB', fontWeight: '800', fontSize: fs(11), letterSpacing: 0.8 }}>CONTROLS</Text>
            <Pressable onPress={() => setIsAssistiveTouchOpen(false)}>
              <Text style={{ color: '#9CA3AF', fontWeight: '800' }}>✕</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => speakTarget(currentTarget, mode)}
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
              {mode === 'colors' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
                  <View
                    style={{
                      width: s(18),
                      height: s(18),
                      borderRadius: s(9),
                      backgroundColor: targetColor,
                      borderWidth: 1,
                      borderColor: '#fff',
                    }}
                  />
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: fs(12) }}>{currentTarget}</Text>
                </View>
              ) : (
                <Text style={{ color: targetColor, fontWeight: '900', fontSize: fs(20) }}>{currentTarget}</Text>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
              <VolumeIcon size={14} color="#60A5FA" />
              <Text style={{ color: '#60A5FA', fontWeight: '800', fontSize: fs(11) }}>Replay</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() =>
              setIsPaused((prev) => {
                const next = !prev;
                if (next && isGameStarted && sessionRef.current?.openTrial) {
                  interruptRotatoryTrial(sessionRef.current);
                }
                return next;
              })
            }
            style={{
              backgroundColor: isPaused ? '#059669' : '#1F2937',
              borderRadius: s(16),
              paddingVertical: s(10),
              alignItems: 'center',
              marginBottom: s(8),
              flexDirection: 'row',
              justifyContent: 'center',
              gap: s(8),
            }}
          >
            {isPaused ? <PlayIcon size={14} color="#fff" /> : <PauseIcon size={14} color="#fff" />}
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: fs(12) }}>{isPaused ? 'Play' : 'Pause'}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setIsAssistiveTouchOpen(false);
              openHowToPlay();
            }}
            style={{
              backgroundColor: 'rgba(5,150,105,0.22)',
              borderRadius: s(16),
              paddingVertical: s(10),
              alignItems: 'center',
              marginBottom: s(8),
              flexDirection: 'row',
              justifyContent: 'center',
              gap: s(8),
              borderWidth: 1,
              borderColor: 'rgba(52,211,153,0.4)',
            }}
          >
            <Text style={{ color: '#6EE7B7', fontWeight: '800', fontSize: fs(12) }}>How to play?</Text>
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
            style={{ backgroundColor: '#1F2937', borderRadius: s(16), paddingVertical: s(10), alignItems: 'center', marginBottom: s(8) }}
          >
            <Text style={{ color: '#E5E7EB', fontWeight: '800', fontSize: fs(12) }}>Reset Game</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              const inProgress = isGameStarted && !isResultsOpen;
              if (inProgress) setConfirmQuit(true);
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

      {isHeaderExpanded ? (
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
              <Text style={{ color: '#9CA3AF', fontSize: fs(11) }}>{modeSubtitle}</Text>
            </View>
            <Pressable onPress={() => setIsHeaderExpanded(false)}>
              <Text style={{ color: '#9CA3AF', fontWeight: '800' }}>✕</Text>
            </Pressable>
          </View>
          <Text style={{ color: '#9CA3AF', fontSize: fs(10), fontWeight: '800', marginBottom: s(6) }}>
            CLINICAL PARAMETERS
          </Text>
          <InfoRow label="Patient" value={patientName} />
          {mode === 'colors' ? null : <InfoRow label="Letter Size" value={`${letterSize} rem`} accent="#60A5FA" />}
          <InfoRow label="Bubble Size" value={`${bubbleSize} px`} accent="#60A5FA" />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: s(4) }}>
            <Text style={{ color: '#9CA3AF', fontSize: fs(12) }}>Wheel Color</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
              <View
                style={{
                  width: s(12),
                  height: s(12),
                  borderRadius: s(6),
                  backgroundColor: wheelColor,
                  borderWidth: 1,
                  borderColor: '#4B5563',
                }}
              />
              <Text style={{ color: '#E5E7EB', fontSize: fs(11) }}>{wheelColorLabel(wheelColor)}</Text>
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: '#1F2937', marginVertical: s(8) }} />
          <Text style={{ color: '#9CA3AF', fontSize: fs(10), fontWeight: '800', marginBottom: s(6) }}>LIVE METRICS</Text>
          <InfoRow label="Targets" value={`${statsRef.current.correctCount} / ${sessionGoal}`} accent="#34D399" />
          <InfoRow label="Wrong Clicks" value={String(statsRef.current.wrongCount)} accent="#FB7185" />
        </View>
      ) : null}

      <HowToPlayManual
        moduleId="rotatory"
        isOpen={showHowToPlay}
        mode={howToPlayMode}
        onContinue={finishHowToPlay}
        onClose={closeHowToPlay}
      />
      <ClinicalSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          if (!isGameStarted) {
            setIsPaused(true);
          } else {
            setIsPaused(false);
          }
        }}
        onApply={(next) => {
          setPatientName(next.patientName);
          setLetterSize(next.letterSize);
          setBubbleSize(next.bubbleSize);
          bubbleSizeRef.current = next.bubbleSize;
          if (next.speed !== undefined) setSpeed(next.speed);
          if (next.wheelColor !== undefined) setWheelColor(next.wheelColor);
          if (next.stimuliColor !== undefined) {
            setStimuliColor(next.stimuliColor);
            stimuliColorRef.current = next.stimuliColor;
          }
          if (next.bubbleAppearance !== undefined) setBubbleAppearance(next.bubbleAppearance);
          setNotification('Settings Applied Successfully!');
          setTimeout(() => setNotification(null), 2500);
          setIsSettingsOpen(false);
          setIsGameStarted(false);
          setIsPaused(true);
          startNewSession();
        }}
        patientName={patientName}
        letterSize={letterSize}
        bubbleSize={bubbleSize}
        speed={speed}
        wheelColor={wheelColor}
        showWheelColorControl
        showLetterSizeControl={mode !== 'colors'}
        showStimuliColorPicker={mode !== 'colors'}
        stimuliColor={stimuliColor}
        showBubbleAppearancePicker
        bubbleAppearance={bubbleAppearance}
        sampleSymbol={mode === 'colors' ? '' : mode === 'numbers' ? '5' : variant === 'lowercase' ? 'a' : 'A'}
        sessionLocked={isGameStarted && !isResultsOpen}
      />
      {resultsData ? (
        <GameResultsModal
          isOpen={isResultsOpen}
          data={resultsData}
          onClose={() => {
            setIsResultsOpen(false);
            requestExit();
          }}
          onReplay={() => {
            setIsResultsOpen(false);
            setIsGameStarted(false);
            setIsPaused(true);
            startNewSession();
          }}
        />
      ) : null}
      <GameMenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onOpenHowToPlay={openHowToPlay}
        onQuit={() => {
          if (isGameStarted && !isResultsOpen && sessionRef.current?.trials.length) {
            finishSession({ abandoned: true });
            return;
          }
          requestExit();
        }}
        sessionInProgress={isGameStarted && !isResultsOpen}
        onReset={() => {
          setIsGameStarted(false);
          setIsPaused(true);
          startNewSession();
        }}
        extraControls={
          <View style={{ gap: 10 }}>
            <Text style={{ color: '#9CA3AF', fontWeight: '700' }}>
              Speed {assessmentLocked ? '(locked)' : ''}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {SPEED_PRESETS.map((s) => (
                <Pressable
                  key={s}
                  disabled={assessmentLocked}
                  onPress={() => {
                    if (!assessmentLocked) setSpeed(s);
                  }}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: speed === s ? '#3B82F6' : '#374151',
                    opacity: assessmentLocked ? 0.5 : 1,
                  }}
                >
                  <Text style={{ color: speed === s ? '#60A5FA' : '#D1D5DB', fontWeight: '700' }}>{s}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={{ color: '#9CA3AF', fontWeight: '700' }}>Cue mode</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['both', 'visual', 'audio'] as RotatoryCueMode[]).map((item) => (
                <Pressable
                  key={item}
                  disabled={assessmentLocked}
                  onPress={() => {
                    if (!assessmentLocked) setCueMode(item);
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: cueMode === item ? '#3B82F6' : '#374151',
                    opacity: assessmentLocked ? 0.5 : 1,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: cueMode === item ? '#60A5FA' : '#D1D5DB', fontWeight: '700', fontSize: 12 }}>
                    {item}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={{ color: '#9CA3AF', fontWeight: '700' }}>Hand used</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['unspecified', 'left', 'right'] as RotatoryHandUsed[]).map((item) => (
                <Pressable
                  key={item}
                  disabled={assessmentLocked}
                  onPress={() => {
                    if (!assessmentLocked) setHandUsed(item);
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: handUsed === item ? '#3B82F6' : '#374151',
                    opacity: assessmentLocked ? 0.5 : 1,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: handUsed === item ? '#60A5FA' : '#D1D5DB', fontWeight: '700', fontSize: 11 }}>
                    {item === 'unspecified' ? 'Not set' : item}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={{ color: '#9CA3AF', fontWeight: '700' }}>Viewing distance (cm)</Text>
            <TextInput
              editable={!assessmentLocked}
              keyboardType="numeric"
              value={viewingDistanceCm}
              onChangeText={setViewingDistanceCm}
              placeholder="e.g. 40"
              placeholderTextColor="#6B7280"
              style={{
                borderWidth: 1,
                borderColor: '#374151',
                borderRadius: 8,
                color: '#fff',
                paddingHorizontal: 12,
                paddingVertical: 8,
                opacity: assessmentLocked ? 0.5 : 1,
              }}
            />
          </View>
        }
        resetButtonLabel="Reset Level"
        onOpenSettings={() => setIsSettingsOpen(true)}
        settingsSummary={[
          { label: 'Patient', value: patientName },
          ...(mode === 'colors' ? [] : [{ label: 'Letter Size', value: String(letterSize) }]),
          { label: 'Bubble Size', value: String(bubbleSize) },
          ...(mode === 'colors'
            ? []
            : [{ label: 'Stimuli Color', value: stimuliColorLabel(stimuliColor) }]),
          { label: 'Bubble Style', value: bubbleAppearanceLabel(bubbleAppearance) },
          {
            label: 'Wheel Color',
            value: (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: wheelColor,
                    borderWidth: 1,
                    borderColor: '#4B5563',
                  }}
                />
                <Text style={{ color: '#D1D5DB', fontSize: 11 }}>{wheelColorLabel(wheelColor)}</Text>
              </View>
            ),
          },
        ]}
      />
      <ResetConfirmDialog
        visible={confirmReset}
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          setIsAssistiveTouchOpen(false);
          startNewSession();
        }}
      />
      <ResetConfirmDialog
        visible={confirmQuit}
        title="Leave this game?"
        message="This session isn't finished yet. Leaving will save it as abandoned so the taps are not lost."
        confirmLabel="Leave"
        onCancel={() => setConfirmQuit(false)}
        onConfirm={() => {
          setConfirmQuit(false);
          setIsAssistiveTouchOpen(false);
          if (sessionRef.current?.trials.length) {
            finishSession({ abandoned: true });
            return;
          }
          requestExit();
        }}
      />
    </View>
  );
}

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
      <Text style={{ color: '#9CA3AF', fontSize: 12 }}>{label}</Text>
      <Text style={{ color: accent || '#fff', fontWeight: '700', fontSize: 12 }}>{value}</Text>
    </View>
  );
}

const absoluteFill = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };
