import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlphabetVariant,
  GameMode,
  MobileTargetSessionResultData,
  MobileTargetSetMetric,
  MobileTargetSettings,
  THERAPY_COLOR_ITEMS,
  getContrastColor,
} from '@candela/shared/rn';
import { ClinicalSettingsModal } from '../components/ClinicalSettingsModal';
import { GameMenuDrawer } from '../components/GameMenuDrawer';
import { GameResultsModal } from '../components/GameResultsModal';
import { SlidersIcon, PlayIcon, PauseIcon, ChevronUpIcon, VolumeIcon, ReplayIcon } from '../components/icons';
import { ResetConfirmDialog } from '../components/ResetConfirmDialog';
import { hapticCorrect, hapticWrong } from '../lib/haptics';
import { sessionDisplayName, useAuth } from '../lib/auth-context';
import { useLayout } from '../lib/layout';
import { speak } from '../lib/speech';

interface MovingBubble {
  id: string;
  isTarget: boolean;
  value: string;
  color: string;
  colorName?: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  scatterTimer?: number;
}

function announceChaseTarget(mode: GameMode, value: string, name?: string) {
  if (mode === 'colors') speak(name || value);
  else speak(`target ${String(value).toLowerCase()}`);
}

function activeTherapyColors(enabled?: string[]) {
  const selected = (enabled || []).map((hex) => hex.toLowerCase());
  const items = selected.length
    ? THERAPY_COLOR_ITEMS.filter((item) => selected.includes(item.code.toLowerCase()))
    : THERAPY_COLOR_ITEMS;
  return items.length >= 2 ? items : THERAPY_COLOR_ITEMS;
}

export function MobileTargetGame({
  initialMode = 'alphabets',
  initialVariant = 'uppercase',
  onExit,
}: {
  initialMode?: GameMode;
  initialVariant?: AlphabetVariant;
  onExit: () => void;
}) {
  const { s, fs } = useLayout();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [settings, setSettings] = useState<MobileTargetSettings>({
    patientName: sessionDisplayName(session),
    gameMode: initialMode,
    alphabetVariant: initialVariant,
    speedPxPerSec: 70,
    setDurationSec: 7,
    totalSets: 10,
    bubbleSize: 96,
    letterSize: 32,
    hasBackground: false,
    therapyColors: THERAPY_COLOR_ITEMS.map((item) => item.code),
  });
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [targetItem, setTargetItem] = useState<{ value: string; color: string; name?: string }>({
    value: 'A',
    color: '#00F0FF',
  });
  const [bubbles, setBubbles] = useState<MovingBubble[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [showSettings, setShowSettings] = useState(true);
  const [showClickToStart, setShowClickToStart] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAssistiveTouchOpen, setIsAssistiveTouchOpen] = useState(false);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [setMetrics, setSetMetrics] = useState<MobileTargetSetMetric[]>([]);
  const [sessionResult, setSessionResult] = useState<MobileTargetSessionResultData | null>(null);
  const [bounds, setBounds] = useState({ w: 360, h: 640 });
  const bubblesRef = useRef<MovingBubble[]>([]);
  const setStartTimeRef = useRef(Date.now());
  const wrongClicksSetRef = useRef(0);
  const shuffledPoolRef = useRef<string[]>([]);

  useEffect(() => {
    bubblesRef.current = bubbles;
  }, [bubbles]);

  useEffect(() => {
    setSettings((prev) =>
      prev.gameMode === initialMode && prev.alphabetVariant === initialVariant
        ? prev
        : { ...prev, gameMode: initialMode, alphabetVariant: initialVariant },
    );
  }, [initialMode, initialVariant]);
  useEffect(() => {
    const name = session?.user.name?.trim();
    if (!name) return;
    setSettings((prev) => (prev.patientName === name ? prev : { ...prev, patientName: name }));
  }, [session?.user.name]);

  const gameTitle =
    settings.gameMode === 'colors'
      ? 'Color Discriminant Bubble Chase'
      : settings.gameMode === 'numbers'
        ? 'Numeric Bubble Chase'
        : settings.alphabetVariant === 'lowercase'
          ? 'Lowercase Bubble Chase'
          : 'Uppercase Bubble Chase';

  const generateShuffledPool = useCallback(
    (mode: GameMode, variant?: AlphabetVariant, enabledColors?: string[]) => {
      let items: string[] = [];
      if (mode === 'alphabets') {
        items = (variant === 'lowercase' ? 'abcdefghijklmnopqrstuvwxyz' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ').split('');
      } else if (mode === 'numbers') {
        items = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
      } else {
        items = activeTherapyColors(enabledColors ?? settings.therapyColors).map((c) => c.name);
      }
      for (let i = items.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
      shuffledPoolRef.current = items;
      return items;
    },
    [settings.therapyColors]
  );

  const generateSetPair = useCallback(
    (setIdx: number, mode: GameMode, variant?: AlphabetVariant, customSettings?: MobileTargetSettings, shouldSpeak = false) => {
      const effSettings = customSettings || settings;
      if (shuffledPoolRef.current.length === 0 || setIdx === 0) {
        generateShuffledPool(mode, variant, effSettings.therapyColors);
      }
      const pool = shuffledPoolRef.current;
      if (settings.totalSets !== pool.length) {
        setSettings((prev) => (prev.totalSets === pool.length ? prev : { ...prev, totalSets: pool.length }));
      }
      const targetVal = pool[setIdx % pool.length];
      const availableDistractors = pool.filter((val) => val !== targetVal);
      const distractorVal = availableDistractors[Math.floor(Math.random() * availableDistractors.length)];
      const palette = activeTherapyColors(effSettings.therapyColors);
      let targetCol = palette[0].code;
      let distractorCol = palette[1].code;
      let targetName: string | undefined;
      if (mode === 'colors') {
        const tColorObj = palette.find((c) => c.name === targetVal) || palette[0];
        const dColorObj = palette.find((c) => c.name === distractorVal) || palette[1];
        targetCol = tColorObj.code;
        distractorCol = dColorObj.code;
        targetName = tColorObj.name;
      } else {
        const c1 = Math.floor(Math.random() * palette.length);
        let c2 = Math.floor(Math.random() * palette.length);
        while (c2 === c1 && palette.length > 1) c2 = Math.floor(Math.random() * palette.length);
        targetCol = palette[c1].code;
        distractorCol = palette[c2].code;
      }
      setTargetItem({ value: targetVal, color: targetCol, name: targetName });
      if (shouldSpeak) announceChaseTarget(mode, targetVal, targetName);
      const speed = effSettings.speedPxPerSec;
      const radius = (effSettings.bubbleSize || 96) / 2;
      const axis = effSettings.movementAxis || 'random';
      const halfW = bounds.w / 2;
      const halfH = bounds.h / 2;
      let initX0 = -halfW * 0.4;
      let initY0 = -Math.max(50, halfH * 0.45);
      let initX1 = halfW * 0.4;
      let initY1 = Math.max(50, halfH * 0.45);
      let initVx0 = speed;
      let initVy0 = 0;
      let initVx1 = -speed;
      let initVy1 = 0;
      if (axis === 'vertical') {
        initX0 = -Math.max(60, halfW * 0.45);
        initX1 = Math.max(60, halfW * 0.45);
        initVx0 = 0;
        initVy0 = speed;
        initVx1 = 0;
        initVy1 = -speed;
      } else if (axis === 'random') {
        const angle1 = Math.PI / 4 + (Math.random() * Math.PI) / 4;
        const angle2 = (5 * Math.PI) / 4 + (Math.random() * Math.PI) / 4;
        initVx0 = Math.cos(angle1) * speed;
        initVy0 = Math.sin(angle1) * speed;
        initVx1 = Math.cos(angle2) * speed;
        initVy1 = Math.sin(angle2) * speed;
      }
      const existingB0 = setIdx > 0 && bubblesRef.current.length >= 2 ? bubblesRef.current[0] : null;
      const existingB1 = setIdx > 0 && bubblesRef.current.length >= 2 ? bubblesRef.current[1] : null;
      const targetSlot = Math.random() < 0.5 ? 0 : 1;
      const initialBubbles: MovingBubble[] = [
        {
          id: `b_0_${setIdx}`,
          isTarget: targetSlot === 0,
          value: targetSlot === 0 ? targetVal : distractorVal,
          color: targetSlot === 0 ? targetCol : distractorCol,
          x: existingB0 ? existingB0.x : initX0,
          y: existingB0 ? existingB0.y : initY0,
          vx: existingB0 ? existingB0.vx : initVx0,
          vy: existingB0 ? existingB0.vy : initVy0,
          radius,
        },
        {
          id: `b_1_${setIdx}`,
          isTarget: targetSlot === 1,
          value: targetSlot === 1 ? targetVal : distractorVal,
          color: targetSlot === 1 ? targetCol : distractorCol,
          x: existingB1 ? existingB1.x : initX1,
          y: existingB1 ? existingB1.y : initY1,
          vx: existingB1 ? existingB1.vx : initVx1,
          vy: existingB1 ? existingB1.vy : initVy1,
          radius,
        },
      ];
      setBubbles(initialBubbles);
      bubblesRef.current = initialBubbles;
      wrongClicksSetRef.current = 0;
      setStartTimeRef.current = Date.now();
    },
    [settings, generateShuffledPool, bounds],
  );

  useEffect(() => {
    setCurrentSetIndex(0);
    setCorrectCount(0);
    setWrongCount(0);
    setSetMetrics([]);
    setIsPlaying(false);
    setIsPaused(true);
    setShowSettings(true);
    setShowResults(false);
    generateShuffledPool(initialMode, initialVariant);
    generateSetPair(0, initialMode, initialVariant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMode, initialVariant]);

  const advanceToNextSet = useCallback(
    (outcome: 'correct', reactionMs: number) => {
      const metric: MobileTargetSetMetric = {
        setIndex: currentSetIndex,
        targetValue: targetItem.value,
        targetColor: targetItem.color,
        distractorValue: bubblesRef.current.find((b) => !b.isTarget)?.value || '',
        outcome,
        reactionTimeMs: reactionMs,
        wrongClicksCount: wrongClicksSetRef.current,
      };
      const updatedMetrics = [...setMetrics, metric];
      setSetMetrics(updatedMetrics);
      const nextSet = currentSetIndex + 1;
      if (nextSet >= settings.totalSets) {
        setIsPlaying(false);
        const totalCorrect = updatedMetrics.length;
        const totalWrong = updatedMetrics.reduce((acc, m) => acc + m.wrongClicksCount, 0);
        const avgReaction =
          updatedMetrics.reduce((a, m) => a + m.reactionTimeMs / 1000, 0) / Math.max(1, updatedMetrics.length);
        const accuracy = Math.round((totalCorrect / Math.max(1, totalCorrect + totalWrong)) * 100);
        setSessionResult({
          patientName: settings.patientName,
          sessionId: Date.now(),
          date: new Date().toLocaleDateString(),
          gameName: gameTitle,
          stimuliCount: settings.totalSets * 2,
          letterSize: settings.letterSize || 32,
          speed: `${settings.speedPxPerSec} px/s`,
          durationSec: Math.round(updatedMetrics.reduce((acc, m) => acc + m.reactionTimeMs, 0) / 1000),
          clicksTotal: totalCorrect + totalWrong,
          correct: totalCorrect,
          wrong: totalWrong,
          accuracy,
          avgReactionSec: avgReaction,
          gameMode: settings.gameMode,
          speedPxPerSec: settings.speedPxPerSec,
          setDurationSec: 0,
          totalSets: settings.totalSets,
          timeoutCount: 0,
          setMetrics: updatedMetrics,
          starRating: accuracy >= 90 ? 5 : accuracy >= 75 ? 4 : accuracy >= 60 ? 3 : 2,
        });
        setShowResults(true);
      } else {
        setCurrentSetIndex(nextSet);
        generateSetPair(nextSet, settings.gameMode, settings.alphabetVariant, undefined, true);
      }
    },
    [currentSetIndex, generateSetPair, setMetrics, settings, gameTitle, targetItem],
  );

  useEffect(() => {
    let lastTimestamp = performance.now();
    let raf = 0;
    const updatePhysics = (timestamp: number) => {
      const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.05);
      lastTimestamp = timestamp;
      if (isPlaying && !isPaused && !showResults && !showSettings) {
        const halfW = bounds.w / 2;
        const halfH = bounds.h / 2;
        const list = bubblesRef.current.map((b) => ({ ...b, x: b.x + b.vx * dt, y: b.y + b.vy * dt }));
        if (list.length >= 2) {
          const b1 = list[0];
          const b2 = list[1];
          const dx = b2.x - b1.x;
          const dy = b2.y - b1.y;
          const distSq = dx * dx + dy * dy;
          const minDist = b1.radius + b2.radius + 6;
          if (distSq < minDist * minDist && distSq > 0) {
            const dist = Math.sqrt(distSq);
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minDist - dist;
            b1.x -= nx * (overlap / 2);
            b1.y -= ny * (overlap / 2);
            b2.x += nx * (overlap / 2);
            b2.y += ny * (overlap / 2);
            const velAlongNormal = (b2.vx - b1.vx) * nx + (b2.vy - b1.vy) * ny;
            if (velAlongNormal < 0) {
              b1.vx += velAlongNormal * nx;
              b1.vy += velAlongNormal * ny;
              b2.vx -= velAlongNormal * nx;
              b2.vy -= velAlongNormal * ny;
              const spd1 = Math.hypot(b1.vx, b1.vy) || 1;
              const spd2 = Math.hypot(b2.vx, b2.vy) || 1;
              b1.vx = (b1.vx / spd1) * settings.speedPxPerSec;
              b1.vy = (b1.vy / spd1) * settings.speedPxPerSec;
              b2.vx = (b2.vx / spd2) * settings.speedPxPerSec;
              b2.vy = (b2.vy / spd2) * settings.speedPxPerSec;
            }
          }
        }
        const updated = list.map((bubble) => {
          let nx = bubble.x;
          let ny = bubble.y;
          let nvx = bubble.vx;
          let nvy = bubble.vy;
          const minX = -halfW + bubble.radius + 8;
          const maxX = halfW - bubble.radius - 8;
          const minY = -halfH + bubble.radius + 8;
          const maxY = halfH - bubble.radius - 8;
          if (nx <= minX) {
            nx = minX;
            nvx = Math.abs(nvx);
          } else if (nx >= maxX) {
            nx = maxX;
            nvx = -Math.abs(nvx);
          }
          if (ny <= minY) {
            ny = minY;
            nvy = Math.abs(nvy);
          } else if (ny >= maxY) {
            ny = maxY;
            nvy = -Math.abs(nvy);
          }
          return { ...bubble, x: nx, y: ny, vx: nvx, vy: nvy };
        });
        bubblesRef.current = updated;
        setBubbles(updated);
      }
      raf = requestAnimationFrame(updatePhysics);
    };
    raf = requestAnimationFrame(updatePhysics);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, isPaused, showResults, showSettings, bounds, settings.speedPxPerSec]);

  const fabSize = s(40);
  const bottomPad = insets.bottom + s(12);
  const rightPad = s(12);
  const isColors = settings.gameMode === 'colors';

  return (
    <View style={{ flex: 1, backgroundColor: '#05070F' }}>
      {showClickToStart && !showSettings && !showResults ? (
        <View style={{ ...absoluteFill, alignItems: 'center', justifyContent: 'center', zIndex: 20, backgroundColor: 'rgba(6,7,13,0.98)' }}>
          <Text style={{ color: '#fff', fontSize: fs(24), fontWeight: '900', marginBottom: s(16), textAlign: 'center' }}>{gameTitle}</Text>
          <Pressable
            onPress={() => {
              setShowClickToStart(false);
              setIsPlaying(true);
              setIsPaused(false);
              announceChaseTarget(settings.gameMode, targetItem.value, targetItem.name);
            }}
            style={{ backgroundColor: '#34D399', borderRadius: 999, paddingHorizontal: s(28), paddingVertical: s(16) }}
          >
            <Text style={{ fontWeight: '900', fontSize: fs(20) }}>Click to Start</Text>
          </Pressable>
        </View>
      ) : null}
      <View
        style={{ flex: 1 }}
        onLayout={(e) => {
          const { width: w, height: h } = e.nativeEvent.layout;
          setBounds((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
        }}
      >
        {bubbles.map((bubble) => {
          const size = bubble.radius * 2;
          const filled = settings.hasBackground === true;
          return (
            <Pressable
              key={bubble.id}
              onPress={() => {
                if (!isPlaying || isPaused || showResults) return;
                if (bubble.isTarget) {
                  void hapticCorrect();
                  setCorrectCount((c) => c + 1);
                  advanceToNextSet('correct', Date.now() - setStartTimeRef.current);
                } else {
                  void hapticWrong();
                  setWrongCount((w) => w + 1);
                  wrongClicksSetRef.current += 1;
                }
              }}
              style={{
                position: 'absolute',
                left: bounds.w / 2 + bubble.x - size / 2,
                top: bounds.h / 2 + bubble.y - size / 2,
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: filled ? bubble.color : '#121626',
                borderWidth: filled ? 3 : 4,
                borderColor: filled ? '#FFFFFF' : bubble.color,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isColors ? null : (
                <Text
                  style={{
                    color: filled ? getContrastColor(bubble.color) : bubble.color,
                    fontWeight: '900',
                    fontSize: settings.letterSize || 32,
                  }}
                >
                  {bubble.value}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

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
          onPress={() => announceChaseTarget(settings.gameMode, targetItem.value, targetItem.name)}
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
          {isColors ? (
            <View
              style={{
                width: s(14),
                height: s(14),
                borderRadius: s(7),
                backgroundColor: targetItem.color,
                borderWidth: 1,
                borderColor: '#fff',
              }}
            />
          ) : (
            <Text style={{ color: targetItem.color, fontWeight: '900', fontSize: fs(14) }}>{targetItem.value || '—'}</Text>
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
            onPress={() => {
              announceChaseTarget(settings.gameMode, targetItem.value, targetItem.name);
            }}
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
              {isColors ? (
                <View
                  style={{
                    width: s(22),
                    height: s(22),
                    borderRadius: s(11),
                    backgroundColor: targetItem.color,
                    borderWidth: 1,
                    borderColor: '#fff',
                  }}
                />
              ) : (
                <Text style={{ color: targetItem.color, fontWeight: '900', fontSize: fs(20) }}>{targetItem.value}</Text>
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
            onPress={() => {
              setIsAssistiveTouchOpen(false);
              setIsPaused(true);
              setShowSettings(true);
            }}
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
              const inProgress = !showResults && !showSettings && !showClickToStart;
              if (inProgress) setConfirmQuit(true);
              else {
                setIsAssistiveTouchOpen(false);
                onExit();
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
              <Text style={{ color: '#9CA3AF', fontSize: fs(11) }}>{gameTitle}</Text>
            </View>
            <Pressable onPress={() => setIsHeaderExpanded(false)}>
              <Text style={{ color: '#9CA3AF', fontWeight: '800' }}>✕</Text>
            </Pressable>
          </View>
          <Text style={{ color: '#9CA3AF', fontSize: fs(10), fontWeight: '800', marginBottom: s(6) }}>
            CLINICAL PARAMETERS
          </Text>
          <InfoRow label="Patient" value={settings.patientName} />
          {isColors ? null : <InfoRow label="Letter Size" value={`${settings.letterSize || 32} px`} accent="#60A5FA" />}
          <InfoRow label="Bubble Size" value={`${settings.bubbleSize || 96} px`} accent="#60A5FA" />
          <InfoRow label="Set" value={`${currentSetIndex + 1} / ${settings.totalSets}`} accent="#60A5FA" />
          <View style={{ height: 1, backgroundColor: '#1F2937', marginVertical: s(8) }} />
          <Text style={{ color: '#9CA3AF', fontSize: fs(10), fontWeight: '800', marginBottom: s(6) }}>LIVE METRICS</Text>
          <InfoRow label="Correct Sets" value={`${correctCount} / ${settings.totalSets}`} accent="#34D399" />
          <InfoRow label="Wrong Clicks" value={String(wrongCount)} accent="#FB7185" />
        </View>
      ) : null}
      <ClinicalSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        patientName={settings.patientName}
        letterSize={(settings.letterSize || 32) / 16}
        bubbleSize={settings.bubbleSize || 96}
        sampleSymbol={settings.gameMode === 'colors' ? '' : settings.gameMode === 'numbers' ? '7' : settings.alphabetVariant === 'lowercase' ? 'a' : 'A'}
        showTherapyColorPicker={settings.gameMode === 'colors'}
        showLetterSizeControl={settings.gameMode !== 'colors'}
        therapyColors={settings.therapyColors}
        onApply={(next) => {
          const nextColors = activeTherapyColors(next.therapyColors).map((item) => item.code);
          const nextSettings: MobileTargetSettings = {
            ...settings,
            patientName: next.patientName,
            letterSize: Math.round(next.letterSize * 16),
            bubbleSize: next.bubbleSize,
            therapyColors: nextColors,
          };
          setSettings(nextSettings);
          setShowSettings(false);
          setShowClickToStart(true);
          generateSetPair(0, nextSettings.gameMode, nextSettings.alphabetVariant, nextSettings, false);
        }}
      />
      {sessionResult ? (
        <GameResultsModal isOpen={showResults} data={sessionResult} onClose={onExit} onReplay={() => { setShowResults(false); setCurrentSetIndex(0); generateSetPair(0, settings.gameMode, settings.alphabetVariant); setShowClickToStart(true); }} />
      ) : null}
      <GameMenuDrawer
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onQuit={onExit}
        sessionInProgress={!showResults && !showSettings && !showClickToStart}
        onReset={() => {
          setCurrentSetIndex(0);
          generateSetPair(0, settings.gameMode, settings.alphabetVariant);
        }}
        onOpenSettings={() => {
          setIsPaused(true);
          setShowSettings(true);
        }}
        settingsSummary={[
          { label: 'Patient', value: settings.patientName },
        ]}
      />
      <ResetConfirmDialog
        visible={confirmReset}
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          setIsAssistiveTouchOpen(false);
          setCurrentSetIndex(0);
          generateSetPair(0, settings.gameMode, settings.alphabetVariant);
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
          onExit();
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
