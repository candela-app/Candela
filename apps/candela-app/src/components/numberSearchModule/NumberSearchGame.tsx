'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppliedClinicalSettings,
  ClinicalSettingsModal,
  DEFAULT_NUMBER_SEARCH_BG,
  DEFAULT_NUMBER_SEARCH_CHAR_COLOR,
  DEFAULT_NUMBER_SEARCH_LETTER_SIZE,
  DEFAULT_NUMBER_SEARCH_TARGET_DIGITS,
  DEFAULT_NUMBER_SEARCH_TIME_LIMIT_SEC,
  DEFAULT_NUMBER_SEARCH_LAYOUT,
  DEFAULT_NUMBER_SEARCH_FIELD_COUNT,
  NUMBER_SEARCH_DIGIT_SIZE_SCALE,
  getDeviceTier,
  numberSearchDeviceDefaults,
  numberSearchFieldCountLabel,
  numberSearchLayoutLabel,
  clinicalColorSessionFields,
  getContrastAdjustedColor,
  packNumberSearchField,
  playMissPressSoundAndHaptic,
  playSuccessSoundAndHaptic,
  playWhooshSoundAndHaptic,
  playWrongSoundAndHaptic,
  requestFullScreenSafe,
  type NumberSearchGlyph,
  type NumberSearchLayoutMode,
  type NumberSearchSessionResultData,
  useHowToPlayGate,
  usePauseShiftedClock,
  buildSessionMetrics,
  captureReactionMs,
} from '@candela/shared';
import { useAuth } from '@/lib/auth-context';
import { GameMenuDrawer } from '../shared/GameMenuDrawer';
import { FullscreenToggleButton } from '../shared/FullscreenToggleButton';
import { GameResultsModal } from '../shared/GameResultsModal';
import { useGameSessionLock } from '../shared/useGameSessionLock';
import { ClickToStartOverlay } from '../shared/ClickToStartOverlay';
import { HowToPlayManual } from '../shared/HowToPlayManual';
import { SlidersIcon } from '../icons/VectorIcons';
import styles from './NumberSearchGame.module.css';

interface NumberSearchGameProps {
  onExit?: () => void;
}

function sessionPatientName(session: { user?: { name?: string | null } } | null | undefined): string {
  const name = session?.user?.name?.trim();
  return name && name.length > 0 ? name : 'Demo Patient';
}

export function NumberSearchGame({ onExit }: NumberSearchGameProps) {
  const { session } = useAuth();
  const deviceTier = useMemo(() => getDeviceTier(), []);
  const defaults = useMemo(() => numberSearchDeviceDefaults(deviceTier), [deviceTier]);

  const [gameStarted, setGameStarted] = useState(false);
  const { showHowToPlay, howToPlayMode, isSettingsOpen, setIsSettingsOpen, finishHowToPlay, openHowToPlay, closeHowToPlay, playBlocked, isMenuOpen, setIsMenuOpen } = useHowToPlayGate();
  useGameSessionLock(true);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [resultsData, setResultsData] = useState<NumberSearchSessionResultData | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const [patientName, setPatientName] = useState(() => sessionPatientName(session));
  const [letterSize, setLetterSize] = useState(defaults.letterSize || DEFAULT_NUMBER_SEARCH_LETTER_SIZE);
  const [targetDigitCount, setTargetDigitCount] = useState(
    defaults.targetDigitCount || DEFAULT_NUMBER_SEARCH_TARGET_DIGITS,
  );
  const [layoutMode, setLayoutMode] = useState<NumberSearchLayoutMode>(
    defaults.layoutMode || DEFAULT_NUMBER_SEARCH_LAYOUT,
  );
  const [fieldCount, setFieldCount] = useState(
    defaults.fieldCount ?? DEFAULT_NUMBER_SEARCH_FIELD_COUNT,
  );
  const [timeLimitSec, setTimeLimitSec] = useState(DEFAULT_NUMBER_SEARCH_TIME_LIMIT_SEC);
  const [engineBgColor, setEngineBgColor] = useState(DEFAULT_NUMBER_SEARCH_BG);
  const [charColor, setCharColor] = useState(DEFAULT_NUMBER_SEARCH_CHAR_COLOR);
  const [contrastSensitivity, setContrastSensitivity] = useState(1);
  const displayCharColor = getContrastAdjustedColor(charColor, engineBgColor, contrastSensitivity);

  const [glyphs, setGlyphs] = useState<NumberSearchGlyph[]>([]);
  const [poppingIds, setPoppingIds] = useState<Set<string>>(new Set());
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [timeLeft, setTimeLeft] = useState(0);

  const [clicks, setClicks] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [targetShownAt, setTargetShownAt] = useState<number | null>(null);
  const [durationSec, setDurationSec] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const endingRef = useRef(false);
  const statsRef = useRef({
    clicks: 0,
    correct: 0,
    wrong: 0,
    misses: 0,
    reactions: [] as number[],
    digitsConfigured: 0,
  });
  const startTimeRef = useRef<number | null>(null);

  const sessionFrozen = playBlocked || isResultsOpen;
  usePauseShiftedClock(sessionFrozen, Boolean(gameStarted && startTime != null), (delta) => {
    setStartTime((prev) => (prev == null ? prev : prev + delta));
    if (startTimeRef.current != null) startTimeRef.current += delta;
    setTargetShownAt((prev) => (prev == null ? prev : prev + delta));
  }, startTime);
  const settingsRef = useRef({
    patientName,
    letterSize,
    targetDigitCount,
    layoutMode,
    fieldCount,
    timeLimitSec,
    engineBgColor,
    charColor,
    contrastSensitivity,
  });

  useEffect(() => {
    settingsRef.current = {
      patientName,
      letterSize,
      targetDigitCount,
      layoutMode,
      fieldCount,
      timeLimitSec,
      engineBgColor,
      charColor,
      contrastSensitivity,
    };
  }, [patientName, letterSize, targetDigitCount, layoutMode, fieldCount, timeLimitSec, engineBgColor, charColor, contrastSensitivity]);

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
    if (!gameStarted || startTime === null || playBlocked || isMenuOpen || isResultsOpen) return;
    const interval = setInterval(() => {
      setDurationSec(Math.max(0, Math.floor((performance.now() - startTime) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [gameStarted, startTime, playBlocked, isMenuOpen, isResultsOpen]);

  const remainingDigits = useMemo(
    () => glyphs.filter((g) => g.isDigit && !poppingIds.has(g.id)).length,
    [glyphs, poppingIds],
  );

  const finishSession = useCallback(
    (endedBy: 'cleared' | 'timeout') => {
      if (endingRef.current) return;
      endingRef.current = true;

      const stats = statsRef.current;
      const cfg = settingsRef.current;
      const digitsFound = stats.correct;
      const digitsRemaining = Math.max(0, stats.digitsConfigured - digitsFound);
      const elapsed =
        startTimeRef.current != null
          ? Math.max(1, Math.floor((performance.now() - startTimeRef.current) / 1000))
          : durationSec;

      if (endedBy === 'cleared') {
        playSuccessSoundAndHaptic();
      }

      const data: NumberSearchSessionResultData = {
        patientName: cfg.patientName,
        sessionId: Date.now(),
        date: new Date().toISOString(),
        gameName: 'Crowded Search',
        stimuliCount: stats.digitsConfigured,
        letterSize: cfg.letterSize,
        speed: cfg.timeLimitSec > 0 ? `${cfg.timeLimitSec}s` : 'Untimed',
        durationSec: elapsed,
        clicksTotal: stats.clicks,
        correct: stats.correct,
        ...buildSessionMetrics({
          correct: stats.correct,
          wrongTaps: stats.wrong,
          misses: stats.misses,
          timeouts: endedBy === 'timeout' ? digitsRemaining : 0,
          reactionMs: stats.reactions,
        }),
        targetDigitsConfigured: stats.digitsConfigured,
        digitsFound,
        digitsRemaining,
      timeLimitSec: cfg.timeLimitSec,
      endedBy,
      deviceTier,
      ...clinicalColorSessionFields(cfg.engineBgColor, cfg.charColor, cfg.contrastSensitivity),
    };

      setResultsData(data);
      setIsResultsOpen(true);
      setGameStarted(false);
      setTimeLeft(0);
    },
    [deviceTier, durationSec],
  );

  // Timed round countdown
  useEffect(() => {
    if (!gameStarted || playBlocked || isResultsOpen || isMenuOpen) return;
    if (timeLimitSec <= 0) return;
    if (timeLeft <= 0) {
      finishSession('timeout');
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [
    gameStarted,
    playBlocked,
    isResultsOpen,
    isMenuOpen,
    timeLimitSec,
    timeLeft,
    finishSession,
  ]);

  const populateField = useCallback(
    (overrides?: {
      letterSize?: number;
      targetDigitCount?: number;
      layoutMode?: NumberSearchLayoutMode;
      fieldCount?: number;
    }) => {
      const w = size.w || containerRef.current?.clientWidth || 0;
      const h = size.h || containerRef.current?.clientHeight || 0;
      if (w < 40 || h < 40) return [] as NumberSearchGlyph[];
      return packNumberSearchField({
        width: w,
        height: h,
        letterSizeRem: overrides?.letterSize ?? letterSize,
        targetDigitCount: overrides?.targetDigitCount ?? targetDigitCount,
        layoutMode: overrides?.layoutMode ?? layoutMode,
        fieldCount: overrides?.fieldCount ?? fieldCount,
        paddingTopPx: 64,
      });
    },
    [size.w, size.h, letterSize, targetDigitCount, layoutMode, fieldCount],
  );

  const commitSettings = useCallback(
    (newSettings: AppliedClinicalSettings) => {
      const nextLetter = newSettings.letterSize ?? letterSize;
      const nextDigits = newSettings.targetDigitCount ?? targetDigitCount;
      const nextLayout = newSettings.numberSearchLayout ?? layoutMode;
      const nextField = newSettings.numberSearchFieldCount ?? fieldCount;
      const nextTime = newSettings.timeLimitSec ?? timeLimitSec;
      const nextBg = newSettings.bgColor || engineBgColor;
      const nextChar = newSettings.shapeColor || charColor;

      setPatientName(newSettings.patientName);
      setLetterSize(nextLetter);
      setTargetDigitCount(nextDigits);
      setLayoutMode(nextLayout);
      setFieldCount(nextField);
      setTimeLimitSec(nextTime);
      setEngineBgColor(nextBg);
      setCharColor(nextChar);
      if (newSettings.contrastSensitivity != null) setContrastSensitivity(newSettings.contrastSensitivity);

      return {
        letterSize: nextLetter,
        targetDigitCount: nextDigits,
        layoutMode: nextLayout,
        fieldCount: nextField,
        timeLimitSec: nextTime,
      };
    },
    [letterSize, targetDigitCount, layoutMode, fieldCount, timeLimitSec, engineBgColor, charColor],
  );

  const startGame = useCallback(
    (overrides?: {
      letterSize?: number;
      targetDigitCount?: number;
      layoutMode?: NumberSearchLayoutMode;
      fieldCount?: number;
      timeLimitSec?: number;
    }) => {
      endingRef.current = false;
      const packed = populateField(overrides);
      const digitTotal = packed.filter((g) => g.isDigit).length;
      const limit = overrides?.timeLimitSec ?? timeLimitSec;

      if (packed.length === 0 || digitTotal === 0) {
        setNotification('Play field not ready — try again in a moment.');
        setTimeout(() => setNotification(null), 2500);
        return;
      }

      statsRef.current = {
        clicks: 0,
        correct: 0,
        wrong: 0,
        misses: 0,
        reactions: [],
        digitsConfigured: digitTotal,
      };

      setGlyphs(packed);
      setPoppingIds(new Set());
      setWrongIds(new Set());
      setClicks(0);
      setCorrectCount(0);
      setWrongCount(0);
      setReactionTimes([]);
      setDurationSec(0);
      setIsResultsOpen(false);
      setResultsData(null);

      const now = performance.now();
      setStartTime(now);
      startTimeRef.current = now;
      setTargetShownAt(now);
      setTimeLeft(limit > 0 ? limit : 0);
      setGameStarted(true);
      setIsSettingsOpen(false);
      requestFullScreenSafe();
    },
    [populateField, timeLimitSec],
  );

  const handleGlyphClick = useCallback(
    (glyph: NumberSearchGlyph, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!gameStarted || isResultsOpen || poppingIds.has(glyph.id)) return;

      const now = performance.now();
      statsRef.current.clicks += 1;
      setClicks((c) => c + 1);

      if (glyph.isDigit) {
        playWhooshSoundAndHaptic();
        if (targetShownAt != null) {
          const rt = captureReactionMs(now, targetShownAt);
          if (rt != null) {
            statsRef.current.reactions.push(rt);
            setReactionTimes([...statsRef.current.reactions]);
          }
        }
        setTargetShownAt(now);

        statsRef.current.correct += 1;
        setCorrectCount(statsRef.current.correct);

        setPoppingIds((prev) => new Set(prev).add(glyph.id));

        window.setTimeout(() => {
          setGlyphs((prev) => {
            const next = prev.filter((g) => g.id !== glyph.id);
            const stillDigits = next.some((g) => g.isDigit);
            if (!stillDigits) {
              // Defer finish so pop animation can start
              window.setTimeout(() => finishSession('cleared'), 40);
            }
            return next;
          });
          setPoppingIds((prev) => {
            const next = new Set(prev);
            next.delete(glyph.id);
            return next;
          });
        }, 220);
        return;
      }

      playWrongSoundAndHaptic();
      statsRef.current.wrong += 1;
      setWrongCount(statsRef.current.wrong);
      setWrongIds((prev) => new Set(prev).add(glyph.id));
      window.setTimeout(() => {
        setWrongIds((prev) => {
          const next = new Set(prev);
          next.delete(glyph.id);
          return next;
        });
      }, 300);
    },
    [gameStarted, isResultsOpen, poppingIds, targetShownAt, finishSession],
  );

  const handleBackgroundClick = useCallback(() => {
    if (!gameStarted || isResultsOpen) return;
    playMissPressSoundAndHaptic();
    statsRef.current.misses += 1;
  }, [gameStarted, isResultsOpen]);

  const avgReactionMs =
    reactionTimes.length > 0
      ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
      : 0;

  return (
    <div className={styles.shell} style={{ backgroundColor: engineBgColor }}>
      {notification ? <div className={styles.toast}>✓ {notification}</div> : null}

      {!gameStarted && !showHowToPlay && !isSettingsOpen && !isResultsOpen ? (
        <ClickToStartOverlay
          title="Crowded Search"
          hint="Find and tap every digit hidden among mixed letters. Correct digits whoosh away — letters are misses."
          onStart={startGame}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onExit={onExit}
        />
      ) : null}

      <div
        ref={containerRef}
        className={styles.playField}
        style={{ backgroundColor: engineBgColor }}
        onClick={handleBackgroundClick}
      >
        {gameStarted
          ? glyphs.map((glyph) => {
              const isPopping = poppingIds.has(glyph.id);
              const isWrong = wrongIds.has(glyph.id);
              return (
                <button
                  key={glyph.id}
                  type="button"
                  className={`${styles.glyph} ${isPopping ? styles.glyphPop : ''} ${isWrong ? styles.glyphShake : ''}`}
                  style={{
                    left: glyph.x,
                    top: glyph.y,
                    fontSize: `${glyph.isDigit ? letterSize * NUMBER_SEARCH_DIGIT_SIZE_SCALE : letterSize}rem`,
                    color: displayCharColor,
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                  }}
                  onClick={(e) => handleGlyphClick(glyph, e)}
                  aria-label={glyph.isDigit ? `Digit ${glyph.char}` : `Letter ${glyph.char}`}
                >
                  {glyph.char}
                </button>
              );
            })
          : null}
      </div>

      {gameStarted ? (
        <div className={styles.hud}>
          <div className={styles.hudLeft}>
            <p className={styles.hudSub}>
              {remainingDigits} digit{remainingDigits === 1 ? '' : 's'} left · {correctCount} found
              {wrongCount > 0 ? ` · ${wrongCount} misses` : ''}
            </p>
          </div>
          <div className={styles.hudRight}>
            {timeLimitSec > 0 ? (
              <span className={`${styles.chip} ${styles.chipAccent} ${timeLeft <= 10 ? styles.chipLow : ''}`}>
                {timeLeft}s
              </span>
            ) : (
              <span className={styles.chip}>{durationSec}s</span>
            )}
          </div>
        </div>
      ) : null}

      <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-40 flex items-center gap-2">
        <FullscreenToggleButton />
        <button
          type="button"
          className={styles.menuBtn}
          onClick={() => setIsMenuOpen(true)}
          title="Settings menu"
        >
          <SlidersIcon className="w-5 h-5" />
        </button>
      </div>

      <GameMenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onOpenHowToPlay={openHowToPlay}
        onQuit={() => {
          if (onExit) onExit();
        }}
        onReset={() => {
          setGameStarted(false);
          setGlyphs([]);
          endingRef.current = false;
          setIsSettingsOpen(true);
        }}
        resetButtonLabel="Reset Game"
        onOpenSettings={() => setIsSettingsOpen(true)}
        sessionInProgress={gameStarted && !isResultsOpen}
        settingsSummary={[
          { label: 'Patient', value: patientName },
          { label: 'Glyph Size', value: <span className="text-amber-400 font-bold">{letterSize}</span> },
          { label: 'Digits', value: <span className="text-amber-400 font-bold">{targetDigitCount}</span> },
          {
            label: 'Layout',
            value: <span className="text-amber-400 font-bold">{numberSearchLayoutLabel(layoutMode)}</span>,
          },
          {
            label: 'Field count',
            value: (
              <span className="text-amber-400 font-bold">{numberSearchFieldCountLabel(fieldCount)}</span>
            ),
          },
          {
            label: 'Time Limit',
            value:
              timeLimitSec > 0 ? (
                <span className="text-amber-400 font-bold">{timeLimitSec}s</span>
              ) : (
                <span className="text-emerald-400 font-bold">Off</span>
              ),
          },
          { label: 'Engine', value: engineBgColor },
          { label: 'Characters', value: charColor },
          { label: 'Contrast', value: `${Math.round(contrastSensitivity * 100)}%` },
        ]}
      />

      <HowToPlayManual
        moduleId="number_search"
        isOpen={showHowToPlay}
        mode={howToPlayMode}
        onContinue={finishHowToPlay}
        onClose={closeHowToPlay}
      />
      <ClinicalSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onApply={(newSettings) => {
          const wasPlaying = gameStarted && !isResultsOpen;
          const next = commitSettings(newSettings);
          setNotification('Settings Applied Successfully!');
          setTimeout(() => setNotification(null), 2500);
          setIsSettingsOpen(false);
          requestFullScreenSafe();
          if (wasPlaying) startGame(next);
        }}
        patientName={patientName}
        letterSize={letterSize}
        bubbleSize={80}
        showLetterSizeControl={false}
        showNumberSearchControls
        sampleSymbol="7"
        targetDigitCount={targetDigitCount}
        numberSearchLayout={layoutMode}
        numberSearchFieldCount={fieldCount}
        timeLimitSec={timeLimitSec}
        bgColor={engineBgColor}
        shapeColor={charColor}
        contrastSensitivity={contrastSensitivity}
        sessionLocked={gameStarted && !isResultsOpen}
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
