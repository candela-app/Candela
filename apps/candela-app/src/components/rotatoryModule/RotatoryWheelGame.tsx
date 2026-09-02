'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  GameMode,
  AlphabetVariant,
  BubbleItem,
  BRIGHT_COLORS,
  SPEED_PRESETS,
  DEFAULT_BASE_ANIMATION_DURATION,
  defaultBubbleSizePx,
  getDeviceTier,
  playCorrectSoundAndHaptic,
  playWrongBubbleSoundAndHaptic,
  playMissPressSoundAndHaptic,
  playSuccessSoundAndHaptic,
  requestFullScreenSafe,
  ClinicalSettingsModal,
  SessionResultData,
  createRotatorySession,
  nextRotatoryBatch,
  takeNextRotatorySymbol,
  makeRotatoryBubbleItem,
  beginRotatoryTrial,
  noteRotatoryWrong,
  completeRotatoryTrial,
  rotatoryDeckComplete,
  summarizeRotatorySession,
  rotatoryBubbleValue,
  pickBalancedRotatoryTarget,
  placeInitialRotatoryPositions,
  nextRotatoryRefillPosition,
  cssMatrixRotationDeg,
  type RotatorySessionState,
  DEFAULT_STIMULI_BUBBLE_COLOR,
  DEFAULT_BUBBLE_APPEARANCE,
  resolveBubblePaint,
  stimuliColorLabel,
  bubbleAppearanceLabel,
  wheelColorLabel,
  getContrastAdjustedColor,
  clinicalColorSessionFields,
  type BubbleAppearance,
  useHowToPlayGate,
  usePauseShiftedClock,
} from '@candela/shared';
import { sessionDisplayName, useAuth } from '@/lib/auth-context';
import { GameMenuDrawer } from '../shared/GameMenuDrawer';
import { FullscreenToggleButton } from '../shared/FullscreenToggleButton';
import { useGameSessionLock } from '../shared/useGameSessionLock';
import { ClickToStartOverlay } from '../shared/ClickToStartOverlay';
import { HowToPlayManual } from '../shared/HowToPlayManual';
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
  const { session } = useAuth();
  const [mode] = useState<GameMode>(initialMode);
  const [variant] = useState<AlphabetVariant>(initialVariant);
  const [isPaused, setIsPaused] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(0.5);
  const [bubbles, setBubbles] = useState<BubbleItem[]>([]);
  const [currentTarget, setCurrentTarget] = useState<string>('');
  const [targetColor, setTargetColor] = useState<string>('#ff5722');

  // Clinical Settings
  const [patientName, setPatientName] = useState<string>(() => sessionDisplayName(session));
  const [letterSize, setLetterSize] = useState<number>(3);
  const [bubbleSize, setBubbleSize] = useState<number>(() => defaultBubbleSizePx(getDeviceTier(), 'rotatory'));
  const [wheelColor, setWheelColor] = useState<string>('#000000');
  const [stimuliColor, setStimuliColor] = useState(DEFAULT_STIMULI_BUBBLE_COLOR);
  const [bubbleAppearance, setBubbleAppearance] = useState<BubbleAppearance>(DEFAULT_BUBBLE_APPEARANCE);
  const [contrastSensitivity, setContrastSensitivity] = useState(1);

  useEffect(() => {
    const name = session?.user?.name?.trim();
    if (!name) return;
    setPatientName((prev) => (prev === name ? prev : name));
  }, [session?.user?.name]);

  // Settings, Click to Start & Results Modal State
  const { showHowToPlay, howToPlayMode, isSettingsOpen, setIsSettingsOpen, finishHowToPlay, openHowToPlay, closeHowToPlay, playBlocked, isMenuOpen, setIsMenuOpen } = useHowToPlayGate();
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
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  useGameSessionLock(true);

  // Gameplay state
  const [poppingActive, setPoppingActive] = useState<boolean>(false);
  const [poppingIds, setPoppingIds] = useState<Set<string>>(new Set());
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());
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
  const wheelAngleRef = useRef(0);
  const dealingRef = useRef(false);
  const hitLockRef = useRef(false);
  const bubbleSizeRef = useRef(bubbleSize);
  const stimuliColorRef = useRef(stimuliColor);
  const bubblesRef = useRef<BubbleItem[]>([]);
  bubbleSizeRef.current = bubbleSize;
  stimuliColorRef.current = stimuliColor;
  bubblesRef.current = bubbles;

  const wheelRef = useRef<HTMLDivElement>(null);
  const bubbleContainerRef = useRef<HTMLDivElement>(null);
  const isSettingsOpenRef = useRef<boolean>(playBlocked);
  const currentTargetRef = useRef<string>('');
  const engineFrozen = playBlocked || isPaused || isAssistiveTouchOpen || isResultsOpen;
  usePauseShiftedClock(engineFrozen, isGameStarted, (delta) => {
    if (statsRef.current.startTime != null) statsRef.current.startTime += delta;
    if (statsRef.current.targetShownAt != null) statsRef.current.targetShownAt += delta;
    if (sessionRef.current?.openTrial) sessionRef.current.openTrial.targetShownAt += delta;
  }, statsRef.current.startTime);

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
    isSettingsOpenRef.current = playBlocked;
  }, [playBlocked]);

  // Counter-rotate text inside bubbles to maintain 0 self-rotation relative to screen viewport
  useEffect(() => {
    let animId: number;
    const syncRotation = () => {
      if (wheelRef.current) {
        const transform = window.getComputedStyle(wheelRef.current).transform;
        const angle = cssMatrixRotationDeg(transform);
        if (angle != null) {
          wheelAngleRef.current = angle;
          const spans = wheelRef.current.querySelectorAll('.bubble-text');
          spans.forEach((span) => {
            (span as HTMLElement).style.transform = `rotate(${-angle}deg)`;
          });
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

  const chooseNextTarget = useCallback(
    (currentBubbles: BubbleItem[], currentMode: GameMode) => {
      if (!sessionRef.current || currentBubbles.length === 0) return;

      const nextTarget = pickBalancedRotatoryTarget(
        currentBubbles,
        currentMode,
        wheelAngleRef.current,
        sessionRef.current.trials,
      );
      if (!nextTarget) return;
      setCurrentTarget(nextTarget);
      currentTargetRef.current = nextTarget;
      const now = performance.now();
      statsRef.current.targetShownAt = now;
      beginRotatoryTrial(sessionRef.current, {
        glyphId: nextTarget,
        bubbles: currentBubbles,
        wheelRotationDeg: wheelAngleRef.current,
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
        if (currentMode === 'colors') {
          setTimeout(() => speak(nextTarget, currentMode), 400);
        } else {
          setTimeout(() => speak(`target ${nextTarget}`, currentMode), 400);
        }
      }

      hitLockRef.current = false;
      setPoppingActive(true);
    },
    [speak, speed],
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

    const rawContainer = bubbleContainerRef.current;
    const measured = rawContainer
      ? Math.min(rawContainer.clientWidth, rawContainer.clientHeight)
      : 0;
    const containerSize =
      measured > 40
        ? measured
        : typeof window !== 'undefined'
          ? Math.min(window.innerWidth * 0.98, window.innerHeight * 0.98)
          : 500;

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
      chooseNextTarget(newBubbles, mode);
    }, 300);
    return true;
  }, [mode, chooseNextTarget]);

  const startNewSession = useCallback(() => {
    const deviceTier = getDeviceTier(
      typeof window !== 'undefined' ? window.innerWidth : undefined,
      typeof window !== 'undefined' ? window.innerHeight : undefined,
    );
    sessionRef.current = createRotatorySession(mode, variant, deviceTier);
    setSessionGoal(sessionRef.current.deck.length);
    dealingRef.current = false;
    hitLockRef.current = false;
    resetStats();
    setBubbles([]);
    dealNextBatch();
  }, [mode, variant, resetStats, dealNextBatch]);

  useEffect(() => {
    startNewSession();
    // Settings apply / replay call startNewSession explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, variant]);

  const finishSession = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    setPoppingActive(false);
    playSuccessSoundAndHaptic();
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
      ...clinicalColorSessionFields(wheelColor, stimuliColor, contrastSensitivity),
    });
    setResultsData(finalData);
    setIsResultsOpen(true);
    setIsPaused(true);
  }, [patientName, mode, variant, letterSize, speed, wheelColor, stimuliColor, contrastSensitivity]);

  const handleBubbleClick = (clickedBubble: BubbleItem) => {
    if (!poppingActive) return;

    const clickedValue = rotatoryBubbleValue(clickedBubble, mode);
    if (clickedValue === currentTarget && hitLockRef.current) return;

    statsRef.current.clicks += 1;

    if (clickedValue === currentTarget) {
      hitLockRef.current = true;
      playCorrectSoundAndHaptic();
      const now = performance.now();
      if (sessionRef.current) {
        const trial = completeRotatoryTrial(sessionRef.current, {
          tapLocalXPct: clickedBubble.x,
          tapLocalYPct: clickedBubble.y,
          wheelRotationDeg: wheelAngleRef.current,
          nowMs: now,
        });
        if (trial) statsRef.current.reactionTimes.push(trial.reactionMs);
      }
      statsRef.current.targetShownAt = null;
      statsRef.current.correctCount += 1;

      setPoppingIds((prev) => new Set(prev).add(clickedBubble.id));

      setTimeout(() => {
        let remaining = bubblesRef.current.filter((b) => b.id !== clickedBubble.id);
        if (sessionRef.current && rotatoryDeckComplete(sessionRef.current)) {
          bubblesRef.current = remaining;
          setBubbles(remaining);
          setPoppingActive(false);
          finishSession();
          return;
        }

        const avoid = new Set(remaining.map((b) => rotatoryBubbleValue(b, mode)));
        const nextSymbol = sessionRef.current
          ? takeNextRotatorySymbol(sessionRef.current, avoid)
          : null;
        if (nextSymbol) {
          const rawContainer = bubbleContainerRef.current;
          const measured = rawContainer
            ? Math.min(rawContainer.clientWidth, rawContainer.clientHeight)
            : 0;
          const containerSize =
            measured > 40
              ? measured
              : typeof window !== 'undefined'
                ? Math.min(window.innerWidth * 0.98, window.innerHeight * 0.98)
                : 500;
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
          finishSession();
          return;
        }
        setTimeout(() => chooseNextTarget(remaining, mode), 200);
      }, 250);
    } else {
      playWrongBubbleSoundAndHaptic();
      if (sessionRef.current) noteRotatoryWrong(sessionRef.current, 'discrimination');
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
    if (!engineFrozen && poppingActive) {
      statsRef.current.clicks += 1;
      statsRef.current.wrongCount += 1;
      if (sessionRef.current) noteRotatoryWrong(sessionRef.current, 'aim');
      playMissPressSoundAndHaptic();
    }
  };

  const handleStartGame = () => {
    setIsGameStarted(true);
    setIsPaused(false);
    const now = performance.now();
    statsRef.current.clicks = 0;
    statsRef.current.wrongCount = 0;
    statsRef.current.correctCount = sessionRef.current?.trials.length ?? 0;
    statsRef.current.startTime = now;
    statsRef.current.reactionTimes = [];
    statsRef.current.targetShownAt = now;
    if (sessionRef.current?.openTrial) {
      sessionRef.current.openTrial.targetShownAt = now;
      sessionRef.current.openTrial.wrongTaps = 0;
      sessionRef.current.openTrial.aimTaps = 0;
    }
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

      {!isGameStarted && !showHowToPlay && !isSettingsOpen && !isResultsOpen && (
        <ClickToStartOverlay
          title={
            mode === 'colors'
              ? 'Color Discriminant Wheel'
              : variant === 'lowercase'
                ? 'Lowercase Alphabets'
                : mode === 'numbers'
                  ? 'Numeric Rotatory'
                  : 'Uppercase Alphabets'
          }
          onStart={handleStartGame}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onExit={onExit}
        />
      )}

      {/* BOTTOM RIGHT FLOATING CONTROLS GROUP (ULTRA-COMPACT & UNMUTED IDLE OPACITY) */}
      <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-40 flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity duration-200">
        <FullscreenToggleButton />
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

          <button
            onClick={() => {
              setIsAssistiveTouchOpen(false);
              openHowToPlay();
            }}
            className="w-full py-2.5 px-3 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 hover:text-white transition-colors border border-emerald-500/40 flex items-center justify-center gap-2 text-xs font-bold"
            title="How to play"
          >
            <span>How to play?</span>
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
                <span className="text-[11px] text-gray-200">{wheelColorLabel(wheelColor)}</span>
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
              <span className="text-gray-400">Targets:</span>
              <span className="text-emerald-400 font-bold">{statsRef.current.correctCount} / {sessionGoal}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Misses:</span>
              <span className="text-rose-400 font-bold">{statsRef.current.wrongCount}</span>
            </div>
          </div>
        </div>
      )}

      {/* CENTER: ROTATING WHEEL (MAXIMIZED FULL SCREEN DIAMETER EDGE-TO-EDGE) */}
      {!isSettingsOpen ? (
      <main className="relative w-full h-full min-h-screen flex items-center justify-center p-0 overflow-hidden">
        <div className="absolute w-[86vmin] h-[86vmin] max-w-[86vw] max-h-[86vw] rounded-full bg-blue-500/10 pointer-events-none" />

        <div
          ref={wheelRef}
          className="relative h-[86vmin] w-[86vmin] max-w-[86vw] max-h-[86vw] aspect-square rounded-full flex justify-center items-center cursor-pointer shrink-0 animate-rotate-wheel"
          style={{
            animationDuration: `${animationDurationSeconds}s`,
            animationPlayState: engineFrozen ? 'paused' : 'running',
            backgroundColor: wheelColor,
          }}
          onClick={handleWheelClick}
        >
          <div ref={bubbleContainerRef} className="absolute inset-0 w-full h-full">
            {bubbles.map((bubble) => {
              const isPopping = poppingIds.has(bubble.id);
              const isWrong = wrongIds.has(bubble.id);
              const paint = resolveBubblePaint(
                bubbleAppearance,
                getContrastAdjustedColor(bubble.color || '#FFFFFF', wheelColor, contrastSensitivity),
                {
                borderFill: 'transparent',
                solidBorderWidth: 0,
              });
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
                    backgroundColor: paint.backgroundColor,
                    border: `${paint.borderWidth}px solid ${paint.borderColor}`,
                    color: paint.textColor,
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
      ) : null}

      {/* SHARED OFFCANVAS MENU (WITHOUT DUPLICATE OPEN SETTINGS BUTTON) */}
      <GameMenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onOpenHowToPlay={openHowToPlay}
        onQuit={() => {
          if (onExit) onExit();
        }}
        sessionInProgress={isGameStarted && !isResultsOpen}
        onReset={() => {
          setIsGameStarted(false);
          setIsPaused(true);
          setIsSettingsOpen(true);
          if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.cancel();
          }
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
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
          ...(mode === 'colors'
            ? []
            : [{ label: 'Stimuli Color', value: stimuliColorLabel(stimuliColor) }]),
          { label: 'Bubble Style', value: bubbleAppearanceLabel(bubbleAppearance) },
          {
            label: 'Wheel Color',
            value: (
              <div className="flex items-center gap-1.5">
                <span
                  className="w-4 h-4 rounded-full border border-gray-600 inline-block shadow-sm"
                  style={{ backgroundColor: wheelColor }}
                />
                <span className="text-[11px] text-gray-300">{wheelColorLabel(wheelColor)}</span>
              </div>
            ),
          },
          { label: 'Wheel Speed', value: <span className="text-emerald-400 font-bold">{speed}</span> },
        ]}
      />

      {/* SHARED CLINICAL SETTINGS MODAL */}
      <HowToPlayManual
        moduleId="rotatory"
        isOpen={showHowToPlay}
        mode={howToPlayMode}
        onContinue={finishHowToPlay}
        onClose={closeHowToPlay}
      />
      <ClinicalSettingsModal
        isOpen={isSettingsOpen}
        onClose={handleCloseSettings}
        onApply={(newSettings) => {
          setPatientName(newSettings.patientName);
          setLetterSize(newSettings.letterSize);
          setBubbleSize(newSettings.bubbleSize);
          bubbleSizeRef.current = newSettings.bubbleSize;
          if (newSettings.speed !== undefined) setSpeed(newSettings.speed);
          if (newSettings.wheelColor !== undefined) setWheelColor(newSettings.wheelColor);
          if (newSettings.stimuliColor !== undefined) {
            setStimuliColor(newSettings.stimuliColor);
            stimuliColorRef.current = newSettings.stimuliColor;
          }
          if (newSettings.bubbleAppearance !== undefined) setBubbleAppearance(newSettings.bubbleAppearance);
          if (newSettings.contrastSensitivity != null) setContrastSensitivity(newSettings.contrastSensitivity);

          setNotification('Settings Applied Successfully!');
          setTimeout(() => setNotification(null), 2500);

          setIsSettingsOpen(false);
          setIsPaused(false);
          startNewSession();
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
        showStimuliColorPicker={mode !== 'colors'}
        stimuliColor={stimuliColor}
        showBubbleAppearancePicker
        bubbleAppearance={bubbleAppearance}
        sampleSymbol={mode === 'colors' ? '' : 'A'}
        contrastSensitivity={contrastSensitivity}
        sessionLocked={isGameStarted && !isResultsOpen}
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
            startNewSession();
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
          startNewSession();
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
