import { calendarDayKey, calendarMonthKey, shiftUtcDateKey } from './game-session';
import { ALL_MODULE_IDS, GAME_CATALOG, MODULE_LEVELS, isTherapyModuleId } from './game-registry';
import { buildLevelAnalytics, type LevelAnalytics, type LevelContextMatch, type LevelDailyPoint } from './level-analytics';
import { round1 } from './session-metrics';
import type { SessionDetail } from './session-detail';

export const OVERVIEW_SESSION_CAP = 2000;

export const RECORDED_DURATION_NOTE =
  'Recorded duration adds the stored time on each saved session. Pursuit and Bubble Chase store the sum of trial times. Other games store time to finish. This is not continuous time spent exercising.';

export const GAZE_HOLD_RECORD_NOTE =
  'Gaze Hold sessions are not saved, so they are not part of this record.';

export const EMPTY_PERIOD_LABEL = 'No session saved';

export const TRUNCATED_HISTORY_NOTE =
  'This range has more saved sessions than this list can return. Older sessions were left out. These totals are incomplete.';

export type DurationMeaning = 'sum_of_trial_times' | 'time_to_finish';
export type PeriodAvailability = 'recorded' | 'none_saved';
export type InsightPreset = '7d' | '30d' | '90d';

export interface PracticeInsightRow {
  id: string;
  sessionNumber: number;
  gameId: string;
  levelId: string | null;
  deviceTier: string | null;
  recordedAt: string;
  durationSec: number;
  correct: number;
  wrongTaps: number;
  misses: number;
  timeouts: number;
  accuracy: number;
  avgReactionSec: number;
  medianReactionSec: number;
  reactionMs: number[] | null;
  stimuliCount: number;
  gameName: string;
  contrastPercent?: number | null;
  detail?: SessionDetail | null;
}

export interface PracticePeriod {
  key: string;
  sessionCount: number;
  availability: PeriodAvailability;
}

export interface DurationSummary {
  totalSec: number | null;
  averageSec: number | null;
  countedSessions: number;
  excludedSessions: number;
  availability: 'recorded' | 'unavailable';
}

export interface PracticeInsights {
  sessionCount: number;
  undatedCount: number;
  outsideRangeCount: number;
  activeDays: number;
  /** Saved sessions divided by every Monday week that overlaps the range, including weeks with none saved. */
  sessionsPerWeek: number | null;
  weeks: PracticePeriod[];
  months: PracticePeriod[];
  duration: DurationSummary;
  medianIntervalSec: number | null;
  latestIntervalSec: number | null;
}

export interface RecordedLevelStop {
  levelId: string | null;
  levelName: string;
  firstRecordedAt: string;
  lastRecordedAt: string;
  sessionCount: number;
}

export interface OverviewLevel {
  gameId: string;
  levelId: string | null;
  levelName: string;
  sessionCount: number;
  firstRecordedAt: string;
  lastRecordedAt: string;
  performanceLabel: string | null;
  performanceValue: number | null;
  reactionLabel: string | null;
  reactionMeanSec: number | null;
  daily: LevelDailyPoint[];
  analyticsStatus: 'ok' | 'invalid' | 'unrecorded';
  detailRecorded: number;
  detailUnavailable: number;
  contextMatches: LevelContextMatch[];
}

export interface OverviewGame {
  gameId: string;
  gameName: string;
  sessionCount: number;
  duration: DurationSummary;
  durationMeaning: DurationMeaning;
  durationLabel: string;
  levels: OverviewLevel[];
  sequence: RecordedLevelStop[];
}

export interface PatientOverview {
  from: string;
  to: string;
  timeZone: string;
  truncated: boolean;
  omitted: 'older' | null;
  cap: number;
  practice: PracticeInsights;
  games: OverviewGame[];
  recent: PracticeInsightRow[];
  durationNote: string;
  gazeHoldNote: string;
}

export interface PatientLevelView {
  gameId: string;
  levelId: string | null;
  levelName: string;
  sessionCount: number;
  firstRecordedAt: string;
  lastRecordedAt: string;
  performanceLabel: string | null;
  performanceValue: number | null;
  reactionLabel: string | null;
  reactionMeanSec: number | null;
  daily: LevelDailyPoint[];
  analyticsStatus: 'ok' | 'invalid' | 'unrecorded';
}

export interface PatientOverviewView {
  from: string;
  to: string;
  timeZone: string;
  truncated: boolean;
  omitted: 'older' | null;
  practice: PracticeInsights;
  games: Array<Omit<OverviewGame, 'levels'> & { levels: PatientLevelView[] }>;
  recent: Array<Omit<PracticeInsightRow, 'detail'>>;
  durationNote: string;
  gazeHoldNote: string;
}

export function durationMeaning(gameId: string): DurationMeaning {
  return gameId === 'pursuit' || gameId === 'mobile_target' ? 'sum_of_trial_times' : 'time_to_finish';
}

export function durationMeaningLabel(meaning: DurationMeaning): string {
  return meaning === 'sum_of_trial_times' ? 'Sum of trial times' : 'Time to finish';
}

/** Inclusive local dates. 7 days is today and the previous 6 calendar days. */
export function insightPresetRange(preset: InsightPreset, nowIso: string, timeZone: string): { from: string; to: string } {
  const today = calendarDayKey(nowIso, timeZone);
  const span = preset === '7d' ? 6 : preset === '30d' ? 29 : 89;
  return { from: shiftUtcDateKey(today, -span), to: today };
}

/** Monday YYYY-MM-DD of the civil week containing `dayKey`. Sunday belongs to the previous Monday. */
export function mondayWeekKey(dayKey: string): string {
  const [year, month, day] = dayKey.split('-').map(Number);
  const utc = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  const weekday = utc.getUTCDay();
  const delta = weekday === 0 ? -6 : 1 - weekday;
  utc.setUTCDate(utc.getUTCDate() + delta);
  return utc.toISOString().slice(0, 10);
}

export function selectNewestOverview<T>(newestFirst: readonly T[], cap = OVERVIEW_SESSION_CAP): {
  rows: T[];
  truncated: boolean;
  omitted: 'older' | null;
  cap: number;
} {
  const truncated = newestFirst.length > cap;
  return {
    rows: newestFirst.slice(0, cap),
    truncated,
    omitted: truncated ? 'older' : null,
    cap,
  };
}

function validDuration(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function summarizeDuration(rows: readonly { durationSec: number }[]): DurationSummary {
  const valid = rows.map((row) => row.durationSec).filter(validDuration);
  if (valid.length === 0) {
    return {
      totalSec: null,
      averageSec: null,
      countedSessions: 0,
      excludedSessions: rows.length,
      availability: 'unavailable',
    };
  }
  const total = valid.reduce((sum, value) => sum + value, 0);
  return {
    totalSec: total,
    averageSec: round1(total / valid.length),
    countedSessions: valid.length,
    excludedSessions: rows.length - valid.length,
    availability: 'recorded',
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return round1(value);
}

function enumerateDays(from: string, to: string): string[] {
  const days: string[] = [];
  let cursor = from;
  while (cursor <= to && days.length < 4000) {
    days.push(cursor);
    cursor = shiftUtcDateKey(cursor, 1);
  }
  return days;
}

function fillPeriods(keys: string[], counts: Map<string, number>): PracticePeriod[] {
  return keys.map((key) => {
    const sessionCount = counts.get(key) ?? 0;
    return { key, sessionCount, availability: sessionCount > 0 ? 'recorded' : 'none_saved' };
  });
}

function rowsInRange(rows: readonly PracticeInsightRow[], timeZone: string, from: string, to: string): {
  dated: PracticeInsightRow[];
  undatedCount: number;
  outsideRangeCount: number;
} {
  const dated: PracticeInsightRow[] = [];
  let undatedCount = 0;
  let outsideRangeCount = 0;
  for (const row of rows) {
    const day = calendarDayKey(row.recordedAt, timeZone);
    if (day === 'unknown') {
      undatedCount += 1;
      continue;
    }
    if (day < from || day > to) {
      outsideRangeCount += 1;
      continue;
    }
    dated.push(row);
  }
  return { dated, undatedCount, outsideRangeCount };
}

export function buildPracticeInsights(
  rows: readonly PracticeInsightRow[],
  options: { timeZone: string; from: string; to: string },
): PracticeInsights {
  const from = options.from <= options.to ? options.from : options.to;
  const to = options.from <= options.to ? options.to : options.from;
  const { dated, undatedCount, outsideRangeCount } = rowsInRange(rows, options.timeZone, from, to);
  const weekCounts = new Map<string, number>();
  const monthCounts = new Map<string, number>();
  const days = new Set<string>();
  for (const row of dated) {
    const day = calendarDayKey(row.recordedAt, options.timeZone);
    days.add(day);
    const week = mondayWeekKey(day);
    const month = calendarMonthKey(row.recordedAt, options.timeZone);
    weekCounts.set(week, (weekCounts.get(week) ?? 0) + 1);
    monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
  }
  const weekKeys: string[] = [];
  const monthKeys: string[] = [];
  for (const day of enumerateDays(from, to)) {
    const week = mondayWeekKey(day);
    if (!weekKeys.includes(week)) weekKeys.push(week);
    const month = day.slice(0, 7);
    if (!monthKeys.includes(month)) monthKeys.push(month);
  }
  const ordered = dated
    .filter((row) => !Number.isNaN(new Date(row.recordedAt).getTime()))
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.sessionNumber - b.sessionNumber);
  const gaps: number[] = [];
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = new Date(ordered[index - 1].recordedAt).getTime();
    const current = new Date(ordered[index].recordedAt).getTime();
    gaps.push((current - previous) / 1000);
  }
  return {
    sessionCount: dated.length,
    undatedCount,
    outsideRangeCount,
    activeDays: days.size,
    sessionsPerWeek: weekKeys.length > 0 ? round1(dated.length / weekKeys.length) : null,
    weeks: fillPeriods(weekKeys, weekCounts),
    months: fillPeriods(monthKeys, monthCounts),
    duration: summarizeDuration(dated),
    medianIntervalSec: median(gaps),
    latestIntervalSec: gaps.length > 0 ? round1(gaps[gaps.length - 1]) : null,
  };
}

function levelDisplayName(gameId: string, levelId: string | null): string {
  if (!levelId) return 'Level not recorded';
  if (!isTherapyModuleId(gameId)) return levelId;
  return MODULE_LEVELS[gameId].find((level) => level.id === levelId)?.name ?? levelId;
}

function gameDisplayName(gameId: string, rows: readonly PracticeInsightRow[]): string {
  if (isTherapyModuleId(gameId)) return GAME_CATALOG[gameId].name;
  const named = rows.find((row) => row.gameName.trim());
  return named ? named.gameName.trim() : gameId;
}

function detailCounts(rows: readonly PracticeInsightRow[]): { recorded: number; unavailable: number } {
  let recorded = 0;
  for (const row of rows) {
    if (row.detail && row.detail.status === 'ok') recorded += 1;
  }
  return { recorded, unavailable: rows.length - recorded };
}

function earliest(rows: readonly PracticeInsightRow[]): string {
  return rows.slice().sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))[0]?.recordedAt ?? '';
}

function latestAt(rows: readonly PracticeInsightRow[]): string {
  const sorted = rows.slice().sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  return sorted[sorted.length - 1]?.recordedAt ?? '';
}

function levelFromAnalytics(gameId: string, levelId: string, rows: PracticeInsightRow[], analytics: LevelAnalytics): OverviewLevel {
  const counts = detailCounts(rows);
  const base = {
    gameId,
    levelId,
    levelName: levelDisplayName(gameId, levelId),
    sessionCount: rows.length,
    firstRecordedAt: earliest(rows),
    lastRecordedAt: latestAt(rows),
    detailRecorded: counts.recorded,
    detailUnavailable: counts.unavailable,
  };
  if (analytics.status !== 'ok') {
    return {
      ...base,
      performanceLabel: null,
      performanceValue: null,
      reactionLabel: null,
      reactionMeanSec: null,
      daily: [],
      analyticsStatus: 'invalid',
      contextMatches: [],
    };
  }
  return {
    ...base,
    levelName: analytics.levelName,
    performanceLabel: analytics.performanceLabel,
    performanceValue: analytics.performanceValue,
    reactionLabel: analytics.reactionLabel,
    reactionMeanSec: analytics.reactionMeanSec,
    daily: analytics.daily,
    analyticsStatus: 'ok',
    contextMatches: analytics.contextMatches,
  };
}

function unrecordedLevel(gameId: string, rows: PracticeInsightRow[]): OverviewLevel {
  const counts = detailCounts(rows);
  return {
    gameId,
    levelId: null,
    levelName: 'Level not recorded',
    sessionCount: rows.length,
    firstRecordedAt: earliest(rows),
    lastRecordedAt: latestAt(rows),
    performanceLabel: null,
    performanceValue: null,
    reactionLabel: null,
    reactionMeanSec: null,
    daily: [],
    analyticsStatus: 'unrecorded',
    detailRecorded: counts.recorded,
    detailUnavailable: counts.unavailable,
    contextMatches: [],
  };
}

export function buildPatientOverview(
  rows: readonly PracticeInsightRow[],
  options: { timeZone: string; from: string; to: string; truncated?: boolean; omitted?: 'older' | null; cap?: number },
): PatientOverview {
  const from = options.from <= options.to ? options.from : options.to;
  const to = options.from <= options.to ? options.to : options.from;
  const practice = buildPracticeInsights(rows, { timeZone: options.timeZone, from, to });
  const { dated } = rowsInRange(rows, options.timeZone, from, to);
  const byGame = new Map<string, PracticeInsightRow[]>();
  for (const row of dated) {
    const list = byGame.get(row.gameId) ?? [];
    list.push(row);
    byGame.set(row.gameId, list);
  }
  const gameIds = Array.from(byGame.keys()).sort((a, b) => {
    const aIndex = ALL_MODULE_IDS.indexOf(a as (typeof ALL_MODULE_IDS)[number]);
    const bIndex = ALL_MODULE_IDS.indexOf(b as (typeof ALL_MODULE_IDS)[number]);
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });
  const games = gameIds.map((gameId) => {
    const gameRows = byGame.get(gameId) ?? [];
    const byLevel = new Map<string, PracticeInsightRow[]>();
    const unrecorded: PracticeInsightRow[] = [];
    for (const row of gameRows) {
      if (!row.levelId) {
        unrecorded.push(row);
        continue;
      }
      const list = byLevel.get(row.levelId) ?? [];
      list.push(row);
      byLevel.set(row.levelId, list);
    }
    const levels = Array.from(byLevel.entries()).map(([levelId, levelRows]) =>
      levelFromAnalytics(
        gameId,
        levelId,
        levelRows,
        buildLevelAnalytics({ gameId, levelId, timeZone: options.timeZone, rows: levelRows }),
      ),
    );
    if (unrecorded.length > 0) levels.push(unrecordedLevel(gameId, unrecorded));
    const stops = new Map<string, PracticeInsightRow[]>();
    for (const row of gameRows) {
      const key = row.levelId ?? '';
      const list = stops.get(key) ?? [];
      list.push(row);
      stops.set(key, list);
    }
    const sequence = Array.from(stops.entries())
      .map(([key, stopRows]) => ({
        levelId: key ? key : null,
        levelName: levelDisplayName(gameId, key || null),
        firstRecordedAt: earliest(stopRows),
        lastRecordedAt: latestAt(stopRows),
        sessionCount: stopRows.length,
      }))
      .sort((a, b) => a.firstRecordedAt.localeCompare(b.firstRecordedAt) || a.levelName.localeCompare(b.levelName));
    return {
      gameId,
      gameName: gameDisplayName(gameId, gameRows),
      sessionCount: gameRows.length,
      duration: summarizeDuration(gameRows),
      durationMeaning: durationMeaning(gameId),
      durationLabel: durationMeaningLabel(durationMeaning(gameId)),
      levels,
      sequence,
    };
  });
  const recent = dated
    .slice()
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt) || b.sessionNumber - a.sessionNumber)
    .slice(0, 8);
  return {
    from,
    to,
    timeZone: options.timeZone,
    truncated: Boolean(options.truncated),
    omitted: options.omitted ?? null,
    cap: options.cap ?? OVERVIEW_SESSION_CAP,
    practice,
    games,
    recent,
    durationNote: RECORDED_DURATION_NOTE,
    gazeHoldNote: GAZE_HOLD_RECORD_NOTE,
  };
}

export function projectPatientOverview(overview: PatientOverview): PatientOverviewView {
  return {
    from: overview.from,
    to: overview.to,
    timeZone: overview.timeZone,
    truncated: overview.truncated,
    omitted: overview.omitted,
    practice: overview.practice,
    games: overview.games.map((game) => ({
      gameId: game.gameId,
      gameName: game.gameName,
      sessionCount: game.sessionCount,
      duration: game.duration,
      durationMeaning: game.durationMeaning,
      durationLabel: game.durationLabel,
      sequence: game.sequence,
      levels: game.levels.map((level) => ({
        gameId: level.gameId,
        levelId: level.levelId,
        levelName: level.levelName,
        sessionCount: level.sessionCount,
        firstRecordedAt: level.firstRecordedAt,
        lastRecordedAt: level.lastRecordedAt,
        performanceLabel: level.performanceLabel,
        performanceValue: level.performanceValue,
        reactionLabel: level.reactionLabel,
        reactionMeanSec: level.reactionMeanSec,
        daily: level.daily,
        analyticsStatus: level.analyticsStatus,
      })),
    })),
    recent: overview.recent.map((row) => {
      const copy: PracticeInsightRow = { ...row };
      delete copy.detail;
      return copy;
    }),
    durationNote: overview.durationNote,
    gazeHoldNote: overview.gazeHoldNote,
  };
}
