import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  ALPHABETS,
  BubbleItem,
  BubblePosition,
  SortingVariant,
  SessionResultData,
  checkOverlap,
  getMinDistancePercent,
  getDeviceTier,
  DEFAULT_SORTING_NUMBER_FROM,
  DEFAULT_SORTING_NUMBER_TO,
  DEFAULT_STIMULI_BUBBLE_COLOR,
  DEFAULT_BUBBLE_APPEARANCE,
  sortingNumberSequence,
  sortingBatchPlan,
  clampSortingNumberRange,
  reactionStatsFromMs,
  resolveStimuliBubbleColor,
  resolveBubblePaint,
  stimuliColorLabel,
  bubbleAppearanceLabel,
  wheelColorLabel,
  type BubbleAppearance,
} from '@candela/shared/rn';
import { ClinicalSettingsModal } from '../components/ClinicalSettingsModal';
import { GameMenuDrawer } from '../components/GameMenuDrawer';
import { GameResultsModal } from '../components/GameResultsModal';
import { SlidersIcon } from '../components/icons';
import { hapticCorrect, hapticWrong } from '../lib/haptics';
import { sessionDisplayName, useAuth } from '../lib/auth-context';
import { useGameSessionLock } from '../lib/use-game-session-lock';
import { useLayout } from '../lib/layout';
import { speak } from '../lib/speech';

export function SortingGame({ variant = 'uppercase', onExit }: { variant?: SortingVariant; onExit?: () => void }) {
  const { session } = useAuth();
  const { width, height, s, fs, isTablet } = useLayout();
  const [gameStarted, setGameStarted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [resultsData, setResultsData] = useState<SessionResultData | null>(null);
  const [patientName, setPatientName] = useState(sessionDisplayName(session));
  const [letterSize, setLetterSize] = useState(1.8);
  const [bubbleSize, setBubbleSize] = useState(() => (isTablet ? 100 : 90));
  const [numberRangeFrom, setNumberRangeFrom] = useState(DEFAULT_SORTING_NUMBER_FROM);
  const [numberRangeTo, setNumberRangeTo] = useState(DEFAULT_SORTING_NUMBER_TO);
  const [stimuliColor, setStimuliColor] = useState(DEFAULT_STIMULI_BUBBLE_COLOR);
  const [bubbleAppearance, setBubbleAppearance] = useState<BubbleAppearance>(DEFAULT_BUBBLE_APPEARANCE);
  const [wheelColor, setWheelColor] = useState('#000000');
  const { requestExit } = useGameSessionLock(onExit);
  const [notification, setNotification] = useState<string | null>(null);
  const [bubbles, setBubbles] = useState<BubbleItem[]>([]);
  const [expectedIndex, setExpectedIndex] = useState(0);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [poppingIds, setPoppingIds] = useState<Set<string>>(new Set());
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());
  const [clicks, setClicks] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [targetShownAt, setTargetShownAt] = useState<number | null>(null);
  const [playArea, setPlayArea] = useState({ w: width, h: height });
  const reactionTimesRef = useRef<number[]>([]);
  const targetShownAtRef = useRef<number | null>(null);

  useEffect(() => {
    const name = session?.user.name?.trim();
    if (name) setPatientName(name);
  }, [session?.user.name]);

  const isMobileTab = !isTablet || Math.min(width, height) < 1024;

  const sequenceItems = useCallback(() => {
    if (variant === 'uppercase') return ALPHABETS.split('');
    if (variant === 'lowercase') return ALPHABETS.toLowerCase().split('');
    return sortingNumberSequence(numberRangeFrom, numberRangeTo);
  }, [variant, numberRangeFrom, numberRangeTo]);

  const getBatchPlan = useCallback(() => {
    if (variant === 'numbers') return sortingBatchPlan(sequenceItems().length, getDeviceTier(width, height));
    return isMobileTab ? [4, 4, 4, 4, 4, 4, 2] : [5, 5, 5, 5, 6];
  }, [variant, isMobileTab, sequenceItems, width, height]);

  const spawnBatch = useCallback(
    (batchIdx: number, allItems: string[]) => {
      const plan = getBatchPlan();
      let startIdx = 0;
      for (let i = 0; i < batchIdx && i < plan.length; i += 1) startIdx += plan[i];
      const count = plan[batchIdx] || 0;
      const batchItems = allItems.slice(startIdx, startIdx + count);
      const shuffled = [...batchItems].sort(() => Math.random() - 0.5);
      const newBubbles: BubbleItem[] = [];
      const positions: BubblePosition[] = [];
      const containerWidth = playArea.w;
      const containerHeight = playArea.h;
      const containerSize = Math.min(containerWidth, containerHeight);
      const minDistance = getMinDistancePercent(bubbleSize, containerSize, 2);
      const bubbleRadiusPercentX = Math.max(10, ((bubbleSize / 2 + 16) / containerWidth) * 100);
      const bubbleRadiusPercentY = Math.max(10, ((bubbleSize / 2 + 16) / containerHeight) * 100);
      const minX = bubbleRadiusPercentX;
      const maxX = 100 - bubbleRadiusPercentX;
      const minY = bubbleRadiusPercentY;
      const maxY = 100 - bubbleRadiusPercentY;

      shuffled.forEach((symbol, i) => {
        let pos: BubblePosition = { x: 50, y: 50 };
        let valid = false;
        for (let attempt = 0; attempt < 80; attempt += 1) {
          pos = { x: minX + Math.random() * (maxX - minX), y: minY + Math.random() * (maxY - minY) };
          if (!checkOverlap(pos, positions, minDistance)) {
            valid = true;
            break;
          }
        }
        if (!valid) {
          const cols = Math.ceil(Math.sqrt(count));
          const rows = Math.ceil(count / cols);
          const colIndex = i % cols;
          const rowIndex = Math.floor(i / cols);
          pos = {
            x: minX + (colIndex + 0.5) * ((maxX - minX) / Math.max(1, cols)),
            y: minY + (rowIndex + 0.5) * ((maxY - minY) / Math.max(1, rows)),
          };
        }
        positions.push(pos);
        newBubbles.push({
          id: `sort-bubble-${symbol}-${batchIdx}-${i}-${Math.random()}`,
          symbol,
          color: resolveStimuliBubbleColor(stimuliColor, startIdx + i),
          x: pos.x,
          y: pos.y,
        });
      });
      setBubbles(newBubbles);
      const shownAt = performance.now();
      targetShownAtRef.current = shownAt;
      setTargetShownAt(shownAt);
    },
    [getBatchPlan, bubbleSize, playArea, stimuliColor],
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
    targetShownAtRef.current = now;
    reactionTimesRef.current = [];
    setReactionTimes([]);
    spawnBatch(0, sequenceItems());
    speak(`Start sorting ${variant}`, { language: 'en-IN', rate: 0.85 });
  };

  const handleBubbleClick = (clickedBubble: BubbleItem) => {
    setClicks((prev) => prev + 1);
    const allItems = sequenceItems();
    const targetSymbol = allItems[expectedIndex];
    if (clickedBubble.symbol === targetSymbol) {
      void hapticCorrect();
      const shownAt = targetShownAtRef.current;
      const reactionMs = shownAt != null ? performance.now() - shownAt : null;
      if (reactionMs != null) {
        reactionTimesRef.current = [...reactionTimesRef.current, reactionMs];
        setReactionTimes(reactionTimesRef.current);
      }
      const nextShown = performance.now();
      targetShownAtRef.current = nextShown;
      setTargetShownAt(nextShown);
      setCorrectCount((prev) => prev + 1);
      setPoppingIds((prev) => new Set(prev).add(clickedBubble.id));
      setTimeout(() => {
        const nextIndex = expectedIndex + 1;
        setExpectedIndex(nextIndex);
        const remainingInCurrentBatch = bubbles.filter((b) => b.id !== clickedBubble.id);
        setBubbles(remainingInCurrentBatch);
        if (remainingInCurrentBatch.length === 0) {
          const plan = getBatchPlan();
          const nextBatch = currentBatchIndex + 1;
          if (nextBatch < plan.length && nextIndex < allItems.length) {
            setCurrentBatchIndex(nextBatch);
            setTimeout(() => spawnBatch(nextBatch, allItems), 300);
          } else if (nextIndex >= allItems.length) {
            const totalDuration = startTime ? (performance.now() - startTime) / 1000 : 0;
            const { avgSec } = reactionStatsFromMs(reactionTimesRef.current);
            setResultsData({
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
              avgReactionSec: avgSec,
            });
            setIsResultsOpen(true);
            setTimeout(() => setGameStarted(false), 500);
          }
        }
      }, 250);
    } else {
      void hapticWrong();
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

  const allItems = sequenceItems();
  const scaledBubble = bubbleSize;
  const letterPx = Math.round(16 * letterSize * (scaledBubble / 90));

  return (
    <View style={{ flex: 1, backgroundColor: wheelColor }}>
      {notification ? (
        <View style={{ position: 'absolute', top: s(48), right: s(16), zIndex: 40, backgroundColor: '#059669', padding: s(12), borderRadius: s(14) }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>✓ {notification}</Text>
        </View>
      ) : null}
      {!gameStarted && !isSettingsOpen && !isResultsOpen ? (
        <View style={{ ...absoluteFill, alignItems: 'center', justifyContent: 'center', zIndex: 20, backgroundColor: 'rgba(6,7,13,0.98)' }}>
          <Text style={{ color: '#fff', fontSize: fs(26), fontWeight: '900', marginBottom: s(12) }}>Sorting Module</Text>
          <Pressable onPress={startGame} style={{ backgroundColor: '#34D399', borderRadius: 999, paddingHorizontal: s(28), paddingVertical: s(16) }}>
            <Text style={{ fontWeight: '900', fontSize: fs(20) }}>Click to Start</Text>
          </Pressable>
        </View>
      ) : null}
      <Pressable
        onPress={() => {
          if (gameStarted) {
            setClicks((prev) => prev + 1);
            setWrongCount((prev) => prev + 1);
            void hapticWrong();
          }
        }}
        onLayout={(e) => setPlayArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        style={{ flex: 1, backgroundColor: wheelColor }}
      >
        {bubbles.map((bubble) => {
          const paint = resolveBubblePaint(bubbleAppearance, bubble.color || '#FFFFFF', {
            borderFill: 'transparent',
            solidBorderWidth: 0,
          });
          return (
          <Pressable
            key={bubble.id}
            onPress={(e) => {
              e.stopPropagation();
              handleBubbleClick(bubble);
            }}
            style={{
              position: 'absolute',
              left: `${bubble.x}%`,
              top: `${bubble.y}%`,
              width: scaledBubble,
              height: scaledBubble,
              marginLeft: -scaledBubble / 2,
              marginTop: -scaledBubble / 2,
              borderRadius: scaledBubble / 2,
              backgroundColor: paint.backgroundColor,
              borderWidth: paint.borderWidth,
              borderColor: paint.borderColor,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: poppingIds.has(bubble.id) ? 0.2 : 1,
              transform: [{ scale: wrongIds.has(bubble.id) ? 1.08 : 1 }],
            }}
          >
            <Text style={{ color: paint.textColor, fontWeight: '900', fontSize: letterPx }}>
              {bubble.symbol}
            </Text>
          </Pressable>
          );
        })}
      </Pressable>
      <Pressable
        onPress={() => setIsMenuOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Settings menu"
        style={{
          position: 'absolute',
          bottom: s(24),
          right: s(16),
          width: s(44),
          height: s(44),
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'transparent',
        }}
      >
        <SlidersIcon size={22} color="#94A3B8" />
      </Pressable>
      <ClinicalSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onApply={(next) => {
          const wasPlaying = gameStarted && !isResultsOpen;
          setPatientName(next.patientName);
          setLetterSize(next.letterSize);
          setBubbleSize(next.bubbleSize);
          if (next.numberRangeFrom != null && next.numberRangeTo != null) {
            const range = clampSortingNumberRange(next.numberRangeFrom, next.numberRangeTo);
            setNumberRangeFrom(range.from);
            setNumberRangeTo(range.to);
          }
          if (next.stimuliColor !== undefined) setStimuliColor(next.stimuliColor);
          if (next.bubbleAppearance !== undefined) setBubbleAppearance(next.bubbleAppearance);
          if (next.wheelColor !== undefined) setWheelColor(next.wheelColor);
          setNotification('Settings Applied Successfully!');
          setTimeout(() => setNotification(null), 2500);
          setIsSettingsOpen(false);
          if (wasPlaying) startGame();
        }}
        patientName={patientName}
        letterSize={letterSize}
        bubbleSize={bubbleSize}
        showStimuliColorPicker
        stimuliColor={stimuliColor}
        showBubbleAppearancePicker
        bubbleAppearance={bubbleAppearance}
        showWheelColorControl
        wheelColor={wheelColor}
        wheelColorTitle="Background Color"
        wheelColorHint="Background color of the sorting playfield."
        showNumberRangeControl={variant === 'numbers'}
        numberRangeFrom={numberRangeFrom}
        numberRangeTo={numberRangeTo}
        sessionLocked={gameStarted && !isResultsOpen}
      />
      {resultsData ? (
        <GameResultsModal
          isOpen={isResultsOpen}
          data={resultsData}
          onClose={() => {
            setIsResultsOpen(false);
            requestExit();
          }}
          onReplay={() => {
            setIsResultsOpen(false);
            startGame();
          }}
        />
      ) : null}
      <GameMenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onQuit={() => requestExit()}
        onReset={() => startGame()}
        onOpenSettings={() => setIsSettingsOpen(true)}
        sessionInProgress={gameStarted && !isResultsOpen}
        settingsSummary={[
          { label: 'Patient', value: patientName },
          { label: 'Variant', value: variant },
          { label: 'Stimuli Color', value: stimuliColorLabel(stimuliColor) },
          { label: 'Bubble Style', value: bubbleAppearanceLabel(bubbleAppearance) },
          {
            label: 'Background',
            value: (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: wheelColor,
                    borderWidth: 1,
                    borderColor: '#4B5563',
                  }}
                />
                <Text style={{ color: '#D1D5DB', fontSize: 11 }}>{wheelColorLabel(wheelColor)}</Text>
              </View>
            ),
          },
          ...(variant === 'numbers' ? [{ label: 'Range', value: `${numberRangeFrom}–${numberRangeTo}` }] : []),
        ]}
      />
    </View>
  );
}

const absoluteFill = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };
