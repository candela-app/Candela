'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  GameMode,
  AlphabetVariant,
  BubbleItem,
  BubblePosition,
  BRIGHT_COLORS,
  SPEED_PRESETS,
  BUBBLES_PER_ROUND,
  DEFAULT_BASE_ANIMATION_DURATION,
  checkOverlap,
  getMinDistancePercent,
  defaultBubbleSizePx,
  getDeviceTier,
  getSlotFallbackPosition,
  getRandomSymbol,
  getContrastColor,
  exportSessionCSV,
  playCorrectSoundAndHaptic,
  playWrongSoundAndHaptic,
  playWrongBubbleSoundAndHaptic,
  playMissPressSoundAndHaptic,
  playSuccessSoundAndHaptic,
  requestFullScreenSafe,
  exitFullScreenSafe,
  ClinicalSettingsModal,
  SessionResultData,
} from '@candela/shared';
import { GameMenuDrawer } from '../shared/GameMenuDrawer';
import { useGameSessionLock } from '../shared/useGameSessionLock';
import { ResetConfirmDialog } from '../shared/ResetConfirmDialog';
import { GameResultsModal } from '../shared/GameResultsModal';
import { SlidersIcon, PlayIcon, PauseIcon, VolumeIcon, ChevronUpIcon, ReplayIcon } from '../icons/VectorIcons';

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
  const [mode] = useState<GameMode>(initialMode);
  const [variant] = useState<AlphabetVariant>(initialVariant);
  const [isPaused, setIsPaused] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(1);
  const [bubbles, setBubbles] = useState<BubbleItem[]>([]);
  const [currentTarget, setCurrentTarget] = useState<string>('');
  const [targetColor, setTargetColor] = useState<string>('#ff5722');

  // Clinical Settings
  const [patientName, setPatientName] = useState<string>('Demo Patient');
  const [letterSize, setLetterSize] = useState<number>(2.5);
  const [bubbleSize, setBubbleSize] = useState<number>(() => defaultBubbleSizePx(getDeviceTier(), 'rotatory'));
  const [wheelColor, setWheelColor] = useState<string>('#000000');
  const [customColors] = useState<string[]>(['#FFFFFF', '#2F80FF', '#FF3B30']);

  // Settings, Click to Start & Results Modal State
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(true);
  const [isGameStarted, setIsGameStarted] = useState<boolean>(false);
  const [isResultsOpen, setIsResultsOpen] = useState<boolean>(false);
  const [resultsData, setResultsData] = useState<SessionResultData | null>(null);

  // Temporary Settings state for Modal editing
  const [tempPatientName, setTempPatientName] = useState<string>(patientName);
  const [tempLetterSize, setTempLetterSize] = useState<number>(letterSize);
  const [tempBubbleSize, setTempBubbleSize] = useState<number>(bubbleSize);
  const [tempWheelColor, setTempWheelColor] = useState<string>(wheelColor);

  // Notification Toast, Controls Floating & Fullscreen State
  const [notification, setNotification] = useState<string | null>(null);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState<boolean>(false);
  const [isAssistiveTouchOpen, setIsAssistiveTouchOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  useGameSessionLock(true);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  // Gameplay state
  const [poppingActive, setPoppingActive] = useState<boolean>(false);
  const [poppingIds, setPoppingIds] = useState<Set<string>>(new Set());
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());

  // UseRef for stats to prevent re-creating callbacks and restarting animations
  const statsRef = useRef({
    clicks: 0,
    correctCount: 0,
    wrongCount: 0,
    startTime: null as number | null,
    reactionTimes: [] as number[],
    targetShownAt: null as number | null,
  });

  const wheelRef = useRef<HTMLDivElement>(null);
  const bubbleContainerRef = useRef<HTMLDivElement>(null);
  const isSettingsOpenRef = useRef<boolean>(isSettingsOpen);
  const currentTargetRef = useRef<string>('');

  // Original English target voice (device en-US, e.g. Samantha)
  const targetVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      const original =
        voices.find((v) => v.name === 'Samantha') ||
        voices.find((v) => v.lang.toLowerCase().startsWith('en-us') && v.localService) ||
        voices.find((v) => v.lang.toLowerCase().startsWith('en-us')) ||
        voices.find((v) => v.lang.toLowerCase().startsWith('en'));

      if (original) {
        targetVoiceRef.current = original;
      }
    };

    updateVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  useEffect(() => {
    isSettingsOpenRef.current = isSettingsOpen;
  }, [isSettingsOpen]);

  // Counter-rotate text inside bubbles to maintain 0 self-rotation relative to screen viewport
  useEffect(() => {
    let animId: number;
    const syncRotation = () => {
      if (wheelRef.current) {
        const transform = window.getComputedStyle(wheelRef.current).transform;
        if (transform && transform !== 'none') {
          const match = transform.match(/matrix\(([^)]+)\)/);
          if (match && match[1]) {
            const values = match[1].split(',').map(Number);
            const angle = Math.atan2(values[1], values[0]) * (180 / Math.PI);
            const spans = wheelRef.current.querySelectorAll('.bubble-text');
            spans.forEach((span) => {
              (span as HTMLElement).style.transform = `rotate(${-angle}deg)`;
            });
          }
        }
      }
      animId = requestAnimationFrame(syncRotation);
    };
    animId = requestAnimationFrame(syncRotation);
    return () => cancelAnimationFrame(animId);
  }, []);

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

  const speak = useCallback((text: string, currentMode: GameMode) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance();

    utter.text = currentMode !== 'colors' ? text.toLowerCase() : text;
    utter.rate = 0.95;
    utter.pitch = 1;

    if (targetVoiceRef.current) {
      utter.voice = targetVoiceRef.current;
      utter.lang = targetVoiceRef.current.lang;
    } else {
      utter.lang = 'en-US';
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

  // Choose Next Target
  const chooseNextTarget = useCallback(
    (currentBubbles: BubbleItem[], currentMode: GameMode) => {
      if (currentBubbles.length === 0) return;

      const remainingSymbols = Array.from(
        new Set(
          currentBubbles.map((b) =>
            currentMode === 'colors' ? b.colorName || '' : b.symbol
          )
        )
      ).filter(Boolean);

      if (remainingSymbols.length === 0) {
        const st = statsRef.current.startTime;
        const totalTime = st ? (performance.now() - st) / 1000 : 0;
        const rTimes = statsRef.current.reactionTimes;
        const avgReact = rTimes.length
          ? rTimes.reduce((a, b) => a + b, 0) / rTimes.length / 1000
          : 0;

        exportSessionCSV({
          patientName,
          sessionId: Math.floor(1000 + Math.random() * 9000),
          date: new Date().toLocaleDateString('en-GB'),
          gameName: `Rotatory Wheel (${currentMode} - ${variant})`,
          stimuliCount: 10,
          letterSize,
          speed: `${speed}x`,
          durationSec: Math.round(totalTime),
          clicksTotal: statsRef.current.clicks,
          correct: statsRef.current.correctCount,
          wrong: statsRef.current.wrongCount,
          accuracy:
            statsRef.current.clicks > 0
              ? Math.round(
                  (statsRef.current.correctCount / statsRef.current.clicks) * 100
                )
              : 100,
          avgReactionSec: parseFloat(avgReact.toFixed(2)),
        });
        return;
      }

      const nextTarget =
        remainingSymbols[Math.floor(Math.random() * remainingSymbols.length)];

      setCurrentTarget(nextTarget);
      currentTargetRef.current = nextTarget;
      statsRef.current.targetShownAt = performance.now();

      if (currentMode === 'colors') {
        const colorObj = BRIGHT_COLORS.find((c) => c.name === nextTarget);
        setTargetColor(colorObj ? colorObj.code : '#ff5722');
      } else {
        setTargetColor('#ff5722');
      }

      // ONLY speak if settings modal is NOT open
      if (!isSettingsOpenRef.current) {
        if (currentMode === 'colors') {
          setTimeout(() => speak(nextTarget, currentMode), 400);
        } else {
          setTimeout(() => speak(`target ${nextTarget}`, currentMode), 400);
        }
      }

      setPoppingActive(true);
    },
    [speak, patientName, variant, letterSize, speed]
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

  // Generate Level (Round)
  const startLevel = useCallback(() => {
    setBubbles([]);
    setPoppingIds(new Set());
    setWrongIds(new Set());
    setPoppingActive(false);

    const newBubbles: BubbleItem[] = [];
    const positions: BubblePosition[] = [];

    const rawContainer = bubbleContainerRef.current;
    const containerSize = rawContainer
      ? Math.min(rawContainer.clientWidth, rawContainer.clientHeight)
      : 500;

    const minDistance = getMinDistancePercent(bubbleSize, containerSize, 2);
    const deviceTier = getDeviceTier(
      typeof window !== 'undefined' ? window.innerWidth : undefined,
      typeof window !== 'undefined' ? window.innerHeight : undefined
    );
    const bubblesPerRound = BUBBLES_PER_ROUND[deviceTier];

    for (let i = 0; i < bubblesPerRound; i++) {
      const symbol = getRandomSymbol(mode, variant);
      let pos: BubblePosition = { x: 50, y: 50 };
      let valid = false;

      for (let attempt = 0; attempt < 80; attempt++) {
        const angle = Math.random() * 2 * Math.PI;
        const maxR = containerSize / 2 - bubbleSize / 2 - 12;
        const radius = Math.sqrt(Math.random()) * maxR;

        const x = 50 + (radius * Math.cos(angle)) / (containerSize / 100);
        const y = 50 + (radius * Math.sin(angle)) / (containerSize / 100);

        pos = { x, y };
        if (!checkOverlap(pos, positions, minDistance)) {
          valid = true;
          break;
        }
      }

      // Guaranteed Slot Fallback: if all 80 attempts fail, place deterministically
      if (!valid) {
        pos = getSlotFallbackPosition(i, bubblesPerRound, containerSize, bubbleSize);
      }

      positions.push(pos);
      let bgColor = '';
      let colorName = '';

      if (mode === 'colors') {
        const colorObj =
          BRIGHT_COLORS.find((c) => c.name === symbol) || BRIGHT_COLORS[0];
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

    setTimeout(() => {
      chooseNextTarget(newBubbles, mode);
    }, 300);
  }, [mode, variant, bubbleSize, customColors, chooseNextTarget]);

  useEffect(() => {
    resetStats();
    startLevel();
  }, [mode, variant, resetStats, startLevel]);

  const handleBubbleClick = (clickedBubble: BubbleItem) => {
    if (!poppingActive) return;

    statsRef.current.clicks += 1;

    const clickedValue =
      mode === 'colors' ? clickedBubble.colorName : clickedBubble.symbol;

    if (clickedValue === currentTarget) {
      playCorrectSoundAndHaptic();

      if (statsRef.current.targetShownAt) {
        statsRef.current.reactionTimes.push(
          performance.now() - statsRef.current.targetShownAt
        );
      }
      statsRef.current.targetShownAt = performance.now();
      statsRef.current.correctCount += 1;

      setPoppingIds((prev) => new Set(prev).add(clickedBubble.id));

      setTimeout(() => {
        setBubbles((prevBubbles) => {
          const updatedBubbles = prevBubbles.filter(
            (b) => b.id !== clickedBubble.id
          );

          if (statsRef.current.correctCount >= 20) {
            setPoppingActive(false);
            playSuccessSoundAndHaptic();
            const st = statsRef.current.startTime;
            const totalTime = st ? (performance.now() - st) / 1000 : 0;
            const rTimes = statsRef.current.reactionTimes;
            const avgReact = rTimes.length
              ? rTimes.reduce((a, b) => a + b, 0) / rTimes.length / 1000
              : 0;

            const finalData: SessionResultData = {
              patientName,
              sessionId: Math.floor(1000 + Math.random() * 9000),
              date: new Date().toLocaleDateString('en-GB'),
              gameName: `Rotatory Wheel (${mode} - ${variant})`,
              stimuliCount: statsRef.current.correctCount,
              letterSize,
              speed: `${speed}x`,
              durationSec: Math.round(totalTime),
              clicksTotal: statsRef.current.clicks,
              correct: statsRef.current.correctCount,
              wrong: statsRef.current.wrongCount,
              accuracy:
                statsRef.current.clicks > 0
                  ? Math.round(
                      (statsRef.current.correctCount / statsRef.current.clicks) * 100
                    )
                  : 100,
              avgReactionSec: parseFloat(avgReact.toFixed(2)),
            };

            setResultsData(finalData);
            setIsResultsOpen(true);
            setIsPaused(true);
            return updatedBubbles;
          }

          const stillLeft = updatedBubbles.some((b) =>
            mode === 'colors'
              ? b.colorName === currentTarget
              : b.symbol === currentTarget
          );

          if (!stillLeft) {
            setPoppingActive(false);
            if (updatedBubbles.length === 0) {
              playSuccessSoundAndHaptic();
              setTimeout(() => startLevel(), 500);
            } else {
              setTimeout(() => {
                chooseNextTarget(updatedBubbles, mode);
              }, 600);
            }
          }
          return updatedBubbles;
        });
      }, 250);
    } else {
      playWrongBubbleSoundAndHaptic();
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

  const handleWheelClick = () => {
    if (!isPaused && poppingActive) {
      statsRef.current.clicks += 1;
      statsRef.current.wrongCount += 1;
      playMissPressSoundAndHaptic();
    }
  };

  const handleStartGame = () => {
    setIsGameStarted(true);
    setIsPaused(false);
    resetStats();
    if (currentTargetRef.current) {
      const targetText = currentTargetRef.current;
      setTimeout(() => {
        speak(mode === 'colors' ? targetText : `target ${targetText}`, mode);
      }, 200);
    }
  };

  const handleApplySettings = () => {
    setPatientName(tempPatientName);
    setLetterSize(tempLetterSize);
    setBubbleSize(tempBubbleSize);
    setWheelColor(tempWheelColor);

    // Show Notification Toast
    setNotification('Settings Applied Successfully!');
    setTimeout(() => setNotification(null), 2500);

    // Transition to Click to Start Screen
    setIsSettingsOpen(false);
    setIsGameStarted(false);
    setIsPaused(true);
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
    if (!isGameStarted) {
      setIsPaused(true);
    } else {
      setIsPaused(false);
    }
  };

  const animationDurationSeconds = DEFAULT_BASE_ANIMATION_DURATION / speed;

  return (
    <div className="w-screen h-screen bg-[#0A0A12] text-white flex items-center justify-center select-none overflow-hidden touch-none relative font-sans">
      {/* TOP-RIGHT NOTIFICATION TOAST */}
      {notification && (
        <div className="fixed top-6 right-6 z-[300] flex items-center gap-2 bg-emerald-600/90 backdrop-blur-md text-white font-bold px-5 py-3 rounded-2xl shadow-2xl border border-emerald-400/30 text-sm animate-fade-in">
          ✓ {notification}
        </div>
      )}

      {!isGameStarted && !isSettingsOpen && !isResultsOpen && (
        <div className="fixed inset-0 z-50 bg-[#06070D]/98 flex flex-col justify-center items-center gap-4 p-6 text-center select-none">
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            {mode === 'colors'
              ? 'Color Discriminant Wheel'
              : variant === 'lowercase'
                ? 'Lowercase Alphabets'
                : 'Uppercase Alphabets'}
          </h2>
          <button
            onClick={handleStartGame}
            className="px-8 py-4 rounded-full bg-[#34D399] text-slate-950 font-black text-xl cursor-pointer active:scale-95"
            title="Click to Start Therapy Session"
          >
            Click to Start
          </button>

          {/* Sub-action: Edit Settings */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="text-xs sm:text-sm font-extrabold text-gray-300 hover:text-cyan-300 transition-colors cursor-pointer flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900/60 hover:bg-gray-800/90 border border-gray-700/80 shadow-md z-10"
          >
            <span>⚙️ Edit Clinical Settings</span>
          </button>
        </div>
      )}

      {/* BOTTOM RIGHT FLOATING CONTROLS GROUP (ULTRA-COMPACT & UNMUTED IDLE OPACITY) */}
      <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-40 flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity duration-200">
        {/* DIRECT FULLSCREEN TOGGLE BUTTON */}
        <button
          onClick={toggleFullscreen}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#121626]/90 hover:bg-[#1A2035] border border-gray-800/90 hover:border-gray-700 text-gray-300 hover:text-white flex items-center justify-center shadow-md transition-all cursor-pointer backdrop-blur-md active:scale-95"
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {isFullscreen ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 3v3a2 2 0 0 1-2 2H3" />
              <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
              <path d="M3 16h3a2 2 0 0 1 2 2v3" />
              <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 3h6v6" />
              <path d="M9 21H3v-6" />
              <path d="M21 3l-7 7" />
              <path d="M3 21l7-7" />
            </svg>
          )}
        </button>
        <button
          onClick={() => speak(mode === 'colors' ? currentTarget : `target ${currentTarget}`, mode)}
          className="w-7 h-7 sm:w-8 sm:h-8 bg-transparent border-0 text-slate-500/40 hover:text-slate-400 flex items-center justify-center cursor-pointer transition-colors active:scale-95"
          title="Replay target"
        >
          <ReplayIcon className="w-3.5 h-3.5" />
        </button>
        {/* TARGET DISPLAY ASSISTIVETOUCH FLOATING ORB BUTTON */}
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
          {/* JUST THE TARGET SYMBOL / COLOR */}
          {mode === 'colors' ? (
            <div
              className="w-3.5 h-3.5 rounded-full border border-white shadow-sm shrink-0"
              style={{ backgroundColor: targetColor }}
            />
          ) : (
            <span
              className="text-xs sm:text-sm font-black tracking-tight drop-shadow-md select-none"
              style={{ color: targetColor }}
            >
              {currentTarget}
            </span>
          )}

          {/* UP ARROW INDICATOR TO SHOW EXPANDABLE MENU */}
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-blue-600 text-white flex items-center justify-center border border-blue-400 shadow-sm group-hover:scale-110 transition-transform">
            <ChevronUpIcon className="w-2 h-2" size={8} />
          </span>
        </button>

        {/* BOTTOM RIGHT INFO TOGGLE BUTTON */}
        <button
          onClick={() => setIsHeaderExpanded((prev) => !prev)}
          className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-[#121626]/90 hover:bg-[#1A2035] border border-gray-800/90 hover:border-gray-700 text-gray-300 hover:text-white text-[10px] sm:text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur-md active:scale-95"
          title={isHeaderExpanded ? 'Hide Info' : 'View Info'}
        >
          <span className="text-blue-400 font-extrabold text-[9px] sm:text-[10px]">
            {isHeaderExpanded ? '▼' : '▲'}
          </span>
          <span>{isHeaderExpanded ? 'Hide Info' : 'View Info'}</span>
        </button>
      </div>

      {/* ASSISTIVETOUCH FLOATING MENU POPUP (iPhone-inspired) */}
      {isAssistiveTouchOpen && (
        <div className="fixed bottom-16 right-16 sm:bottom-20 sm:right-24 z-50 bg-[#121626]/95 border border-gray-800/90 p-4 rounded-3xl shadow-2xl backdrop-blur-xl flex flex-col gap-3 min-w-[210px] animate-slide-in-up">
          <div className="flex items-center justify-between border-b border-gray-800/80 pb-2">
            <span className="text-xs font-extrabold text-gray-300 uppercase tracking-wider">
              Controls
            </span>
            <button
              onClick={() => setIsAssistiveTouchOpen(false)}
              className="text-gray-400 hover:text-white text-sm font-bold cursor-pointer p-0.5"
            >
              ✕
            </button>
          </div>

          {/* TARGET CARD DISPLAY & SPEAKER REPLAY BUTTON */}
          <button
            onClick={() => speak(mode === 'colors' ? currentTarget : `target ${currentTarget}`, mode)}
            title="Click to hear target sound"
            className="flex items-center justify-between bg-[#1A2035] hover:bg-[#222942] border border-blue-500/40 hover:border-blue-400 px-3 py-2 rounded-2xl shadow-inner cursor-pointer transition-all active:scale-95 group w-full"
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider group-hover:text-blue-300">
                Target:
              </span>
              {mode === 'colors' ? (
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-5 h-5 rounded-full border border-white shadow-sm"
                    style={{ backgroundColor: targetColor }}
                  />
                  <span className="font-extrabold text-xs text-white">{currentTarget}</span>
                </div>
              ) : (
                <span
                  className="text-xl font-black tracking-widest drop-shadow-md"
                  style={{ color: targetColor }}
                >
                  {currentTarget}
                </span>
              )}
            </div>
            <span className="text-blue-400 group-hover:scale-110 transition-transform text-xs font-bold flex items-center gap-1">
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
            title={isPaused ? 'Resume Game' : 'Pause Game'}
          >
            {isPaused ? <PlayIcon className="w-3.5 h-3.5" /> : <PauseIcon className="w-3.5 h-3.5" />}
            <span>{isPaused ? 'Play' : 'Pause'}</span>
          </button>

          {/* CLINICAL SETTINGS BUTTON */}
          <button
            onClick={() => {
              setIsAssistiveTouchOpen(false);
              setIsPaused(true);
              if (typeof window !== 'undefined' && window.speechSynthesis) {
                window.speechSynthesis.cancel();
              }
              setIsSettingsOpen(true);
            }}
            className="w-full py-2.5 px-3 rounded-2xl bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors border border-gray-700/80 flex items-center justify-center gap-2 text-xs font-bold"
            title="Clinical Settings"
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
              const inProgress = isGameStarted && !isResultsOpen;
              if (inProgress) setConfirmQuit(true);
              else {
                setIsAssistiveTouchOpen(false);
                if (onExit) onExit();
              }
            }}
            className="w-full py-2 rounded-2xl bg-red-700 hover:bg-red-600 text-xs font-bold text-white transition-colors shadow-md text-center"
          >
            Quit Game
          </button>
        </div>
      )}

      {/* BOTTOM RIGHT CLINICAL & PERFORMANCE INFO OVERLAY CARD */}
      {isHeaderExpanded && (
        <div className="fixed bottom-16 right-4 sm:bottom-20 sm:right-6 z-40 bg-[#121626]/95 border border-gray-800/90 p-4 sm:p-5 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col gap-3 text-xs animate-slide-in-up min-w-[270px]">
          <div className="flex items-center justify-between border-b border-gray-800 pb-2">
            <div>
              <h1 className="text-sm font-extrabold text-white tracking-tight">
                Session & Clinical Info
              </h1>
              <span className="text-[11px] text-gray-400 font-medium">
                {mode === 'colors'
                  ? 'Color Discriminant Rotatory'
                  : `${variant === 'lowercase' ? 'Lowercase' : 'Uppercase'} Rotatory`}
              </span>
            </div>
            <button
              onClick={() => setIsHeaderExpanded(false)}
              className="text-gray-400 hover:text-white text-base font-bold ml-3 cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* CLINICAL SETTINGS PARAMETERS */}
          <div className="flex flex-col gap-1.5 text-xs font-medium text-gray-300">
            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
              Clinical Parameters
            </span>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Patient:</span>
              <span className="text-white font-bold">{patientName}</span>
            </div>
            {mode === 'colors' ? null : (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Letter Size:</span>
                <span className="text-blue-400 font-bold">{letterSize} rem</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Bubble Size:</span>
              <span className="text-blue-400 font-bold">{bubbleSize} px</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Wheel Color:</span>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-3.5 h-3.5 rounded-full border border-gray-600 inline-block shadow-sm"
                  style={{ backgroundColor: wheelColor }}
                />
                <span className="font-mono text-[11px] text-gray-200">{wheelColor}</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Wheel Speed:</span>
              <span className="text-blue-400 font-bold">{speed}x</span>
            </div>
          </div>

          <div className="h-px bg-gray-800/80 my-0.5" />

          {/* LIVE PERFORMANCE METRICS */}
          <div className="flex flex-col gap-1.5 text-xs font-medium text-gray-300">
            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
              Live Metrics
            </span>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Correct Hits:</span>
              <span className="text-emerald-400 font-bold">{statsRef.current.correctCount} / 20</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Wrong Clicks:</span>
              <span className="text-rose-400 font-bold">{statsRef.current.wrongCount}</span>
            </div>
          </div>
        </div>
      )}

      {/* CENTER: ROTATING WHEEL (MAXIMIZED FULL SCREEN DIAMETER EDGE-TO-EDGE) */}
      <main className="relative w-full h-full min-h-screen flex items-center justify-center p-0 overflow-hidden">
        <div className="absolute w-[98vh] h-[98vh] max-w-[98vw] max-h-[98vw] rounded-full bg-blue-500/10 pointer-events-none" />

        <div
          ref={wheelRef}
          className="relative h-[98vh] w-[98vh] max-w-[98vw] max-h-[98vw] aspect-square rounded-full flex justify-center items-center cursor-pointer shrink-0 animate-rotate-wheel"
          style={{
            animationDuration: `${animationDurationSeconds}s`,
            animationPlayState: isPaused ? 'paused' : 'running',
            backgroundColor: wheelColor,
          }}
          onClick={handleWheelClick}
        >
          <div ref={bubbleContainerRef} className="absolute inset-0 w-full h-full">
            {bubbles.map((bubble) => {
              const isPopping = poppingIds.has(bubble.id);
              const isWrong = wrongIds.has(bubble.id);
              const textColor = getContrastColor(bubble.color || '#FFFFFF');
              return (
                <div
                  key={bubble.id}
                  className={`absolute rounded-full flex justify-center items-center font-bold cursor-pointer select-none active:scale-110 transition-transform -translate-x-1/2 -translate-y-1/2 ${
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
      </main>

      {/* SHARED OFFCANVAS MENU (WITHOUT DUPLICATE OPEN SETTINGS BUTTON) */}
      <GameMenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onQuit={() => {
          if (onExit) onExit();
        }}
        sessionInProgress={isGameStarted && !isResultsOpen}
        onReset={startLevel}
        resetButtonLabel="Reset Level"
        extraControls={
          <div className="flex flex-col gap-2">
            <div className="text-sm font-semibold text-gray-400 mt-2">Speed</div>
            <div className="grid grid-cols-3 gap-2">
              {SPEED_PRESETS.map((s) => (
                <button
                  key={s}
                  className={`py-2 border rounded-lg font-semibold cursor-pointer transition-colors ${
                    speed === s
                      ? 'border-blue-500 text-blue-400 bg-blue-950/40'
                      : 'border-gray-700 text-gray-300 bg-[#222222] hover:bg-gray-800'
                  }`}
                  onClick={() => setSpeed(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        }
        settingsSummary={[
          { label: 'Patient', value: patientName },
          ...(mode === 'colors'
            ? []
            : [{ label: 'Letter Size', value: <span className="text-blue-400 font-bold">{letterSize}</span> }]),
          { label: 'Bubble Size', value: <span className="text-blue-400 font-bold">{bubbleSize}</span> },
          {
            label: 'Wheel Color',
            value: (
              <div className="flex items-center gap-1.5">
                <span
                  className="w-4 h-4 rounded-full border border-gray-600 inline-block shadow-sm"
                  style={{ backgroundColor: wheelColor }}
                />
                <span className="font-mono text-[11px] text-gray-300">{wheelColor}</span>
              </div>
            ),
          },
          { label: 'Wheel Speed', value: <span className="text-emerald-400 font-bold">{speed}</span> },
        ]}
      />

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
          resetStats();
          startLevel();
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
        showLetterSizeControl={mode !== 'colors'}
        sampleSymbol={mode === 'colors' ? '' : 'A'}
      />

      {/* GAME RESULTS MODAL */}
      {resultsData && (
        <GameResultsModal
          isOpen={isResultsOpen}
          onClose={() => {
            setIsResultsOpen(false);
            if (onExit) onExit();
          }}
          onReplay={() => {
            setIsResultsOpen(false);
            resetStats();
            startLevel();
            setIsPaused(false);
          }}
          data={resultsData}
        />
      )}
      <ResetConfirmDialog
        isOpen={confirmReset}
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          setIsAssistiveTouchOpen(false);
          resetStats();
          startLevel();
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
          if (onExit) onExit();
        }}
      />
    </div>
  );
}
