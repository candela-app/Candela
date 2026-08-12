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
import { MobileTargetSettingsModal, getContrastTextColor } from './MobileTargetSettingsModal';
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
  scatterTimer?: number; // duration of 2D scatter deflection after collision
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
    hasBackground: false,
  });

  // Speech Synthesis for Target Announcement
  const speakTarget = useCallback((textToSpeak: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(textToSpeak);
      utter.rate = 0.9;
      utter.pitch = 1.0;
      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }, []);

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
      ? 'Color Discriminant Bubble Chase'
      : settings.gameMode === 'numbers'
      ? 'Numeric Bubble Chase'
      : settings.alphabetVariant === 'lowercase'
      ? 'Lowercase Bubble Chase'
      : 'Uppercase Bubble Chase';

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
  const [showClickToStart, setShowClickToStart] = useState<boolean>(false);
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
      items = GENERIC_COLORS.map((c) => c.name);
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
    (
      setIdx: number,
      mode: GameMode,
      variant?: AlphabetVariant,
      customSettings?: MobileTargetSettings,
      shouldSpeak: boolean = false
    ) => {
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
      const distractorVal =
        availableDistractors[Math.floor(Math.random() * availableDistractors.length)];

      let targetCol = GENERIC_COLORS[0].code;
      let distractorCol = GENERIC_COLORS[1].code;
      let targetName: string | undefined = undefined;

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

      // Announce target via sound/speech synthesis ONLY when requested
      if (shouldSpeak) {
        speakTarget(targetName || targetVal);
      }

      const effSettings = customSettings || settings;
      const speed = effSettings.speedPxPerSec;
      const radius = (effSettings.bubbleSize || 96) / 2;
      const axis = effSettings.movementAxis || 'random';

      // Detect canvas bounds & screen orientation
      let boundsW = 360;
      let boundsH = 640;
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          boundsW = rect.width;
          boundsH = rect.height;
        }
      }

      const halfW = boundsW / 2;
      const halfH = boundsH / 2;

      // Full screen initial scattering
      let initX0 = -halfW * 0.4;
      let initY0 = -Math.max(50, halfH * 0.45);
      let initX1 = halfW * 0.4;
      let initY1 = Math.max(50, halfH * 0.45);

      let initVx0 = speed;
      let initVy0 = 0;
      let initVx1 = -speed;
      let initVy1 = 0;

      if (axis === 'horizontal') {
        // Scatter across top vs bottom screen space
        initY0 = -Math.max(60, halfH * 0.45);
        initY1 = Math.max(60, halfH * 0.45);
        initVx0 = speed;
        initVy0 = 0;
        initVx1 = -speed;
        initVy1 = 0;
      } else if (axis === 'vertical') {
        // Scatter across left vs right screen space
        initX0 = -Math.max(60, halfW * 0.45);
        initX1 = Math.max(60, halfW * 0.45);
        initVx0 = 0;
        initVy0 = speed;
        initVx1 = 0;
        initVy1 = -speed;
      } else {
        let angle1 = Math.PI / 4 + (Math.random() * Math.PI) / 4;
        let angle2 = (5 * Math.PI) / 4 + (Math.random() * Math.PI) / 4;
        initVx0 = Math.cos(angle1) * speed;
        initVy0 = Math.sin(angle1) * speed;
        initVx1 = Math.cos(angle2) * speed;
        initVy1 = Math.sin(angle2) * speed;
      }

      const existingB0 = setIdx > 0 && bubblesRef.current.length >= 2 ? bubblesRef.current[0] : null;
      const existingB1 = setIdx > 0 && bubblesRef.current.length >= 2 ? bubblesRef.current[1] : null;

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
        y: existingB0 ? existingB0.y : initY0,
        vx: existingB0 ? (axis === 'horizontal' ? (existingB0.vx >= 0 ? speed : -speed) : existingB0.vx) : initVx0,
        vy: existingB0 ? (axis === 'vertical' ? (existingB0.vy >= 0 ? speed : -speed) : existingB0.vy) : initVy0,
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
        y: existingB1 ? existingB1.y : initY1,
        vx: existingB1 ? (axis === 'horizontal' ? (existingB1.vx >= 0 ? speed : -speed) : existingB1.vx) : initVx1,
        vy: existingB1 ? (axis === 'vertical' ? (existingB1.vy >= 0 ? speed : -speed) : existingB1.vy) : initVy1,
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
    generateShuffledPool(initialMode, initialVariant);
    generateSetPair(0, initialMode, initialVariant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMode, initialVariant]);

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
        generateSetPair(nextSet, settings.gameMode, settings.alphabetVariant, undefined, true);
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

              if (axis === 'horizontal' || axis === 'vertical') {
                // Scatter deflection: enable 2D bounce for 1.4s so bubbles scatter apart into open space
                b1.scatterTimer = 1.4;
                b2.scatterTimer = 1.4;
              }

              const spd1 = Math.hypot(b1.vx, b1.vy) || 1;
              b1.vx = (b1.vx / spd1) * targetSpeed;
              b1.vy = (b1.vy / spd1) * targetSpeed;

              const spd2 = Math.hypot(b2.vx, b2.vy) || 1;
              b2.vx = (b2.vx / spd2) * targetSpeed;
              b2.vy = (b2.vy / spd2) * targetSpeed;
            }
          }
        }

        // 2. Wall Bouncing, Bounds Clamping & Scatter Decay
        const updated = list.map((bubble) => {
          let nx = bubble.x;
          let ny = bubble.y;
          let nvx = bubble.vx;
          let nvy = bubble.vy;
          let timer = bubble.scatterTimer !== undefined ? bubble.scatterTimer - dt : 0;
          if (timer < 0) timer = 0;

          const targetSpeed = settings.speedPxPerSec;
          const axis = settings.movementAxis || 'random';

          // When scatter deflection timer expires, smoothly damp secondary velocity back to zero
          if (timer <= 0) {
            if (axis === 'horizontal') {
              nvy = nvy * Math.pow(0.01, dt);
              if (Math.abs(nvy) < 2) nvy = 0;
              nvx = (nvx >= 0 ? 1 : -1) * targetSpeed;
            } else if (axis === 'vertical') {
              nvx = nvx * Math.pow(0.01, dt);
              if (Math.abs(nvx) < 2) nvx = 0;
              nvy = (nvy >= 0 ? 1 : -1) * targetSpeed;
            }
          }

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

          return { ...bubble, x: nx, y: ny, vx: nvx, vy: nvy, scatterTimer: timer };
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

  const handleStartGameFromOverlay = () => {
    setShowClickToStart(false);
    setIsPlaying(true);
    setIsPaused(false);
    setStartTimeRef.current = Date.now();
    speakTarget(targetItem.name || targetItem.value);
  };

  const handleRestartSession = () => {
    setCurrentSetIndex(0);
    setCorrectCount(0);
    setWrongCount(0);
    setSetMetrics([]);
    setSessionResult(null);
    setShowResults(false);
    setShowSettings(true);
    setShowClickToStart(false);
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
          <div>
            <h1 className="text-base font-extrabold text-white tracking-tight leading-none">
              {gameTitle}
            </h1>
            <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider">
              Set {currentSetIndex + 1} of {settings.totalSets}
            </span>
          </div>
        </div>

        {/* TARGET CARD DISPLAY WITH SPEAKER BUTTON */}
        <button
          onClick={() => speakTarget(targetItem.name || targetItem.value)}
          title="Click to hear target sound"
          className="flex items-center gap-3 bg-[#1A2035] hover:bg-[#222942] border-2 border-blue-500/40 hover:border-blue-400 px-4 py-1.5 rounded-2xl shadow-inner cursor-pointer transition-all active:scale-95 group"
        >
          <span className="text-xs text-gray-400 font-bold uppercase tracking-wider hidden sm:inline group-hover:text-blue-300">
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
          <span
            className="text-blue-400 group-hover:scale-110 transition-transform text-base ml-1"
            title="Play target sound"
          >
            🔊
          </span>
        </button>

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
        {bubbles.map((bubble) => {
          const hasBg = settings.hasBackground ?? false;
          const contrastTextColor = getContrastTextColor(bubble.color);
          const textColor = hasBg ? contrastTextColor : bubble.color;

          const radius = bubble.radius || (settings.bubbleSize || 96) / 2;
          const diameter = radius * 2;
          const fontSize = settings.letterSize || Math.round(diameter * 0.38);

          return (
            <div
              key={bubble.id}
              onClick={() => handleBubbleTap(bubble)}
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleBubbleTap(bubble);
              }}
              className="absolute rounded-full flex items-center justify-center cursor-pointer shadow-2xl select-none"
              style={{
                left: '50%',
                top: '50%',
                transform: `translate3d(${bubble.x - radius}px, ${bubble.y - radius}px, 0)`,
                width: `${diameter}px`,
                height: `${diameter}px`,
                backgroundColor: hasBg ? bubble.color : '#121626',
                border: hasBg ? '3px solid #FFFFFF' : `4px solid ${bubble.color}`,
                boxShadow: hasBg
                  ? `0 0 20px ${bubble.color}90`
                  : `0 0 20px ${bubble.color}60, inset 0 0 10px ${bubble.color}30`,
                touchAction: 'none',
                willChange: 'transform',
              }}
            >
              {settings.gameMode === 'colors' ? (
                <div
                  className="rounded-full shadow-md"
                  style={{
                    width: `${radius * 0.8}px`,
                    height: `${radius * 0.8}px`,
                    backgroundColor: hasBg ? contrastTextColor : bubble.color,
                    border: hasBg ? '2px solid rgba(0,0,0,0.3)' : '2px solid #FFFFFF',
                  }}
                />
              ) : (
                <span
                  className="font-black tracking-tight"
                  style={{ color: textColor, fontSize: `${fontSize}px` }}
                >
                  {bubble.value}
                </span>
              )}
            </div>
          );
        })}
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

      {/* PEDIATRIC LOW-VISION PLAY BUTTON (NO MODAL CARD) */}
      {showClickToStart && !showSettings && !showResults && (
        <div
          onClick={handleStartGameFromOverlay}
          onTouchStart={(e) => {
            e.preventDefault();
            handleStartGameFromOverlay();
          }}
          className="fixed inset-0 z-40 bg-[#06060C]/90 backdrop-blur-md flex flex-col items-center justify-center cursor-pointer select-none px-4 animate-fadeIn"
        >
          <div className="flex flex-col items-center gap-8 transform transition-transform hover:scale-105 active:scale-95">
            {/* GIANT HIGH-CONTRAST NEON PLAY BUTTON */}
            <div className="relative flex items-center justify-center">
              {/* Pulsing Outer Neon Ring for Visual Guidance */}
              <div className="absolute w-48 h-48 sm:w-56 sm:h-56 rounded-full bg-emerald-400/30 animate-ping" />
              <div className="absolute w-44 h-44 sm:w-52 sm:h-52 rounded-full bg-emerald-500/20 blur-xl" />

              {/* Main Circular High-Contrast Button */}
              <button
                type="button"
                className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-full bg-gradient-to-tr from-emerald-500 via-green-400 to-lime-300 border-4 border-white shadow-[0_0_60px_rgba(57,255,20,0.85)] flex items-center justify-center cursor-pointer"
                title="Tap to Play"
              >
                {/* Giant High-Contrast Black Triangle Play Icon */}
                <svg
                  viewBox="0 0 24 24"
                  fill="#000000"
                  className="w-24 h-24 sm:w-28 sm:h-28 translate-x-2 drop-shadow-lg"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
            </div>

            {/* HUGE CHILD-FRIENDLY HIGH-CONTRAST TEXT */}
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="text-3xl sm:text-5xl font-black text-white tracking-wider drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
                TAP TO PLAY
              </span>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      <MobileTargetSettingsModal
        isOpen={showSettings}
        onClose={() => {
          setShowSettings(false);
          setIsPlaying(false);
          setIsPaused(true);
          setShowClickToStart(true);
        }}
        settings={settings}
        onUpdateSettings={(newSettings) => {
          setSettings(newSettings);
          setShowSettings(false);
          setIsPlaying(false);
          setIsPaused(true);
          setShowClickToStart(true);
          generateSetPair(currentSetIndex, newSettings.gameMode, newSettings.alphabetVariant, newSettings);
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
