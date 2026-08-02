'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SortingVariant,
  BubbleItem,
  BubblePosition,
  ALPHABETS,
  NUMBERS,
  THERAPY_COLORS,
  checkOverlap,
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

interface SortingGameProps {
  variant?: SortingVariant;
  onExit?: () => void;
}

export function SortingGame({ variant = 'uppercase', onExit }: SortingGameProps) {
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [isBlinking, setIsBlinking] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  // Settings & Results Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(true);
  const [isResultsOpen, setIsResultsOpen] = useState<boolean>(false);
  const [resultsData, setResultsData] = useState<SessionResultData | null>(null);

  // Active Settings
  const [patientName, setPatientName] = useState<string>('Demo Patient');
  const [letterSize, setLetterSize] = useState<number>(1.8);
  const [bubbleSize, setBubbleSize] = useState<number>(90);

  // Temporary Settings state for Modal editing
  const [tempPatientName, setTempPatientName] = useState<string>(patientName);
  const [tempLetterSize, setTempLetterSize] = useState<number>(letterSize);
  const [tempBubbleSize, setTempBubbleSize] = useState<number>(bubbleSize);

  // Notification Toast State
  const [notification, setNotification] = useState<string | null>(null);

  // Game Play State & Batching
  const [bubbles, setBubbles] = useState<BubbleItem[]>([]);
  const [expectedIndex, setExpectedIndex] = useState<number>(0);
  const [currentBatchIndex, setCurrentBatchIndex] = useState<number>(0);
  const [poppingIds, setPoppingIds] = useState<Set<string>>(new Set());
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());

  // Screen & Device type state for responsive batching
  const [deviceType, setDeviceType] = useState<'Mobile' | 'Tablet' | 'Desktop'>('Desktop');

  // Stats
  const [clicks, setClicks] = useState<number>(0);
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [wrongCount, setWrongCount] = useState<number>(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [targetShownAt, setTargetShownAt] = useState<number | null>(null);
  const [durationSec, setDurationSec] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const indianVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    const detectDevice = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0));

      if (w < 768 || (w < 1024 && h < 500)) {
        setDeviceType('Mobile');
      } else if (w < 1024 || (isTouch && w <= 1366 && h <= 1024)) {
        setDeviceType('Tablet');
      } else {
        setDeviceType('Desktop');
      }
    };

    detectDevice();
    window.addEventListener('resize', detectDevice);
    return () => window.removeEventListener('resize', detectDevice);
  }, []);

  const isMobileTab = deviceType === 'Mobile' || deviceType === 'Tablet';

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

  const sequenceItems = useCallback(() => {
    if (variant === 'uppercase') {
      return ALPHABETS.split('');
    }
    if (variant === 'lowercase') {
      return ALPHABETS.toLowerCase().split('');
    }
    return NUMBERS.split('');
  }, [variant]);

  // Compute batch plan:
  // Big Screens (>=1024px): 5-5-5-5-6 for alphabets (26), 5-5 for numbers (10)
  // Tabs & Mobiles (<1024px): 4-4-4-4-4-4-2 for alphabets (26), 4-4-2 for numbers (10)
  const getBatchPlan = useCallback(() => {
    if (variant === 'numbers') {
      return isMobileTab ? [4, 4, 2] : [5, 5];
    }
    return isMobileTab ? [4, 4, 4, 4, 4, 4, 2] : [5, 5, 5, 5, 6];
  }, [variant, isMobileTab]);

  const speak = useCallback((text: string) => {
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
    }
  }, [isSettingsOpen, patientName, letterSize, bubbleSize]);

  // Idle blinking emoji timer
  useEffect(() => {
    if (gameStarted) return;
    const interval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 1200);
    }, 3000);
    return () => clearInterval(interval);
  }, [gameStarted]);

  // Duration timer
  useEffect(() => {
    if (!gameStarted || startTime === null) return;
    const interval = setInterval(() => {
      setDurationSec(Math.floor((performance.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [gameStarted, startTime]);

  // Spawn bubbles for a specific batch index
  const spawnBatch = useCallback(
    (batchIdx: number, allItems: string[]) => {
      const plan = getBatchPlan();
      let startIdx = 0;
      for (let i = 0; i < batchIdx && i < plan.length; i++) {
        startIdx += plan[i];
      }
      const count = plan[batchIdx] || 0;
      const batchItems = allItems.slice(startIdx, startIdx + count);
      const shuffled = [...batchItems].sort(() => Math.random() - 0.5);

      const newBubbles: BubbleItem[] = [];
      const positions: BubblePosition[] = [];

      shuffled.forEach((symbol, i) => {
        let pos: BubblePosition = { x: 50, y: 50 };
        let valid = false;

        for (let attempt = 0; attempt < 80; attempt++) {
          const paddingPercent = 12;
          const x = paddingPercent + Math.random() * (100 - 2 * paddingPercent);
          const y = paddingPercent + Math.random() * (100 - 2 * paddingPercent);

          pos = { x, y };
          if (!checkOverlap(pos, positions, 12)) {
            valid = true;
            break;
          }
        }

        if (valid) {
          positions.push(pos);
          newBubbles.push({
            id: `sort-bubble-${symbol}-${batchIdx}-${i}-${Math.random()}`,
            symbol,
            color: THERAPY_COLORS[(startIdx + i) % THERAPY_COLORS.length],
            x: pos.x,
            y: pos.y,
          });
        }
      });

      setBubbles(newBubbles);
    },
    [getBatchPlan]
  );

  const startGame = () => {
    setGameStarted(true);
    setExpectedIndex(0);
    setCurrentBatchIndex(0);
    setClicks(0);
    setCorrectCount(0);
    setWrongCount(0);
    const now = performance.now();
    setStartTime(now);
    setTargetShownAt(now);

    const allItems = sequenceItems();
    spawnBatch(0, allItems);
    speak(`Start sorting ${variant}`);
  };

  const handleBubbleClick = (clickedBubble: BubbleItem) => {
    setClicks((prev) => prev + 1);

    const allItems = sequenceItems();
    const targetSymbol = allItems[expectedIndex];

    if (clickedBubble.symbol === targetSymbol) {
      playCorrectSoundAndHaptic();

      if (targetShownAt) {
        setReactionTimes((prev) => [...prev, performance.now() - targetShownAt]);
      }
      setTargetShownAt(performance.now());

      setCorrectCount((prev) => prev + 1);

      setPoppingIds((prev) => new Set(prev).add(clickedBubble.id));

      setTimeout(() => {
        const nextIndex = expectedIndex + 1;
        setExpectedIndex(nextIndex);

        const remainingInCurrentBatch = bubbles.filter((b) => b.id !== clickedBubble.id);
        setBubbles(remainingInCurrentBatch);

        // Check if all items in current batch have been popped
        if (remainingInCurrentBatch.length === 0) {
          const plan = getBatchPlan();
          const nextBatch = currentBatchIndex + 1;

          if (nextBatch < plan.length && nextIndex < allItems.length) {
            setCurrentBatchIndex(nextBatch);
            setTimeout(() => {
              spawnBatch(nextBatch, allItems);
            }, 300);
          } else if (nextIndex >= allItems.length) {
            playSuccessSoundAndHaptic();

            const totalDuration = startTime ? (performance.now() - startTime) / 1000 : 0;
            const avgReact = reactionTimes.length
              ? reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length / 1000
              : 0;

            const finalData: SessionResultData = {
              patientName,
              sessionId: Math.floor(1000 + Math.random() * 9000),
              date: new Date().toLocaleDateString('en-GB'),
              gameName: `Sorting Module (${variant})`,
              stimuliCount: allItems.length,
              letterSize,
              speed: '1x',
              durationSec: Math.round(totalDuration),
              clicksTotal: clicks + 1,
              correct: correctCount + 1,
              wrong: wrongCount,
              accuracy: Math.round(((correctCount + 1) / (clicks + 1)) * 100),
              avgReactionSec: parseFloat(avgReact.toFixed(2)),
            };

            setResultsData(finalData);
            setIsResultsOpen(true);

            setTimeout(() => {
              setGameStarted(false);
            }, 500);
          }
        }
      }, 250);
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

  const handleBackgroundClick = () => {
    if (gameStarted) {
      setClicks((prev) => prev + 1);
      setWrongCount((prev) => prev + 1);
      playMissPressSoundAndHaptic();
    }
  };

  const handleApplySettings = () => {
    setPatientName(tempPatientName);
    setLetterSize(tempLetterSize);
    setBubbleSize(tempBubbleSize);

    // Show Notification Toast
    setNotification('Settings Applied Successfully!');
    setTimeout(() => setNotification(null), 2500);

    // Close Modal after applying
    setIsSettingsOpen(false);
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
  };

  const allItems = sequenceItems();
  const currentTargetSymbol = allItems[expectedIndex] || '';
  const batchPlan = getBatchPlan();

  const avgReactionMs = reactionTimes.length
    ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
    : 0;

  return (
    <div className="relative w-screen h-screen bg-[#0A0A0A] flex flex-col justify-between overflow-hidden text-white">
      {/* NOTIFICATION TOAST */}
      {notification && (
        <div className="fixed top-5 left-1/2 transform -translate-x-1/2 bg-emerald-600 text-white font-bold px-6 py-3 rounded-full shadow-2xl z-[300] animate-bounce">
          ✓ {notification}
        </div>
      )}

      {/* HEADER BAR */}
      <div className="w-full flex justify-between items-center px-6 py-4 bg-[#141414]/90 backdrop-blur border-b border-gray-800 z-10">
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
          <h2 className="text-2xl font-extrabold text-white capitalize">
            {variant} Sorting
          </h2>
        </div>

        {gameStarted && (
          <div className="flex items-center gap-6">
            <div className="text-lg font-bold text-gray-300">
              Next: <span className="text-2xl font-black text-blue-400 font-mono">{currentTargetSymbol}</span>
            </div>
            <div className="text-sm font-semibold text-gray-400">
              Batch {currentBatchIndex + 1} of {batchPlan.length} ({expectedIndex} / {allItems.length})
            </div>
          </div>
        )}

        <button
          className="text-3xl text-gray-300 hover:text-white transition-colors"
          onClick={() => setIsMenuOpen(true)}
        >
          ☰
        </button>
      </div>

      {/* GAME AREA */}
      <div
        ref={containerRef}
        className="relative flex-1 w-full h-full bg-[#000000] overflow-hidden cursor-pointer"
        onClick={handleBackgroundClick}
      >
        {!gameStarted ? (
          <div className="absolute inset-0 flex flex-col justify-center items-center gap-6 bg-black/80">
            <button
              className="text-8xl hover:scale-110 active:scale-95 transition-transform cursor-pointer select-none"
              onClick={startGame}
              title="Click to Start Game"
            >
              {isBlinking ? '😉' : '🙂'}
            </button>
            <div className="text-2xl font-bold text-gray-200">
              Click the emoji to start sorting!
            </div>
            <div className="text-sm text-gray-400 font-medium">
              Device: <span className="text-blue-400 font-bold">{deviceType}</span> ({deviceType === 'Desktop' ? '5-item chunks' : '4-item chunks'})
            </div>
          </div>
        ) : (
          <div>
            {bubbles.map((bubble) => {
              const isPopping = poppingIds.has(bubble.id);
              const isWrong = wrongIds.has(bubble.id);
              const textColor = getContrastColor(bubble.color || '#FFFFFF');
              return (
                <div
                  key={bubble.id}
                  className={`absolute rounded-full flex justify-center items-center font-extrabold cursor-pointer select-none border-2 border-white/40 shadow-lg active:scale-110 transition-all -translate-x-1/2 -translate-y-1/2 ${
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
                  {bubble.symbol}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SHARED OFFCANVAS MENU */}
      <GameMenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onQuit={() => {
          if (onExit) onExit();
        }}
        onReset={() => setGameStarted(false)}
        resetButtonLabel="Reset Game"
        onOpenSettings={() => setIsSettingsOpen(true)}
        settingsSummary={[
          { label: 'Patient', value: patientName },
          { label: 'Letter Size', value: <span className="text-blue-400 font-bold">{letterSize}</span> },
          { label: 'Bubble Size', value: <span className="text-blue-400 font-bold">{bubbleSize}</span> },
          { label: 'Variant', value: <span className="text-emerald-400 font-bold capitalize">{variant}</span> },
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

          setNotification('Settings Applied Successfully!');
          setTimeout(() => setNotification(null), 2500);

          setIsSettingsOpen(false);
          requestFullScreenSafe();
        }}
        patientName={patientName}
        letterSize={letterSize}
        bubbleSize={bubbleSize}
        sampleSymbol={variant === 'lowercase' ? 'a' : variant === 'numbers' ? '1' : 'A'}
        extraStats={
          <div className="grid grid-cols-3 text-center bg-[#282828] p-3 rounded-xl gap-2 border border-gray-800">
            <div>
              <div className="text-xs text-gray-400">Reaction</div>
              <div className="font-bold text-white text-base">{avgReactionMs}ms</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Duration</div>
              <div className="font-bold text-white text-base">{durationSec}s</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Clicks</div>
              <div className="font-bold text-white text-base">{clicks}</div>
            </div>
          </div>
        }
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
            startGame();
          }}
          data={resultsData}
        />
      )}
    </div>
  );
}
