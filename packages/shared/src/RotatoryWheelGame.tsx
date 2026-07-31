'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameMode, AlphabetVariant, BubbleItem, BubblePosition } from './types';
import { BRIGHT_COLORS, SPEED_PRESETS, DEFAULT_BASE_ANIMATION_DURATION } from './constants';
import {
  checkOverlap,
  getRandomSymbol,
  getContrastColor,
  exportSessionCSV,
  requestFullScreenSafe,
  exitFullScreenSafe,
} from './game-logic';
import {
  playCorrectSoundAndHaptic,
  playWrongBubbleSoundAndHaptic,
  playMissPressSoundAndHaptic,
  playSuccessSoundAndHaptic,
} from './audio-haptics';
import { ClinicalSettingsModal } from './ClinicalSettingsModal';

export interface RotatoryWheelGameProps {
  initialMode?: GameMode;
  initialVariant?: AlphabetVariant;
  onExit?: () => void;
}

/**
 * Shared Rotatory Wheel Game Component for Vision Therapy & Visual Pursuit.
 * Standardized template, smooth revolving wheel, zero-rotation bubble orientation (N & Z look distinct),
 * shared audio-haptics, background miss-press detection, and ClinicalSettingsModal.
 */
export function RotatoryWheelGame({
  initialMode = 'alphabets',
  initialVariant = 'uppercase',
  onExit,
}: RotatoryWheelGameProps) {
  const [mode] = useState<GameMode>(initialMode);
  const [variant] = useState<AlphabetVariant>(initialVariant);
  const [isPaused, setIsPaused] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(1);
  const [bubbles, setBubbles] = useState<BubbleItem[]>([]);
  const [currentTarget, setCurrentTarget] = useState<string>('');
  const [targetColor, setTargetColor] = useState<string>('#ff5722');

  // Clinical Settings
  const [patientName, setPatientName] = useState<string>('Demo Patient');
  const [letterSize, setLetterSize] = useState<number>(1.8);
  const [bubbleSize, setBubbleSize] = useState<number>(90);
  const [wheelColor, setWheelColor] = useState<string>('#000000');
  const [customColors] = useState<string[]>(['#FFFFFF', '#2F80FF', '#FF3B30']);

  // Settings Modal State (AUTO OPENS ON GAME LAUNCH)
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(true);

  // Temporary Settings state for Modal editing
  const [tempPatientName, setTempPatientName] = useState<string>(patientName);
  const [tempLetterSize, setTempLetterSize] = useState<number>(letterSize);
  const [tempBubbleSize, setTempBubbleSize] = useState<number>(bubbleSize);
  const [tempWheelColor, setTempWheelColor] = useState<string>(wheelColor);

  // Notification Toast State
  const [notification, setNotification] = useState<string | null>(null);

  // Stats
  const [clicks, setClicks] = useState<number>(0);
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [wrongCount, setWrongCount] = useState<number>(0);
  const [poppingIds, setPoppingIds] = useState<Set<string>>(new Set());
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());
  const [startTime, setStartTime] = useState<number | null>(null);

  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [targetShownAt, setTargetShownAt] = useState<number | null>(null);

  const currentTargetRef = useRef<string>('');
  const modeRef = useRef<GameMode>(mode);
  const variantRef = useRef<AlphabetVariant>(variant);

  // Voice selection helper for Indian English (en-IN)
  const indianVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    modeRef.current = mode;
    variantRef.current = variant;
  }, [mode, variant]);

  // Request Fullscreen on game entry and prevent double-tap zoom gestures
  useEffect(() => {
    requestFullScreenSafe();

    let lastTouchEnd = 0;
    const preventDoubleTapZoom = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };

    document.addEventListener('touchend', preventDoubleTapZoom, { passive: false });

    return () => {
      document.removeEventListener('touchend', preventDoubleTapZoom);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      const inVoice = voices.find(
        (v) =>
          v.lang.toLowerCase().includes('en-in') ||
          v.lang.toLowerCase().includes('en_in') ||
          v.name.toLowerCase().includes('india') ||
          v.name.toLowerCase().includes('indian')
      );
      if (inVoice) {
        indianVoiceRef.current = inVoice;
      }
    };

    updateVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  const speak = useCallback((text: string, currentMode: GameMode) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.85; // Clear, natural rate for Indian speech therapy context
    utter.pitch = 1.0;

    if (indianVoiceRef.current) {
      utter.voice = indianVoiceRef.current;
      utter.lang = indianVoiceRef.current.lang;
    } else {
      utter.lang = 'en-IN';
    }

    window.speechSynthesis.speak(utter);
  }, []);

  // Sync temp settings whenever modal opens
  useEffect(() => {
    if (isSettingsOpen) {
      setTempPatientName(patientName);
      setTempLetterSize(letterSize);
      setTempBubbleSize(bubbleSize);
      setTempWheelColor(wheelColor);
    }
  }, [isSettingsOpen, patientName, letterSize, bubbleSize, wheelColor]);

  const selectNewTarget = useCallback(
    (currentBubbles: BubbleItem[]) => {
      if (!currentBubbles.length) return;
      const randomBubble = currentBubbles[Math.floor(Math.random() * currentBubbles.length)];

      if (modeRef.current === 'colors') {
        const matchingColorObj = BRIGHT_COLORS.find((c) => c.code === randomBubble.color);
        const name = matchingColorObj ? matchingColorObj.name : 'Color';
        setCurrentTarget(name);
        setTargetColor(randomBubble.color || '#ff5722');
        currentTargetRef.current = name;
        setTargetShownAt(performance.now());
        speak(name, modeRef.current);
      } else {
        const symbol = randomBubble.symbol;
        setCurrentTarget(symbol);
        setTargetColor('#ff5722');
        currentTargetRef.current = symbol;
        setTargetShownAt(performance.now());
        speak(`target ${symbol}`, modeRef.current);
      }
    },
    [speak]
  );

  const spawnBubbles = useCallback(() => {
    const newBubbles: BubbleItem[] = [];
    const count = 10;
    const centerMarginPct = 25;
    const maxRadiusPct = 42;
    const positions: BubblePosition[] = [];

    for (let i = 0; i < count; i++) {
      let pos: BubblePosition = { x: 50, y: 50 };
      let valid = false;

      for (let attempt = 0; attempt < 100; attempt++) {
        const angle = Math.random() * 2 * Math.PI;
        const radius = centerMarginPct + Math.random() * (maxRadiusPct - centerMarginPct);
        const x = 50 + radius * Math.cos(angle);
        const y = 50 + radius * Math.sin(angle);

        pos = { x, y };
        if (!checkOverlap(pos, positions, 14)) {
          valid = true;
          break;
        }
      }

      if (valid) {
        positions.push(pos);
        const randomSymbol = getRandomSymbol(modeRef.current, variantRef.current);
        const randomColor = BRIGHT_COLORS[Math.floor(Math.random() * BRIGHT_COLORS.length)].code;

        newBubbles.push({
          id: `bubble-${i}-${Math.random()}`,
          symbol: randomSymbol,
          color: randomColor,
          x: pos.x,
          y: pos.y,
        });
      }
    }

    setBubbles(newBubbles);
    selectNewTarget(newBubbles);
  }, [selectNewTarget]);

  const startLevel = useCallback(() => {
    setClicks(0);
    setCorrectCount(0);
    setWrongCount(0);
    setPoppingIds(new Set());
    setWrongIds(new Set());
    setReactionTimes([]);
    setStartTime(performance.now());
    spawnBubbles();
    setIsPaused(false);
  }, [spawnBubbles]);

  useEffect(() => {
    startLevel();
  }, [startLevel]);

  const handleBubbleClick = (clickedBubble: BubbleItem) => {
    if (isPaused) return;

    setClicks((prev) => prev + 1);

    let isCorrect = false;
    if (mode === 'colors') {
      const matchingColorObj = BRIGHT_COLORS.find((c) => c.code === clickedBubble.color);
      if (matchingColorObj && matchingColorObj.name === currentTarget) {
        isCorrect = true;
      }
    } else {
      if (clickedBubble.symbol === currentTarget) {
        isCorrect = true;
      }
    }

    if (isCorrect) {
      playCorrectSoundAndHaptic();
      setCorrectCount((prev) => prev + 1);

      if (targetShownAt !== null) {
        const rt = performance.now() - targetShownAt;
        setReactionTimes((prev) => [...prev, rt]);
      }

      setPoppingIds((prev) => new Set(prev).add(clickedBubble.id));

      setTimeout(() => {
        setBubbles((prevBubbles) => {
          const updated = prevBubbles.map((b) => {
            if (b.id === clickedBubble.id) {
              const centerMarginPct = 25;
              const maxRadiusPct = 42;
              const otherPositions = prevBubbles
                .filter((other) => other.id !== clickedBubble.id)
                .map((other) => ({ x: other.x, y: other.y }));

              let pos: BubblePosition = { x: 50, y: 50 };
              for (let attempt = 0; attempt < 100; attempt++) {
                const angle = Math.random() * 2 * Math.PI;
                const radius = centerMarginPct + Math.random() * (maxRadiusPct - centerMarginPct);
                const x = 50 + radius * Math.cos(angle);
                const y = 50 + radius * Math.sin(angle);
                pos = { x, y };
                if (!checkOverlap(pos, otherPositions, 14)) {
                  break;
                }
              }

              return {
                ...b,
                symbol: getRandomSymbol(mode, variant),
                color: BRIGHT_COLORS[Math.floor(Math.random() * BRIGHT_COLORS.length)].code,
                x: pos.x,
                y: pos.y,
              };
            }
            return b;
          });

          selectNewTarget(updated);
          return updated;
        });

        setPoppingIds((prev) => {
          const next = new Set(prev);
          next.delete(clickedBubble.id);
          return next;
        });
      }, 300);

      // Level completion trigger after 10 correct hits
      if (correctCount + 1 >= 10) {
        setIsPaused(true);
        playSuccessSoundAndHaptic();

        if (startTime !== null) {
          const totalDuration = (performance.now() - startTime) / 1000;
          const avgReact = reactionTimes.length
            ? reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length / 1000
            : 0;

          exportSessionCSV({
            patientName,
            sessionId: Math.floor(1000 + Math.random() * 9000),
            date: new Date().toLocaleDateString('en-GB'),
            gameName: `Rotatory Module (${mode} - ${variant})`,
            stimuliCount: 10,
            letterSize,
            speed: `${speed}x`,
            durationSec: Math.round(totalDuration),
            clicksTotal: clicks + 1,
            correct: correctCount + 1,
            wrong: wrongCount,
            accuracy: Math.round(((correctCount + 1) / (clicks + 1)) * 100),
            avgReactionSec: parseFloat(avgReact.toFixed(2)),
          });
        }
      }
    } else {
      playWrongBubbleSoundAndHaptic();
      setWrongCount((prev) => prev + 1);
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
    if (!isPaused) {
      setClicks((prev) => prev + 1);
      setWrongCount((prev) => prev + 1);
      playMissPressSoundAndHaptic();
    }
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
    setIsPaused(false);
    if (currentTargetRef.current) {
      const targetText = currentTargetRef.current;
      setTimeout(() => {
        speak(mode === 'colors' ? targetText : `target ${targetText}`, mode);
      }, 200);
    }
  };

  const currentDurationSec = startTime ? Math.floor((performance.now() - startTime) / 1000) : 0;
  const currentAccuracy = clicks > 0 ? Math.round((correctCount / clicks) * 100) : 0;
  const animationDuration = DEFAULT_BASE_ANIMATION_DURATION / speed;
  const textColor = getContrastColor(wheelColor);

  return (
    <div className="relative w-screen h-screen bg-[#111111] flex flex-col justify-between overflow-hidden select-none">
      {/* NOTIFICATION TOAST */}
      {notification && (
        <div className="fixed top-5 left-1/2 transform -translate-x-1/2 bg-emerald-600 text-white font-bold px-6 py-3 rounded-full shadow-2xl z-[300] animate-bounce">
          ✓ {notification}
        </div>
      )}

      {/* HEADER STATS BAR */}
      <div className="w-full flex flex-row items-center justify-between px-6 py-3 bg-[#1e1e1e]/90 text-white backdrop-blur border-b border-gray-800 z-10">
        <div className="flex items-center gap-4">
          <button
            className="text-2xl font-bold text-gray-300 hover:text-white transition-colors"
            onClick={() => {
              exitFullScreenSafe();
              if (onExit) onExit();
            }}
          >
            ← Back
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-400">Target:</span>
            {mode === 'colors' ? (
              <span className="text-xl font-extrabold" style={{ color: targetColor }}>
                {currentTarget}
              </span>
            ) : (
              <span className="text-3xl font-black text-blue-400 font-mono">{currentTarget}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm font-medium">
          <div>
            Time: <span className="font-mono font-bold text-blue-400">{currentDurationSec}s</span>
          </div>
          <div>
            Accuracy: <span className="font-mono font-bold text-emerald-400">{currentAccuracy}%</span>
          </div>
          <div>
            Score: <span className="font-mono font-bold text-yellow-400">{correctCount}</span>
          </div>
        </div>

        {/* RIGHT: HAMBURGER MENU */}
        <div className="z-10 flex items-center">
          <button
            className="bg-transparent border-none text-4xl text-gray-300 hover:text-white cursor-pointer"
            onClick={() => setIsMenuOpen(true)}
            title="Menu"
          >
            ☰
          </button>
        </div>
      </div>

      {/* MAIN GAME CONTAINER WITH ROTATING WHEEL */}
      <div
        className="relative flex-1 w-full h-full flex justify-center items-center overflow-hidden cursor-pointer"
        onClick={handleWheelClick}
      >
        <div
          className="relative rounded-full transition-all duration-300 flex justify-center items-center shadow-2xl border-4 border-gray-800"
          style={{
            width: '82vw',
            height: '82vw',
            maxWidth: '680px',
            maxHeight: '680px',
            backgroundColor: wheelColor,
            animation: isPaused ? 'none' : `spin ${animationDuration}s linear infinite`,
          }}
        >
          {/* INNER BUBBLES REVOLVING AROUND THE WHEEL */}
          {bubbles.map((bubble) => {
            const isPopping = poppingIds.has(bubble.id);
            const isWrong = wrongIds.has(bubble.id);
            return (
              <div
                key={bubble.id}
                className={`absolute rounded-full flex justify-center items-center font-extrabold cursor-pointer select-none border-2 border-white/40 shadow-xl active:scale-110 transition-transform ${
                  isPopping ? 'animate-pop' : ''
                } ${isWrong ? 'animate-shake' : ''}`}
                style={{
                  left: `${bubble.x}%`,
                  top: `${bubble.y}%`,
                  width: `${bubbleSize}px`,
                  height: `${bubbleSize}px`,
                  fontSize: `${letterSize}rem`,
                  backgroundColor: bubble.color,
                  color: textColor,
                  animation: isPaused ? 'none' : `spin-reverse ${animationDuration}s linear infinite`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleBubbleClick(bubble);
                }}
              >
                <span className="bubble-text inline-flex items-center justify-center pointer-events-none select-none">
                  {mode === 'colors' ? '' : bubble.symbol}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* OFFCANVAS MENU */}
      {isMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex justify-end" onClick={() => setIsMenuOpen(false)}>
          <div
            className="w-[300px] h-full bg-[#111111] text-white p-6 flex flex-col gap-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-gray-800 pb-3">
              <h3 className="text-xl font-bold">Menu</h3>
              <button className="text-2xl text-white hover:text-gray-400" onClick={() => setIsMenuOpen(false)}>
                ✕
              </button>
            </div>

            <button
              className="w-full py-3 px-4 bg-[#222222] border border-gray-700 rounded-xl text-gray-200 hover:bg-gray-800 font-semibold"
              onClick={() => {
                setIsMenuOpen(false);
                exitFullScreenSafe();
                if (onExit) onExit();
              }}
            >
              Quit Game
            </button>

            <button
              className="w-full py-3 px-4 bg-[#222222] border border-gray-700 rounded-xl text-gray-200 hover:bg-gray-800 font-semibold"
              onClick={() => {
                setIsMenuOpen(false);
                startLevel();
              }}
            >
              Reset Level
            </button>

            <button
              className="w-full py-3 px-4 bg-blue-600 border border-blue-500 rounded-xl text-white hover:bg-blue-700 font-semibold"
              onClick={() => {
                setIsMenuOpen(false);
                setIsPaused(true);
                if (typeof window !== 'undefined' && window.speechSynthesis) {
                  window.speechSynthesis.cancel();
                }
                setIsSettingsOpen(true);
              }}
            >
              Open Settings
            </button>

            <div className="text-sm font-semibold text-gray-400 mt-2">Speed</div>
            <div className="grid grid-cols-3 gap-2">
              {SPEED_PRESETS.map((s) => (
                <button
                  key={s}
                  className={`py-2 border rounded-lg font-semibold ${
                    speed === s
                      ? 'border-blue-500 text-blue-400 bg-blue-950/40'
                      : 'border-gray-700 text-gray-300 bg-[#222222]'
                  }`}
                  onClick={() => setSpeed(s)}
                >
                  {s}x
                </button>
              ))}
            </div>

            {/* CURRENT CLINICAL SETTINGS AT BOTTOM OF MENU */}
            <div className="mt-auto pt-4 border-t border-gray-800 flex flex-col gap-2">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Current Clinical Settings
              </div>
              <div className="bg-[#181818] p-3.5 rounded-xl border border-gray-800 text-xs text-gray-300 flex flex-col gap-2 shadow-inner">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Patient:</span>
                  <span className="font-semibold text-white">{patientName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Letter Size:</span>
                  <span className="font-bold text-blue-400">{letterSize} rem</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Bubble Size:</span>
                  <span className="font-bold text-blue-400">{bubbleSize} px</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Wheel Color:</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-4 h-4 rounded-full border border-gray-600 inline-block shadow-sm"
                      style={{ backgroundColor: wheelColor }}
                    />
                    <span className="font-mono text-[11px] text-gray-300">{wheelColor}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Wheel Speed:</span>
                  <span className="font-bold text-emerald-400">{speed}x</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SHARED CLINICAL SETTINGS MODAL */}
      <ClinicalSettingsModal
        isOpen={isSettingsOpen}
        onClose={handleCloseSettings}
        onApply={(newSettings) => {
          setPatientName(newSettings.patientName);
          setLetterSize(newSettings.letterSize);
          setBubbleSize(newSettings.bubbleSize);
          if (newSettings.speed !== undefined) setSpeed(newSettings.speed);
          if (newSettings.wheelColor !== undefined) setWheelColor(newSettings.wheelColor);

          setNotification('Settings Applied Successfully!');
          setTimeout(() => setNotification(null), 2500);

          setIsSettingsOpen(false);
          setIsPaused(false);
          requestFullScreenSafe();
          if (currentTargetRef.current) {
            const targetText = currentTargetRef.current;
            setTimeout(() => {
              speak(mode === 'colors' ? targetText : `target ${targetText}`, mode);
            }, 200);
          }
        }}
        patientName={patientName}
        letterSize={letterSize}
        bubbleSize={bubbleSize}
        speed={speed}
        wheelColor={wheelColor}
        showSpeedControl={true}
        showWheelColorControl={true}
        sampleSymbol={mode === 'colors' ? '' : 'A'}
      />
    </div>
  );
}
