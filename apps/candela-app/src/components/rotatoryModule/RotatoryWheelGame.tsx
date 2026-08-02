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
import { GameResultsModal } from '../shared/GameResultsModal';

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
  const [letterSize, setLetterSize] = useState<number>(1.8);
  const [bubbleSize, setBubbleSize] = useState<number>(90);
  const [wheelColor, setWheelColor] = useState<string>('#000000');
  const [customColors] = useState<string[]>(['#FFFFFF', '#2F80FF', '#FF3B30']);

  // Settings & Results Modal State
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(true);
  const [isResultsOpen, setIsResultsOpen] = useState<boolean>(false);
  const [resultsData, setResultsData] = useState<SessionResultData | null>(null);

  // Temporary Settings state for Modal editing
  const [tempPatientName, setTempPatientName] = useState<string>(patientName);
  const [tempLetterSize, setTempLetterSize] = useState<number>(letterSize);
  const [tempBubbleSize, setTempBubbleSize] = useState<number>(bubbleSize);
  const [tempWheelColor, setTempWheelColor] = useState<string>(wheelColor);

  // Notification Toast State
  const [notification, setNotification] = useState<string | null>(null);

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

  // Voice selection helper for Indian English (en-IN)
  const indianVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

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

  // Speech helper with Indian English accent priority
  const speak = useCallback((text: string, currentMode: GameMode) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance();
    utter.text = currentMode !== 'colors' ? text.toLowerCase() : text;
    utter.rate = 0.85; // Clear, natural rate for Indian learners / speech therapy
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

  const handleApplySettings = () => {
    setPatientName(tempPatientName);
    setLetterSize(tempLetterSize);
    setBubbleSize(tempBubbleSize);
    setWheelColor(tempWheelColor);

    // Show Notification Toast
    setNotification('Settings Applied Successfully!');
    setTimeout(() => setNotification(null), 2500);

    // Close Modal and start game + audio speech
    setIsSettingsOpen(false);
    setIsPaused(false);
    if (currentTargetRef.current) {
      const targetText = currentTargetRef.current;
      setTimeout(() => {
        speak(mode === 'colors' ? targetText : `target ${targetText}`, mode);
      }, 200);
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

  const animationDurationSeconds = DEFAULT_BASE_ANIMATION_DURATION / speed;

  return (
    <div className="relative w-screen h-screen flex justify-between items-center px-4 md:px-8 overflow-hidden bg-gradient-to-b from-[#D7ECFF] to-[#BFDFFF]">
      {/* NOTIFICATION TOAST */}
      {notification && (
        <div className="fixed top-5 left-1/2 transform -translate-x-1/2 bg-emerald-600 text-white font-bold px-6 py-3 rounded-full shadow-2xl z-[300] animate-bounce">
          ✓ {notification}
        </div>
      )}

      {/* LEFT: CONTROLS (Tailwind CSS) */}
      <div className="flex flex-col items-center gap-4 z-10">
        <button
          className="w-[70px] md:w-[100px] h-[70px] md:h-[100px] rounded-2xl bg-white border-2 border-gray-300 text-3xl md:text-4xl text-gray-500 hover:text-black flex justify-center items-center shadow-lg active:scale-95 transition-all"
          onClick={() => setIsPaused((prev) => !prev)}
          title={isPaused ? 'Play' : 'Pause'}
        >
          {isPaused ? '▶' : '⏸'}
        </button>

        <div className="mt-4 text-xl md:text-2xl font-bold text-gray-800 text-center">
          Target:{' '}
          <span className="text-3xl md:text-4xl font-extrabold" style={{ color: targetColor }}>
            {currentTarget}
          </span>
        </div>
      </div>

      {/* CENTER: ROTATING WHEEL (Tailwind CSS) */}
      <div
        ref={wheelRef}
        className={`relative h-[98vh] w-[98vh] max-w-[calc(100vw-140px)] sm:max-w-[calc(100vw-200px)] aspect-square rounded-full flex justify-center items-center shadow-2xl transition-transform cursor-pointer shrink-0 ${
          isPaused ? 'paused' : 'animate-rotate-wheel'
        }`}
        style={{
          animationDuration: `${animationDurationSeconds}s`,
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
                className={`absolute rounded-full flex justify-center items-center font-bold cursor-pointer select-none border-2 border-white/40 shadow-md active:scale-110 transition-transform -translate-x-1/2 -translate-y-1/2 ${
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

      {/* RIGHT: HAMBURGER MENU */}
      <div className="z-10 flex items-center">
        <button
          className="bg-transparent border-none text-4xl text-gray-600 hover:text-black cursor-pointer"
          onClick={() => setIsMenuOpen(true)}
          title="Menu"
        >
          ☰
        </button>
      </div>

      {/* SHARED OFFCANVAS MENU */}
      <GameMenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onQuit={() => {
          if (onExit) onExit();
        }}
        onReset={startLevel}
        resetButtonLabel="Reset Level"
        onOpenSettings={() => {
          setIsPaused(true);
          if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.cancel();
          }
          setIsSettingsOpen(true);
        }}
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
          { label: 'Letter Size', value: <span className="text-blue-400 font-bold">{letterSize}</span> },
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
    </div>
  );
}
