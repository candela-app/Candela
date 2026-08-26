'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppliedClinicalSettings,
  ClinicalSettingsModal,
  buildHexHive,
  clampBatchesPerSession,
  clampHexSizePx,
  clampStimuliCount,
  DEFAULT_PERIPHERAL_BG_COLOR,
  DEFAULT_PERIPHERAL_BUBBLE_TYPE,
  DEFAULT_PERIPHERAL_FIXATION_COLOR,
  DEFAULT_PERIPHERAL_LETTER_SIZE,
  DEFAULT_PERIPHERAL_STIMULUS_COLOR,
  eligibleCellIds,
  getDeviceTier,
  hexPointsAttribute,
  isPeripheralLandscape,
  fixationTrianglePointsAttribute,
  peripheralDeviceDefaults,
  peripheralFieldLabel,
  peripheralHexPaint,
  peripheralHexRenderRadius,
  peripheralLetterColor,
  peripheralLetterFontPx,
  peripheralSessionAccuracy,
  clampPeripheralLetterSize,
  clampPeripheralTargetTimeoutSec,
  playCorrectSoundAndHaptic,
  playMissPressSoundAndHaptic,
  playSuccessSoundAndHaptic,
  playWrongBubbleSoundAndHaptic,
  requestFullScreenSafe,
  resolvePeripheralField,
  spawnBatch,
  reactionStatsFromMs,
  type HexCell,
  type PeripheralSessionResultData,
  type PeripheralTrialOutcome,
} from '@candela/shared';
import { useGameSessionLock } from '../shared/useGameSessionLock';
import { GameResultsModal } from '../shared/GameResultsModal';
import { ResetConfirmDialog } from '../shared/ResetConfirmDialog';
import { ChevronUpIcon, ReplayIcon, SlidersIcon, VolumeIcon } from '../icons/VectorIcons';
import { useAuth } from '@/lib/auth-context';
import styles from './PeripheralViewGame.module.css';

interface PeripheralViewGameProps {
  field?: string;
  onExit?: () => void;
}

function sessionPatientName(session: { user?: { name?: string | null } } | null | undefined): string {
  const name = session?.user?.name?.trim();
  return name && name.length > 0 ? name : 'Demo Patient';
}

export function PeripheralViewGame({ field: fieldProp = 'both', onExit }: PeripheralViewGameProps) {
  const field = resolvePeripheralField(fieldProp);
  const { session } = useAuth();
  const deviceTier = useMemo(() => getDeviceTier(), []);
  const defaults = useMemo(() => peripheralDeviceDefaults(deviceTier), [deviceTier]);

  const [gameStarted, setGameStarted] = useState(false);
  const [isAssistiveTouchOpen, setIsAssistiveTouchOpen] = useState(false);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  useGameSessionLock(true);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [resultsData, setResultsData] = useState<PeripheralSessionResultData | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const [patientName, setPatientName] = useState(() => sessionPatientName(session));
  const [letterSize, setLetterSize] = useState(DEFAULT_PERIPHERAL_LETTER_SIZE);
  const [targetTimeoutSec, setTargetTimeoutSec] = useState(0);
  const [hexSizePx, setHexSizePx] = useState(defaults.hexSizePx);
  const [stimuliCount, setStimuliCount] = useState(defaults.stimuliCount);
  const [batchesPerSession, setBatchesPerSession] = useState(defaults.batchesPerSession);
  const [stimulusColor, setStimulusColor] = useState(DEFAULT_PERIPHERAL_STIMULUS_COLOR);
  const [engineBgColor, setEngineBgColor] = useState(DEFAULT_PERIPHERAL_BG_COLOR);
  const [bubbleType, setBubbleType] = useState<'solid' | 'boundary'>(DEFAULT_PERIPHERAL_BUBBLE_TYPE);

  const [cells, setCells] = useState<HexCell[]>([]);
  const [activeMap, setActiveMap] = useState<Record<string, string>>({});
  const [currentTarget, setCurrentTarget] = useState('');
  const [poppingIds, setPoppingIds] = useState<Set<string>>(new Set());
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());
  const [batchIndex, setBatchIndex] = useState(0);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const [clicks, setClicks] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [targetShownAt, setTargetShownAt] = useState<number | null>(null);
  const [durationSec, setDurationSec] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const batchIndexRef = useRef(0);
  const statsRef = useRef({
    clicks: 0,
    correct: 0,
    wrong: 0,
    reactions: [] as number[],
    trials: [] as PeripheralSessionResultData['trials'],
    stimuliPresented: 0,
  });
  const startTimeRef = useRef<number | null>(null);
  const currentTargetRef = useRef('');
  const isSettingsOpenRef = useRef(isSettingsOpen);
  const targetVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const cellsRef = useRef<HexCell[]>([]);
  const sizeRef = useRef(size);
  const gameStartedRef = useRef(gameStarted);
  const wasLandscapeRef = useRef(false);
  const batchesPerSessionRef = useRef(batchesPerSession);
  const activeMapRef = useRef<Record<string, string>>({});
  const targetTimeoutSecRef = useRef(targetTimeoutSec);
  const targetTimeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLandscape = isPeripheralLandscape(size.w, size.h);
  const sizeReady = size.w > 0 && size.h > 0;
  const needsLandscape = sizeReady && !isLandscape;

  useEffect(() => {
    const name = session?.user.name?.trim();
    if (name) setPatientName(name);
  }, [session?.user.name]);

  useEffect(() => {
    isSettingsOpenRef.current = isSettingsOpen;
  }, [isSettingsOpen]);

  useEffect(() => {
    startTimeRef.current = startTime;
  }, [startTime]);

  useEffect(() => {
    setStimuliCount((prev) => clampStimuliCount(prev, deviceTier));
  }, [deviceTier]);

  const recordTrial = useCallback((outcome: PeripheralTrialOutcome, reactionMs: number | null) => {
    const sessionStart = startTimeRef.current;
    statsRef.current.trials.push({
      batchIndex: batchIndexRef.current,
      targetLetter: currentTargetRef.current,
      outcome,
      reactionMs: reactionMs != null ? Math.round(reactionMs) : null,
      atMs: sessionStart != null ? Math.round(performance.now() - sessionStart) : 0,
    });
  }, []);

  useEffect(() => {
    batchIndexRef.current = batchIndex;
  }, [batchIndex]);

  useEffect(() => {
    batchesPerSessionRef.current = batchesPerSession;
  }, [batchesPerSession]);

  useEffect(() => {
    gameStartedRef.current = gameStarted;
  }, [gameStarted]);

  useEffect(() => {
    statsRef.current.clicks = clicks;
    statsRef.current.correct = correctCount;
    statsRef.current.wrong = wrongCount;
    statsRef.current.reactions = reactionTimes;
  }, [clicks, correctCount, wrongCount, reactionTimes]);

  useEffect(() => {
    cellsRef.current = cells;
  }, [cells]);

  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      const original =
        voices.find((v) => v.lang === 'en-US' && /Samantha|Google US English|Microsoft Aria/i.test(v.name)) ||
        voices.find((v) => v.lang.startsWith('en')) ||
        null;
      targetVoiceRef.current = original;
    };
    updateVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    if (targetVoiceRef.current) {
      utter.voice = targetVoiceRef.current;
      utter.lang = targetVoiceRef.current.lang;
    } else {
      utter.lang = 'en-US';
    }
    utter.rate = 0.9;
    window.speechSynthesis.speak(utter);
  }, []);

  const speakTarget = useCallback(
    (letter: string) => {
      if (!letter) return;
      speak(`target ${letter}`);
    },
    [speak],
  );

  useEffect(() => {
    requestFullScreenSafe();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setSize({ w: Math.floor(rect.width), h: Math.floor(rect.height) });
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  useEffect(() => {
    if (!gameStarted || startTime === null) return;
    const interval = setInterval(() => {
      setDurationSec(Math.floor((performance.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [gameStarted, startTime]);

  const clearBoard = useCallback(() => {
    setActiveMap({});
    setCurrentTarget('');
    currentTargetRef.current = '';
    setPoppingIds(new Set());
    setWrongIds(new Set());
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const chooseNextTarget = useCallback(
    (map: Record<string, string>) => {
      const remaining = Array.from(new Set(Object.values(map)));
      if (remaining.length === 0) {
        setCurrentTarget('');
        currentTargetRef.current = '';
        return;
      }
      const next = remaining[Math.floor(Math.random() * remaining.length)];
      setCurrentTarget(next);
      currentTargetRef.current = next;
      setTargetShownAt(performance.now());
      if (!isSettingsOpenRef.current) {
        setTimeout(() => speakTarget(next), 350);
      }
    },
    [speakTarget],
  );

  useEffect(() => {
    activeMapRef.current = activeMap;
  }, [activeMap]);

  useEffect(() => {
    targetTimeoutSecRef.current = targetTimeoutSec;
  }, [targetTimeoutSec]);

  const clearTargetTimeout = useCallback(() => {
    if (targetTimeoutTimerRef.current) {
      clearTimeout(targetTimeoutTimerRef.current);
      targetTimeoutTimerRef.current = null;
    }
  }, []);

  const handleTargetTimeout = useCallback(() => {
    if (!gameStartedRef.current || !currentTargetRef.current || isSettingsOpenRef.current) return;
    setClicks((prev) => prev + 1);
    setWrongCount((prev) => prev + 1);
    void playWrongBubbleSoundAndHaptic();
    recordTrial('timeout', null);
    chooseNextTarget(activeMapRef.current);
  }, [chooseNextTarget, recordTrial]);

  const scheduleTargetTimeout = useCallback(() => {
    clearTargetTimeout();
    const sec = targetTimeoutSecRef.current;
    if (sec <= 0 || !gameStartedRef.current || !currentTargetRef.current || isSettingsOpenRef.current) return;
    targetTimeoutTimerRef.current = setTimeout(() => {
      handleTargetTimeout();
    }, sec * 1000);
  }, [clearTargetTimeout, handleTargetTimeout]);

  useEffect(() => {
    if (!gameStarted || !currentTarget || targetTimeoutSec <= 0 || isSettingsOpen) {
      clearTargetTimeout();
      return;
    }
    scheduleTargetTimeout();
    return clearTargetTimeout;
  }, [gameStarted, currentTarget, targetTimeoutSec, targetShownAt, isSettingsOpen, scheduleTargetTimeout, clearTargetTimeout]);

  useEffect(() => () => clearTargetTimeout(), [clearTargetTimeout]);

  const refillBatch = useCallback(
    (nextBatch: number, hive: HexCell[], width: number, height: number) => {
      if (!isPeripheralLandscape(width, height)) {
        clearBoard();
        return;
      }
      const eligible = eligibleCellIds(hive, field, width, height, hexSizePx);
      const map = spawnBatch(eligible, stimuliCount, Math.random, deviceTier);
      statsRef.current.stimuliPresented += Object.keys(map).length;
      setActiveMap(map);
      setBatchIndex(nextBatch);
      chooseNextTarget(map);
    },
    [chooseNextTarget, clearBoard, deviceTier, field, hexSizePx, stimuliCount],
  );

  // Rebuild hive on size change; drop stale pops in portrait; refill when landscape while session active.
  useEffect(() => {
    if (size.w <= 0 || size.h <= 0) return;
    const landscape = isPeripheralLandscape(size.w, size.h);
    const hive = landscape ? buildHexHive(size.w, size.h, hexSizePx) : [];
    setCells(hive);
    cellsRef.current = hive;

    if (!landscape) {
      clearBoard();
      wasLandscapeRef.current = false;
      return;
    }

    wasLandscapeRef.current = true;
    // Re-seed on size/hex change mid-session so pops never stick to a stale hive.
    if (gameStartedRef.current) {
      refillBatch(batchIndexRef.current, hive, size.w, size.h);
    }
  }, [size.w, size.h, hexSizePx, clearBoard, refillBatch]);

  const finishSession = useCallback(() => {
    playSuccessSoundAndHaptic();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    const { correct, wrong, reactions, trials, stimuliPresented } = statsRef.current;
    const totalDuration = startTime ? (performance.now() - startTime) / 1000 : 0;
    const { avgSec: avgReact, medianSec: medianReact } = reactionStatsFromMs(reactions);
    const data: PeripheralSessionResultData = {
      patientName,
      sessionId: Math.floor(1000 + Math.random() * 9000),
      date: new Date().toLocaleDateString('en-GB'),
      gameName: `Peripheral View (${peripheralFieldLabel(field)})`,
      stimuliCount: stimuliPresented,
      letterSize,
      speed: `${hexSizePx}px`,
      durationSec: Math.round(totalDuration),
      clicksTotal: correct + wrong,
      correct,
      wrong,
      accuracy: peripheralSessionAccuracy(correct, wrong),
      avgReactionSec: avgReact,
      medianReactionSec: medianReact,
      peripheralField: field,
      batchesConfigured: batchesPerSession,
      stimuliPerBatchConfigured: stimuliCount,
      stimuliPresentedTotal: stimuliPresented,
      targetTimeoutSec,
      bubbleType,
      deviceTier,
      trials,
    };
    // TODO: persist once DB is configured
    setResultsData(data);
    setIsResultsOpen(true);
    setTimeout(() => setGameStarted(false), 400);
  }, [batchesPerSession, bubbleType, deviceTier, field, hexSizePx, letterSize, patientName, startTime, stimuliCount, targetTimeoutSec]);

  const startGame = () => {
    if (!isPeripheralLandscape(size.w, size.h)) return;
    setGameStarted(true);
    setClicks(0);
    setCorrectCount(0);
    setWrongCount(0);
    setReactionTimes([]);
    setPoppingIds(new Set());
    setWrongIds(new Set());
    const now = performance.now();
    setStartTime(now);
    setTargetShownAt(now);
    setDurationSec(0);
    statsRef.current = {
      clicks: 0,
      correct: 0,
      wrong: 0,
      reactions: [],
      trials: [],
      stimuliPresented: 0,
    };
    const hive = buildHexHive(size.w, size.h, hexSizePx);
    setCells(hive);
    cellsRef.current = hive;
    refillBatch(0, hive, size.w, size.h);
  };

  const handleHexClick = (cellId: string) => {
    if (!isLandscape || !gameStarted || !activeMap[cellId] || poppingIds.has(cellId) || !currentTarget) return;
    const letter = activeMap[cellId];
    setClicks((prev) => prev + 1);

    if (letter !== currentTarget) {
      playWrongBubbleSoundAndHaptic();
      setWrongCount((prev) => prev + 1);
      recordTrial('wrong', null);
      setWrongIds((prev) => new Set(prev).add(cellId));
      setTimeout(() => {
        setWrongIds((prev) => {
          const next = new Set(prev);
          next.delete(cellId);
          return next;
        });
      }, 280);
      return;
    }

    playCorrectSoundAndHaptic();
    setCorrectCount((prev) => prev + 1);
    const reactionMs = targetShownAt != null ? performance.now() - targetShownAt : null;
    if (reactionMs != null) {
      setReactionTimes((prev) => [...prev, reactionMs]);
    }
    recordTrial('correct', reactionMs);
    setPoppingIds((prev) => new Set(prev).add(cellId));

    setTimeout(() => {
      setActiveMap((prev) => {
        const next = { ...prev };
        delete next[cellId];
        const stillSameTarget = Object.values(next).some((v) => v === currentTargetRef.current);

        if (Object.keys(next).length === 0) {
          const nextBatch = batchIndexRef.current + 1;
          if (nextBatch < batchesPerSessionRef.current) {
            setTimeout(() => {
              refillBatch(
                nextBatch,
                cellsRef.current,
                sizeRef.current.w || 800,
                sizeRef.current.h || 600,
              );
            }, 280);
          } else {
            setTimeout(() => finishSession(), 200);
          }
        } else if (!stillSameTarget) {
          setTimeout(() => chooseNextTarget(next), 400);
        }

        return next;
      });
      setPoppingIds((prev) => {
        const n = new Set(prev);
        n.delete(cellId);
        return n;
      });
    }, 220);
  };

  const handleBackgroundMiss = () => {
    if (!isLandscape || !gameStarted) return;
    setClicks((prev) => prev + 1);
    setWrongCount((prev) => prev + 1);
    recordTrial('miss', null);
    playMissPressSoundAndHaptic();
  };

  const avgReactionMs = reactionTimes.length
    ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
    : 0;

  const fontPx = peripheralLetterFontPx(hexSizePx, letterSize);
  const letterColor = peripheralLetterColor({ bubbleType, stimulusColor });
  const fieldTitle = peripheralFieldLabel(field);

  const resetSession = () => {
    setIsAssistiveTouchOpen(false);
    setIsHeaderExpanded(false);
    setGameStarted(false);
    clearBoard();
    setIsSettingsOpen(false);
  };

  const openSettings = () => {
    setIsAssistiveTouchOpen(false);
    setIsHeaderExpanded(false);
    setIsSettingsOpen(true);
  };

  return (
    <div
      className={`${styles.root} select-none touch-manipulation`}
      style={{ backgroundColor: engineBgColor }}
    >
      {notification ? (
        <div className="fixed top-6 right-6 z-[300] flex items-center gap-2 bg-emerald-600/90 backdrop-blur-md text-white font-bold px-5 py-3 rounded-2xl shadow-2xl border border-emerald-400/30 text-sm">
          ✓ {notification}
        </div>
      ) : null}

      {needsLandscape ? (
        <div className={styles.landscapeGate} role="dialog" aria-label="Rotate to landscape">
          <div className={styles.landscapePhone} aria-hidden />
          <h2 className={styles.landscapeTitle}>Rotate to landscape</h2>
          <p className={styles.landscapeCopy}>
            Peripheral View is played in landscape so left and right fields stay clear. Rotate your device to continue.
          </p>
        </div>
      ) : null}

      {isLandscape && !gameStarted && !isSettingsOpen && !isResultsOpen ? (
        <div className={styles.startGate}>
          <h2 className={styles.startTitle}>
            Peripheral View · {peripheralFieldLabel(field)}
          </h2>
          <p className={styles.startHint}>Tap the triangle to start · keep eyes on center</p>
          <button
            type="button"
            onClick={startGame}
            className={styles.startTriangleBtn}
            title="Tap triangle to start"
            aria-label="Tap triangle to start therapy session"
          >
            <svg className={styles.startTriangleSvg} viewBox="0 0 120 120" aria-hidden>
              <defs>
                <radialGradient id="pv-start-halo" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={DEFAULT_PERIPHERAL_FIXATION_COLOR} stopOpacity="0.55" />
                  <stop offset="45%" stopColor={DEFAULT_PERIPHERAL_FIXATION_COLOR} stopOpacity="0.2" />
                  <stop offset="100%" stopColor={DEFAULT_PERIPHERAL_FIXATION_COLOR} stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx="60" cy="62" r="54" fill="url(#pv-start-halo)" />
              <circle cx="60" cy="62" r="32" fill={DEFAULT_PERIPHERAL_FIXATION_COLOR} opacity="0.22" />
              <polygon
                points={fixationTrianglePointsAttribute(60, 62, 28)}
                fill={DEFAULT_PERIPHERAL_FIXATION_COLOR}
                stroke="#FFFFFF"
                strokeWidth="2"
                strokeLinejoin="round"
                opacity="0.95"
              />
              <polygon
                points={fixationTrianglePointsAttribute(60, 62, 15)}
                fill="#FFFFFF"
                opacity="0.98"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="text-xs sm:text-sm font-extrabold text-gray-300 hover:text-cyan-300 transition-colors cursor-pointer flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900/60 hover:bg-gray-800/90 border border-gray-700/80 shadow-md z-10"
          >
            <span>Edit Clinical Settings</span>
          </button>
        </div>
      ) : null}

      <div
        ref={containerRef}
        className={styles.hive}
        style={{ backgroundColor: engineBgColor }}
        onClick={handleBackgroundMiss}
        role="presentation"
      >
        {isLandscape && gameStarted && size.w > 0 ? (
          <svg className={styles.svg} width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`}>
            {cells.map((cell) => {
              const letter = activeMap[cell.id];
              const isActive = Boolean(letter);
              const isPopping = poppingIds.has(cell.id);
              const isWrong = wrongIds.has(cell.id);
              const paint = peripheralHexPaint({ bubbleType, isActive, stimulusColor });
              const hexR = peripheralHexRenderRadius(hexSizePx);
              return (
                <g
                  key={cell.id}
                  className={isPopping ? styles.popping : isWrong ? styles.wrong : undefined}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isActive) handleHexClick(cell.id);
                    else handleBackgroundMiss();
                  }}
                  style={{ cursor: isActive ? 'pointer' : 'default' }}
                >
                  <polygon
                    points={hexPointsAttribute(cell.cx, cell.cy, hexR)}
                    fill={paint.fill}
                    stroke={paint.stroke}
                    strokeWidth={paint.strokeWidth}
                    opacity={isActive ? 1 : 0.95}
                  />
                  {isActive ? (
                    <text
                      x={cell.cx}
                      y={cell.cy}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={
                        bubbleType === 'boundary'
                          ? peripheralLetterColor({ bubbleType, stimulusColor })
                          : letterColor
                      }
                      fontWeight={900}
                      style={{ fontSize: fontPx, pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {letter}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
        ) : null}

        {isLandscape && gameStarted ? (
          <div className={styles.hud} aria-hidden>
            Batch {Math.min(batchIndex + 1, batchesPerSession)}/{batchesPerSession} ·{' '}
            {Object.keys(activeMap).length} left
          </div>
        ) : null}
      </div>

      {isLandscape && gameStarted ? (
        <div className={styles.fabRow}>
          <button
            type="button"
            onClick={() => speakTarget(currentTarget)}
            className={styles.replayBtn}
            title="Replay target"
          >
            <ReplayIcon className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAssistiveTouchOpen((prev) => !prev);
              setIsHeaderExpanded(false);
            }}
            className={`${styles.targetFab} ${isAssistiveTouchOpen ? styles.targetFabOpen : ''}`}
            title="Current target — tap to open menu"
          >
            <span className={styles.targetFabGlyph} style={{ color: stimulusColor }}>
              {currentTarget || '—'}
            </span>
            <span className={styles.targetFabChevron}>
              <ChevronUpIcon className="w-2 h-2" size={8} />
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsHeaderExpanded((prev) => !prev);
              setIsAssistiveTouchOpen(false);
            }}
            className={styles.infoToggle}
            title={isHeaderExpanded ? 'Hide Info' : 'View Info'}
          >
            <span className={styles.infoToggleCaret}>{isHeaderExpanded ? '▼' : '▲'}</span>
            <span>{isHeaderExpanded ? 'Hide Info' : 'View Info'}</span>
          </button>
        </div>
      ) : isLandscape ? (
        <button
          type="button"
          onClick={openSettings}
          className="absolute bottom-3 right-4 z-40 w-11 h-11 bg-transparent border-0 flex items-center justify-center cursor-pointer active:scale-95 text-slate-400"
          title="Clinical settings"
        >
          <SlidersIcon className="w-[22px] h-[22px]" />
        </button>
      ) : null}

      {isLandscape && isAssistiveTouchOpen ? (
        <div className={styles.assistiveMenu}>
          <div className={styles.assistiveMenuHeader}>
            <span>Controls</span>
            <button type="button" onClick={() => setIsAssistiveTouchOpen(false)} aria-label="Close menu">
              ✕
            </button>
          </div>
          <button type="button" onClick={() => speakTarget(currentTarget)} className={styles.assistiveTargetCard}>
            <div className={styles.assistiveTargetLeft}>
              <span>Target:</span>
              <strong style={{ color: stimulusColor }}>{currentTarget || '—'}</strong>
            </div>
            <span className={styles.assistiveReplay}>
              <VolumeIcon className="w-3.5 h-3.5" /> Replay
            </span>
          </button>
          <button type="button" onClick={openSettings} className={styles.assistiveBtn}>
            <SlidersIcon className="w-4 h-4" />
            <span>Settings</span>
          </button>
          <button type="button" onClick={() => setConfirmReset(true)} className={styles.assistiveBtn}>
            Reset Session
          </button>
          <button
            type="button"
            onClick={() => {
              if (gameStarted && !isResultsOpen) setConfirmQuit(true);
              else {
                setIsAssistiveTouchOpen(false);
                if (onExit) onExit();
              }
            }}
            className={styles.assistiveQuit}
          >
            Quit Game
          </button>
        </div>
      ) : null}

      {isLandscape && isHeaderExpanded ? (
        <div className={styles.infoCard}>
          <div className={styles.infoCardHeader}>
            <div>
              <h2>Session & Clinical Info</h2>
              <p>{fieldTitle}</p>
            </div>
            <button type="button" onClick={() => setIsHeaderExpanded(false)} aria-label="Close info">
              ✕
            </button>
          </div>
          <div className={styles.infoSectionLabel}>Clinical parameters</div>
          <InfoRow label="Patient" value={patientName} />
          <InfoRow label="Hex size" value={`${hexSizePx}px`} accent="#60A5FA" />
          <InfoRow label="Stimuli / batch" value={String(stimuliCount)} accent="#60A5FA" />
          <InfoRow label="Batches" value={String(batchesPerSession)} />
          <InfoRow label="Letter size" value={String(letterSize)} accent="#60A5FA" />
          <InfoRow label="Target timer" value={targetTimeoutSec > 0 ? `${targetTimeoutSec}s` : 'Off'} />
          <InfoRow label="Bubble type" value={bubbleType === 'boundary' ? 'Boundary' : 'Solid'} />
          <div className={styles.infoDivider} />
          <div className={styles.infoSectionLabel}>Live metrics</div>
          <InfoRow label="Correct" value={String(correctCount)} accent="#34D399" />
          <InfoRow label="Wrong" value={String(wrongCount)} accent="#FB7185" />
          <InfoRow
            label="Batch"
            value={`${Math.min(batchIndex + 1, batchesPerSession)} / ${batchesPerSession}`}
          />
          {currentTarget ? <InfoRow label="Target" value={currentTarget} accent={stimulusColor} /> : null}
        </div>
      ) : null}

      <ResetConfirmDialog
        isOpen={confirmReset}
        confirmLabel="Reset Session"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          resetSession();
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

      <ClinicalSettingsModal
        isOpen={isSettingsOpen && (!sizeReady || isLandscape)}
        onClose={() => setIsSettingsOpen(false)}
        onApply={(newSettings: AppliedClinicalSettings) => {
          setPatientName(newSettings.patientName);
          if (newSettings.hexSizePx != null) setHexSizePx(clampHexSizePx(newSettings.hexSizePx));
          if (newSettings.stimuliCount != null) {
            setStimuliCount(clampStimuliCount(newSettings.stimuliCount, deviceTier));
          }
          if (newSettings.batchesPerSession != null) {
            setBatchesPerSession(clampBatchesPerSession(newSettings.batchesPerSession));
          }
          if (newSettings.stimulusColor) setStimulusColor(newSettings.stimulusColor);
          if (newSettings.bgColor) setEngineBgColor(newSettings.bgColor);
          if (newSettings.letterSize != null) setLetterSize(clampPeripheralLetterSize(newSettings.letterSize));
          if (newSettings.peripheralTargetTimeoutSec != null) {
            setTargetTimeoutSec(clampPeripheralTargetTimeoutSec(newSettings.peripheralTargetTimeoutSec));
          }
          if (newSettings.peripheralBubbleType) setBubbleType(newSettings.peripheralBubbleType);
          setNotification('Settings Applied Successfully!');
          setTimeout(() => setNotification(null), 2500);
          setIsSettingsOpen(false);
          requestFullScreenSafe();
        }}
        patientName={patientName}
        letterSize={letterSize}
        bubbleSize={hexSizePx}
        showLetterSizeControl={false}
        showPeripheralViewControls
        hexSizePx={hexSizePx}
        stimuliCount={stimuliCount}
        batchesPerSession={batchesPerSession}
        stimulusColor={stimulusColor}
        bgColor={engineBgColor}
        peripheralTargetTimeoutSec={targetTimeoutSec}
        peripheralBubbleType={bubbleType}
        sampleSymbol="A"
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

      {resultsData ? (
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
      ) : null}
    </div>
  );
}

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className={styles.infoRow}>
      <span>{label}</span>
      <strong style={{ color: accent || '#fff' }}>{value}</strong>
    </div>
  );
}
