import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  GameMode,
  AlphabetVariant,
  MobileTargetSettings,
  MobileTargetSetMetric,
  MobileTargetSessionResultData,
  playSuccessTone,
  playErrorTone,
} from '@candela/shared';
import { MobileTargetSettingsModal } from './MobileTargetSettingsModal';
import { MobileTargetResultsModal } from './MobileTargetResultsModal';
import { GameMenuDrawer } from '../shared/GameMenuDrawer';
import { ArrowLeftIcon, SlidersIcon } from '../icons/VectorIcons';

interface MobileTargetGameProps {
  initialMode?: GameMode;
  initialVariant?: AlphabetVariant;
  onExit: () => void;
}

interface MovingBubble {
  id: string;
  isTarget: boolean;
  value: string;
  color: string;
  colorName?: string;
  x: number; // canvas center relative px
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

const ELECTRIC_COLORS = [
  { name: 'Cyan', code: '#00F0FF' },
  { name: 'Magenta', code: '#FF007A' },
  { name: 'Lime', code: '#39FF14' },
  { name: 'Yellow', code: '#FFE600' },
  { name: 'Orange', code: '#FF6D00' },
  { name: 'Purple', code: '#B000FF' },
];

export function MobileTargetGame({
  initialMode = 'alphabets',
  initialVariant = 'uppercase',
  onExit,
}: MobileTargetGameProps) {
  // Settings
  const [settings, setSettings] = useState<MobileTargetSettings>({
    patientName: 'Mobile Patient',
    gameMode: initialMode,
    alphabetVariant: initialVariant,
    speedPxPerSec: 70,
    setDurationSec: 7,
    totalSets: 10,
    bubbleSize: 96,
    letterSize: 32,
  });

  // Sync settings when initial props change
  useEffect(() => {
    setSettings((prev) => ({
      ...prev,
      gameMode: initialMode,
      alphabetVariant: initialVariant,
    }));
  }, [initialMode, initialVariant]);

  const gameTitle =
    settings.gameMode === 'colors'
      ? 'Color Discriminant Pursuit'
      : settings.gameMode === 'numbers'
      ? 'Numeric Mobile Pursuit'
      : settings.alphabetVariant === 'lowercase'
      ? 'Lowercase Mobile Pursuit'
      : 'Uppercase Mobile Pursuit';

  // State
  const [currentSetIndex, setCurrentSetIndex] = useState<number>(0);
  const [targetItem, setTargetItem] = useState<{ value: string; color: string; name?: string }>({
    value: 'A',
    color: '#00F0FF',
  });
  const [bubbles, setBubbles] = useState<MovingBubble[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState<boolean>(true);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [shakeError, setShakeError] = useState<boolean>(false);

  // Metrics
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [wrongCount, setWrongCount] = useState<number>(0);
  const [setMetrics, setSetMetrics] = useState<MobileTargetSetMetric[]>([]);
  const [sessionResult, setSessionResult] = useState<MobileTargetSessionResultData | null>(null);

  // Refs for physics loop
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const setStartTimeRef = useRef<number>(Date.now());
  const bubblesRef = useRef<MovingBubble[]>([]);
  const wrongClicksSetRef = useRef<number>(0);

  // Synchronize bubblesRef
  useEffect(() => {
    bubblesRef.current = bubbles;
  }, [bubbles]);

  // Ref for shuffled pool deck
  const shuffledPoolRef = useRef<string[]>([]);

  // Function to generate shuffled pool deck for full random coverage
  const generateShuffledPool = useCallback((mode: GameMode, variant?: AlphabetVariant) => {
    let items: string[] = [];
    if (mode === 'alphabets') {
      const letters =
        variant === 'lowercase'
          ? 'abcdefghijklmnopqrstuvwxyz'.split('')
          : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      items = [...letters];
    } else if (mode === 'numbers') {
      items = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    } else if (mode === 'colors') {
      items = ELECTRIC_COLORS.map((c) => c.name);
    }

    // Fisher-Yates shuffle
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }

    shuffledPoolRef.current = items;
    return items;
  }, []);

  // Generate Pair of Target & Distractor Bubbles
  const generateSetPair = useCallback(
    (setIdx: number, mode: GameMode, variant?: AlphabetVariant) => {
      // Ensure pool exists
      if (shuffledPoolRef.current.length === 0 || setIdx === 0) {
        generateShuffledPool(mode, variant);
      }

      const pool = shuffledPoolRef.current;
      const totalPoolSets = pool.length;

      // Update totalSets in settings dynamically to pool size (e.g. 26 letters)
      if (settings.totalSets !== totalPoolSets) {
        setSettings((prev) => ({ ...prev, totalSets: totalPoolSets }));
      }

      const targetVal = pool[setIdx % pool.length];

      // Pick distractorVal from remaining pool items
      const availableDistractors = pool.filter((val) => val !== targetVal);
      const distractorVal = availableDistractors[Math.floor(Math.random() * availableDistractors.length)];

      let targetCol = ELECTRIC_COLORS[0].code;
      let distractorCol = ELECTRIC_COLORS[1].code;
      let targetName: string | undefined = undefined;

      if (mode === 'colors') {
        const tColorObj = ELECTRIC_COLORS.find((c) => c.name === targetVal) || ELECTRIC_COLORS[0];
        const dColorObj = ELECTRIC_COLORS.find((c) => c.name === distractorVal) || ELECTRIC_COLORS[1];
        targetCol = tColorObj.code;
        distractorCol = dColorObj.code;
        targetName = tColorObj.name;
      } else {
        const c1 = Math.floor(Math.random() * ELECTRIC_COLORS.length);
        let c2 = Math.floor(Math.random() * ELECTRIC_COLORS.length);
        while (c2 === c1) c2 = Math.floor(Math.random() * ELECTRIC_COLORS.length);
        targetCol = ELECTRIC_COLORS[c1].code;
        distractorCol = ELECTRIC_COLORS[c2].code;
      }

      setTargetItem({ value: targetVal, color: targetCol, name: targetName });

      const speed = settings.speedPxPerSec;
      const radius = (settings.bubbleSize || 96) / 2;
      const axis = settings.movementAxis || 'random';

      const existingB0 = setIdx > 0 && bubblesRef.current.length >= 2 ? bubblesRef.current[0] : null;
      const existingB1 = setIdx > 0 && bubblesRef.current.length >= 2 ? bubblesRef.current[1] : null;

      // Calculate initial velocities & positions based on movementAxis
      let angle1 = Math.PI / 4 + (Math.random() * Math.PI) / 4;
      let angle2 = (5 * Math.PI) / 4 + (Math.random() * Math.PI) / 4;

      let initVx0 = Math.cos(angle1) * speed;
      let initVy0 = Math.sin(angle1) * speed;
      let initVx1 = Math.cos(angle2) * speed;
      let initVy1 = Math.sin(angle2) * speed;

      let initX0 = -120 - Math.random() * 60;
      let initY0 = -150 - Math.random() * 60;
      let initX1 = 120 + Math.random() * 60;
      let initY1 = 150 + Math.random() * 60;

      if (axis === 'horizontal') {
        initVx0 = speed;
        initVy0 = 0;
        initVx1 = -speed;
        initVy1 = 0;

        initY0 = -60;
        initY1 = 60;
      } else if (axis === 'vertical') {
        initVx0 = 0;
        initVy0 = speed;
        initVx1 = 0;
        initVy1 = -speed;

        initX0 = -80;
        initX1 = 80;
      }

      // Randomly assign which moving bubble slot becomes the target (50/50 probability)
      const targetSlot = Math.random() < 0.5 ? 0 : 1;

      const b0Data: MovingBubble = {
        id: `b_0_${setIdx}`,
        isTarget: targetSlot === 0,
        value: targetSlot === 0 ? targetVal : distractorVal,
        color: targetSlot === 0 ? targetCol : distractorCol,
        colorName:
          mode === 'colors'
            ? targetSlot === 0
              ? targetName
              : distractorVal
            : undefined,
        x: existingB0 ? existingB0.x : initX0,
        y: existingB0 ? (axis === 'horizontal' ? initY0 : existingB0.y) : initY0,
        vx: existingB0
          ? axis === 'horizontal'
            ? (existingB0.vx >= 0 ? speed : -speed)
            : axis === 'vertical'
            ? 0
            : (existingB0.vx / (Math.hypot(existingB0.vx, existingB0.vy) || 1)) * speed
          : initVx0,
        vy: existingB0
          ? axis === 'vertical'
            ? (existingB0.vy >= 0 ? speed : -speed)
            : axis === 'horizontal'
            ? 0
            : (existingB0.vy / (Math.hypot(existingB0.vx, existingB0.vy) || 1)) * speed
          : initVy0,
        radius,
      };

      const b1Data: MovingBubble = {
        id: `b_1_${setIdx}`,
        isTarget: targetSlot === 1,
        value: targetSlot === 1 ? targetVal : distractorVal,
        color: targetSlot === 1 ? targetCol : distractorCol,
        colorName:
          mode === 'colors'
            ? targetSlot === 1
              ? targetName
              : distractorVal
            : undefined,
        x: existingB1 ? existingB1.x : initX1,
        y: existingB1 ? (axis === 'horizontal' ? initY1 : existingB1.y) : initY1,
        vx: existingB1
          ? axis === 'horizontal'
            ? (existingB1.vx >= 0 ? speed : -speed)
            : axis === 'vertical'
            ? 0
            : (existingB1.vx / (Math.hypot(existingB1.vx, existingB1.vy) || 1)) * speed
          : initVx1,
        vy: existingB1
          ? axis === 'vertical'
            ? (existingB1.vy >= 0 ? speed : -speed)
            : axis === 'horizontal'
            ? 0
            : (existingB1.vy / (Math.hypot(existingB1.vx, existingB1.vy) || 1)) * speed
          : initVy1,
        radius,
      };

      const initialBubbles: MovingBubble[] = [b0Data, b1Data];

      setBubbles(initialBubbles);
      bubblesRef.current = initialBubbles;
      wrongClicksSetRef.current = 0;
      setStartTimeRef.current = Date.now();
    },
    [settings.speedPxPerSec, settings.bubbleSize, settings.movementAxis, generateShuffledPool]
  );

  // Initialize First Set
  useEffect(() => {
    setCurrentSetIndex(0);
    setCorrectCount(0);
    setWrongCount(0);
    setSetMetrics([]);
    setIsPlaying(false);
    setIsPaused(true);
    setShowSettings(true);
    setShowResults(false);
    generateShuffledPool(settings.gameMode, settings.alphabetVariant);
    generateSetPair(0, settings.gameMode, settings.alphabetVariant);
  }, [settings.gameMode, settings.alphabetVariant, generateShuffledPool, generateSetPair]);

  // Advance Set or Finish Session
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
        // Complete Session
        setIsPlaying(false);
        const totalCorrect = updatedMetrics.length;
        const totalWrong = updatedMetrics.reduce((acc, m) => acc + m.wrongClicksCount, 0);
        const validReactionTimes = updatedMetrics.map((m) => m.reactionTimeMs / 1000);
        const avgReaction =
          validReactionTimes.length > 0
            ? validReactionTimes.reduce((a, b) => a + b, 0) / validReactionTimes.length
            : 0;
        const accuracy = Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100);

        let rating = 3;
        if (accuracy >= 90) rating = 5;
        else if (accuracy >= 75) rating = 4;
        else if (accuracy >= 60) rating = 3;
        else rating = 2;

        const sessionSummary: MobileTargetSessionResultData = {
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
          starRating: rating,
        };

        setSessionResult(sessionSummary);
        setShowResults(true);
      } else {
        setCurrentSetIndex(nextSet);
        generateSetPair(nextSet, settings.gameMode, settings.alphabetVariant);
      }
    },
    [currentSetIndex, generateSetPair, setMetrics, settings, gameTitle]
  );

  // Animation & Physics Motion Loop (Fixed Constant Speed + Wall Bouncing + Non-overlapping Collisions)
  useEffect(() => {
    let lastTimestamp = performance.now();

    const updatePhysics = (timestamp: number) => {
      const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.05); // Cap dt
      lastTimestamp = timestamp;

      if (isPlaying && !isPaused && !showResults && !showSettings && canvasRef.current) {
        const bounds = canvasRef.current.getBoundingClientRect();
        const halfW = bounds.width / 2;
        const halfH = bounds.height / 2;

        // Clone current bubbles array
        const list = bubblesRef.current.map((b) => ({
          ...b,
          x: b.x + b.vx * dt,
          y: b.y + b.vy * dt,
        }));

        // 1. Bubble-to-Bubble Non-Overlapping Collision Response
        if (list.length >= 2) {
          const b1 = list[0];
          const b2 = list[1];

          const dx = b2.x - b1.x;
          const dy = b2.y - b1.y;
          const distSq = dx * dx + dy * dy;
          const minDist = b1.radius + b2.radius + 6; // 6px safety margin to ensure zero overlap
          const minDistSq = minDist * minDist;

          if (distSq < minDistSq && distSq > 0) {
            const dist = Math.sqrt(distSq);
            const nx = dx / dist;
            const ny = dy / dist;

            // Separate overlapping position
            const overlap = minDist - dist;
            b1.x -= nx * (overlap / 2);
            b1.y -= ny * (overlap / 2);
            b2.x += nx * (overlap / 2);
            b2.y += ny * (overlap / 2);

            // Elastic velocity bounce along collision normal
            const relVx = b2.vx - b1.vx;
            const relVy = b2.vy - b1.vy;
            const velAlongNormal = relVx * nx + relVy * ny;

            if (velAlongNormal < 0) {
              const impulse = velAlongNormal;
              b1.vx += impulse * nx;
              b1.vy += impulse * ny;
              b2.vx -= impulse * nx;
              b2.vy -= impulse * ny;

              // Re-normalize speeds to constant target speed
              const targetSpeed = settings.speedPxPerSec;
              const axis = settings.movementAxis || 'random';

              if (axis === 'horizontal') {
                b1.vy = 0;
                b2.vy = 0;
                b1.vx = b1.vx >= 0 ? targetSpeed : -targetSpeed;
                b2.vx = b2.vx >= 0 ? targetSpeed : -targetSpeed;
              } else if (axis === 'vertical') {
                b1.vx = 0;
                b2.vx = 0;
                b1.vy = b1.vy >= 0 ? targetSpeed : -targetSpeed;
                b2.vy = b2.vy >= 0 ? targetSpeed : -targetSpeed;
              } else {
                const spd1 = Math.hypot(b1.vx, b1.vy) || 1;
                b1.vx = (b1.vx / spd1) * targetSpeed;
                b1.vy = (b1.vy / spd1) * targetSpeed;

                const spd2 = Math.hypot(b2.vx, b2.vy) || 1;
                b2.vx = (b2.vx / spd2) * targetSpeed;
                b2.vy = (b2.vy / spd2) * targetSpeed;
              }
            }
          }
        }

        // 2. Wall Bouncing & Bounds Clamping
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

      animFrameRef.current = requestAnimationFrame(updatePhysics);
    };

    animFrameRef.current = requestAnimationFrame(updatePhysics);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, isPaused, showResults, showSettings]);

  // Handle Bubble Tap
  const handleBubbleTap = (bubble: MovingBubble) => {
    if (!isPlaying || isPaused || showResults) return;

    if (bubble.isTarget) {
      // Correct Tap -> Advance Set
      playSuccessTone();
      const reactionMs = Date.now() - setStartTimeRef.current;
      setCorrectCount((c) => c + 1);
      advanceToNextSet('correct', reactionMs);
    } else {
      // Wrong Tap -> Continue set until correct bubble is tapped
      playErrorTone();
      setWrongCount((w) => w + 1);
      wrongClicksSetRef.current += 1;
      setShakeError(true);
      setTimeout(() => setShakeError(false), 300);
    }
  };

  const handleRestartSession = () => {
    setCurrentSetIndex(0);
    setCorrectCount(0);
    setWrongCount(0);
    setSetMetrics([]);
    setSessionResult(null);
    setShowResults(false);
    setShowSettings(true);
    setIsPlaying(false);
    setIsPaused(true);
    generateShuffledPool(settings.gameMode, settings.alphabetVariant);
    generateSetPair(0, settings.gameMode, settings.alphabetVariant);
  };

  return (
    <div className="w-screen h-screen bg-[#0A0A12] text-white flex flex-col justify-between select-none overflow-hidden touch-none relative font-sans">
      {/* FIXED TOP HEADER & TARGET CONTAINER */}
      <header className="w-full bg-[#121626]/90 border-b border-gray-800/80 px-4 py-3 flex items-center justify-between z-30 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="p-2 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base font-extrabold text-white tracking-tight leading-none">
              {gameTitle}
            </h1>
            <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider">
              Set {currentSetIndex + 1} of {settings.totalSets}
            </span>
          </div>
        </div>

        {/* TARGET CARD DISPLAY */}
        <div className="flex items-center gap-3 bg-[#1A2035] border-2 border-blue-500/40 px-5 py-1.5 rounded-2xl shadow-inner">
          <span className="text-xs text-gray-400 font-bold uppercase tracking-wider hidden sm:inline">
            Target:
          </span>
          {settings.gameMode === 'colors' ? (
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full border-2 border-white shadow-md"
                style={{ backgroundColor: targetItem.color }}
              />
              <span className="font-extrabold text-sm text-white">{targetItem.name}</span>
            </div>
          ) : (
            <span
              className="text-2xl font-black tracking-widest drop-shadow-md"
              style={{ color: targetItem.color }}
            >
              {targetItem.value}
            </span>
          )}
        </div>

        {/* ACTIONS & SETTINGS */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
          >
            <SlidersIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => setMenuOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-blue-600/90 hover:bg-blue-500 text-xs font-bold text-white transition-colors"
          >
            Menu
          </button>
        </div>
      </header>

      {/* MOVING BUBBLE FIELD CANVAS */}
      <main
        ref={canvasRef}
        className={`flex-1 relative w-full overflow-hidden flex items-center justify-center ${
          shakeError ? 'animate-shake' : ''
        }`}
      >
        {/* Subtle Background Field Grid Lines */}
        <div className="absolute inset-0 bg-[radial-gradient(#1E2640_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

        {/* Moving Bubbles (2 Bubbles) */}
        {bubbles.map((bubble) => (
          <div
            key={bubble.id}
            onClick={() => handleBubbleTap(bubble)}
            onTouchStart={(e) => {
              e.preventDefault();
              handleBubbleTap(bubble);
            }}
            className="absolute rounded-full flex items-center justify-center cursor-pointer shadow-2xl transition-transform active:scale-90 select-none"
            style={{
              transform: `translate(${bubble.x}px, ${bubble.y}px)`,
              width: `${bubble.radius * 2}px`,
              height: `${bubble.radius * 2}px`,
              backgroundColor: '#121626',
              border: `4px solid ${bubble.color}`,
              boxShadow: `0 0 20px ${bubble.color}60, inset 0 0 10px ${bubble.color}30`,
            }}
          >
            {settings.gameMode === 'colors' ? (
              <div
                className="rounded-full border-2 border-white/80 shadow-inner"
                style={{
                  width: `${bubble.radius * 0.9}px`,
                  height: `${bubble.radius * 0.9}px`,
                  backgroundColor: bubble.color,
                }}
              />
            ) : (
              <span
                className="font-black tracking-tight"
                style={{ color: bubble.color, fontSize: `${settings.letterSize || 24}px` }}
              >
                {bubble.value}
              </span>
            )}
          </div>
        ))}
      </main>

      {/* FOOTER STATS STRIP */}
      <footer className="w-full bg-[#121626]/90 border-t border-gray-800/80 px-6 py-3 flex items-center justify-around text-xs text-gray-400 font-semibold z-30">
        <div>
          Correct Sets: <span className="text-emerald-400 font-bold text-sm ml-1">{correctCount} / {settings.totalSets}</span>
        </div>
        <div>
          Wrong Clicks: <span className="text-rose-400 font-bold text-sm ml-1">{wrongCount}</span>
        </div>
      </footer>

      {/* MODALS */}
      <MobileTargetSettingsModal
        isOpen={showSettings}
        onClose={() => {
          setShowSettings(false);
          setIsPlaying(true);
          setIsPaused(false);
          setStartTimeRef.current = Date.now();
        }}
        settings={settings}
        onUpdateSettings={(newSettings) => {
          setSettings(newSettings);
          setShowSettings(false);
          setIsPlaying(true);
          setIsPaused(false);
          setStartTimeRef.current = Date.now();
        }}
        isInitialLaunch={!isPlaying && currentSetIndex === 0}
      />

      <MobileTargetResultsModal
        isOpen={showResults}
        onClose={() => setShowResults(false)}
        onRestart={handleRestartSession}
        onExit={onExit}
        resultData={sessionResult}
      />

      <GameMenuDrawer
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onQuit={onExit}
        onReset={handleRestartSession}
        onOpenSettings={() => {
          setMenuOpen(false);
          setShowSettings(true);
        }}
        resetButtonLabel="Restart Session"
        settingsSummary={[
          { label: 'Patient Name', value: settings.patientName },
          { label: 'Mode', value: settings.gameMode },
          { label: 'Speed', value: `${settings.speedPxPerSec} px/s` },
          { label: 'Set Duration', value: `${settings.setDurationSec}s` },
        ]}
      />
    </div>
  );
}
