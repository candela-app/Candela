import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DEFAULT_NUMBER_SEARCH_BG,
  DEFAULT_NUMBER_SEARCH_CHAR_COLOR,
  DEFAULT_NUMBER_SEARCH_LETTER_SIZE,
  DEFAULT_NUMBER_SEARCH_TARGET_DIGITS,
  DEFAULT_NUMBER_SEARCH_TIME_LIMIT_SEC,
  DEFAULT_NUMBER_SEARCH_LAYOUT,
  DEFAULT_NUMBER_SEARCH_FIELD_COUNT,
  NUMBER_SEARCH_DIGIT_SIZE_SCALE,
  getDeviceTier,
  numberSearchAccuracy,
  numberSearchDeviceDefaults,
  numberSearchFieldCountLabel,
  numberSearchLayoutLabel,
  packNumberSearchField,
  reactionStatsFromMs,
  type NumberSearchGlyph,
  type NumberSearchLayoutMode,
  type NumberSearchSessionResultData,
} from '@candela/shared/rn';
import { ClinicalSettingsModal, type AppliedClinicalSettings } from '../components/ClinicalSettingsModal';
import { ClickToStartOverlay } from '../components/ClickToStartOverlay';
import { GameMenuDrawer } from '../components/GameMenuDrawer';
import { GameResultsModal } from '../components/GameResultsModal';
import { SlidersIcon } from '../components/icons';
import { sessionDisplayName, useAuth } from '../lib/auth-context';
import { hapticCorrect, hapticMiss, hapticWrong } from '../lib/haptics';
import { useLayout } from '../lib/layout';
import { useGameSessionLock } from '../lib/use-game-session-lock';

export function NumberSearchGame({ onExit }: { onExit?: () => void }) {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const { width, height, s, fs } = useLayout();
  const deviceTier = useMemo(() => getDeviceTier(width, height), [width, height]);
  const defaults = useMemo(() => numberSearchDeviceDefaults(deviceTier), [deviceTier]);
  const { requestExit } = useGameSessionLock(onExit);

  const [gameStarted, setGameStarted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [resultsData, setResultsData] = useState<NumberSearchSessionResultData | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const [patientName, setPatientName] = useState(() => sessionDisplayName(session));
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

  const [glyphs, setGlyphs] = useState<NumberSearchGlyph[]>([]);
  const [poppingIds, setPoppingIds] = useState<Set<string>>(new Set());
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());
  const [playSize, setPlaySize] = useState({ w: 0, h: 0 });
  const [timeLeft, setTimeLeft] = useState(0);

  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [targetShownAt, setTargetShownAt] = useState<number | null>(null);
  const [durationSec, setDurationSec] = useState(0);

  const endingRef = useRef(false);
  const statsRef = useRef({
    clicks: 0,
    correct: 0,
    wrong: 0,
    reactions: [] as number[],
    digitsConfigured: 0,
  });
  const startTimeRef = useRef<number | null>(null);
  const settingsRef = useRef({
    patientName,
    letterSize,
    targetDigitCount,
    layoutMode,
    fieldCount,
    timeLimitSec,
    engineBgColor,
    charColor,
  });

  useEffect(() => {
    const name = session?.user.name?.trim();
    if (name) setPatientName(name);
  }, [session?.user.name]);

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
    };
  }, [patientName, letterSize, targetDigitCount, layoutMode, fieldCount, timeLimitSec, engineBgColor, charColor]);

  useEffect(() => {
    if (!gameStarted || startTime === null || isSettingsOpen || isMenuOpen || isResultsOpen) return;
    const interval = setInterval(() => {
      setDurationSec(Math.floor((performance.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [gameStarted, startTime, isSettingsOpen, isMenuOpen, isResultsOpen]);

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
      const reaction = reactionStatsFromMs(stats.reactions);
      const elapsed =
        startTimeRef.current != null
          ? Math.max(1, Math.floor((performance.now() - startTimeRef.current) / 1000))
          : durationSec;

      if (endedBy === 'cleared') {
        void hapticCorrect();
      }

      const data: NumberSearchSessionResultData = {
        patientName: cfg.patientName,
        sessionId: Date.now(),
        date: new Date().toLocaleDateString('en-GB'),
        gameName: 'Number Search',
        stimuliCount: stats.digitsConfigured,
        letterSize: cfg.letterSize,
        speed: cfg.timeLimitSec > 0 ? `${cfg.timeLimitSec}s` : 'Untimed',
        durationSec: elapsed,
        clicksTotal: stats.clicks,
        correct: stats.correct,
        wrong: stats.wrong,
        accuracy: numberSearchAccuracy(stats.correct, stats.wrong),
        avgReactionSec: reaction.avgSec,
        medianReactionSec: reaction.medianSec,
        targetDigitsConfigured: stats.digitsConfigured,
        digitsFound,
        digitsRemaining,
        timeLimitSec: cfg.timeLimitSec,
        endedBy,
        deviceTier,
      };

      setResultsData(data);
      setIsResultsOpen(true);
      setGameStarted(false);
      setTimeLeft(0);
    },
    [deviceTier, durationSec],
  );

  useEffect(() => {
    if (!gameStarted || isSettingsOpen || isResultsOpen || isMenuOpen) return;
    if (timeLimitSec <= 0) return;
    if (timeLeft <= 0) {
      finishSession('timeout');
      return;
    }
    const t = setTimeout(() => setTimeLeft((sec) => sec - 1), 1000);
    return () => clearTimeout(t);
  }, [
    gameStarted,
    isSettingsOpen,
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
      const w = playSize.w;
      const h = playSize.h;
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
    [playSize.w, playSize.h, letterSize, targetDigitCount, layoutMode, fieldCount],
  );

  const commitSettings = useCallback((newSettings: AppliedClinicalSettings) => {
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

    return {
      letterSize: nextLetter,
      targetDigitCount: nextDigits,
      layoutMode: nextLayout,
      fieldCount: nextField,
      timeLimitSec: nextTime,
    };
  }, [letterSize, targetDigitCount, layoutMode, fieldCount, timeLimitSec, engineBgColor, charColor]);

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
        reactions: [],
        digitsConfigured: digitTotal,
      };

      setGlyphs(packed);
      setPoppingIds(new Set());
      setWrongIds(new Set());
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
    },
    [populateField, timeLimitSec],
  );

  const handleGlyphPress = useCallback(
    (glyph: NumberSearchGlyph) => {
      if (!gameStarted || isResultsOpen || poppingIds.has(glyph.id)) return;

      const now = performance.now();
      statsRef.current.clicks += 1;

      if (glyph.isDigit) {
        void hapticCorrect();
        if (targetShownAt != null) {
          const rt = Math.max(0, Math.round(now - targetShownAt));
          statsRef.current.reactions.push(rt);
          setReactionTimes([...statsRef.current.reactions]);
        }
        setTargetShownAt(now);

        statsRef.current.correct += 1;
        setCorrectCount(statsRef.current.correct);
        setPoppingIds((prev) => new Set(prev).add(glyph.id));

        setTimeout(() => {
          setGlyphs((prev) => {
            const next = prev.filter((g) => g.id !== glyph.id);
            const stillDigits = next.some((g) => g.isDigit);
            if (!stillDigits) {
              setTimeout(() => finishSession('cleared'), 40);
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

      void hapticWrong();
      statsRef.current.wrong += 1;
      setWrongCount(statsRef.current.wrong);
      setWrongIds((prev) => new Set(prev).add(glyph.id));
      setTimeout(() => {
        setWrongIds((prev) => {
          const next = new Set(prev);
          next.delete(glyph.id);
          return next;
        });
      }, 300);
    },
    [gameStarted, isResultsOpen, poppingIds, targetShownAt, finishSession],
  );

  const handleBackgroundPress = useCallback(() => {
    if (!gameStarted || isResultsOpen) return;
    void hapticMiss();
  }, [gameStarted, isResultsOpen]);

  return (
    <View style={{ flex: 1, backgroundColor: engineBgColor }}>
      {notification ? (
        <View
          style={{
            position: 'absolute',
            top: insets.top + s(48),
            right: s(16),
            zIndex: 40,
            backgroundColor: '#059669',
            padding: s(12),
            borderRadius: s(14),
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>✓ {notification}</Text>
        </View>
      ) : null}

      {!gameStarted && !isSettingsOpen && !isResultsOpen ? (
        <ClickToStartOverlay
          title="Number Search"
          hint="Find and tap every digit hidden among mixed letters. Correct digits whoosh away — letters are wrong taps."
          onStart={startGame}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onExit={() => requestExit()}
        />
      ) : null}

      <Pressable
        onPress={handleBackgroundPress}
        onLayout={(e) =>
          setPlaySize({
            w: Math.floor(e.nativeEvent.layout.width),
            h: Math.floor(e.nativeEvent.layout.height),
          })
        }
        style={{ flex: 1, backgroundColor: engineBgColor }}
      >
        {gameStarted
          ? glyphs.map((glyph) => {
              const isPopping = poppingIds.has(glyph.id);
              const isWrong = wrongIds.has(glyph.id);
              const fontPx = Math.round(
                16 * letterSize * (glyph.isDigit ? NUMBER_SEARCH_DIGIT_SIZE_SCALE : 1),
              );
              return (
                <Pressable
                  key={glyph.id}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    handleGlyphPress(glyph);
                  }}
                  style={{
                    position: 'absolute',
                    left: glyph.x,
                    top: glyph.y,
                    transform: [
                      { translateX: -fontPx * 0.5 },
                      { translateY: -fontPx * 0.5 },
                      { scale: isWrong ? 1.08 : isPopping ? 1.4 : 1 },
                    ],
                    opacity: isPopping ? 0 : 1,
                  }}
                  accessibilityLabel={glyph.isDigit ? `Digit ${glyph.char}` : `Letter ${glyph.char}`}
                >
                  <Text
                    style={{
                      color: charColor,
                      fontSize: fontPx,
                      fontWeight: '900',
                    }}
                  >
                    {glyph.char}
                  </Text>
                </Pressable>
              );
            })
          : null}
      </Pressable>

      {gameStarted ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: insets.top + s(8),
            left: s(16),
            right: s(16),
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            zIndex: 20,
          }}
        >
          <Text style={{ color: '#94A3B8', fontSize: fs(12), fontWeight: '600', flex: 1, paddingRight: s(12) }}>
            {remainingDigits} digit{remainingDigits === 1 ? '' : 's'} left · {correctCount} found
            {wrongCount > 0 ? ` · ${wrongCount} wrong` : ''}
          </Text>
          <View
            style={{
              backgroundColor: timeLimitSec > 0 && timeLeft <= 10 ? '#B45309' : 'rgba(15,23,42,0.75)',
              borderRadius: 999,
              paddingHorizontal: s(12),
              paddingVertical: s(6),
              borderWidth: 1,
              borderColor: 'rgba(148,163,184,0.35)',
            }}
          >
            <Text style={{ color: '#F8FAFC', fontWeight: '800', fontSize: fs(13) }}>
              {timeLimitSec > 0 ? `${timeLeft}s` : `${durationSec}s`}
            </Text>
          </View>
        </View>
      ) : null}

      <Pressable
        onPress={() => setIsMenuOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Settings menu"
        style={{
          position: 'absolute',
          bottom: insets.bottom + s(24),
          right: s(16),
          width: s(44),
          height: s(44),
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 40,
        }}
      >
        <SlidersIcon size={22} color="#94A3B8" />
      </Pressable>

      <GameMenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onQuit={() => requestExit()}
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
          { label: 'Glyph Size', value: String(letterSize) },
          { label: 'Digits', value: String(targetDigitCount) },
          { label: 'Layout', value: numberSearchLayoutLabel(layoutMode) },
          { label: 'Field count', value: numberSearchFieldCountLabel(fieldCount) },
          {
            label: 'Time Limit',
            value: timeLimitSec > 0 ? `${timeLimitSec}s` : 'Off',
          },
          { label: 'Engine', value: engineBgColor },
          { label: 'Characters', value: charColor },
        ]}
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
        sessionLocked={gameStarted && !isResultsOpen}
      />

      {resultsData ? (
        <GameResultsModal
          isOpen={isResultsOpen}
          onClose={() => {
            setIsResultsOpen(false);
            requestExit();
          }}
          onReplay={() => {
            setIsResultsOpen(false);
            startGame();
          }}
          data={resultsData}
        />
      ) : null}
    </View>
  );
}
