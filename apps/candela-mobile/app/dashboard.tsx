import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import LottieView from 'lottie-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  CATALOG_TO_UI_MODULE,
  ALL_MODULE_IDS,
  GAME_CATALOG,
  GAME_FAMILIES,
  PEDIATRIC_GAME_FAMILIES,
  levelsForTherapyModule,
  GEOBOARD_BOARD_IDS,
  GEOBOARD_BOARDS,
  MODULE_LEVELS,
  UI_MODULE_TO_CATALOG,
  directionSensePrescribedAllows,
  resolveAllowedModuleIds,
  familyForModuleId,
  getGameFamily,
  isTherapyFamilyId,
  buildGameSessionAnalytics,
  consistencyStreak,
  type GeoboardBoardId,
} from '@candela/shared/rn';
import { AnalyticsIcon, ArrowRightIcon, CloseIcon, CreditCardIcon, EyeIcon, GearIcon, HistoryIcon, InfoIcon, LayoutDashboardIcon, LogOutIcon, SideDockIcon, SortOrderIcon, UserIcon } from '../src/components/icons';
import { AppHeader } from '../src/components/AppHeader';
import { CopyDocId } from '../src/components/CopyDocId';
import { DocIdRequestCard } from '../src/components/DocIdRequestCard';
import { DropdownField, SessionAnalyticsPanel } from '../src/components/SessionAnalyticsPanel';
import { ScreenLoader } from '../src/components/ScreenLoader';
import { EditPatientNameModal } from '../src/components/EditPatientNameModal';
import { useAuth } from '../src/lib/auth-context';
import { listMyGameSessions, type StoredGameSessionRecord } from '../src/lib/api';
import { useLayout } from '../src/lib/layout';
import { colors } from '../src/lib/theme';

function OpenHint({ children }: { children: ReactNode }) {
  const tilt = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;

    const cycle = () => {
      if (cancelled) return;
      const pause = 500 + Math.random() * 2500;
      Animated.sequence([
        Animated.timing(tilt, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(tilt, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(tilt, { toValue: 0.45, duration: 160, useNativeDriver: true }),
        Animated.timing(tilt, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.delay(pause),
      ]).start(({ finished }) => {
        if (finished && !cancelled) cycle();
      });
    };

    const startTimer = setTimeout(cycle, Math.random() * 1800);

    return () => {
      cancelled = true;
      clearTimeout(startTimer);
      tilt.stopAnimation();
    };
  }, [tilt]);

  const shift = tilt.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 4],
  });

  return (
    <Animated.View style={{ transform: [{ translateX: shift }] }}>
      {children}
    </Animated.View>
  );
}

function PrescribedCount({
  count,
  line,
  fontSize,
  shift,
}: {
  count: number;
  line: number;
  fontSize: number;
  shift: Animated.Value;
}) {
  if (count <= 0) {
    return (
      <Text
        style={{
          flexShrink: 0,
          fontSize,
          fontWeight: '600',
          color: '#4B5563',
          backgroundColor: '#F3F4F6',
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        0
      </Text>
    );
  }

  const digits = String(count).split('').map((value) => Number(value));

  return (
    <View
      style={{
        flexShrink: 0,
        flexDirection: 'row',
        height: line,
        overflow: 'hidden',
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 8,
        borderRadius: 999,
      }}
    >
      {digits.map((digit, index) => {
        const cells = [digit, ...Array.from({ length: 10 }, (_, cell) => cell % 10), digit];
        const travel = shift.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -(cells.length - 1) * line],
        });
        return (
          <View key={index} style={{ height: line, overflow: 'hidden' }}>
            <Animated.View style={{ transform: [{ translateY: travel }] }}>
              {cells.map((value, cell) => (
                <Text
                  key={cell}
                  style={{ height: line, lineHeight: line, fontSize, fontWeight: '600', color: colors.blue, textAlign: 'center' }}
                >
                  {value}
                </Text>
              ))}
            </Animated.View>
          </View>
        );
      })}
    </View>
  );
}

function ShineLabel({
  children,
  fontSize,
  active,
  gleam,
}: {
  children: string;
  fontSize: number;
  active: boolean;
  gleam: Animated.Value | null;
}) {
  const resting = active ? '#111827' : '#6B7280';
  if (!gleam) {
    return (
      <Text numberOfLines={1} style={{ flexShrink: 1, fontSize, fontWeight: '600', color: resting }}>
        {children}
      </Text>
    );
  }

  const color = gleam.interpolate({
    inputRange: [0, 1],
    outputRange: [resting, '#2563EB'],
  });

  return (
    <Animated.Text numberOfLines={1} style={{ flexShrink: 1, fontSize, fontWeight: '600', color }}>
      {children}
    </Animated.Text>
  );
}

function PracticeTabCue({
  label,
  count,
  active,
  fontSize,
  countSize,
  line,
}: {
  label: string;
  count: number;
  active: boolean;
  fontSize: number;
  countSize: number;
  line: number;
}) {
  const shift = useRef(new Animated.Value(0)).current;
  const gleam = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (count <= 0) return;
    let cancelled = false;
    const cycle = () => {
      if (cancelled) return;
      const wait = setTimeout(() => {
        if (cancelled) return;
        shift.setValue(0);
        gleam.setValue(0);
        Animated.timing(gleam, {
          toValue: 1,
          duration: 880,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();
        Animated.timing(shift, {
          toValue: 1,
          duration: 880,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (!finished || cancelled) return;
          shift.setValue(0);
          Animated.timing(gleam, { toValue: 0, duration: 220, useNativeDriver: false }).start(({ finished: settled }) => {
            if (settled && !cancelled) cycle();
          });
        });
      }, 900 + Math.random() * 1200);
      return wait;
    };
    const startTimer = cycle();
    return () => {
      cancelled = true;
      clearTimeout(startTimer);
      shift.stopAnimation();
      gleam.stopAnimation();
    };
  }, [count, gleam, line, shift]);

  return (
    <>
      <ShineLabel fontSize={fontSize} active={active} gleam={count > 0 ? gleam : null}>
        {label}
      </ShineLabel>
      <PrescribedCount count={count} line={line} fontSize={countSize} shift={shift} />
    </>
  );
}

type ModuleCard = {
  uiId: string;
  title: string;
  body: string;
  badge: string;
  accent: string;
  bar: string;
};

const MODULE_CARDS: ModuleCard[] = [
  { uiId: 'wheel', title: 'Rotatory Module', body: 'Moving visual search and tap on a spinning wheel', badge: 'For Tabs', accent: '#1D4ED8', bar: '#3B82F6' },
  { uiId: 'sorting', title: 'Sorting Module', body: 'Visual discrimination & sequential recognition', badge: 'For Tabs & Mobile', accent: '#7C3AED', bar: '#8B5CF6' },
  { uiId: 'tracing', title: 'Bee Path Tracing', body: 'Smooth pursuit tracking & visual-motor path control', badge: 'For Touch & Stylus', accent: '#D97706', bar: '#F59E0B' },
  { uiId: 'pursuit', title: 'Pursuit Module', body: 'Continuous visual pursuit & selective attention tracking', badge: 'For All Devices', accent: '#0891B2', bar: '#22D3EE' },
  { uiId: 'mobile_target', title: 'Bubble Chase', body: '2-target bouncing pursuit & dark field tracking', badge: 'For Mobile & Tabs', accent: '#059669', bar: '#34D399' },
  { uiId: 'geoboard', title: 'Draw a Pattern', body: 'Hand-eye coordination & visual spatial recall patterns', badge: 'For All Devices', accent: '#0D9488', bar: '#14B8A6' },
  { uiId: 'peripheral', title: 'Peripheral View', body: 'Hex-hive peripheral field awareness — left, right, or both', badge: 'Landscape only', accent: '#4338CA', bar: '#818CF8' },
  { uiId: 'number_search', title: 'Crowded Search', body: 'Find digits hidden in a crowded field of mixed letters', badge: 'For All Devices', accent: '#B45309', bar: '#F59E0B' },
  { uiId: 'pattern_match', title: 'Hold the Code', body: 'Hold a flashed code and tap every exact match', badge: 'For All Devices', accent: '#BE123C', bar: '#FB7185' },
  { uiId: 'location_memory', title: 'Location Memory', body: 'Explore a grid, then recall where each number was', badge: 'For All Devices', accent: '#D97706', bar: '#FBBF24' },
  { uiId: 'direction_sense', title: 'Direction Sense', body: 'Face & Flip: pick the 90° turn. Straighten: spin the letter to match.', badge: 'For All Devices', accent: '#0284C7', bar: '#38BDF8' },
  { uiId: 'computer_vision', title: 'Gaze Hold', body: 'Look at the still bubble and hold your gaze to pop it', badge: 'For All Devices', accent: '#0E7490', bar: '#22D3EE' },
  { uiId: 'familiar_faces', title: 'Familiar Faces', body: 'Name, find, or hold a face you know', badge: 'For All Devices', accent: '#BE123C', bar: '#FB7185' },
];

function sessionDayKey(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 'unknown';
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

type HistoryMonth = { year: number; month: number };

function currentHistoryMonth(): HistoryMonth {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

function todayHistoryDay(): string {
  return historyDayKey(currentHistoryMonth(), new Date().getDate());
}

function monthPrefix(cursor: HistoryMonth): string {
  return `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`;
}

function daysInHistoryMonth(cursor: HistoryMonth): number {
  return new Date(cursor.year, cursor.month + 1, 0).getDate();
}

function historyDayKey(cursor: HistoryMonth, day: number): string {
  return `${monthPrefix(cursor)}-${String(day).padStart(2, '0')}`;
}

const HISTORY_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function historyYearOptions(rows: StoredGameSessionRecord[], selectedYear?: number): number[] {
  const years = new Set<number>([new Date().getFullYear()]);
  if (selectedYear) years.add(selectedYear);
  for (const row of rows) {
    const day = sessionDayKey(row.recordedAt);
    if (day === 'unknown') continue;
    years.add(Number(day.slice(0, 4)));
  }
  return Array.from(years).sort((a, b) => a - b);
}

function weekdayLabel(cursor: HistoryMonth, day: number): string {
  return new Date(cursor.year, cursor.month, day).toLocaleDateString('en-GB', { weekday: 'short' });
}

function latestHistoryDay(
  rows: StoredGameSessionRecord[],
  gameId: string,
  levelId: string,
  prefix?: string,
): string {
  let latest = '';
  for (const row of rows) {
    if (gameId && row.gameId !== gameId) continue;
    if (levelId && (row.levelId ?? '') !== levelId) continue;
    const day = sessionDayKey(row.recordedAt);
    if (day === 'unknown') continue;
    if (prefix && !day.startsWith(prefix)) continue;
    if (day > latest) latest = day;
  }
  return latest;
}

function monthFromDayKey(dayKey: string): HistoryMonth {
  const [year, month] = dayKey.split('-').map(Number);
  return { year, month: (month || 1) - 1 };
}

function formatSelectedHistoryDay(dayKey: string): string {
  if (!dayKey || dayKey === 'unknown') return '';
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });
}

function historyPlayCounts(
  rows: StoredGameSessionRecord[],
  gameId: string,
  levelId: string,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (gameId && row.gameId !== gameId) continue;
    if (levelId && (row.levelId ?? '') !== levelId) continue;
    const day = sessionDayKey(row.recordedAt);
    if (day === 'unknown') continue;
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return counts;
}

function monthContributionWeeks(year: number, month: number): (string | null)[][] {
  const weeks: (string | null)[][] = [];
  let week: (string | null)[] = Array.from({ length: new Date(year, month, 1).getDay() }, () => null);
  const days = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= days; day += 1) {
    week.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

function contributionDotColor(count: number): string {
  if (count >= 4) return '#059669';
  if (count >= 2) return '#34D399';
  if (count >= 1) return '#A7F3D0';
  return '#E5E7EB';
}

function StreakDotsDialog({
  open,
  sessions,
  onClose,
  s,
  fs,
}: {
  open: boolean;
  sessions: StoredGameSessionRecord[];
  onClose: () => void;
  s: (n: number) => number;
  fs: (n: number) => number;
}) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [tip, setTip] = useState('');
  const counts = historyPlayCounts(sessions, '', '');
  const yearOptions = historyYearOptions(sessions, year);
  const size = s(8);
  const gap = s(2);
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', padding: s(21) }}>
        <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(17,24,39,0.4)' }} />
        <View style={{ backgroundColor: colors.white, borderRadius: s(13), borderWidth: 1, borderColor: colors.border, padding: s(21), ...cardShadow }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: s(13), marginBottom: s(21) }}>
            <View style={{ flex: 1 }}>
              <DropdownField
                label="Year"
                value={String(year)}
                onChange={(next) => setYear(Number(next))}
                fs={fs}
                s={s}
                options={yearOptions.map((option) => ({ value: String(option), label: String(option) }))}
              />
            </View>
            <Text style={{ flexShrink: 0, paddingBottom: s(13), fontSize: fs(13), fontWeight: '600', color: colors.muted }}>Played days</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={{ width: s(34), height: s(34), borderRadius: s(13), borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', ...cardShadow }}
            >
              <CloseIcon size={s(13)} color={colors.ink} />
            </Pressable>
          </View>
          <Text style={{ minHeight: fs(21), marginBottom: s(8), fontSize: fs(13), fontWeight: '600', color: colors.muted, textAlign: 'center' }}>
            {tip}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: s(8), paddingTop: s(13) }}>
            {HISTORY_MONTH_NAMES.map((name, month) => (
              <View key={name} style={{ alignItems: 'center', gap: s(8) }}>
                <Text style={{ fontSize: fs(13), fontWeight: '600', color: colors.muted }}>{name.slice(0, 3)}</Text>
                <View style={{ flexDirection: 'row', gap }}>
                  {monthContributionWeeks(year, month).map((week, weekIndex) => (
                    <View key={weekIndex} style={{ gap }}>
                      {week.map((dayKey, dayIndex) => {
                        if (!dayKey) return <View key={`empty-${dayIndex}`} style={{ width: size, height: size }} />;
                        const count = counts.get(dayKey) ?? 0;
                        return (
                          <Pressable
                            key={dayKey}
                            onPressIn={() => setTip(`${count} ${count === 1 ? 'game' : 'games'}`)}
                            onPressOut={() => setTip('')}
                            accessibilityRole="button"
                            accessibilityLabel={`${count} ${count === 1 ? 'game' : 'games'} on ${formatSelectedHistoryDay(dayKey)}`}
                            style={{
                              width: size,
                              height: size,
                              borderRadius: size,
                              backgroundColor: contributionDotColor(count),
                            }}
                          />
                        );
                      })}
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function formatHistoryDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

const cardShadow = {
  shadowColor: '#0f172a',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.14,
  shadowRadius: 18,
  elevation: 4,
};

function PracticeSummary({
  sessions,
  doctorName,
  doctorCode,
  fs,
  s,
  onSessionsPress,
}: {
  sessions: StoredGameSessionRecord[];
  doctorName: string | null | undefined;
  doctorCode: string | null | undefined;
  fs: (size: number) => number;
  s: (size: number) => number;
  onSessionsPress: () => void;
}) {
  const totals = buildGameSessionAnalytics(
    sessions.map((row) => ({
      ...row,
      gameId: row.gameId as never,
      levelId: row.levelId ?? null,
      deviceTier: row.deviceTier ?? null,
    })),
  ).totals;
  const mean = (value: number | null, suffix = '') => (value != null ? `${value}${suffix}` : '—');
  let lastPlayed = '—';
  let lastPlayedHint = totals.sessionCount ? 'Most recent session' : 'Not played yet';
  if (totals.lastPlayedAt) {
    const parsed = new Date(totals.lastPlayedAt);
    if (!Number.isNaN(parsed.getTime())) {
      lastPlayed = parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      lastPlayedHint = `Most recent session in ${parsed.getFullYear()}`;
    }
  }
  const streak = consistencyStreak(sessions.map((row) => row.recordedAt));
  const [streakOpen, setStreakOpen] = useState(false);
  const cards: { label: string; value: string; hint: string }[] = [
    { label: 'Sessions', value: String(totals.sessionCount), hint: totals.sessionCount === 1 ? '1 finished play' : `${totals.sessionCount} finished plays` },
    { label: 'Last played', value: lastPlayed, hint: lastPlayedHint },
    {
      label: 'Streak',
      value: String(streak),
      hint: totals.sessionCount === 0 ? 'Not played yet' : streak > 0 ? 'Consecutive days' : 'No current streak',
    },
    { label: 'Accuracy', value: mean(totals.avgAccuracy, '%'), hint: 'Mean' },
    { label: 'Avg reaction time', value: mean(totals.avgReactionSec, 's'), hint: 'Mean' },
    { label: 'Efficiency', value: mean(totals.efficiency), hint: 'Mean' },
    { label: 'Wrong-tap rate', value: mean(totals.wrongTapRate, '%'), hint: 'Mean' },
    { label: 'Miss rate', value: mean(totals.missRate, '%'), hint: 'Mean' },
    { label: 'Time to finish', value: mean(totals.avgDurationSec, 's'), hint: 'Mean' },
  ];
  return (
    <View style={{ gap: s(13), marginBottom: s(34) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s(21), backgroundColor: colors.white, borderRadius: s(13), borderWidth: 1, borderColor: colors.border, padding: s(21), ...cardShadow }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: fs(13), lineHeight: fs(21), fontWeight: '600', color: colors.ink }}>Your doctor</Text>
          <Text style={{ marginTop: s(8), fontSize: fs(34), fontWeight: '600', color: colors.ink }}>{doctorName ? `Dr. ${doctorName}` : '—'}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: fs(13), lineHeight: fs(21), fontWeight: '600', color: colors.ink }}>DocID</Text>
          <View style={{ marginTop: s(8), flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
            <Text style={{ fontSize: fs(34), fontWeight: '600', color: colors.ink }}>{doctorCode || '—'}</Text>
            {doctorCode ? <CopyDocId code={doctorCode} plain /> : null}
          </View>
        </View>
      </View>
      {cards.map((card) => {
        const isStreak = card.label === 'Streak';
        const isSessions = card.label === 'Sessions';
        const body = (
          <>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fs(13), lineHeight: fs(21), fontWeight: '600', color: colors.ink }}>{card.label}</Text>
              <Text style={{ marginTop: s(8), fontSize: fs(13), lineHeight: fs(21), color: colors.muted }}>{card.hint}</Text>
            </View>
            <View style={{ height: fs(34), justifyContent: 'center', paddingRight: isStreak ? s(48) : 0 }}>
              <Text style={{ fontSize: fs(34), fontWeight: '600', lineHeight: fs(34), color: colors.ink }}>{card.value}</Text>
              {isStreak ? (
                <View
                  pointerEvents="none"
                  style={{ position: 'absolute', right: 0, top: (fs(34) - fs(55)) / 2 - s(9), width: fs(40), height: fs(55) }}
                >
                  <LottieView
                    source={require('@candela/shared/assets/lottie/streak-fire.json')}
                    autoPlay
                    loop
                    resizeMode="contain"
                    style={{ width: '100%', height: '100%' }}
                  />
                </View>
              ) : null}
            </View>
          </>
        );
        const cardStyle = { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: s(13), backgroundColor: colors.white, borderRadius: s(13), borderWidth: 1, borderColor: colors.border, padding: s(21), ...cardShadow };
        if (isStreak) {
          return (
            <Pressable key={card.label} onPress={() => setStreakOpen(true)} accessibilityRole="button" accessibilityLabel="Open streak graph" style={cardStyle}>
              {body}
            </Pressable>
          );
        }
        if (isSessions) {
          return (
            <Pressable key={card.label} onPress={onSessionsPress} accessibilityRole="button" accessibilityLabel="Open session history" style={cardStyle}>
              {body}
            </Pressable>
          );
        }
        return (
          <View key={card.label} style={cardStyle}>
            {body}
          </View>
        );
      })}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s(13), backgroundColor: colors.white, borderRadius: s(13), borderWidth: 1, borderColor: colors.border, padding: s(21), ...cardShadow }}>
        <Text style={{ fontSize: fs(13), lineHeight: fs(21), fontWeight: '600', color: colors.ink }}>Games</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(21) }}>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.muted }}>Standard</Text>
            <Text style={{ marginTop: s(8), fontSize: fs(34), fontWeight: '600', color: colors.ink }}>{totals.normalGameCount}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.muted }}>Pediatric</Text>
            <Text style={{ marginTop: s(8), fontSize: fs(34), fontWeight: '600', color: colors.ink }}>{totals.pediatricGameCount}</Text>
          </View>
        </View>
      </View>
      <StreakDotsDialog open={streakOpen} sessions={sessions} onClose={() => setStreakOpen(false)} s={s} fs={fs} />
    </View>
  );
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default function DashboardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ module?: string; page?: string; family?: string; welcome?: string }>();
  const moduleParam = firstParam(params.module);
  const familyParam = firstParam(params.family);
  const pageParam = firstParam(params.page);
  const welcomeParam = firstParam(params.welcome);
  const { session, loading, applySession, logout } = useAuth();
  const [showWelcome, setShowWelcome] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [docIdRequestOpen, setDocIdRequestOpen] = useState(false);
  const [panel, setPanel] = useState<'account' | 'settings' | 'history' | 'subscription' | 'help' | null>(null);
  const [history, setHistory] = useState<StoredGameSessionRecord[] | null>(null);
  const [historyGameId, setHistoryGameId] = useState('');
  const [historyLevelId, setHistoryLevelId] = useState('');
  const [historyMonth, setHistoryMonth] = useState<HistoryMonth>(currentHistoryMonth);
  const [historyDay, setHistoryDay] = useState(todayHistoryDay);
  const [historySort, setHistorySort] = useState<'desc' | 'asc'>('desc');
  const [catalog, setCatalog] = useState<'normal' | 'pediatric'>('normal');
  const [practiceSessions, setPracticeSessions] = useState<StoredGameSessionRecord[]>([]);

  useEffect(() => {
    if ((welcomeParam === '1' || session?.isNewUser) && session?.user.role === 'patient') {
      setShowWelcome(true);
    }
  }, [welcomeParam, session?.isNewUser, session?.user.role]);

  useEffect(() => {
    if (session?.user.role !== 'patient') return;
    let cancelled = false;
    listMyGameSessions()
      .then((data) => {
        if (!cancelled) setPracticeSessions(data);
      })
      .catch(() => {
        if (!cancelled) setPracticeSessions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user.role]);

  useEffect(() => {
    if (panel !== 'history' || session?.user.role !== 'patient') return;
    let cancelled = false;
    listMyGameSessions()
      .then((data) => {
        if (!cancelled) setHistory(data);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      });
    return () => {
      cancelled = true;
    };
  }, [panel, session?.user.role]);

  useEffect(() => {
    if (panel !== 'history') return;
    const today = todayHistoryDay();
    setHistoryMonth(monthFromDayKey(today));
    setHistoryDay(today);
  }, [panel]);

  const { fs, s, pad, columns, width, isTablet } = useLayout();
  const allowedModuleIds = new Set(resolveAllowedModuleIds(session));

  const scrollOffsetsRef = useRef<Record<string, number>>({});
  const scrollViewRef = useRef<ScrollView | null>(null);
  const currentViewKey = `${pageParam || ''}:${familyParam || ''}:${moduleParam || ''}`;

  const handleScroll = (e: any) => {
    scrollOffsetsRef.current[currentViewKey] = e.nativeEvent.contentOffset.y;
  };

  useEffect(() => {
    const targetY = scrollOffsetsRef.current[currentViewKey] ?? 0;
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({ y: targetY, animated: false });
    });
  }, [currentViewKey]);

  const canPlayUiModule = (uiId: string) => {
    const catalogId = UI_MODULE_TO_CATALOG[uiId];
    return Boolean(catalogId && allowedModuleIds.has(catalogId));
  };

  const isLevelAllowed = (uiId: string, levelId: string | number) => {
    if (!session || session.user.role !== 'patient') return true;
    if (session.patient?.origin === 'self_signup' || !session.patient?.doctorId) return true;
    const catalogId = UI_MODULE_TO_CATALOG[uiId];
    if (!catalogId || !allowedModuleIds.has(catalogId)) return false;
    const prescribedLevels = session.patient?.prescribedLevels?.[catalogId];
    if (prescribedLevels === undefined) return true;
    if (catalogId === 'bee_tracing') {
      const known = MODULE_LEVELS.bee_tracing.map((level) => level.id);
      const hasNewLevels = prescribedLevels.some((id) => known.includes(id));
      if (!hasNewLevels) return true;
    }
    if (catalogId === 'pursuit') {
      const known = MODULE_LEVELS.pursuit.map((level) => level.id);
      const hasNewLevels = prescribedLevels.some((id) => known.includes(id));
      if (!hasNewLevels) return true;
    }
    if (catalogId === 'computer_vision') {
      const known = MODULE_LEVELS.computer_vision.map((level) => level.id);
      const hasNewLevels = prescribedLevels.some((id) => known.includes(id));
      if (!hasNewLevels) return true;
    }
    if (catalogId === 'geoboard' && String(levelId) === '6') return true;
    if (catalogId === 'computer_vision' && String(levelId) === 'stationary') return true;
    if (catalogId === 'direction_sense') {
      return directionSensePrescribedAllows(String(levelId), prescribedLevels);
    }
    return prescribedLevels.includes(String(levelId));
  };

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/login');
      return;
    }
    if (session.user.role === 'admin') {
      router.replace('/admin');
      return;
    }
    if (session.user.role === 'doctor') {
      router.replace('/doctor');
    }
  }, [loading, session, router]);

  const cardWidth = useMemo(
    () => (columns === 1 ? width - pad * 2 : (width - pad * 2 - s(12) * (Math.min(columns, 2) - 1)) / Math.min(columns, 2)),
    [columns, width, pad, s],
  );

  if (session?.user.role !== 'patient') {
    return loading ? <ScreenLoader /> : null;
  }

  const launchRotatory = (mode: string, variant: string) => {
    router.push(`/play/rotatory?mode=${mode}&variant=${variant}`);
  };
  const launchSorting = (variant: string) => {
    router.push(`/play/sorting?variant=${variant}`);
  };
  const launchMobileTarget = (mode: string, variant: string) => {
    router.push(`/play/mobile-target?mode=${mode}&variant=${variant}`);
  };
  const launchGeoboard = (boardId: GeoboardBoardId) => {
    router.push(`/play/geoboard?boardId=${boardId}` as never);
  };
  const launchBee = (pathType: string) => {
    router.push(`/play/bee?pathType=${pathType}` as never);
  };
  const launchPursuit = (pattern: string) => {
    router.push(`/play/pursuit?pattern=${pattern}` as never);
  };
  const launchPeripheral = (field: string) => {
    router.push(`/play/peripheral?field=${field}` as never);
  };
  const launchNumberSearch = () => {
    router.push('/play/number-search' as never);
  };
  const launchPatternMatch = (levelId: string = 'standard') => {
    router.push(`/play/pattern-match?level=${levelId}` as never);
  };
  const launchDirectionSense = (levelId: string = 'face') => {
    router.push(`/play/direction-sense?level=${levelId}` as never);
  };
  const launchLocationMemory = (levelId: string = 'standard') => {
    router.push(`/play/location-memory?level=${levelId}` as never);
  };
  const launchComputerVision = (pattern: string) => {
    router.push(`/play/computer-vision?pattern=${pattern}` as never);
  };
  const launchFamiliarFaces = (levelId: string = 'name_it') => {
    router.push(`/play/familiar-faces?level=${levelId}` as never);
  };

  const backToModules = () => router.replace('/dashboard?page=games');
  const activeFamilyId =
    (familyParam && isTherapyFamilyId(familyParam) ? familyParam : null) ||
    familyForModuleId(UI_MODULE_TO_CATALOG[moduleParam ?? ''] ?? '')?.id ||
    null;
  const backToFamily = () => {
    if (activeFamilyId) {
      router.replace(`/dashboard?family=${activeFamilyId}`);
      return;
    }
    backToModules();
  };

  const sessionsForModule = (uiId: string) => {
    const catalogId = UI_MODULE_TO_CATALOG[uiId];
    return practiceSessions.filter((row) => row.gameId === catalogId);
  };
  const accuracyForLevel = (uiId: string, levelId: string | number) => {
    const rows = sessionsForModule(uiId).filter((row) => row.levelId === String(levelId));
    if (!rows.length) return '—';
    const value = Math.round((rows.reduce((sum, row) => sum + (row.accuracy || 0), 0) / rows.length) * 10) / 10;
    return `${value}%`;
  };
  const gameSummary = (uiId: string) => {
    const rows = sessionsForModule(uiId);
    const count = rows.length;
    const accuracy = count
      ? `${Math.round((rows.reduce((sum, row) => sum + (row.accuracy || 0), 0) / count) * 10) / 10}%`
      : '—';
    const last = count
      ? new Date([...rows].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))[count - 1].recordedAt).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : '—';
    const duration = rows.reduce((sum, row) => sum + (row.durationSec || 0), 0);
    const cards = [
      { label: 'Sessions', value: String(count), hint: count === 1 ? '1 finished play' : `${count} finished plays` },
      { label: 'Accuracy', value: accuracy, hint: count ? 'Mean score' : 'No plays yet' },
      { label: 'Last played', value: last, hint: count ? 'Most recent session' : 'Not played yet' },
      { label: 'Time spent', value: formatHistoryDuration(duration), hint: duration > 0 ? 'Total training time' : '0 minutes recorded' },
    ];
    return (
      <View style={{ gap: s(13), marginBottom: s(16) }}>
        {cards.map((card) => (
          <View key={card.label} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s(13), backgroundColor: colors.white, borderRadius: s(13), borderWidth: 1, borderColor: colors.border, padding: s(21), ...cardShadow }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fs(13), lineHeight: fs(21), fontWeight: '600', color: colors.ink }}>{card.label}</Text>
              <Text style={{ marginTop: s(8), fontSize: fs(13), lineHeight: fs(21), color: colors.muted }}>{card.hint}</Text>
            </View>
            <Text style={{ fontSize: fs(34), fontWeight: '600', lineHeight: fs(34), color: colors.ink }}>{card.value}</Text>
          </View>
        ))}
      </View>
    );
  };

  const variantCard = (label: string, onPress: () => void, levelId?: string | number) => (
    <Pressable
      key={label}
      onPress={onPress}
      style={{
        width: cardWidth,
        minHeight: s(140),
        borderRadius: s(16),
        backgroundColor: colors.white,
        borderWidth: 2,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        padding: s(16),
        marginBottom: s(12),
        ...cardShadow,
      }}
    >
      <Text style={{ fontSize: fs(18), fontWeight: '600', color: colors.ink, textAlign: 'center' }}>{label}</Text>
      <Text style={{ marginTop: s(8), fontSize: fs(13), fontWeight: '600', color: colors.ink, textAlign: 'center' }}>
        {moduleParam && levelId != null ? accuracyForLevel(moduleParam, levelId) : '—'}
      </Text>
    </Pressable>
  );

  const noLevelsCard = (title: string) => (
    <View style={{ width: '100%', backgroundColor: colors.white, borderRadius: s(24), padding: s(28), alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ fontSize: fs(18), fontWeight: '700', marginBottom: s(8) }}>{title}</Text>
      <Text style={{ fontSize: fs(13), color: colors.muted, textAlign: 'center' }}>
        Your doctor has not enabled any specific levels for this module.
      </Text>
    </View>
  );

  const practiceFamilies = catalog === 'pediatric' ? PEDIATRIC_GAME_FAMILIES : GAME_FAMILIES;
  const visibleFamilies = practiceFamilies.filter((family) =>
    family.moduleIds.some((catalogId) => canPlayUiModule(CATALOG_TO_UI_MODULE[catalogId])),
  );
  const prescribedIn = (families: typeof GAME_FAMILIES) =>
    families.reduce(
      (sum, family) =>
        sum + family.moduleIds.filter((catalogId) => canPlayUiModule(CATALOG_TO_UI_MODULE[catalogId])).length,
      0,
    );
  const normalPrescribedCount = prescribedIn(GAME_FAMILIES);
  const pediatricPrescribedCount = prescribedIn(PEDIATRIC_GAME_FAMILIES);
  const selectedFamily = familyParam && isTherapyFamilyId(familyParam) ? getGameFamily(familyParam) : undefined;
  const familyActivityCards = (selectedFamily?.moduleIds ?? [])
    .map((catalogId) => MODULE_CARDS.find((card) => card.uiId === CATALOG_TO_UI_MODULE[catalogId]))
    .filter((card): card is ModuleCard => Boolean(card && canPlayUiModule(card.uiId)));

  const handleSelectFamily = (id: string) => {
    router.push(`/dashboard?family=${id}`);
  };

  const handleSelectModule = (id: string) => {
    if (!canPlayUiModule(id)) return;
    const family =
      (familyParam && isTherapyFamilyId(familyParam) ? familyParam : null) ||
      familyForModuleId(UI_MODULE_TO_CATALOG[id] ?? '')?.id;
    router.push(family ? `/dashboard?family=${family}&module=${id}` : `/dashboard?module=${id}`);
  };

  const gridCard = (
    key: string,
    title: string,
    body: string,
    _accent: string,
    _bar: string,
    badge: string,
    action: string,
    onPress: () => void,
  ) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={{
        width: cardWidth,
        minHeight: s(144),
        backgroundColor: colors.white,
        borderRadius: s(13),
        padding: s(21),
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: 'space-between',
        ...cardShadow,
      }}
    >
      {action === 'Open' ? (
        <Text
          style={{
            position: 'absolute',
            top: -1,
            right: -1,
            zIndex: 1,
            fontSize: fs(8),
            lineHeight: fs(13),
            fontWeight: '600',
            color: '#4B5563',
            backgroundColor: '#F9FAFB',
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: s(8),
            paddingVertical: s(5),
            borderTopRightRadius: s(13),
            borderBottomLeftRadius: s(8),
            overflow: 'hidden',
          }}
        >
          {badge}
        </Text>
      ) : null}
      <View>
        <Text style={{ fontSize: fs(21), fontWeight: '600', lineHeight: fs(34), color: colors.ink, paddingRight: action === 'Open' ? s(89) : 0 }}>{title}</Text>
        <Text style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.muted, marginTop: s(8) }}>{body}</Text>
      </View>
      <View style={{ marginTop: s(13), flexDirection: 'row', alignItems: 'center', justifyContent: action === 'Open' ? 'flex-end' : 'space-between' }}>
        {action === 'Open' ? null : (
          <Text style={{ flexShrink: 1, fontSize: fs(13), lineHeight: fs(21), color: colors.muted }}>{badge}</Text>
        )}
        {action === 'Open' || action === 'Play' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), marginLeft: action === 'Play' ? s(13) : 0 }}>
            <Text style={{ fontSize: fs(13), fontWeight: '600', color: colors.blue }}>{action}</Text>
            <OpenHint>
              <ArrowRightIcon size={s(14)} color={colors.blue} />
            </OpenHint>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), marginLeft: s(8) }}>
            <Text style={{ fontSize: fs(13), fontWeight: '600', color: '#374151' }}>{action}</Text>
            <ArrowRightIcon size={s(14)} color="#374151" />
          </View>
        )}
      </View>
    </Pressable>
  );

  let headerBackAction: (() => void) | undefined = undefined;
  if (panel) {
    headerBackAction = () => setPanel(null);
  } else if (moduleParam && canPlayUiModule(moduleParam)) {
    headerBackAction = backToFamily;
  } else if (pageParam === 'games' || pageParam === 'analytics') {
    headerBackAction = () => router.replace('/dashboard');
  } else if (selectedFamily) {
    headerBackAction = backToModules;
  }

  const renderContent = () => {
    if (panel === 'history') {
      const prefix = monthPrefix(historyMonth);
      const source = history ?? [];
      const playCounts = historyPlayCounts(source, historyGameId, historyLevelId);
      const playedDays = new Set(
        Array.from(playCounts.entries())
          .filter(([day, count]) => count > 0 && day.startsWith(prefix))
          .map(([day]) => day),
      );
      const historyRows = history
        ? [...history]
            .filter((row) => {
              if (historyGameId && row.gameId !== historyGameId) return false;
              if (historyLevelId && (row.levelId ?? '') !== historyLevelId) return false;
              return sessionDayKey(row.recordedAt) === historyDay;
            })
            .sort((a, b) => (historySort === 'asc' ? 1 : -1) * a.recordedAt.localeCompare(b.recordedAt))
        : null;
      const monthDays = daysInHistoryMonth(historyMonth);
      const yearOptions = historyYearOptions(source, historyMonth.year);
      const setCursor = (next: HistoryMonth) => {
        const nextPrefix = monthPrefix(next);
        const latestInMonth = latestHistoryDay(source, historyGameId, historyLevelId, nextPrefix);
        setHistoryMonth(next);
        setHistoryDay(latestInMonth || `${nextPrefix}-01`);
      };
      return (
        <View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: s(13), marginBottom: s(34) }}>
            <Text style={{ fontSize: fs(21), fontWeight: '600' }}>Session history</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: s(13), flexGrow: 1, justifyContent: 'flex-end' }}>
            <DropdownField
              label="Module"
              value={historyGameId}
              onChange={(next) => {
                setHistoryGameId(next);
                setHistoryLevelId('');
              }}
              fs={fs}
              s={s}
              shadowed
              options={[
                { value: '', label: 'All modules' },
                ...ALL_MODULE_IDS.map((id) => ({ value: id, label: GAME_CATALOG[id].name })),
              ]}
            />
            <DropdownField
              label="Level"
              value={historyLevelId}
              onChange={setHistoryLevelId}
              disabled={!historyGameId}
              fs={fs}
              s={s}
              shadowed
              options={[
                { value: '', label: historyGameId ? 'All levels' : 'Pick a module first' },
                ...levelsForTherapyModule(historyGameId).map((level) => ({ value: level.id, label: level.name })),
              ]}
            />
            <Pressable
              onPress={() => setHistorySort((current) => (current === 'desc' ? 'asc' : 'desc'))}
              accessibilityRole="button"
              accessibilityLabel={historySort === 'desc' ? 'Sort descending' : 'Sort ascending'}
              style={{ width: s(34), height: s(34), borderRadius: s(13), borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', ...cardShadow }}
            >
              <SortOrderIcon size={s(13)} color={colors.ink} direction={historySort} />
            </Pressable>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: s(13), marginBottom: s(34) }}>
                <View style={{ flex: 1 }}>
                  <DropdownField
                    label="Year"
                    value={String(historyMonth.year)}
                    onChange={(next) => setCursor({ year: Number(next), month: historyMonth.month })}
                    fs={fs}
                    s={s}
                    options={yearOptions.map((year) => ({ value: String(year), label: String(year) }))}
                  />
                </View>
                <Text style={{ flexShrink: 0, alignSelf: 'center', fontSize: fs(13), fontWeight: '600', color: colors.muted }}>
                  {historyDay ? `${historyDay.slice(8, 10)} ${HISTORY_MONTH_NAMES[historyMonth.month]} ${historyMonth.year}` : ''}
                </Text>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <DropdownField
                    label="Month"
                    value={String(historyMonth.month)}
                    onChange={(next) => setCursor({ year: historyMonth.year, month: Number(next) })}
                    fs={fs}
                    s={s}
                    options={HISTORY_MONTH_NAMES.map((name, index) => ({ value: String(index), label: name }))}
                  />
                </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: s(34) }} contentContainerStyle={{ gap: s(13) }}>
              {Array.from({ length: monthDays }, (_, index) => {
                const day = index + 1;
                const key = historyDayKey(historyMonth, day);
                const selected = historyDay === key;
                const hasPlays = playedDays.has(key);
                return (
                  <Pressable
                    key={key}
                    onPress={() => setHistoryDay(key)}
                    style={{
                      width: s(55),
                      alignItems: 'center',
                      gap: s(8),
                      borderRadius: s(13),
                      borderWidth: 1,
                      paddingHorizontal: s(8),
                      paddingVertical: s(13),
                      backgroundColor: hasPlays ? (selected ? '#059669' : '#ECFDF5') : selected ? '#111827' : colors.white,
                      borderColor: hasPlays ? (selected ? '#059669' : '#A7F3D0') : selected ? '#111827' : colors.border,
                      ...cardShadow,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: fs(13),
                        color: hasPlays && !selected ? '#059669' : selected ? colors.white : '#9CA3AF',
                      }}
                    >
                      {weekdayLabel(historyMonth, day)}
                    </Text>
                    <Text
                      style={{
                        fontSize: fs(21),
                        fontWeight: '600',
                        color: hasPlays && !selected ? '#047857' : selected ? colors.white : '#D1D5DB',
                      }}
                    >
                      {String(day).padStart(2, '0')}
                    </Text>
                  </Pressable>
                );
              })}
          </ScrollView>
          {historyRows === null ? null : (history?.length ?? 0) === 0 ? (
            <View style={{ backgroundColor: colors.white, borderRadius: s(13), borderWidth: 1, borderColor: colors.border, padding: s(21), ...cardShadow }}>
              <Text style={{ fontSize: fs(13), color: colors.ink }}>No completed sessions yet.</Text>
            </View>
          ) : historyRows.length === 0 ? (
            <View style={{ backgroundColor: colors.white, borderRadius: s(13), borderWidth: 1, borderColor: colors.border, padding: s(21), ...cardShadow }}>
              <Text style={{ fontSize: fs(13), color: colors.ink }}>
                {historyDay ? `No sessions on ${formatSelectedHistoryDay(historyDay)}.` : 'No sessions match these filters.'}
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(13) }}>
              {historyRows.map((row) => (
                <View key={row.id} style={{ width: isTablet ? '48%' : '100%', backgroundColor: colors.white, borderRadius: s(13), borderWidth: 1, borderColor: colors.border, padding: s(21), ...cardShadow }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: s(21) }}>
                    <Text style={{ flex: 1, fontSize: fs(13), fontWeight: '600' }}>{row.gameName}</Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: fs(21), fontWeight: '600' }}>{Math.round(row.accuracy * 10) / 10}%</Text>
                      <Text style={{ fontSize: fs(13), color: colors.muted, marginTop: s(8) }}>{formatHistoryDuration(row.durationSec)}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      );
    }
    if (panel === 'subscription') {
      return (
        <>
          <Text style={{ fontSize: fs(21), fontWeight: '600', marginBottom: s(34) }}>Subscription</Text>
          <View style={{ backgroundColor: colors.white, borderRadius: s(13), borderWidth: 1, borderColor: colors.border, padding: s(21), ...cardShadow }}>
            <Text style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.ink }}>There is no subscription on this account yet. Billing is not set up, so this page does not show a trial, a price, or a renewal date.</Text>
          </View>
        </>
      );
    }
    if (panel === 'help') {
      return (
        <>
          <Text style={{ fontSize: fs(21), fontWeight: '600' }}>Help</Text>
          <Text style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.muted, marginTop: s(8), marginBottom: s(34) }}>How to get support.</Text>
          <View style={{ backgroundColor: colors.white, borderRadius: s(13), borderWidth: 1, borderColor: colors.border, padding: s(21), ...cardShadow }}>
            <Text style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.ink, marginBottom: s(21) }}>There is no help desk in the app yet. Use Settings to open your DocID and the doctor linked to this account.</Text>
            <Pressable
              onPress={() => setPanel('settings')}
              style={{ alignSelf: 'flex-start', backgroundColor: colors.blue, borderRadius: s(13), paddingHorizontal: s(13), paddingVertical: s(13) }}
            >
              <Text style={{ color: colors.white, fontSize: fs(13), fontWeight: '600' }}>Open Settings</Text>
            </Pressable>
          </View>
        </>
      );
    }
    if (panel === 'settings') {
      const patient = session.patient;
      const linked = Boolean(patient?.doctorId && patient?.referralCode);
      const pending = Boolean(patient?.pendingDocIdRequest);
      const copy = pending
        ? 'A DocID request is waiting. Open it to confirm, resend, or cancel.'
        : linked
          ? "Enter another doctor's DocID. That doctor confirms the change."
          : patient?.origin === 'self_signup'
            ? "Enter a doctor's DocID to ask to join their clinic."
            : 'Ask an administrator to transfer you to a doctor.';
      const action = pending ? 'Review request' : linked ? 'Request a change' : patient?.origin === 'self_signup' ? 'Request attach' : null;
      return (
        <>
          <Text style={{ fontSize: fs(21), fontWeight: '600' }}>Settings</Text>
          <Text style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.muted, marginTop: s(8), marginBottom: s(34) }}>Your doctor link.</Text>
          <View style={{ backgroundColor: colors.white, borderRadius: s(13), borderWidth: 1, borderColor: colors.border, padding: s(21), ...cardShadow }}>
            {patient?.doctorName || patient?.referralCode ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: s(13), marginBottom: s(21) }}>
                <Text style={{ fontSize: fs(21), fontWeight: '600', color: colors.ink }}>
                  {patient.doctorName ? `Dr. ${patient.doctorName}` : 'Your doctor'}
                </Text>
                {patient.referralCode ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
                    <Text style={{ fontSize: fs(21), fontWeight: '600', color: colors.ink }}>{patient.referralCode}</Text>
                    <CopyDocId code={patient.referralCode} plain />
                  </View>
                ) : null}
              </View>
            ) : null}
            <Text style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.ink, marginBottom: action ? s(21) : 0 }}>{copy}</Text>
            {action && !docIdRequestOpen ? (
              <Pressable
                onPress={() => setDocIdRequestOpen(true)}
                style={{ alignSelf: 'flex-start', backgroundColor: colors.blue, borderRadius: s(13), paddingHorizontal: s(13), paddingVertical: s(13) }}
              >
                <Text style={{ color: colors.white, fontSize: fs(13), fontWeight: '600' }}>{action}</Text>
              </Pressable>
            ) : null}
            {docIdRequestOpen ? <DocIdRequestCard embedded /> : null}
          </View>
        </>
      );
    }
    if (panel === 'account') {
      return (
        <>
          <Text style={{ fontSize: fs(21), fontWeight: '600', marginBottom: s(34) }}>Account</Text>
          <View style={{ backgroundColor: colors.white, borderRadius: s(13), borderWidth: 1, borderColor: colors.border, padding: s(21), ...cardShadow }}>
            <Text style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.ink }}>Name</Text>
            <Text style={{ fontSize: fs(21), fontWeight: '600', marginTop: s(8), marginBottom: s(21) }}>{session.user.name}</Text>
            <Text style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.ink }}>Email</Text>
            <Text style={{ fontSize: fs(21), fontWeight: '600', marginTop: s(8), marginBottom: s(21) }}>{session.user.email}</Text>
            <Text style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.ink }}>Phone</Text>
            <Text style={{ fontSize: fs(21), fontWeight: '600', marginTop: s(8) }}>{session.user.phone || '—'}</Text>
          </View>
        </>
      );
    }
    if (pageParam === 'analytics') {
      return (
        <>
          <SessionAnalyticsPanel heading="Analytics" patientName={session?.user.name || 'you'} />
          <Pressable
            onPress={() => router.replace('/dashboard')}
            style={{
              marginTop: s(16),
              alignSelf: 'flex-start',
              backgroundColor: colors.blue,
              borderRadius: s(12),
              paddingHorizontal: s(20),
              paddingVertical: s(12),
              flexDirection: 'row',
              alignItems: 'center',
              gap: s(8),
            }}
          >
            <EyeIcon size={s(18)} color="#fff" />
            <Text style={{ color: colors.white, fontWeight: '700' }}>Start a Therapy Session</Text>
          </Pressable>
        </>
      );
    }

    if (moduleParam === 'wheel' && canPlayUiModule('wheel')) {
      const levels = [
        isLevelAllowed('wheel', 'uppercase') ? variantCard('Uppercase Rotatory', () => launchRotatory('alphabets', 'uppercase'), 'uppercase') : null,
        isLevelAllowed('wheel', 'lowercase') ? variantCard('Lowercase Rotatory', () => launchRotatory('alphabets', 'lowercase'), 'lowercase') : null,
        isLevelAllowed('wheel', 'numbers') ? variantCard('Numeric Rotatory', () => launchRotatory('numbers', 'uppercase'), 'numbers') : null,
        isLevelAllowed('wheel', 'colors') ? variantCard('Color Discriminant', () => launchRotatory('colors', 'uppercase'), 'colors') : null,
      ].filter(Boolean);
      return (
        <>
          <Text style={{ fontSize: fs(22), fontWeight: '600', marginBottom: s(4) }}>Rotatory Module</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginBottom: s(16) }}>Select an exercise mode to begin</Text>
          {gameSummary(moduleParam)}
          {levels.length === 0 ? noLevelsCard('No levels assigned yet') : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>{levels}</View>}
        </>
      );
    }

    if (moduleParam === 'sorting' && canPlayUiModule('sorting')) {
      const levels = [
        isLevelAllowed('sorting', 'uppercase') ? variantCard('Uppercase Alphabet Sorting', () => launchSorting('uppercase'), 'uppercase') : null,
        isLevelAllowed('sorting', 'lowercase') ? variantCard('Lowercase Alphabet Sorting', () => launchSorting('lowercase'), 'lowercase') : null,
        isLevelAllowed('sorting', 'numbers') ? variantCard('Numeric Sorting', () => launchSorting('numbers'), 'numbers') : null,
      ].filter(Boolean);
      return (
        <>
          <Text style={{ fontSize: fs(22), fontWeight: '600', marginBottom: s(4) }}>Sorting Module</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginBottom: s(16) }}>Select a sorting category to begin</Text>
          {gameSummary(moduleParam)}
          {levels.length === 0 ? noLevelsCard('No levels assigned yet') : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>{levels}</View>}
        </>
      );
    }

    if (moduleParam === 'mobile_target' && canPlayUiModule('mobile_target')) {
      const levels = [
        isLevelAllowed('mobile_target', 'uppercase') ? variantCard('Uppercase Bubble Chase', () => launchMobileTarget('alphabets', 'uppercase'), 'uppercase') : null,
        isLevelAllowed('mobile_target', 'lowercase') ? variantCard('Lowercase Bubble Chase', () => launchMobileTarget('alphabets', 'lowercase'), 'lowercase') : null,
        isLevelAllowed('mobile_target', 'numbers') ? variantCard('Numeric Bubble Chase', () => launchMobileTarget('numbers', 'uppercase'), 'numbers') : null,
        isLevelAllowed('mobile_target', 'colors') ? variantCard('Color Discriminant Bubble Chase', () => launchMobileTarget('colors', 'uppercase'), 'colors') : null,
      ].filter(Boolean);
      return (
        <>
          <Text style={{ fontSize: fs(22), fontWeight: '600', marginBottom: s(4) }}>Bubble Chase</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginBottom: s(16) }}>Select an exercise mode to begin</Text>
          {gameSummary(moduleParam)}
          {levels.length === 0 ? noLevelsCard('No levels assigned yet') : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>{levels}</View>}
        </>
      );
    }

    if (moduleParam === 'tracing' && canPlayUiModule('tracing')) {
      const levels = MODULE_LEVELS.bee_tracing
        .filter((level) => isLevelAllowed('tracing', level.id))
        .map((level) => variantCard(level.name, () => launchBee(level.id), level.id));
      return (
        <>
          <Text style={{ fontSize: fs(22), fontWeight: '600', marginBottom: s(4) }}>Bee Path Tracing</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginBottom: s(16) }}>Select a path type to begin</Text>
          {gameSummary(moduleParam)}
          {levels.length === 0 ? noLevelsCard('No levels assigned yet') : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>{levels}</View>}
        </>
      );
    }

    if (moduleParam === 'pursuit' && canPlayUiModule('pursuit')) {
      const levels = MODULE_LEVELS.pursuit
        .filter((level) => isLevelAllowed('pursuit', level.id))
        .map((level) => variantCard(level.name, () => launchPursuit(level.id), level.id));
      return (
        <>
          <Text style={{ fontSize: fs(22), fontWeight: '600', marginBottom: s(4) }}>Pursuit Module</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginBottom: s(16) }}>Select a movement pattern to begin</Text>
          {gameSummary(moduleParam)}
          {levels.length === 0 ? noLevelsCard('No levels assigned yet') : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>{levels}</View>}
        </>
      );
    }

    if (moduleParam === 'geoboard' && canPlayUiModule('geoboard')) {
      const levels = GEOBOARD_BOARD_IDS.filter((id) => isLevelAllowed('geoboard', id)).map((id) =>
        variantCard(GEOBOARD_BOARDS[id].shortLabel, () => launchGeoboard(id), id),
      );
      return (
        <>
          <Text style={{ fontSize: fs(22), fontWeight: '600', marginBottom: s(4) }}>Draw a Pattern</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginBottom: s(16) }}>Select a board to begin</Text>
          {gameSummary(moduleParam)}
          {levels.length === 0 ? noLevelsCard('No boards assigned yet') : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>{levels}</View>}
        </>
      );
    }

    if (moduleParam === 'peripheral' && canPlayUiModule('peripheral')) {
      const levels = MODULE_LEVELS.peripheral_view
        .filter((level) => isLevelAllowed('peripheral', level.id))
        .map((level) => variantCard(level.name, () => launchPeripheral(level.id), level.id));
      return (
        <>
          <Text style={{ fontSize: fs(22), fontWeight: '600', marginBottom: s(4) }}>Peripheral View</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginBottom: s(16) }}>
            Select a visual field · designed for landscape
          </Text>
          {gameSummary(moduleParam)}
          {levels.length === 0 ? noLevelsCard('No levels assigned yet') : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>{levels}</View>}
        </>
      );
    }

    if (moduleParam === 'number_search' && canPlayUiModule('number_search')) {
      const levels = MODULE_LEVELS.number_search
        .filter((level) => isLevelAllowed('number_search', level.id))
        .map((level) => variantCard(level.name, () => launchNumberSearch(), level.id));
      return (
        <>
          <Text style={{ fontSize: fs(22), fontWeight: '600', marginBottom: s(4) }}>Crowded Search</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginBottom: s(16) }}>
            Find digits hidden among mixed letters
          </Text>
          {gameSummary(moduleParam)}
          {levels.length === 0 ? noLevelsCard('No levels assigned yet') : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>{levels}</View>}
        </>
      );
    }

    if (moduleParam === 'pattern_match' && canPlayUiModule('pattern_match')) {
      const levels = MODULE_LEVELS.pattern_match
        .filter((level) => isLevelAllowed('pattern_match', level.id))
        .map((level) => variantCard(level.name, () => launchPatternMatch(level.id), level.id));
      return (
        <>
          <Text style={{ fontSize: fs(22), fontWeight: '600', marginBottom: s(4) }}>Hold the Code</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginBottom: s(16) }}>
            Hold a code — tap every exact match
          </Text>
          {gameSummary(moduleParam)}
          {levels.length === 0 ? noLevelsCard('No levels assigned yet') : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>{levels}</View>}
        </>
      );
    }

    if (moduleParam === 'computer_vision' && canPlayUiModule('computer_vision')) {
      const levels = MODULE_LEVELS.computer_vision
        .filter((level) => isLevelAllowed('computer_vision', level.id))
        .map((level) => variantCard(level.name, () => launchComputerVision(level.id), level.id));
      return (
        <>
          <Text style={{ fontSize: fs(22), fontWeight: '600', marginBottom: s(4) }}>Gaze Hold</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginBottom: s(16) }}>
            Look at the still bubble and hold your gaze to pop it
          </Text>
          {gameSummary(moduleParam)}
          {levels.length === 0 ? noLevelsCard('No levels assigned yet') : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>{levels}</View>}
        </>
      );
    }

    if (moduleParam === 'familiar_faces' && canPlayUiModule('familiar_faces')) {
      const levels = MODULE_LEVELS.familiar_faces
        .filter((level) => isLevelAllowed('familiar_faces', level.id))
        .map((level) => variantCard(level.name, () => launchFamiliarFaces(level.id), level.id));
      return (
        <>
          <Text style={{ fontSize: fs(22), fontWeight: '600', marginBottom: s(4) }}>Familiar Faces</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginBottom: s(16) }}>
            Add family photos, then name, find, or hold a face
          </Text>
          {gameSummary(moduleParam)}
          {levels.length === 0 ? noLevelsCard('No levels assigned yet') : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>{levels}</View>}
        </>
      );
    }

    if (moduleParam === 'direction_sense' && canPlayUiModule('direction_sense')) {
      const levels = MODULE_LEVELS.direction_sense
        .filter((level) => isLevelAllowed('direction_sense', level.id))
        .map((level) => variantCard(level.name, () => launchDirectionSense(level.id), level.id));
      return (
        <>
          <Text style={{ fontSize: fs(22), fontWeight: '600', marginBottom: s(4) }}>Direction Sense</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginBottom: s(16) }}>
            Face & Flip: pick the 90° turn. Straighten: spin the letter to match.
          </Text>
          {gameSummary(moduleParam)}
          {levels.length === 0 ? noLevelsCard('No levels assigned yet') : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>{levels}</View>}
        </>
      );
    }

    if (moduleParam === 'location_memory' && canPlayUiModule('location_memory')) {
      const levels = MODULE_LEVELS.location_memory
        .filter((level) => isLevelAllowed('location_memory', level.id))
        .map((level) => variantCard(level.name, () => launchLocationMemory(level.id), level.id));
      return (
        <>
          <Text style={{ fontSize: fs(22), fontWeight: '600', marginBottom: s(4) }}>Location Memory</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginBottom: s(16) }}>
            Explore the grid, then recall each number
          </Text>
          {gameSummary(moduleParam)}
          {levels.length === 0 ? noLevelsCard('No levels assigned yet') : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>{levels}</View>}
        </>
      );
    }

    if (selectedFamily) {
      return (
        <>
          <Text style={{ fontSize: fs(21), fontWeight: '600' }}>{selectedFamily.title}</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginTop: s(8), marginBottom: s(34) }}>
            {selectedFamily.body}
          </Text>
          {familyActivityCards.length === 0 ? (
            <View style={{ backgroundColor: colors.white, borderRadius: s(24), padding: s(28), alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: fs(18), fontWeight: '700' }}>No activities prescribed yet</Text>
              <Text style={{ fontSize: fs(13), color: colors.muted, marginTop: s(8), textAlign: 'center' }}>
                Your doctor has not added any games in this family.
              </Text>
            </View>
          ) : (
            <>
              <Text style={{ fontSize: fs(13), fontWeight: '600', color: '#374151', marginBottom: s(13) }}>Choose an activity</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(13) }}>
                {familyActivityCards.map((card) =>
                  gridCard(card.uiId, card.title, card.body, card.accent, card.bar, card.badge, 'Play', () => handleSelectModule(card.uiId)),
                )}
              </View>
            </>
          )}
        </>
      );
    }

    if (pageParam === 'games') return renderGames();

    return (
      <>
        <Text style={{ fontSize: fs(21), fontWeight: '600', marginBottom: s(34) }}>Vision Therapy Dashboard</Text>
        <PracticeSummary
          sessions={practiceSessions}
          doctorName={session.patient?.doctorName}
          doctorCode={session.patient?.referralCode}
          fs={fs}
          s={s}
          onSessionsPress={() => setPanel('history')}
        />
      </>
    );
  };

  function renderGames() {
    return (
    <>
      <Text style={{ fontSize: fs(21), fontWeight: '600', marginBottom: s(34) }}>My games</Text>
      <View style={{ flexDirection: 'row', backgroundColor: '#E5E7EB', borderRadius: s(13), padding: s(8), marginBottom: s(34) }}>
          {(
            [
              { id: 'normal' as const, label: 'Standard games', count: normalPrescribedCount },
              { id: 'pediatric' as const, label: 'Pediatric games', count: pediatricPrescribedCount },
            ]
          ).map((tab) => {
            const active = catalog === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setCatalog(tab.id)}
                style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(8), borderRadius: s(8), paddingVertical: s(13), paddingHorizontal: s(13), backgroundColor: active ? colors.white : 'transparent' }}
              >
                <PracticeTabCue label={tab.label} count={tab.count} active={active} fontSize={fs(13)} countSize={fs(11)} line={s(16)} />
              </Pressable>
            );
          })}
        </View>

        {catalog === 'pediatric' && visibleFamilies.length === 0 ? (
          <View style={{ backgroundColor: colors.white, borderRadius: s(24), padding: s(28), alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginBottom: s(16), ...cardShadow }}>
            <Text style={{ fontSize: fs(18), fontWeight: '700' }}>No pediatric games yet</Text>
            <Text style={{ fontSize: fs(13), color: colors.muted, marginTop: s(8), textAlign: 'center' }}>
              Pediatric games will appear here when they are added.
            </Text>
            <Pressable onPress={() => setCatalog('normal')} style={{ marginTop: s(16), backgroundColor: colors.blue, borderRadius: s(12), paddingHorizontal: s(16), paddingVertical: s(10) }}>
              <Text style={{ color: colors.white, fontWeight: '700' }}>Show standard games</Text>
            </Pressable>
          </View>
        ) : null}

        {catalog === 'normal' && allowedModuleIds.size === 0 ? (
          <View style={{ backgroundColor: colors.white, borderRadius: s(24), padding: s(28), alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginBottom: s(16), ...cardShadow }}>
            <Text style={{ fontSize: fs(18), fontWeight: '700' }}>No modules prescribed yet</Text>
            <Text style={{ fontSize: fs(13), color: colors.muted, marginTop: s(8), textAlign: 'center' }}>
              Your doctor has not added any therapy modules. Check back after they prescribe one.
            </Text>
            <Pressable onPress={() => router.push('/docid')} style={{ marginTop: s(16), backgroundColor: colors.blue, borderRadius: s(12), paddingHorizontal: s(16), paddingVertical: s(10) }}>
              <Text style={{ color: colors.white, fontWeight: '700' }}>Open DocID</Text>
            </Pressable>
          </View>
        ) : null}

        {visibleFamilies.length > 0 ? (
          <Text style={{ fontSize: fs(13), fontWeight: '600', color: '#374151', marginBottom: s(13) }}>Choose a family</Text>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(13) }}>
          {visibleFamilies.map((family) => {
            const playableCount = family.moduleIds.filter((catalogId) =>
              canPlayUiModule(CATALOG_TO_UI_MODULE[catalogId]),
            ).length;
            return gridCard(
              family.id,
              family.title,
              family.body,
              family.accent,
              family.bar,
              `${playableCount} ${playableCount === 1 ? 'activity' : 'activities'}`,
              'Open',
              () => handleSelectFamily(family.id),
            );
          })}
        </View>
    </>
    );
  }

  function renderPatientNav() {
    const items = [
      {
        id: 'practice',
        label: 'Dashboard',
        icon: LayoutDashboardIcon,
        active: panel === null && !pageParam && !familyParam && !moduleParam,
        onPress: () => {
          setPanel(null);
          setNavOpen(false);
          router.replace('/dashboard');
        },
      },
      {
        id: 'games',
        label: 'My games',
        icon: EyeIcon,
        active: panel === null && (pageParam === 'games' || Boolean(familyParam) || Boolean(moduleParam)),
        onPress: () => {
          setPanel(null);
          setNavOpen(false);
          router.replace('/dashboard?page=games');
        },
      },
      {
        id: 'analytics',
        label: 'Analytics',
        icon: AnalyticsIcon,
        active: panel === null && pageParam === 'analytics',
        onPress: () => {
          setPanel(null);
          setNavOpen(false);
          router.push('/dashboard?page=analytics');
        },
      },
      {
        id: 'history',
        label: 'Session history',
        icon: HistoryIcon,
        active: panel === 'history',
        onPress: () => {
          setPanel('history');
          setNavOpen(false);
        },
      },
      {
        id: 'subscription',
        label: 'Subscription',
        icon: CreditCardIcon,
        active: panel === 'subscription',
        onPress: () => {
          setPanel('subscription');
          setNavOpen(false);
        },
      },
      {
        id: 'account',
        label: 'Account',
        icon: UserIcon,
        active: panel === 'account',
        onPress: () => {
          setPanel('account');
          setNavOpen(false);
        },
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: GearIcon,
        active: panel === 'settings',
        onPress: () => {
          setPanel('settings');
          setNavOpen(false);
        },
      },
      {
        id: 'help',
        label: 'Help',
        icon: InfoIcon,
        active: panel === 'help',
        onPress: () => {
          setPanel('help');
          setNavOpen(false);
        },
      },
    ];
    return (
      <View style={{ backgroundColor: colors.white, borderRadius: s(13), borderWidth: 1, borderColor: colors.border, padding: s(13), ...cardShadow }}>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Pressable
              key={item.id}
              onPress={item.onPress}
              accessibilityRole="button"
              accessibilityState={{ selected: item.active }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), borderRadius: s(12), paddingHorizontal: s(12), paddingVertical: s(10), backgroundColor: item.active ? '#111827' : 'transparent' }}
            >
              <Icon size={s(16)} color={item.active ? colors.white : '#374151'} />
              <Text style={{ fontSize: fs(14), fontWeight: '600', color: item.active ? colors.white : '#374151' }}>{item.label}</Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => {
            void logout().then(() => router.replace('/'));
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), borderRadius: s(12), paddingHorizontal: s(12), paddingVertical: s(10), marginTop: s(8) }}
        >
          <LogOutIcon size={s(16)} color="#DC2626" />
          <Text style={{ fontSize: fs(14), fontWeight: '600', color: '#DC2626' }}>Sign out</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <AppHeader
        leading={
          isTablet ? null : (
            <Pressable
              accessibilityLabel={navOpen ? 'Close sidebar' : 'Open sidebar'}
              onPress={() => setNavOpen((open) => !open)}
              hitSlop={s(8)}
              style={{ width: s(36), height: s(36), alignItems: 'center', justifyContent: 'center' }}
            >
              <SideDockIcon size={s(22)} color="#111827" open={navOpen} />
            </Pressable>
          )
        }
        onBack={headerBackAction}
      />
      <Modal visible={navOpen && !isTablet} transparent animationType="fade" onRequestClose={() => setNavOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.4)' }} onPress={() => setNavOpen(false)}>
          <View style={{ marginTop: s(68), marginLeft: s(13), width: s(220) }}>{renderPatientNav()}</View>
        </Pressable>
      </Modal>
      <View style={{ flex: 1, flexDirection: isTablet ? 'row' : 'column' }}>
        {isTablet ? <View style={{ width: s(220), paddingLeft: pad, paddingTop: pad }}>{renderPatientNav()}</View> : null}
        <ScrollView
          ref={scrollViewRef}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          bounces={false}
          overScrollMode="never"
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: pad, flexGrow: 0, paddingBottom: s(24) }}
        >
          {renderContent()}
        </ScrollView>
      </View>

      {session?.user.role === 'patient' && (
        <EditPatientNameModal
          visible={showWelcome}
          onClose={() => {
            setShowWelcome(false);
            if (session?.isNewUser) {
              applySession({ ...session, isNewUser: false });
            }
          }}
          isWelcome={true}
        />
      )}
    </View>
  );
}
