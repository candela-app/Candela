import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  ALPHABETS,
  NUMBERS,
  THERAPY_COLORS,
  BubbleItem,
  BubblePosition,
  SortingVariant,
  SessionResultData,
  checkOverlap,
  getContrastColor,
  getMinDistancePercent,
} from '@candela/shared/rn';
import { ClinicalSettingsModal } from '../components/ClinicalSettingsModal';
import { GameMenuDrawer } from '../components/GameMenuDrawer';
import { GameResultsModal } from '../components/GameResultsModal';
import { hapticCorrect, hapticWrong } from '../lib/haptics';
import { useLayout } from '../lib/layout';
import { speak } from '../lib/speech';

export function SortingGame({ variant = 'uppercase', onExit }: { variant?: SortingVariant; onExit?: () => void }) {
  const { width, height, s, fs, isTablet } = useLayout();
  const [gameStarted, setGameStarted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [resultsData, setResultsData] = useState<SessionResultData | null>(null);
  const [patientName, setPatientName] = useState('Demo Patient');
  const [letterSize, setLetterSize] = useState(1.8);
  const [bubbleSize, setBubbleSize] = useState(90);
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

  const isMobileTab = !isTablet || Math.min(width, height) < 1024;

  const sequenceItems = useCallback(() => {
    if (variant === 'uppercase') return ALPHABETS.split('');
    if (variant === 'lowercase') return ALPHABETS.toLowerCase().split('');
    return NUMBERS.split('');
  }, [variant]);

  const getBatchPlan = useCallback(() => {
    if (variant === 'numbers') return isMobileTab ? [4, 4, 2] : [5, 5];
    return isMobileTab ? [4, 4, 4, 4, 4, 4, 2] : [5, 5, 5, 5, 6];
  }, [variant, isMobileTab]);

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
          color: THERAPY_COLORS[(startIdx + i) % THERAPY_COLORS.length],
          x: pos.x,
          y: pos.y,
        });
      });
      setBubbles(newBubbles);
    },
    [getBatchPlan, bubbleSize, playArea],
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
    spawnBatch(0, sequenceItems());
    speak(`Start sorting ${variant}`, { language: 'en-IN', rate: 0.85 });
  };

  const handleBubbleClick = (clickedBubble: BubbleItem) => {
    setClicks((prev) => prev + 1);
    const allItems = sequenceItems();
    const targetSymbol = allItems[expectedIndex];
    if (clickedBubble.symbol === targetSymbol) {
      void hapticCorrect();
      if (targetShownAt) setReactionTimes((prev) => [...prev, performance.now() - targetShownAt]);
      setTargetShownAt(performance.now());
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
            const avgReact = reactionTimes.length
              ? reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length / 1000
              : 0;
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
              avgReactionSec: parseFloat(avgReact.toFixed(2)),
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
  const target = allItems[expectedIndex] || '';
  const scaledBubble = Math.round(bubbleSize * Math.min(1.15, Math.max(0.75, playArea.w / 420)));
  const letterPx = Math.round(16 * letterSize * (scaledBubble / 90));

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A12' }}>
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
      <View style={{ position: 'absolute', top: s(48), alignSelf: 'center', zIndex: 10, backgroundColor: '#111827', paddingHorizontal: s(16), paddingVertical: s(8), borderRadius: s(12) }}>
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: fs(22) }}>{target}</Text>
      </View>
      <Pressable
        onPress={() => {
          if (gameStarted) {
            setClicks((prev) => prev + 1);
            setWrongCount((prev) => prev + 1);
            void hapticWrong();
          }
        }}
        onLayout={(e) => setPlayArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        style={{ flex: 1 }}
      >
        {bubbles.map((bubble) => (
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
              backgroundColor: bubble.color,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: poppingIds.has(bubble.id) ? 0.2 : 1,
              transform: [{ scale: wrongIds.has(bubble.id) ? 1.08 : 1 }],
            }}
          >
            <Text style={{ color: getContrastColor(bubble.color || '#fff'), fontWeight: '900', fontSize: letterPx }}>
              {bubble.symbol}
            </Text>
          </Pressable>
        ))}
      </Pressable>
      <Pressable onPress={() => setIsMenuOpen(true)} style={{ position: 'absolute', bottom: s(24), right: s(16), width: s(44), height: s(44), borderRadius: 22, backgroundColor: '#121626', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff' }}>☰</Text>
      </Pressable>
      <ClinicalSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onApply={(next) => {
          setPatientName(next.patientName);
          setLetterSize(next.letterSize);
          setBubbleSize(next.bubbleSize);
          setNotification('Settings Applied Successfully!');
          setTimeout(() => setNotification(null), 2500);
          setIsSettingsOpen(false);
        }}
        patientName={patientName}
        letterSize={letterSize}
        bubbleSize={bubbleSize}
      />
      {resultsData ? (
        <GameResultsModal
          isOpen={isResultsOpen}
          data={resultsData}
          onClose={() => {
            setIsResultsOpen(false);
            onExit?.();
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
        onQuit={() => onExit?.()}
        onReset={() => startGame()}
        onOpenSettings={() => setIsSettingsOpen(true)}
        settingsSummary={[
          { label: 'Patient', value: patientName },
          { label: 'Variant', value: variant },
        ]}
      />
    </View>
  );
}

const absoluteFill = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };
