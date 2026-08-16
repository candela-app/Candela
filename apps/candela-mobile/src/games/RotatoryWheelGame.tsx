import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
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
import { hapticCorrect, hapticWrong } from '../lib/haptics';
import { useLayout } from '../lib/layout';
import { speak } from '../lib/speech';

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
  const { width, height, s, fs } = useLayout();
  const [mode] = useState<GameMode>(initialMode);
  const [variant] = useState<AlphabetVariant>(initialVariant);
  const [isPaused, setIsPaused] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [bubbles, setBubbles] = useState<BubbleItem[]>([]);
  const [currentTarget, setCurrentTarget] = useState('');
  const [targetColor, setTargetColor] = useState('#ff5722');
  const [patientName, setPatientName] = useState('Demo Patient');
  const [letterSize, setLetterSize] = useState(1.8);
  const [bubbleSize, setBubbleSize] = useState(90);
  const [wheelColor, setWheelColor] = useState('#000000');
  const [customColors] = useState(['#FFFFFF', '#2F80FF', '#FF3B30']);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [resultsData, setResultsData] = useState<SessionResultData | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [poppingActive, setPoppingActive] = useState(false);
  const [poppingIds, setPoppingIds] = useState<Set<string>>(new Set());
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());
  const [angle, setAngle] = useState(0);
  const [wheelPx, setWheelPx] = useState(Math.min(width, height) * 0.78);

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

  const speakTarget = useCallback(
    (text: string, currentMode: GameMode) => {
      speak(currentMode !== 'colors' ? `target ${text.toLowerCase()}` : text, {
        rate: 0.82,
        pitch: 1.4,
        language: 'en-IN',
      });
    },
    [],
  );

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
      setPoppingIds((prev) => new Set(prev).add(clickedBubble.id));
      setTimeout(() => {
        setBubbles((prevBubbles) => {
          const updatedBubbles = prevBubbles.filter((b) => b.id !== clickedBubble.id);
          if (statsRef.current.correctCount >= 20) {
            setPoppingActive(false);
            finishSession(mode);
            return updatedBubbles;
          }
          const stillLeft = updatedBubbles.some((b) =>
            mode === 'colors' ? b.colorName === currentTarget : b.symbol === currentTarget,
          );
          if (!stillLeft) {
            setPoppingActive(false);
            if (updatedBubbles.length === 0) {
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

  const scaledBubble = Math.round(bubbleSize * Math.min(1.15, Math.max(0.75, wheelPx / 420)));
  const letterPx = Math.round(16 * letterSize * (scaledBubble / 90));

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A12' }}>
      {notification ? (
        <View style={{ position: 'absolute', top: s(48), right: s(16), zIndex: 40, backgroundColor: '#059669', padding: s(12), borderRadius: s(14) }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>✓ {notification}</Text>
        </View>
      ) : null}

      {!isGameStarted && !isSettingsOpen && !isResultsOpen ? (
        <View style={{ ...absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(6,7,13,0.98)', zIndex: 30, padding: s(24) }}>
          <Text style={{ color: '#000', backgroundColor: '#FBBF24', fontWeight: '900', paddingHorizontal: s(12), paddingVertical: s(6), borderRadius: 999, overflow: 'hidden', marginBottom: s(16) }}>
            VISION THERAPY GAME READY
          </Text>
          <Text style={{ color: '#fff', fontSize: fs(28), fontWeight: '900', textAlign: 'center', marginBottom: s(12) }}>
            {mode === 'colors'
              ? 'Color Discriminant Wheel'
              : variant === 'lowercase'
                ? 'Lowercase Alphabets'
                : mode === 'numbers'
                  ? 'Numeric Rotatory'
                  : 'Uppercase Alphabets'}
          </Text>
          <Text style={{ color: '#E5E7EB', marginBottom: s(20) }}>
            Patient: {patientName}  |  Speed: {speed}x
          </Text>
          <Pressable
            onPress={() => {
              setIsGameStarted(true);
              setIsPaused(false);
              resetStats();
              if (currentTargetRef.current) {
                setTimeout(() => speakTarget(currentTargetRef.current, mode), 200);
              }
            }}
            style={{ backgroundColor: '#34D399', borderRadius: 999, paddingHorizontal: s(28), paddingVertical: s(16) }}
          >
            <Text style={{ fontWeight: '900', fontSize: fs(20), color: '#022c22' }}>Click to Start</Text>
          </Pressable>
          <Pressable onPress={() => setIsSettingsOpen(true)} style={{ marginTop: s(16) }}>
            <Text style={{ color: '#D1D5DB', fontWeight: '700' }}>Edit Clinical Settings</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={{ position: 'absolute', top: s(48), left: 0, right: 0, alignItems: 'center', zIndex: 10 }}>
        <View style={{ backgroundColor: targetColor, paddingHorizontal: s(18), paddingVertical: s(8), borderRadius: s(14) }}>
          <Text style={{ color: getContrastColor(targetColor), fontWeight: '900', fontSize: fs(22) }}>
            {currentTarget || '—'}
          </Text>
        </View>
      </View>

      <View
        onLayout={(e) => {
          const { width: w, height: h } = e.nativeEvent.layout;
          setWheelPx(Math.min(w, h) * 0.86);
        }}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      >
        <Pressable
          onPress={() => {
            if (!isPaused && poppingActive) {
              statsRef.current.clicks += 1;
              statsRef.current.wrongCount += 1;
              void hapticWrong();
            }
          }}
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
                onPress={(e) => {
                  e.stopPropagation();
                  handleBubbleClick(bubble);
                }}
                style={{
                  position: 'absolute',
                  width: scaledBubble,
                  height: scaledBubble,
                  borderRadius: scaledBubble / 2,
                  backgroundColor: bubble.color,
                  left: `${bubble.x}%`,
                  top: `${bubble.y}%`,
                  marginLeft: -scaledBubble / 2,
                  marginTop: -scaledBubble / 2,
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

      <Pressable
        onPress={() => setIsMenuOpen(true)}
        style={{ position: 'absolute', bottom: s(24), right: s(16), width: s(44), height: s(44), borderRadius: 22, backgroundColor: '#121626', alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color: '#fff', fontSize: fs(18) }}>☰</Text>
      </Pressable>

      <ClinicalSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          if (isGameStarted) setIsPaused(false);
        }}
        onApply={(next) => {
          setPatientName(next.patientName);
          setLetterSize(next.letterSize);
          setBubbleSize(next.bubbleSize);
          if (next.speed) setSpeed(next.speed);
          if (next.wheelColor) setWheelColor(next.wheelColor);
          setNotification('Settings Applied Successfully!');
          setTimeout(() => setNotification(null), 2500);
          setIsSettingsOpen(false);
          setIsGameStarted(false);
          setIsPaused(true);
        }}
        patientName={patientName}
        letterSize={letterSize}
        bubbleSize={bubbleSize}
        speed={speed}
        wheelColor={wheelColor}
        showSpeedControl
        showWheelColorControl
      />
      {resultsData ? (
        <GameResultsModal
          isOpen={isResultsOpen}
          data={resultsData}
          onClose={() => {
            setIsResultsOpen(false);
            onExit?.();
          }}
          onReplay={() => {
            setIsResultsOpen(false);
            resetStats();
            startLevel();
            setIsGameStarted(false);
            setIsPaused(true);
          }}
        />
      ) : null}
      <GameMenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onQuit={() => onExit?.()}
        onReset={() => {
          resetStats();
          startLevel();
        }}
        onOpenSettings={() => {
          setIsPaused(true);
          setIsSettingsOpen(true);
        }}
        settingsSummary={[
          { label: 'Patient', value: patientName },
          { label: 'Speed', value: `${speed}x` },
          { label: 'Letter size', value: String(letterSize) },
        ]}
      />
    </View>
  );
}

const absoluteFill = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };
