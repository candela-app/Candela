'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppliedClinicalSettings,
  ClinicalSettingsModal,
  LOOK_STATIONARY_BUBBLE_PX,
  LOOK_STATIONARY_COLOR,
  LOOK_STATIONARY_DWELL_MS,
  LOOK_STATIONARY_HIT_PADDING_PX,
  advanceLookDwell,
  clampGazeHoldDwellMs,
  clampGazeHoldGlyphSize,
  createLookDwellState,
  gazeHoldColorLabel,
  lookHitsBubble,
  playCorrectSoundAndHaptic,
  playMissPressSoundAndHaptic,
  resolveGazeHoldGlyphColor,
  useHowToPlayGate,
} from '@candela/shared';
import { sessionDisplayName, useAuth } from '@/lib/auth-context';
import { useFaceLook } from '@/lib/use-face-look';
import { useGameSessionLock } from '../shared/useGameSessionLock';
import { ClickToStartOverlay } from '../shared/ClickToStartOverlay';
import { HowToPlayManual } from '../shared/HowToPlayManual';
import { GameMenuDrawer, type ClinicalSettingSummaryItem } from '../shared/GameMenuDrawer';
import { SlidersIcon } from '../icons/VectorIcons';
import styles from './LookPursuitGame.module.css';

const POP_MS = 220;

type GazeHoldSettings = {
  patientName: string;
  dwellMs: number;
  glyphColor: string;
  glyphSizePx: number;
};

export function GazeHoldGame({ onExit }: { onExit: () => void }) {
  const { session } = useAuth();
  const [camActive, setCamActive] = useState(true);
  const look = useFaceLook(camActive);
  const containerRef = useRef<HTMLDivElement>(null);
  const dwellRef = useRef(createLookDwellState());
  const poppingRef = useRef(false);
  const popTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [settings, setSettings] = useState<GazeHoldSettings>(() => ({
    patientName: sessionDisplayName(session),
    dwellMs: LOOK_STATIONARY_DWELL_MS,
    glyphColor: LOOK_STATIONARY_COLOR,
    glyphSizePx: LOOK_STATIONARY_BUBBLE_PX,
  }));
  const [started, setStarted] = useState(false);
  const [popping, setPopping] = useState(false);
  const { showHowToPlay, howToPlayMode, isSettingsOpen, setIsSettingsOpen, finishHowToPlay, openHowToPlay, closeHowToPlay, playBlocked, isMenuOpen, setIsMenuOpen } =
    useHowToPlayGate();
  const [bounds, setBounds] = useState({ width: 1024, height: 768 });
  useGameSessionLock(true);

  useEffect(() => {
    const name = session?.user?.name?.trim();
    if (!name) return;
    setSettings((prev) => (prev.patientName === name ? prev : { ...prev, patientName: name }));
  }, [session?.user?.name]);

  const measure = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    const width = rect && rect.width > 100 ? rect.width : window.innerWidth;
    const height = rect && rect.height > 100 ? rect.height : window.innerHeight;
    setBounds({ width: Math.max(300, width), height: Math.max(300, height) });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  useEffect(() => {
    return () => {
      if (popTimeoutRef.current) clearTimeout(popTimeoutRef.current);
    };
  }, []);

  const bubbleX = bounds.width / 2;
  const bubbleY = bounds.height / 2;
  const playActive = started && !playBlocked;
  const showPlayfield = started && !isSettingsOpen && !showHowToPlay;

  const resetSession = useCallback((openSettings: boolean) => {
    if (popTimeoutRef.current) {
      clearTimeout(popTimeoutRef.current);
      popTimeoutRef.current = null;
    }
    dwellRef.current = createLookDwellState();
    poppingRef.current = false;
    setPopping(false);
    setStarted(false);
    setIsMenuOpen(false);
    setIsSettingsOpen(openSettings);
  }, []);

  const beginPlay = useCallback(() => {
    measure();
    look.recalibrateCenter();
    dwellRef.current = createLookDwellState();
    poppingRef.current = false;
    setPopping(false);
    setStarted(true);
  }, [measure, look]);

  const stopAndExit = useCallback(() => {
    setCamActive(false);
    onExit();
  }, [onExit]);

  useEffect(() => {
    if (!playActive || popping) {
      return;
    }
    let raf = 0;
    let last = performance.now();
    const loop = (now: number): void => {
      const dtMs = now - last;
      last = now;
      if (!poppingRef.current) {
        const sample = look.sampleRef.current;
        if (!sample.faceLost) {
          const lookX = sample.x * bounds.width;
          const lookY = sample.y * bounds.height;
          const over = lookHitsBubble(
            lookX,
            lookY,
            bubbleX,
            bubbleY,
            settings.glyphSizePx,
            LOOK_STATIONARY_HIT_PADDING_PX + 24,
          )
            ? 'target'
            : null;
          const fired = advanceLookDwell(dwellRef.current, over, dtMs, settings.dwellMs);
          if (fired) {
            poppingRef.current = true;
            setPopping(true);
            playCorrectSoundAndHaptic();
            popTimeoutRef.current = setTimeout(() => {
              dwellRef.current = createLookDwellState();
              poppingRef.current = false;
              setPopping(false);
            }, POP_MS);
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [
    playActive,
    popping,
    look.sampleRef,
    bounds.width,
    bounds.height,
    bubbleX,
    bubbleY,
    settings.glyphSizePx,
    settings.dwellMs,
  ]);

  const handleApplyClinicalSettings = (applied: AppliedClinicalSettings): void => {
    setSettings((prev) => ({
      patientName: applied.patientName || prev.patientName,
      dwellMs: clampGazeHoldDwellMs(applied.gazeHoldDwellMs ?? prev.dwellMs),
      glyphColor: resolveGazeHoldGlyphColor(applied.gazeHoldGlyphColor ?? prev.glyphColor),
      glyphSizePx: clampGazeHoldGlyphSize(applied.bubbleSize || prev.glyphSizePx),
    }));
    resetSession(false);
  };

  const lookPx =
    look.cursor && !look.faceLost
      ? { x: look.cursor.x * bounds.width, y: look.cursor.y * bounds.height }
      : null;

  const settingsSummary: ClinicalSettingSummaryItem[] = [
    { label: 'Patient Name', value: settings.patientName },
    { label: 'Gaze Time', value: `${settings.dwellMs} ms` },
    { label: 'Glyph Color', value: gazeHoldColorLabel(settings.glyphColor) },
    { label: 'Glyph Size', value: `${settings.glyphSizePx}px` },
  ];

  return (
    <div ref={containerRef} className={styles.gameContainer}>
      <video id="look-pursuit-cam" ref={look.videoRef} className={styles.preview} muted playsInline />
      {!started && !showHowToPlay && !isSettingsOpen && !isMenuOpen ? (
        <ClickToStartOverlay
          accentModuleId="computer_vision"
          title="Gaze Hold"
          hint="Look at the still bubble. Hold your gaze to pop it."
          onStart={beginPlay}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onExit={stopAndExit}
        />
      ) : null}
      {look.error ? <div className={styles.faceLost}>{look.error}</div> : null}
      {playActive && look.faceLost && !look.error ? <div className={styles.faceLost}>Face the camera</div> : null}

      <div
        className={styles.canvas}
        onClick={() => {
          if (playActive) playMissPressSoundAndHaptic();
        }}
      >
        {showPlayfield ? (
          <div
            className={`${styles.targetBubble}${popping ? ` ${styles.gazeHoldPop}` : ''}`}
            style={{
              left: `${bubbleX}px`,
              top: `${bubbleY}px`,
              width: `${settings.glyphSizePx}px`,
              height: `${settings.glyphSizePx}px`,
              backgroundColor: settings.glyphColor,
              pointerEvents: 'none',
            }}
          />
        ) : null}
        {showPlayfield && lookPx ? (
          <div className={styles.lookCursor} style={{ left: lookPx.x, top: lookPx.y }} />
        ) : null}
      </div>

      <div className="absolute bottom-6 right-4 z-50 flex items-center gap-2">
        {started ? (
          <button
            type="button"
            onClick={() => {
              look.recalibrateCenter();
              dwellRef.current = createLookDwellState();
            }}
            className="w-11 h-11 flex items-center justify-center cursor-pointer active:scale-95 text-slate-400 hover:text-cyan-400 bg-transparent border-0"
            title="Recalibrate Center Gaze"
            aria-label="Recalibrate Center Gaze"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" strokeWidth="2" />
              <path strokeWidth="2" d="M12 3v4m0 10v4m-9-9h4m10 0h4m-7 0a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setIsMenuOpen(true)}
          className="w-11 h-11 flex items-center justify-center cursor-pointer active:scale-95 text-slate-300 bg-transparent border-0"
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
          setIsMenuOpen(false);
          stopAndExit();
        }}
        onReset={() => resetSession(true)}
        onOpenSettings={() => {
          setIsMenuOpen(false);
          setIsSettingsOpen(true);
        }}
        resetButtonLabel="Restart Session"
        sessionInProgress={started}
        settingsSummary={settingsSummary}
      />

      <HowToPlayManual
        moduleId="computer_vision"
        isOpen={showHowToPlay}
        mode={howToPlayMode}
        onContinue={finishHowToPlay}
        onClose={closeHowToPlay}
      />
      <ClinicalSettingsModal
        accentModuleId="computer_vision"
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onApply={handleApplyClinicalSettings}
        patientName={settings.patientName}
        letterSize={1.5}
        bubbleSize={settings.glyphSizePx}
        showLetterSizeControl={false}
        showGazeHoldControls
        gazeHoldDwellMs={settings.dwellMs}
        gazeHoldGlyphColor={settings.glyphColor}
        sessionLocked={started}
      />
    </div>
  );
}
