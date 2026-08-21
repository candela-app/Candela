import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlphabetVariant,
  BRIGHT_COLORS,
  BUBBLES_PER_ROUND,
  BubbleItem,
  BubblePosition,
  DEFAULT_BASE_ANIMATION_DURATION,
  GameMode,
  SessionResultData,
  checkOverlap,
  getContrastColor,
  getDeviceTier,
  getMinDistancePercent,
  getRandomSymbol,
  getSlotFallbackPosition,
} from '@candela/shared/rn';
import { ClinicalSettingsModal } from '../components/ClinicalSettingsModal';
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
  const [customColors] = useState(['#FFFFFF', '#2F80FF', '#FF3B30']);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
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

  const statsRef = useRef({
    clicks: 0,
    correctCount: 0,
    wrongCount: 0,
    startTime: null as number | null,
    reactionTimes: [] as number[],
    targetShownAt: null as number | null,
  });
  const isSettingsOpenRef = useRef(isSettingsOpen);
  const currentTargetRef = useRef('');
  const pausedRef = useRef(isPaused);

  useEffect(() => {
    isSettingsOpenRef.current = isSettingsOpen;
  }, [isSettingsOpen]);
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
    if (isPaused || isSettingsOpen || isResultsOpen || !isGameStarted) return;
    let last = performance.now();
    let current = angle;
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      current = (current + (360 * dt) / (animationDurationSeconds * 1000)) % 360;
      setAngle(current);
      raf = requestAnimationFrame(loop);
    };
    let raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaused, isSettingsOpen, isResultsOpen, isGameStarted, animationDurationSeconds]);

  const speakTarget = useCallback((text: string, currentMode: GameMode) => {
    speak(currentMode !== 'colors' ? `target ${text.toLowerCase()}` : text, {
      rate: 0.95,
      pitch: 1,
      language: 'en-US',
    });
  }, []);

  const bumpStats = () => setStatsTick((n) => n + 1);

  const chooseNextTarget = useCallback(
    (currentBubbles: BubbleItem[], currentMode: GameMode) => {
      if (currentBubbles.length === 0) return;
      const remainingSymbols = Array.from(
        new Set(currentBubbles.map((b) => (currentMode === 'colors' ? b.colorName || '' : b.symbol))),
      ).filter(Boolean);
      if (remainingSymbols.length === 0) return;
      const nextTarget = remainingSymbols[Math.floor(Math.random() * remainingSymbols.length)];
      setCurrentTarget(nextTarget);
      currentTargetRef.current = nextTarget;
      statsRef.current.targetShownAt = performance.now();
      if (currentMode === 'colors') {
        const colorObj = BRIGHT_COLORS.find((c) => c.name === nextTarget);
        setTargetColor(colorObj ? colorObj.code : '#ff5722');
      } else {
        setTargetColor('#ff5722');
      }
      if (!isSettingsOpenRef.current) {
        setTimeout(() => speakTarget(nextTarget, currentMode), 400);
      }
      setPoppingActive(true);
    },
    [speakTarget],
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

  const startLevel = useCallback(() => {
    setBubbles([]);
    setPoppingIds(new Set());
    setWrongIds(new Set());
    setPoppingActive(false);
    const newBubbles: BubbleItem[] = [];
    const positions: BubblePosition[] = [];
    const containerSize = wheelPx;
    const minDistance = getMinDistancePercent(bubbleSize, containerSize, 2);
    const deviceTier = getDeviceTier(width, height);
    const bubblesPerRound = BUBBLES_PER_ROUND[deviceTier];

    for (let i = 0; i < bubblesPerRound; i += 1) {
      const symbol = getRandomSymbol(mode, variant);
      let pos: BubblePosition = { x: 50, y: 50 };
      let valid = false;
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const a = Math.random() * 2 * Math.PI;
        const maxR = containerSize / 2 - bubbleSize / 2 - 12;
        const radius = Math.sqrt(Math.random()) * maxR;
        const x = 50 + (radius * Math.cos(a)) / (containerSize / 100);
        const y = 50 + (radius * Math.sin(a)) / (containerSize / 100);
        pos = { x, y };
        if (!checkOverlap(pos, positions, minDistance)) {
          valid = true;
          break;
        }
      }
      if (!valid) {
        pos = getSlotFallbackPosition(i, bubblesPerRound, containerSize, bubbleSize);
      }
      positions.push(pos);
      let bgColor = '';
      let colorName = '';
      if (mode === 'colors') {
        const colorObj = BRIGHT_COLORS.find((c) => c.name === symbol) || BRIGHT_COLORS[0];
        bgColor = colorObj.code;
        colorName = colorObj.name;
      } else {
        bgColor = customColors[i % customColors.length];
      }
      newBubbles.push({
        id: `bubble-${i}-${Date.now()}-${Math.random()}`,
        symbol,
        color: bgColor,
        colorName,
        x: pos.x,
        y: pos.y,
      });
    }
    setBubbles(newBubbles);
    setTimeout(() => chooseNextTarget(newBubbles, mode), 300);
  }, [mode, variant, bubbleSize, customColors, chooseNextTarget, wheelPx, width, height]);

  useEffect(() => {
    resetStats();
    startLevel();
  }, [mode, variant, resetStats, startLevel]);

  const finishSession = (currentMode: GameMode) => {
    const st = statsRef.current.startTime;
    const totalTime = st ? (performance.now() - st) / 1000 : 0;
    const rTimes = statsRef.current.reactionTimes;
    const avgReact = rTimes.length ? rTimes.reduce((a, b) => a + b, 0) / rTimes.length / 1000 : 0;
    const finalData: SessionResultData = {
      patientName,
      sessionId: Math.floor(1000 + Math.random() * 9000),
      date: new Date().toLocaleDateString('en-GB'),
      gameName: `Rotatory Wheel (${currentMode} - ${variant})`,
      stimuliCount: statsRef.current.correctCount,
      letterSize,
      speed: `${speed}x`,
      durationSec: Math.round(totalTime),
      clicksTotal: statsRef.current.clicks,
      correct: statsRef.current.correctCount,
      wrong: statsRef.current.wrongCount,
      accuracy:
        statsRef.current.clicks > 0
          ? Math.round((statsRef.current.correctCount / statsRef.current.clicks) * 100)
          : 100,
      avgReactionSec: parseFloat(avgReact.toFixed(2)),
    };
    setResultsData(finalData);
    setIsResultsOpen(true);
    setIsPaused(true);
    bumpStats();
  };

  const handleBubbleClick = (clickedBubble: BubbleItem) => {
    if (!poppingActive) return;
    statsRef.current.clicks += 1;
    const clickedValue = mode === 'colors' ? clickedBubble.colorName : clickedBubble.symbol;
    if (clickedValue === currentTarget) {
      void hapticCorrect();
      if (statsRef.current.targetShownAt) {
        statsRef.current.reactionTimes.push(performance.now() - statsRef.current.targetShownAt);
      }
      statsRef.current.targetShownAt = performance.now();
      statsRef.current.correctCount += 1;
      bumpStats();
      setPoppingIds((prev) => new Set(prev).add(clickedBubble.id));
      setTimeout(() => {
        setBubbles((prevBubbles) => {
          const updatedBubbles = prevBubbles.filter((b) => b.id !== clickedBubble.id);
          if (statsRef.current.correctCount >= 20) {
            setPoppingActive(false);
            void hapticCorrect();
            finishSession(mode);
            return updatedBubbles;
          }
          const stillLeft = updatedBubbles.some((b) =>
            mode === 'colors' ? b.colorName === currentTarget : b.symbol === currentTarget,
          );
          if (!stillLeft) {
            setPoppingActive(false);
            if (updatedBubbles.length === 0) {
              void hapticCorrect();
              setTimeout(() => startLevel(), 500);
            } else {
              setTimeout(() => chooseNextTarget(updatedBubbles, mode), 600);
            }
          }
          return updatedBubbles;
        });
      }, 250);
    } else {
      void hapticWrong();
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
    if (!isPaused && poppingActive) {
      statsRef.current.clicks += 1;
      statsRef.current.wrongCount += 1;
      bumpStats();
      void hapticMiss();
    }
  };

  const handleStartGame = () => {
    setIsGameStarted(true);
    setIsPaused(false);
    resetStats();
    if (currentTargetRef.current) {
      const targetText = currentTargetRef.current;
      setTimeout(() => speakTarget(targetText, mode), 200);
    }
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

      {!isGameStarted && !isSettingsOpen && !isResultsOpen ? (
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
            overflow: 'hidden',
          }}
        >
          {bubbles.map((bubble) => {
            const popping = poppingIds.has(bubble.id);
            const wrong = wrongIds.has(bubble.id);
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
                  backgroundColor: bubble.color,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: popping ? 0.2 : 1,
                  transform: [{ scale: popping ? 0.4 : wrong ? 1.08 : 1 }, { rotate: `${-angle}deg` }],
                }}
              >
                <Text style={{ color: getContrastColor(bubble.color || '#fff'), fontWeight: '900', fontSize: letterPx }}>
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
          {mode === 'colors' ? (
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
            onPress={() => setIsPaused((prev) => !prev)}
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
              <Text style={{ color: '#E5E7EB', fontSize: fs(11), fontFamily: 'monospace' }}>{wheelColor}</Text>
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: '#1F2937', marginVertical: s(8) }} />
          <Text style={{ color: '#9CA3AF', fontSize: fs(10), fontWeight: '800', marginBottom: s(6) }}>LIVE METRICS</Text>
          <InfoRow label="Correct Hits" value={`${statsRef.current.correctCount} / 20`} accent="#34D399" />
          <InfoRow label="Wrong Clicks" value={String(statsRef.current.wrongCount)} accent="#FB7185" />
        </View>
      ) : null}

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
          if (next.speed !== undefined) setSpeed(next.speed);
          if (next.wheelColor !== undefined) setWheelColor(next.wheelColor);
          setNotification('Settings Applied Successfully!');
          setTimeout(() => setNotification(null), 2500);
          setIsSettingsOpen(false);
          if (isGameStarted) {
            setIsPaused(false);
            resetStats();
            startLevel();
            if (currentTargetRef.current) {
              const targetText = currentTargetRef.current;
              setTimeout(() => speakTarget(targetText, mode), 200);
            }
          } else {
            setIsPaused(true);
          }
        }}
        patientName={patientName}
        letterSize={letterSize}
        bubbleSize={bubbleSize}
        speed={speed}
        wheelColor={wheelColor}
        showWheelColorControl
        showLetterSizeControl={mode !== 'colors'}
        sampleSymbol={mode === 'colors' ? '' : mode === 'numbers' ? '5' : variant === 'lowercase' ? 'a' : 'A'}
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
            resetStats();
            startLevel();
            setIsPaused(false);
            setIsGameStarted(true);
          }}
        />
      ) : null}
      <GameMenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onQuit={() => requestExit()}
        sessionInProgress={isGameStarted && !isResultsOpen}
        onReset={startLevel}
        resetButtonLabel="Reset Level"
        settingsSummary={[
          { label: 'Patient', value: patientName },
          ...(mode === 'colors' ? [] : [{ label: 'Letter Size', value: String(letterSize) }]),
          { label: 'Bubble Size', value: String(bubbleSize) },
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
                <Text style={{ color: '#D1D5DB', fontSize: 11 }}>{wheelColor}</Text>
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
          resetStats();
          startLevel();
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
