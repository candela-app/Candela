import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  AlphabetVariant,
  GameMode,
  MobileTargetSessionResultData,
  MobileTargetSetMetric,
  MobileTargetSettings,
  getContrastColor,
} from '@candela/shared/rn';
import { ClinicalSettingsModal } from '../components/ClinicalSettingsModal';
import { GameMenuDrawer } from '../components/GameMenuDrawer';
import { GameResultsModal } from '../components/GameResultsModal';
import { hapticCorrect, hapticWrong } from '../lib/haptics';
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

const GENERIC_COLORS = [
  { name: 'Red', code: '#FF3344' },
  { name: 'Blue', code: '#0070FF' },
  { name: 'Green', code: '#00E640' },
  { name: 'Yellow', code: '#FFDD00' },
  { name: 'Orange', code: '#FF6600' },
  { name: 'Purple', code: '#B000FF' },
];

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
  const [settings, setSettings] = useState<MobileTargetSettings>({
    patientName: 'Mobile Patient',
    gameMode: initialMode,
    alphabetVariant: initialVariant,
    speedPxPerSec: 70,
    setDurationSec: 7,
    totalSets: 10,
    bubbleSize: 96,
    letterSize: 32,
    hasBackground: false,
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
    setSettings((prev) => ({ ...prev, gameMode: initialMode, alphabetVariant: initialVariant }));
  }, [initialMode, initialVariant]);

  const gameTitle =
    settings.gameMode === 'colors'
      ? 'Color Discriminant Bubble Chase'
      : settings.gameMode === 'numbers'
        ? 'Numeric Bubble Chase'
        : settings.alphabetVariant === 'lowercase'
          ? 'Lowercase Bubble Chase'
          : 'Uppercase Bubble Chase';

  const generateShuffledPool = useCallback((mode: GameMode, variant?: AlphabetVariant) => {
    let items: string[] = [];
    if (mode === 'alphabets') {
      items = (variant === 'lowercase' ? 'abcdefghijklmnopqrstuvwxyz' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ').split('');
    } else if (mode === 'numbers') {
      items = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    } else {
      items = GENERIC_COLORS.map((c) => c.name);
    }
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    shuffledPoolRef.current = items;
    return items;
  }, []);

  const generateSetPair = useCallback(
    (setIdx: number, mode: GameMode, variant?: AlphabetVariant, customSettings?: MobileTargetSettings, shouldSpeak = false) => {
      if (shuffledPoolRef.current.length === 0 || setIdx === 0) generateShuffledPool(mode, variant);
      const pool = shuffledPoolRef.current;
      if (settings.totalSets !== pool.length) setSettings((prev) => ({ ...prev, totalSets: pool.length }));
      const targetVal = pool[setIdx % pool.length];
      const availableDistractors = pool.filter((val) => val !== targetVal);
      const distractorVal = availableDistractors[Math.floor(Math.random() * availableDistractors.length)];
      let targetCol = GENERIC_COLORS[0].code;
      let distractorCol = GENERIC_COLORS[1].code;
      let targetName: string | undefined;
      if (mode === 'colors') {
        const tColorObj = GENERIC_COLORS.find((c) => c.name === targetVal) || GENERIC_COLORS[0];
        const dColorObj = GENERIC_COLORS.find((c) => c.name === distractorVal) || GENERIC_COLORS[1];
        targetCol = tColorObj.code;
        distractorCol = dColorObj.code;
        targetName = tColorObj.name;
      } else {
        const c1 = Math.floor(Math.random() * GENERIC_COLORS.length);
        let c2 = Math.floor(Math.random() * GENERIC_COLORS.length);
        while (c2 === c1) c2 = Math.floor(Math.random() * GENERIC_COLORS.length);
        targetCol = GENERIC_COLORS[c1].code;
        distractorCol = GENERIC_COLORS[c2].code;
      }
      setTargetItem({ value: targetVal, color: targetCol, name: targetName });
      if (shouldSpeak) speak(targetName || targetVal);
      const effSettings = customSettings || settings;
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
              speak(targetItem.name || targetItem.value);
            }}
            style={{ backgroundColor: '#34D399', borderRadius: 999, paddingHorizontal: s(28), paddingVertical: s(16) }}
          >
            <Text style={{ fontWeight: '900', fontSize: fs(20) }}>Click to Start</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={{ position: 'absolute', top: s(48), alignSelf: 'center', zIndex: 10, backgroundColor: targetItem.color, paddingHorizontal: s(16), paddingVertical: s(8), borderRadius: s(12) }}>
        <Text style={{ color: getContrastColor(targetItem.color), fontWeight: '900', fontSize: fs(20) }}>{targetItem.value}</Text>
      </View>
      <View
        style={{ flex: 1 }}
        onLayout={(e) => setBounds({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        {bubbles.map((bubble) => (
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
              width: bubble.radius * 2,
              height: bubble.radius * 2,
              borderRadius: bubble.radius,
              backgroundColor: settings.hasBackground === false ? 'transparent' : bubble.color,
              borderWidth: 4,
              borderColor: bubble.color,
              left: bounds.w / 2 + bubble.x - bubble.radius,
              top: bounds.h / 2 + bubble.y - bubble.radius,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: settings.hasBackground === false ? bubble.color : getContrastColor(bubble.color), fontWeight: '900', fontSize: settings.letterSize || 32 }}>
              {settings.gameMode === 'colors' ? '' : bubble.value}
            </Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={() => setMenuOpen(true)} style={{ position: 'absolute', bottom: s(24), right: s(16), backgroundColor: '#121626', padding: s(12), borderRadius: 22 }}>
        <Text style={{ color: '#fff' }}>☰</Text>
      </Pressable>
      <ClinicalSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        patientName={settings.patientName}
        letterSize={(settings.letterSize || 32) / 16}
        bubbleSize={settings.bubbleSize || 96}
        speed={settings.speedPxPerSec / 70}
        onApply={(next) => {
          setSettings((prev) => ({
            ...prev,
            patientName: next.patientName,
            letterSize: Math.round(next.letterSize * 16),
            bubbleSize: next.bubbleSize,
            speedPxPerSec: Math.round((next.speed || 1) * 70),
          }));
          setShowSettings(false);
          setShowClickToStart(true);
        }}
        showSpeedControl
      />
      {sessionResult ? (
        <GameResultsModal isOpen={showResults} data={sessionResult} onClose={onExit} onReplay={() => { setShowResults(false); setCurrentSetIndex(0); generateSetPair(0, settings.gameMode, settings.alphabetVariant); setShowClickToStart(true); }} />
      ) : null}
      <GameMenuDrawer
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onQuit={onExit}
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
          { label: 'Speed', value: `${settings.speedPxPerSec} px/s` },
        ]}
      />
    </View>
  );
}

const absoluteFill = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };
