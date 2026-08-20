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
  getMinDistancePercent,
  getContrastColor,
  exportSessionCSV,
  playCorrectSoundAndHaptic,
  playWrongSoundAndHaptic,
  playWrongBubbleSoundAndHaptic,
  playMissPressSoundAndHaptic,
  playSuccessSoundAndHaptic,
  requestFullScreenSafe,
  ClinicalSettingsModal,
  SessionResultData,
} from '@candela/shared';
import { GameMenuDrawer } from '../shared/GameMenuDrawer';
import { GameResultsModal } from '../shared/GameResultsModal';
import { SlidersIcon } from '../icons/VectorIcons';

interface SortingGameProps {
  variant?: SortingVariant;
  onExit?: () => void;
}

export function SortingGame({ variant = 'uppercase', onExit }: SortingGameProps) {
  const [gameStarted, setGameStarted] = useState<boolean>(false);
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

      const rawContainer = containerRef.current;
      const containerWidth = rawContainer ? rawContainer.clientWidth : 800;
      const containerHeight = rawContainer ? rawContainer.clientHeight : 600;
      const containerSize = Math.min(containerWidth, containerHeight);

      const minDistance = getMinDistancePercent(bubbleSize, containerSize, 2);

      // Boundary padding in percentage based on actual rendered bubble size + 16px safety padding
      const bubbleRadiusPercentX = Math.max(10, ((bubbleSize / 2 + 16) / containerWidth) * 100);
      const bubbleRadiusPercentY = Math.max(10, ((bubbleSize / 2 + 16) / containerHeight) * 100);

      const minX = bubbleRadiusPercentX;
      const maxX = 100 - bubbleRadiusPercentX;
      const minY = bubbleRadiusPercentY;
      const maxY = 100 - bubbleRadiusPercentY;

      shuffled.forEach((symbol, i) => {
        let pos: BubblePosition = { x: 50, y: 50 };
        let valid = false;

        for (let attempt = 0; attempt < 80; attempt++) {
          const x = minX + Math.random() * (maxX - minX);
          const y = minY + Math.random() * (maxY - minY);

          pos = { x, y };
          if (!checkOverlap(pos, positions, minDistance)) {
            valid = true;
            break;
          }
        }

        // Guaranteed Grid/Slot Fallback if all 80 attempts fail
        if (!valid) {
          const cols = Math.ceil(Math.sqrt(count));
          const rows = Math.ceil(count / cols);
          const colIndex = i % cols;
          const rowIndex = Math.floor(i / cols);

          const cellWidth = (maxX - minX) / Math.max(1, cols);
          const cellHeight = (maxY - minY) / Math.max(1, rows);

          const x = minX + (colIndex + 0.5) * cellWidth;
          const y = minY + (rowIndex + 0.5) * cellHeight;
          pos = { x, y };
        }

        positions.push(pos);
        newBubbles.push({
          id: `sort-bubble-${symbol}-${batchIdx}-${i}-${Math.random()}`,
          symbol,
          color: THERAPY_COLORS[(startIdx + i) % THERAPY_COLORS.length],
          x: pos.x,
          y: pos.y,
        });
      });

      setBubbles(newBubbles);
    },
    [getBatchPlan, bubbleSize]
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

  const avgReactionMs = reactionTimes.length
    ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
    : 0;

  return (
    <div className="relative w-screen h-screen bg-[#0A0A0A] overflow-hidden text-white">
      {/* TOP-RIGHT NOTIFICATION TOAST */}
      {notification && (
        <div className="fixed top-6 right-6 z-[300] flex items-center gap-2 bg-emerald-600/90 backdrop-blur-md text-white font-bold px-5 py-3 rounded-2xl shadow-2xl border border-emerald-400/30 text-sm animate-fade-in">
          ✓ {notification}
        </div>
      )}

      {!gameStarted && !isSettingsOpen && !isResultsOpen ? (
        <div className="fixed inset-0 z-50 bg-[#06070D]/98 flex flex-col justify-center items-center gap-4 p-6 text-center select-none">
          <h2 className="text-2xl sm:text-3xl font-black text-white">Sorting Module</h2>
          <button
            type="button"
            onClick={startGame}
            className="px-8 py-4 rounded-full bg-[#34D399] text-slate-950 font-black text-xl cursor-pointer active:scale-95"
            title="Click to Start Therapy Session"
          >
            Click to Start
          </button>
        </div>
      ) : null}

      {gameStarted ? (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 bg-[#111827] px-4 py-2 rounded-xl">
          <span className="text-white font-black text-2xl">{currentTargetSymbol}</span>
        </div>
      ) : null}

      {/* GAME AREA */}
      <div
        ref={containerRef}
        className="relative w-full h-full bg-[#000000] overflow-hidden cursor-pointer"
        onClick={handleBackgroundClick}
      >
        {gameStarted ? (
          <div>
            {bubbles.map((bubble) => {
              const isPopping = poppingIds.has(bubble.id);
              const isWrong = wrongIds.has(bubble.id);
              const textColor = getContrastColor(bubble.color || '#FFFFFF');
              return (
                <div
                  key={bubble.id}
                  className={`absolute rounded-full flex justify-center items-center font-extrabold cursor-pointer select-none active:scale-110 transition-all -translate-x-1/2 -translate-y-1/2 ${
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
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => setIsMenuOpen(true)}
        className="absolute bottom-6 right-4 z-40 w-11 h-11 rounded-full bg-[#121626] text-white flex items-center justify-center cursor-pointer active:scale-95"
        title="Settings menu"
      >
        <SlidersIcon className="w-5 h-5" />
      </button>

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
        sessionInProgress={gameStarted && !isResultsOpen}
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
