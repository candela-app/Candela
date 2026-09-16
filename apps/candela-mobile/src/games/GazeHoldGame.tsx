import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import {
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
  resolveGazeHoldGlyphColor,
  type LookSample,
  useHowToPlayGate,
} from '@candela/shared/rn';
import { ClinicalSettingsModal, type AppliedClinicalSettings } from '../components/ClinicalSettingsModal';
import { ClickToStartOverlay } from '../components/ClickToStartOverlay';
import { HowToPlayManual } from '../components/HowToPlayManual';
import { GameMenuDrawer } from '../components/GameMenuDrawer';
import { LookTracker } from '../components/LookTracker';
import { SlidersIcon } from '../components/icons';
import { hapticCorrect, hapticMiss } from '../lib/haptics';
import { sessionDisplayName, useAuth } from '../lib/auth-context';
import { useGameSessionLock } from '../lib/use-game-session-lock';
import { useLayout } from '../lib/layout';

const POP_MS = 220;

type GazeHoldSettings = {
  patientName: string;
  dwellMs: number;
  glyphColor: string;
  glyphSizePx: number;
};

export function GazeHoldGame({ onExit }: { onExit: () => void }) {
  const { session } = useAuth();
  const { width, height, s } = useLayout();
  const { requestExit } = useGameSessionLock(onExit);
  useKeepAwake();
  const [settings, setSettings] = useState<GazeHoldSettings>({
    patientName: sessionDisplayName(session),
    dwellMs: LOOK_STATIONARY_DWELL_MS,
    glyphColor: LOOK_STATIONARY_COLOR,
    glyphSizePx: LOOK_STATIONARY_BUBBLE_PX,
  });
  const [started, setStarted] = useState(false);
  const [popping, setPopping] = useState(false);
  const [lookReady, setLookReady] = useState(false);
  const [lookError, setLookError] = useState<string | null>(null);
  const [faceLost, setFaceLost] = useState(true);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [bounds, setBounds] = useState({ width, height });
  const { showHowToPlay, howToPlayMode, isSettingsOpen, setIsSettingsOpen, finishHowToPlay, openHowToPlay, closeHowToPlay, playBlocked, isMenuOpen, setIsMenuOpen } =
    useHowToPlayGate();
  const [camActive, setCamActive] = useState(true);

  const sampleRef = useRef<LookSample>({ x: 0.5, y: 0.5, faceLost: true });
  const dwellRef = useRef(createLookDwellState());
  const poppingRef = useRef(false);
  const popTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bubbleX = bounds.width / 2;
  const bubbleY = bounds.height / 2;
  const playActive = started && !playBlocked;
  const showPlayfield = started && !isSettingsOpen && !showHowToPlay;
  const size = settings.glyphSizePx * (popping ? 0.2 : 1);
  const opacity = popping ? 0 : 1;

  useEffect(() => {
    const name = session?.user?.name?.trim();
    if (!name) return;
    setSettings((prev) => (prev.patientName === name ? prev : { ...prev, patientName: name }));
  }, [session?.user?.name]);

  useEffect(() => {
    return () => {
      if (popTimeoutRef.current) clearTimeout(popTimeoutRef.current);
    };
  }, []);

  const resetSession = useCallback((openSettings: boolean) => {
    if (popTimeoutRef.current) {
      clearTimeout(popTimeoutRef.current);
      popTimeoutRef.current = null;
    }
    dwellRef.current = createLookDwellState();
    poppingRef.current = false;
    setPopping(false);
    setCursor(null);
    setStarted(false);
    setIsMenuOpen(false);
    setIsSettingsOpen(openSettings);
  }, []);

  const beginPlay = useCallback(() => {
    sampleRef.current = { x: 0.5, y: 0.5, faceLost: false };
    setCursor({ x: bubbleX, y: bubbleY });
    dwellRef.current = createLookDwellState();
    poppingRef.current = false;
    setPopping(false);
    setStarted(true);
  }, [bubbleX, bubbleY]);

  const stopAndExit = useCallback(() => {
    setCamActive(false);
    requestExit();
  }, [requestExit]);

  useEffect(() => {
    if (!playActive || popping) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number): void => {
      const dtMs = now - last;
      last = now;
      const sample = sampleRef.current;
      if (!poppingRef.current && !sample.faceLost) {
        const lookX = sample.x * bounds.width;
        const lookY = sample.y * bounds.height;
        setCursor({ x: lookX, y: lookY });
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
          void hapticCorrect();
          popTimeoutRef.current = setTimeout(() => {
            dwellRef.current = createLookDwellState();
            poppingRef.current = false;
            setPopping(false);
          }, POP_MS);
        }
      } else if (sample.faceLost) {
        setCursor(null);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [
    playActive,
    popping,
    bounds.width,
    bounds.height,
    bubbleX,
    bubbleY,
    settings.glyphSizePx,
    settings.dwellMs,
  ]);

  return (
    <View
      style={{ flex: 1, backgroundColor: '#05070F' }}
      onLayout={(e) => setBounds({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {camActive ? (
        <LookTracker
          sampleRef={sampleRef}
          onReady={() => setLookReady(true)}
          onError={setLookError}
          onFaceLost={setFaceLost}
          active={camActive}
        />
      ) : null}
      {showPlayfield ? (
        <View
          onTouchStart={(e) => {
            if (!playActive) return;
            const tx = e.nativeEvent.locationX / Math.max(1, bounds.width);
            const ty = e.nativeEvent.locationY / Math.max(1, bounds.height);
            sampleRef.current = { x: tx, y: ty, faceLost: false };
            setCursor({ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY });
          }}
          onTouchMove={(e) => {
            if (!playActive) return;
            const tx = e.nativeEvent.locationX / Math.max(1, bounds.width);
            const ty = e.nativeEvent.locationY / Math.max(1, bounds.height);
            sampleRef.current = { x: tx, y: ty, faceLost: false };
            setCursor({ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY });
          }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      ) : null}
      {showPlayfield ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: settings.glyphColor,
            opacity,
            left: bubbleX - size / 2,
            top: bubbleY - size / 2,
          }}
        />
      ) : null}
      {showPlayfield && cursor ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 30,
            height: 30,
            borderRadius: 15,
            borderWidth: 2.5,
            borderColor: '#FFFFFF',
            backgroundColor: 'rgba(0, 243, 255, 0.4)',
            shadowColor: '#00F3FF',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.9,
            shadowRadius: 10,
            elevation: 8,
            left: cursor.x - 15,
            top: cursor.y - 15,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 40,
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#FFFFFF',
            }}
          />
        </View>
      ) : null}
      {lookError ? (
        <Text style={{ position: 'absolute', top: s(72), alignSelf: 'center', color: '#FDE68A', fontWeight: '700' }}>
          {lookError}
        </Text>
      ) : null}
      {showPlayfield && faceLost && !lookError ? (
        <Text style={{ position: 'absolute', top: s(72), alignSelf: 'center', color: '#FDE68A', fontWeight: '700' }}>
          Face the camera
        </Text>
      ) : null}
      {!started && !showHowToPlay && !isSettingsOpen && !isMenuOpen ? (
        <ClickToStartOverlay
          accentModuleId="computer_vision"
          title="Gaze Hold"
          hint={
            !lookReady && !lookError
              ? 'Camera starting… Look at the still bubble and hold your gaze to pop it.'
              : 'Look at the still bubble. Hold your gaze to pop it.'
          }
          onStart={beginPlay}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onExit={stopAndExit}
        />
      ) : null}
      <View
        style={{
          position: 'absolute',
          bottom: s(24),
          right: s(16),
          flexDirection: 'row',
          alignItems: 'center',
          gap: s(6),
          zIndex: 50,
        }}
      >
        {started ? (
          <Pressable
            onPress={() => {
              sampleRef.current = { x: 0.5, y: 0.5, faceLost: false };
              setCursor({ x: bubbleX, y: bubbleY });
              dwellRef.current = createLookDwellState();
            }}
            accessibilityRole="button"
            accessibilityLabel="Recalibrate center gaze"
            style={{
              width: s(44),
              height: s(44),
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
            }}
          >
            <Text style={{ color: '#94A3B8', fontSize: 18 }}>🎯</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => setIsMenuOpen(true)}
          style={{
            width: s(44),
            height: s(44),
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'transparent',
          }}
        >
          <SlidersIcon size={22} color="#94A3B8" />
        </Pressable>
      </View>
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
        showLetterSizeControl={false}
        showGazeHoldControls
        patientName={settings.patientName}
        letterSize={1.5}
        bubbleSize={settings.glyphSizePx}
        gazeHoldDwellMs={settings.dwellMs}
        gazeHoldGlyphColor={settings.glyphColor}
        onApply={(applied: AppliedClinicalSettings) => {
          setSettings((prev) => ({
            patientName: applied.patientName || prev.patientName,
            dwellMs: clampGazeHoldDwellMs(applied.gazeHoldDwellMs ?? prev.dwellMs),
            glyphColor: resolveGazeHoldGlyphColor(applied.gazeHoldGlyphColor ?? prev.glyphColor),
            glyphSizePx: clampGazeHoldGlyphSize(applied.bubbleSize || prev.glyphSizePx),
          }));
          resetSession(false);
        }}
        sessionLocked={started}
      />
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
        settingsSummary={[
          { label: 'Patient Name', value: settings.patientName },
          { label: 'Gaze Time', value: `${settings.dwellMs} ms` },
          { label: 'Glyph Color', value: gazeHoldColorLabel(settings.glyphColor) },
          { label: 'Glyph Size', value: `${settings.glyphSizePx}px` },
        ]}
      />
    </View>
  );
}
