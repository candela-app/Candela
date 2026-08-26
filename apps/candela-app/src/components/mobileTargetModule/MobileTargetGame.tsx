import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  GameMode,
  AlphabetVariant,
  MobileTargetSettings,
  MobileTargetSetMetric,
  MobileTargetSessionResultData,
  THERAPY_COLOR_ITEMS,
  DEFAULT_STIMULI_BUBBLE_COLOR,
  playSuccessTone,
  playErrorTone,
  reactionStatsFromMs,
  isStimuliColorMixed,
  resolveStimuliBubbleColor,
  resolveBubblePaint,
  resolveBubbleAppearance,
} from '@candela/shared';
import { MobileTargetSettingsModal, getContrastTextColor } from './MobileTargetSettingsModal';
import { MobileTargetResultsModal } from './MobileTargetResultsModal';
import { GameMenuDrawer } from '../shared/GameMenuDrawer';
import { useGameSessionLock } from '../shared/useGameSessionLock';
import { ResetConfirmDialog } from '../shared/ResetConfirmDialog';
import { SlidersIcon, PlayIcon, PauseIcon, VolumeIcon, ChevronUpIcon, ReplayIcon } from '../icons/VectorIcons';

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
}: MobileTargetGameProps) {
  useGameSessionLock(true);
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
    therapyColors: THERAPY_COLOR_ITEMS.map((item) => item.code),
    stimuliColor: DEFAULT_STIMULI_BUBBLE_COLOR,
  });

  // Speech Synthesis for Target Announcement
  const speakTarget = useCallback((textToSpeak: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(textToSpeak);
      utter.rate = 0.9;
      utter.pitch = 1.0;
      utter.lang = 'en-US';
      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }, []);

  const announceChaseTarget = useCallback(
    (value: string, name?: string) => {
      speakTarget(settings.gameMode === 'colors' ? name || value : `target ${String(value).toLowerCase()}`);
    },
    [settings.gameMode, speakTarget]
  );

  // Sync settings when initial props change
  useEffect(() => {
    setSettings((prev) =>
      prev.gameMode === initialMode && prev.alphabetVariant === initialVariant
        ? prev
        : { ...prev, gameMode: initialMode, alphabetVariant: initialVariant }
    );
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
  const [isAssistiveTouchOpen, setIsAssistiveTouchOpen] = useState(false);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [shakeError, setShakeError] = useState<boolean>(false);

  // Metrics
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [wrongCount, setWrongCount] = useState<number>(0);
  const [setMetrics, setSetMetrics] = useState<MobileTargetSetMetric[]>([]);
  const [sessionResult, setSessionResult] = useState<MobileTargetSessionResultData | null>(null);

  // Refs for physics loop
  const canvasRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const setStartTimeRef = useRef<number>(performance.now());
  const bubblesRef = useRef<MovingBubble[]>([]);
  const wrongClicksSetRef = useRef<number>(0);

  // Synchronize bubblesRef
  useEffect(() => {
    bubblesRef.current = bubbles;
  }, [bubbles]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  // Ref for shuffled pool deck
  const shuffledPoolRef = useRef<string[]>([]);

  // Function to generate shuffled pool deck for full random coverage
  const generateShuffledPool = useCallback(
    (mode: GameMode, variant?: AlphabetVariant, enabledColors?: string[]) => {
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
        items = activeTherapyColors(enabledColors ?? settings.therapyColors).map((c) => c.name);
      }

      // Fisher-Yates shuffle
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }

      shuffledPoolRef.current = items;
      return items;
    },
    [settings.therapyColors]
  );

  // Generate Pair of Target & Distractor Bubbles
  const generateSetPair = useCallback(
    (
      setIdx: number,
      mode: GameMode,
      variant?: AlphabetVariant,
      customSettings?: MobileTargetSettings,
      shouldSpeak: boolean = false
    ) => {
      const effSettings = customSettings || settings;

      // Ensure pool exists
      if (shuffledPoolRef.current.length === 0 || setIdx === 0) {
        generateShuffledPool(mode, variant, effSettings.therapyColors);
      }

      const pool = shuffledPoolRef.current;
      const totalPoolSets = pool.length;

      // Update totalSets in settings dynamically to pool size (e.g. 26 letters)
      if (settings.totalSets !== totalPoolSets) {
        setSettings((prev) => (prev.totalSets === totalPoolSets ? prev : { ...prev, totalSets: totalPoolSets }));
      }

      const targetVal = pool[setIdx % pool.length];

      // Pick distractorVal from remaining pool items
      const availableDistractors = pool.filter((val) => val !== targetVal);
      const distractorVal =
        availableDistractors[Math.floor(Math.random() * availableDistractors.length)];

      const palette = activeTherapyColors(effSettings.therapyColors);
      let targetCol = palette[0].code;
      let distractorCol = palette[1].code;
      let targetName: string | undefined = undefined;

      if (mode === 'colors') {
        const tColorObj = palette.find((c) => c.name === targetVal) || palette[0];
        const dColorObj = palette.find((c) => c.name === distractorVal) || palette[1];
        targetCol = tColorObj.code;
        distractorCol = dColorObj.code;
        targetName = tColorObj.name;
      } else if (isStimuliColorMixed(effSettings.stimuliColor)) {
        const c1 = Math.floor(Math.random() * palette.length);
        let c2 = Math.floor(Math.random() * palette.length);
        while (c2 === c1) c2 = Math.floor(Math.random() * palette.length);
        targetCol = palette[c1].code;
        distractorCol = palette[c2].code;
      } else {
        const solid = resolveStimuliBubbleColor(effSettings.stimuliColor, 0);
        targetCol = solid;
        distractorCol = solid;
      }

      setTargetItem({ value: targetVal, color: targetCol, name: targetName });

      // Announce target via sound/speech synthesis ONLY when requested
      if (shouldSpeak) {
        speakTarget(mode === 'colors' ? targetName || targetVal : `target ${String(targetVal).toLowerCase()}`);
      }

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
      setStartTimeRef.current = performance.now();
    },
    [settings, generateShuffledPool]
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
        const { avgSec: avgReaction } = reactionStatsFromMs(
          updatedMetrics.map((m) => m.reactionTimeMs),
        );
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
      const reactionMs = performance.now() - setStartTimeRef.current;
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
    setStartTimeRef.current = performance.now();
    speakTarget(
      settings.gameMode === 'colors'
        ? targetItem.name || targetItem.value
        : `target ${String(targetItem.value).toLowerCase()}`
    );
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
    <div className="w-screen h-screen bg-[#0A0A12] text-white select-none overflow-hidden touch-none relative font-sans">
      <main
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full overflow-hidden flex items-center justify-center ${
          shakeError ? 'animate-shake' : ''
        }`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(#1E2640_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

        {bubbles.map((bubble) => {
          const appearance = resolveBubbleAppearance(settings.bubbleAppearance, settings.hasBackground);
          const paint = resolveBubblePaint(appearance, bubble.color, {
            borderFill: '#121626',
            solidBorderColor: '#FFFFFF',
            solidBorderWidth: 3,
          });
          const textColor = paint.textColor;

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
              className="absolute rounded-full flex items-center justify-center cursor-pointer select-none"
              style={{
                left: '50%',
                top: '50%',
                transform: `translate3d(${bubble.x - radius}px, ${bubble.y - radius}px, 0)`,
                width: `${diameter}px`,
                height: `${diameter}px`,
                backgroundColor: paint.backgroundColor,
                border: `${paint.borderWidth}px solid ${paint.borderColor}`,
                boxShadow: 'none',
                touchAction: 'none',
                willChange: 'transform',
              }}
            >
              {settings.gameMode === 'colors' ? null : (
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

      <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-40 flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity duration-200">
        <button
          onClick={toggleFullscreen}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#121626]/90 hover:bg-[#1A2035] border border-gray-800/90 hover:border-gray-700 text-gray-300 hover:text-white flex items-center justify-center shadow-md transition-all cursor-pointer backdrop-blur-md active:scale-95"
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {isFullscreen ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3" />
              <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
              <path d="M3 16h3a2 2 0 0 1 2 2v3" />
              <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6" />
              <path d="M9 21H3v-6" />
              <path d="M21 3l-7 7" />
              <path d="M3 21l7-7" />
            </svg>
          )}
        </button>
        <button
          onClick={() => announceChaseTarget(targetItem.value, targetItem.name)}
          className="w-7 h-7 sm:w-8 sm:h-8 bg-transparent border-0 text-slate-500/40 hover:text-slate-400 flex items-center justify-center cursor-pointer transition-colors active:scale-95"
          title="Replay target"
        >
          <ReplayIcon className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => {
            setIsAssistiveTouchOpen((prev) => !prev);
            setIsHeaderExpanded(false);
          }}
          className={`relative w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 shadow-md flex items-center justify-center transition-all cursor-pointer backdrop-blur-md active:scale-95 group ${
            isAssistiveTouchOpen
              ? 'bg-[#1A2035] border-blue-400 text-white shadow-blue-500/30 ring-2 ring-blue-500/40'
              : 'bg-[#121626]/90 hover:bg-[#1A2035] border-blue-500/70 hover:border-blue-400 text-white'
          }`}
          title="Current Target - Tap to open menu"
        >
          {settings.gameMode === 'colors' ? (
            <div
              className="w-3.5 h-3.5 rounded-full border border-white shadow-sm shrink-0"
              style={{ backgroundColor: targetItem.color }}
            />
          ) : (
            <span className="text-xs sm:text-sm font-black tracking-tight drop-shadow-md select-none" style={{ color: targetItem.color }}>
              {targetItem.value}
            </span>
          )}
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-blue-600 text-white flex items-center justify-center border border-blue-400 shadow-sm">
            <ChevronUpIcon className="w-2 h-2" size={8} />
          </span>
        </button>
        <button
          onClick={() => {
            setIsHeaderExpanded((prev) => !prev);
            setIsAssistiveTouchOpen(false);
          }}
          className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-[#121626]/90 hover:bg-[#1A2035] border border-gray-800/90 hover:border-gray-700 text-gray-300 hover:text-white text-[10px] sm:text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur-md active:scale-95"
          title={isHeaderExpanded ? 'Hide Info' : 'View Info'}
        >
          <span className="text-blue-400 font-extrabold text-[9px] sm:text-[10px]">{isHeaderExpanded ? '▼' : '▲'}</span>
          <span>{isHeaderExpanded ? 'Hide Info' : 'View Info'}</span>
        </button>
      </div>

      {isAssistiveTouchOpen && (
        <div className="fixed bottom-16 right-16 sm:bottom-20 sm:right-24 z-50 bg-[#121626]/95 border border-gray-800/90 p-4 rounded-3xl shadow-2xl backdrop-blur-xl flex flex-col gap-3 min-w-[210px] animate-slide-in-up">
          <div className="flex items-center justify-between border-b border-gray-800/80 pb-2">
            <span className="text-xs font-extrabold text-gray-300 uppercase tracking-wider">Controls</span>
            <button onClick={() => setIsAssistiveTouchOpen(false)} className="text-gray-400 hover:text-white text-sm font-bold cursor-pointer p-0.5">
              ✕
            </button>
          </div>
          <button
            onClick={() => announceChaseTarget(targetItem.value, targetItem.name)}
            title="Current target"
            className="flex items-center justify-between bg-[#1A2035] hover:bg-[#222942] border border-blue-500/40 hover:border-blue-400 px-3 py-2 rounded-2xl shadow-inner cursor-pointer transition-all active:scale-95 group w-full"
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Target:</span>
              {settings.gameMode === 'colors' ? (
                <div className="w-5 h-5 rounded-full border border-white shadow-sm" style={{ backgroundColor: targetItem.color }} />
              ) : (
                <span className="text-xl font-black tracking-widest drop-shadow-md" style={{ color: targetItem.color }}>
                  {targetItem.value}
                </span>
              )}
            </div>
            <span className="text-blue-400 text-xs font-bold flex items-center gap-1">
              <VolumeIcon className="w-3.5 h-3.5" /> Replay
            </span>
          </button>
          <button
            onClick={() => setIsPaused((prev) => !prev)}
            className={`w-full py-2.5 px-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 border ${
              isPaused
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-md'
                : 'bg-gray-800/90 hover:bg-gray-700 text-gray-200 border-gray-700'
            }`}
          >
            {isPaused ? <PlayIcon className="w-3.5 h-3.5" /> : <PauseIcon className="w-3.5 h-3.5" />}
            <span>{isPaused ? 'Play' : 'Pause'}</span>
          </button>
          <button
            onClick={() => {
              setIsAssistiveTouchOpen(false);
              setIsPaused(true);
              setShowSettings(true);
            }}
            className="w-full py-2.5 px-3 rounded-2xl bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors border border-gray-700/80 flex items-center justify-center gap-2 text-xs font-bold"
          >
            <SlidersIcon className="w-4 h-4" />
            <span>Settings</span>
          </button>
          <button
            onClick={() => setConfirmReset(true)}
            className="w-full py-2 rounded-2xl bg-gray-800/90 hover:bg-gray-700 text-xs font-bold text-gray-200 transition-colors border border-gray-700 text-center"
          >
            Reset Game
          </button>
          <button
            onClick={() => {
              const inProgress = !showResults && !showSettings && !showClickToStart;
              if (inProgress) setConfirmQuit(true);
              else {
                setIsAssistiveTouchOpen(false);
                onExit();
              }
            }}
            className="w-full py-2 rounded-2xl bg-red-700 hover:bg-red-600 text-xs font-bold text-white transition-colors shadow-md text-center"
          >
            Quit Game
          </button>
        </div>
      )}

      {isHeaderExpanded && (
        <div className="fixed bottom-16 right-4 sm:bottom-20 sm:right-6 z-40 bg-[#121626]/95 border border-gray-800/90 p-4 sm:p-5 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col gap-3 text-xs animate-slide-in-up min-w-[270px]">
          <div className="flex items-center justify-between border-b border-gray-800 pb-2">
            <div>
              <h1 className="text-sm font-extrabold text-white tracking-tight">Session & Clinical Info</h1>
              <span className="text-[11px] text-gray-400 font-medium">{gameTitle}</span>
            </div>
            <button onClick={() => setIsHeaderExpanded(false)} className="text-gray-400 hover:text-white text-base font-bold ml-3 cursor-pointer">
              ✕
            </button>
          </div>
          <div className="flex flex-col gap-1.5 text-xs font-medium text-gray-300">
            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Clinical Parameters</span>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Patient:</span>
              <span className="text-white font-bold">{settings.patientName}</span>
            </div>
            {settings.gameMode === 'colors' ? null : (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Letter Size:</span>
                <span className="text-blue-400 font-bold">{settings.letterSize || 32} px</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Bubble Size:</span>
              <span className="text-blue-400 font-bold">{settings.bubbleSize || 96} px</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Set:</span>
              <span className="text-blue-400 font-bold">{currentSetIndex + 1} / {settings.totalSets}</span>
            </div>
          </div>
          <div className="h-px bg-gray-800/80 my-0.5" />
          <div className="flex flex-col gap-1.5 text-xs font-medium text-gray-300">
            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Live Metrics</span>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Correct Sets:</span>
              <span className="text-emerald-400 font-bold">{correctCount} / {settings.totalSets}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Wrong Clicks:</span>
              <span className="text-rose-400 font-bold">{wrongCount}</span>
            </div>
          </div>
        </div>
      )}

      {/* Click to Start overlay */}
      {showClickToStart && !showSettings && !showResults && (
        <div className="fixed inset-0 z-40 bg-[#06070D]/98 flex flex-col items-center justify-center gap-4 px-4 p-6 text-center select-none">
          <h2 className="text-2xl sm:text-3xl font-black text-white text-center">{gameTitle}</h2>
          <button
            type="button"
            onClick={handleStartGameFromOverlay}
            className="px-8 py-4 rounded-full bg-[#34D399] text-slate-950 font-black text-xl cursor-pointer active:scale-95"
            title="Click to Start Therapy Session"
          >
            Click to Start
          </button>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="text-xs sm:text-sm font-extrabold text-gray-300 hover:text-cyan-300 transition-colors cursor-pointer flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900/60 hover:bg-gray-800/90 border border-gray-700/80 shadow-md z-10"
          >
            <span>⚙️ Edit Clinical Settings</span>
          </button>
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
          const nextColors = activeTherapyColors(newSettings.therapyColors).map((item) => item.code);
          const appearance = resolveBubbleAppearance(newSettings.bubbleAppearance, newSettings.hasBackground);
          const next = {
            ...newSettings,
            therapyColors: nextColors,
            bubbleAppearance: appearance,
            hasBackground: appearance === 'solid',
          };
          setSettings(next);
          setShowSettings(false);
          setIsPlaying(false);
          setIsPaused(true);
          setShowClickToStart(true);
          generateSetPair(0, next.gameMode, next.alphabetVariant, next);
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
        sessionInProgress={!showResults && !showSettings && !showClickToStart}
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
      <ResetConfirmDialog
        isOpen={confirmReset}
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          setIsAssistiveTouchOpen(false);
          handleRestartSession();
        }}
      />
      <ResetConfirmDialog
        isOpen={confirmQuit}
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
    </div>
  );
}
