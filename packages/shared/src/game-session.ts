import { reactionStatsFromMs } from './game-logic';
import { GAME_CATALOG, MODULE_LEVELS, isTherapyModuleId } from './game-registry';
import { efficiencyIndex, round1, sessionAccuracy, sessionErrorRate } from './session-metrics';
import type { AnalyticsMetricId } from './session-analytics-copy';
import { PERSISTABLE_SESSION_ENDED_BY, type DeviceTier, type SessionResultData, type TherapyModuleId } from './types';

export const GAME_SESSION_METRICS_VERSION = 1;

export type DailyAggMode = 'pooled' | 'best';

export interface CreateGameSessionPayload {
  clientEventId: string;
  gameId: TherapyModuleId;
  levelId?: string | null;
  deviceTier?: DeviceTier | string | null;
  recordedAt: string;
  durationSec: number;
  correct: number;
  wrongTaps: number;
  misses: number;
  timeouts: number;
  accuracy: number;
  avgReactionSec: number;
  medianReactionSec: number;
  efficiencyIndex: number;
  reactionMs: number[];
  stimuliCount: number;
  gameName: string;
  bgColor?: string;
  stimulusColor?: string;
  contrastPercent?: number;
  metricsVersion: number;
}

export interface StoredGameSession {
  id: string;
  sessionNumber: number;
  gameId: TherapyModuleId;
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
  efficiencyIndex: number;
  reactionMs: number[];
  stimuliCount: number;
  gameName: string;
  bgColor?: string | null;
  stimulusColor?: string | null;
  contrastPercent?: number | null;
  metricsVersion: number;
}

export interface DailyPlotSessionTip {
  sessionNumber: number;
  recordedAt: string;
  accuracy: number;
  avgReactionSec: number;
  durationSec: number;
  efficiencyIndex: number;
  wrongTaps: number;
  misses: number;
  timeouts: number;
}

export interface DailyPlotPoint {
  date: string;
  pooledAccuracy: number;
  pooledAvgReactionSec: number;
  pooledMedianReactionSec: number;
  pooledEfficiency: number;
  wrongTapRate: number;
  missRate: number;
  timeoutRate: number;
  sessionCount: number;
  /** Mean sitting length (seconds) of finished plays in the bucket. */
  pooledDurationSec: number;
  /** Best-of-day: highest accuracy / lowest RT / highest efficiency / shortest sitting. */
  bestAccuracy: number;
  bestAvgReactionSec: number;
  bestEfficiency: number;
  bestDurationSec: number;
  sessions: DailyPlotSessionTip[];
}

export interface GameSessionAnalytics {
  sessions: StoredGameSession[];
  daily: DailyPlotPoint[];
  totals: {
    sessionCount: number;
    lastPlayedAt: string | null;
    avgAccuracy: number | null;
  };
  preliminary: boolean;
}

/** Map a results-card title to a catalog module. Look Pursuit is stored as computer_vision. */
export function inferTherapyModuleId(gameName: string): TherapyModuleId | null {
  const n = (gameName || '').toLowerCase();
  if (n.includes('rotatory')) return 'rotatory';
  if (n.includes('sorting')) return 'sorting';
  if (n.includes('bee')) return 'bee_tracing';
  if (n.includes('look pursuit') || n.includes('gaze hold')) return 'computer_vision';
  if (n.includes('pursuit')) return 'pursuit';
  if (n.includes('bubble chase') || n.includes('mobile target')) return 'mobile_target';
  if (n.includes('geoboard') || n.includes('draw a pattern')) return 'geoboard';
  if (n.includes('peripheral')) return 'peripheral_view';
  if (n.includes('crowded') || n.includes('number search')) return 'number_search';
  if (n.includes('hold the code') || n.includes('pattern match')) return 'pattern_match';
  if (n.includes('location memory')) return 'location_memory';
  if (n.includes('direction sense')) return 'direction_sense';
  if (n.includes('familiar')) return 'familiar_faces';
  const byCatalog = Object.values(GAME_CATALOG).find((entry) => n.includes(entry.name.toLowerCase()));
  return byCatalog ? byCatalog.id : null;
}

function knownLevelId(gameId: TherapyModuleId, candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  const levels = MODULE_LEVELS[gameId] ?? [];
  if (levels.some((level) => level.id === candidate)) return candidate;
  const lower = candidate.toLowerCase();
  return levels.find((level) => level.name.toLowerCase() === lower)?.id ?? null;
}

function matchLevelFromGameName(gameId: TherapyModuleId, gameName: string): string | null {
  const n = (gameName || '').toLowerCase();
  const levels = [...(MODULE_LEVELS[gameId] ?? [])].sort((a, b) => b.id.length - a.id.length);
  for (const level of levels) {
    if (n.includes(`(${level.id})`) || n.includes(` ${level.id}`) || n.includes(`-${level.id}`)) {
      return level.id;
    }
    if (n.includes(level.name.toLowerCase())) return level.id;
  }
  return null;
}

/** Map a finished play onto a catalog level id, or null when unknown. */
export function inferTherapyLevelId(gameId: TherapyModuleId, data: SessionResultData): string | null {
  const extra = data as SessionResultData & Record<string, unknown>;
  const fromField = knownLevelId(gameId, typeof extra.levelId === 'string' ? extra.levelId : null);
  if (fromField) return fromField;

  switch (gameId) {
    case 'rotatory': {
      const mode = extra.mode;
      const variant = extra.alphabetVariant;
      if (mode === 'colors') return 'colors';
      if (mode === 'numbers') return 'numbers';
      if (mode === 'alphabets' && (variant === 'uppercase' || variant === 'lowercase')) return variant;
      break;
    }
    case 'sorting':
      break;
    case 'bee_tracing':
      return knownLevelId(gameId, typeof extra.pathType === 'string' ? extra.pathType : null);
    case 'pursuit':
    case 'computer_vision':
      return knownLevelId(gameId, typeof extra.movementPattern === 'string' ? extra.movementPattern : null);
    case 'mobile_target': {
      const mode = extra.gameMode;
      const variant = extra.alphabetVariant;
      if (mode === 'colors') return 'colors';
      if (mode === 'numbers') return 'numbers';
      if (mode === 'alphabets' && (variant === 'uppercase' || variant === 'lowercase')) return variant;
      break;
    }
    case 'geoboard':
      if (extra.boardId != null) return knownLevelId(gameId, String(extra.boardId));
      break;
    case 'peripheral_view':
      return knownLevelId(gameId, typeof extra.peripheralField === 'string' ? extra.peripheralField : null);
    case 'number_search':
      return 'standard';
    case 'pattern_match':
      return extra.stimulusMode === 'compound' ? 'compound' : extra.stimulusMode === 'digits' ? 'standard' : null;
    case 'location_memory':
      if (extra.playMode === 'pairs') return 'match';
      if (typeof extra.activeCellsConfigured === 'number' && extra.activeCellsConfigured <= 5) return 'practice';
      if (extra.playMode === 'recall') return 'standard';
      break;
    case 'direction_sense': {
      const transform = extra.transformMode;
      if (transform === 'flip') return 'flip';
      if (transform === 'straighten' || transform === 'mixed') return 'straighten';
      if (transform === 'face') return 'face';
      break;
    }
    default:
      break;
  }

  return matchLevelFromGameName(gameId, data.gameName);
}

export function utcDateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

/** Finished protocols only. Quits / abandoned plays must not enter analytics. */
export function sessionResultShouldPersist(data: SessionResultData): boolean {
  if (data.abandoned) return false;
  if (data.endedBy === 'abandoned') return false;
  if (data.endedBy != null && !PERSISTABLE_SESSION_ENDED_BY.has(data.endedBy)) return false;
  return true;
}

export function payloadFromSessionResult(
  data: SessionResultData,
  extra?: { gameId?: TherapyModuleId; levelId?: string | null; deviceTier?: string | null },
): CreateGameSessionPayload | null {
  if (!sessionResultShouldPersist(data)) return null;
  const gameId = extra?.gameId || inferTherapyModuleId(data.gameName);
  if (!gameId || !isTherapyModuleId(gameId)) return null;
  const clientEventId = data.clientEventId || `${data.recordedAt || data.date}-${data.durationSec}-${data.correct}`;
  const levelId = extra?.levelId || inferTherapyLevelId(gameId, data);
  return {
    clientEventId,
    gameId,
    levelId: levelId || undefined,
    deviceTier: extra?.deviceTier || undefined,
    recordedAt: data.recordedAt || new Date().toISOString(),
    durationSec: Math.max(0, Math.round(Number(data.durationSec) || 0)),
    correct: Math.max(0, Math.round(Number(data.correct) || 0)),
    wrongTaps: Math.max(0, Math.round(Number(data.wrongTaps) || 0)),
    misses: Math.max(0, Math.round(Number(data.misses) || 0)),
    timeouts: Math.max(0, Math.round(Number(data.timeouts) || 0)),
    accuracy: data.accuracy,
    avgReactionSec: data.avgReactionSec,
    medianReactionSec: data.medianReactionSec,
    efficiencyIndex: data.efficiencyIndex ?? 0,
    reactionMs: Array.isArray(data.reactionMs) ? data.reactionMs.slice(0, 5000) : [],
    stimuliCount: Math.max(0, Math.round(Number(data.stimuliCount) || 0)),
    gameName: data.gameName,
    bgColor: data.bgColor,
    stimulusColor: data.stimulusColor,
    contrastPercent: data.contrastPercent,
    metricsVersion: GAME_SESSION_METRICS_VERSION,
  };
}

function attemptsOf(row: StoredGameSession): number {
  return row.correct + row.wrongTaps + row.misses + row.timeouts;
}

export function poolSessionsByDate(sessions: StoredGameSession[]): DailyPlotPoint[] {
  return poolSessionsByKey(sessions, (row) => utcDateKey(row.recordedAt));
}

export function utcMonthKey(iso: string): string {
  return utcDateKey(iso).slice(0, 7);
}

export function poolSessionsByMonth(sessions: StoredGameSession[]): DailyPlotPoint[] {
  return poolSessionsByKey(sessions, (row) => utcMonthKey(row.recordedAt));
}

function poolSessionsByKey(
  sessions: StoredGameSession[],
  keyOf: (row: StoredGameSession) => string,
): DailyPlotPoint[] {
  const byKey = new Map<string, StoredGameSession[]>();
  for (const row of sessions) {
    const key = keyOf(row);
    const list = byKey.get(key) || [];
    list.push(row);
    byKey.set(key, list);
  }
  const keys = Array.from(byKey.keys()).sort();
  return keys.map((date) => {
    const rows = byKey.get(date) || [];
    const allRt: number[] = [];
    let correct = 0;
    let wrongTaps = 0;
    let misses = 0;
    let timeouts = 0;
    for (const row of rows) {
      correct += row.correct;
      wrongTaps += row.wrongTaps;
      misses += row.misses;
      timeouts += row.timeouts;
      allRt.push(...(row.reactionMs || []));
    }
    const errorCount = wrongTaps + misses + timeouts;
    const pooledAccuracy = sessionAccuracy(correct, errorCount);
    const reaction = reactionStatsFromMs(allRt);
    const pooledEfficiency = efficiencyIndex(pooledAccuracy, reaction.avgSec);
    const attemptTotal = correct + errorCount;
    const bestAccuracy = rows.reduce((m, r) => Math.max(m, r.accuracy), 0);
    const rts = rows.map((r) => r.avgReactionSec).filter((v) => v > 0);
    const bestAvgReactionSec = rts.length ? Math.min(...rts) : 0;
    const bestEfficiency = rows.reduce((m, r) => Math.max(m, r.efficiencyIndex), 0);
    const durations = rows.map((r) => r.durationSec).filter((v) => v > 0);
    const pooledDurationSec = durations.length
      ? round1(durations.reduce((sum, v) => sum + v, 0) / durations.length)
      : 0;
    const bestDurationSec = durations.length ? Math.min(...durations) : 0;
    return {
      date,
      pooledAccuracy,
      pooledAvgReactionSec: reaction.avgSec,
      pooledMedianReactionSec: reaction.medianSec,
      pooledEfficiency,
      wrongTapRate: sessionErrorRate(wrongTaps, attemptTotal),
      missRate: sessionErrorRate(misses, attemptTotal),
      timeoutRate: sessionErrorRate(timeouts, attemptTotal),
      sessionCount: rows.length,
      pooledDurationSec,
      bestAccuracy,
      bestAvgReactionSec,
      bestEfficiency,
      bestDurationSec,
      sessions: rows
        .slice()
        .sort((a, b) => a.sessionNumber - b.sessionNumber)
        .map((row) => ({
          sessionNumber: row.sessionNumber,
          recordedAt: row.recordedAt,
          accuracy: row.accuracy,
          avgReactionSec: row.avgReactionSec,
          durationSec: row.durationSec,
          efficiencyIndex: row.efficiencyIndex,
          wrongTaps: row.wrongTaps,
          misses: row.misses,
          timeouts: row.timeouts,
        })),
    };
  });
}

export function selectDailyWindow(daily: DailyPlotPoint[], maxDates?: number): DailyPlotPoint[] {
  if (!maxDates || daily.length <= maxDates) return daily;
  return daily.slice(daily.length - maxDates);
}

export const ANALYTICS_VISIBLE_DAYS = 7;
export const ANALYTICS_VISIBLE_MONTH_DAYS = 30;
export const ANALYTICS_VISIBLE_MONTHS = 12;

export type AnalyticsTimeScale = 'week' | 'month' | 'year';

export const ANALYTICS_SCALE_LABEL: Record<AnalyticsTimeScale, string> = {
  week: 'Week',
  month: 'Month',
  year: 'Year',
};

export function zoomOutScale(scale: AnalyticsTimeScale): AnalyticsTimeScale {
  if (scale === 'week') return 'month';
  return 'year';
}

export function zoomInScale(scale: AnalyticsTimeScale): AnalyticsTimeScale {
  if (scale === 'year') return 'month';
  return 'week';
}

export function analyticsVisibleSlots(scale: AnalyticsTimeScale): number {
  if (scale === 'year') return ANALYTICS_VISIBLE_MONTHS;
  if (scale === 'month') return ANALYTICS_VISIBLE_MONTH_DAYS;
  return ANALYTICS_VISIBLE_DAYS;
}

export function shiftUtcDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function emptyDailyPlotPoint(date: string): DailyPlotPoint {
  return {
    date,
    pooledAccuracy: 0,
    pooledAvgReactionSec: 0,
    pooledMedianReactionSec: 0,
    pooledEfficiency: 0,
    wrongTapRate: 0,
    missRate: 0,
    timeoutRate: 0,
    sessionCount: 0,
    pooledDurationSec: 0,
    bestAccuracy: 0,
    bestAvgReactionSec: 0,
    bestEfficiency: 0,
    bestDurationSec: 0,
    sessions: [],
  };
}

/** Fill calendar days so a week viewport can scroll across history. Days with no play stay empty. */
export function padDailyCalendar(
  daily: DailyPlotPoint[],
  options?: { from?: string; to?: string; visibleDays?: number; nowIso?: string },
): DailyPlotPoint[] {
  const visible = Math.max(2, options?.visibleDays ?? ANALYTICS_VISIBLE_DAYS);
  const today = utcDateKey(options?.nowIso ?? new Date().toISOString());
  const played = daily.map((p) => p.date).filter(Boolean).sort();
  const defaultStart = shiftUtcDateKey(today, -(visible - 1));
  let start = options?.from || (played[0] && played[0] < defaultStart ? played[0] : defaultStart);
  let end = options?.to || today;
  if (end < start) {
    const swap = start;
    start = end;
    end = swap;
  }
  let span = 1;
  for (let key = start; key < end; key = shiftUtcDateKey(key, 1)) span += 1;
  if (span < visible) start = shiftUtcDateKey(end, -(visible - 1));

  const byDate = new Map(daily.map((p) => [p.date, p]));
  const out: DailyPlotPoint[] = [];
  for (let key = start; key <= end && out.length < 400; key = shiftUtcDateKey(key, 1)) {
    out.push(byDate.get(key) ?? emptyDailyPlotPoint(key));
  }
  return out;
}

export function shiftUtcMonthKey(monthKey: string, months: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y || 2026, (m || 1) - 1 + months, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function padMonthlyCalendar(
  monthly: DailyPlotPoint[],
  options?: { from?: string; to?: string; visibleMonths?: number; nowIso?: string },
): DailyPlotPoint[] {
  const visible = Math.max(2, options?.visibleMonths ?? ANALYTICS_VISIBLE_MONTHS);
  const todayMonth = utcMonthKey(options?.nowIso ?? new Date().toISOString());
  const played = monthly.map((p) => p.date.slice(0, 7)).filter(Boolean).sort();
  const defaultStart = shiftUtcMonthKey(todayMonth, -(visible - 1));
  const fromMonth = options?.from ? utcMonthKey(options.from) : '';
  const toMonth = options?.to ? utcMonthKey(options.to) : '';
  let start = fromMonth || (played[0] && played[0] < defaultStart ? played[0] : defaultStart);
  let end = toMonth || todayMonth;
  if (end < start) {
    const swap = start;
    start = end;
    end = swap;
  }
  let span = 1;
  for (let key = start; key < end; key = shiftUtcMonthKey(key, 1)) span += 1;
  if (span < visible) start = shiftUtcMonthKey(end, -(visible - 1));

  const byMonth = new Map(monthly.map((p) => [p.date.slice(0, 7), { ...p, date: p.date.slice(0, 7) }]));
  const out: DailyPlotPoint[] = [];
  for (let key = start; key <= end && out.length < 240; key = shiftUtcMonthKey(key, 1)) {
    out.push(byMonth.get(key) ?? emptyDailyPlotPoint(key));
  }
  return out;
}

export function plotPointsForScale(
  sessions: StoredGameSession[],
  daily: DailyPlotPoint[],
  scale: AnalyticsTimeScale,
  options?: { from?: string; to?: string; nowIso?: string },
): DailyPlotPoint[] {
  if (scale === 'year') {
    return padMonthlyCalendar(poolSessionsByMonth(sessions), {
      from: options?.from,
      to: options?.to,
      nowIso: options?.nowIso,
    });
  }
  return padDailyCalendar(daily, {
    from: options?.from,
    to: options?.to,
    nowIso: options?.nowIso,
    visibleDays: analyticsVisibleSlots(scale),
  });
}

function plotDateParts(date: string): { y: number; m: number; d: number } {
  const bits = date.split('-').map(Number);
  return { y: bits[0] || 2026, m: bits[1] || 1, d: bits[2] || 1 };
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LONG_MONTHS = [
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

function utcMonthName(m: number, style: 'long' | 'short' = 'short'): string {
  const i = Math.min(11, Math.max(0, m - 1));
  return style === 'long' ? LONG_MONTHS[i] : SHORT_MONTHS[i];
}

const MONTH_TICK_DAYS = new Set([1, 8, 15, 22]);

/** Bottom axis title: week = Date, month = Month (September), year = `2026` or `2025–2026`. */
export function formatPlotAxisName(
  points: Array<Pick<DailyPlotPoint, 'date'>>,
  scale: AnalyticsTimeScale,
): string {
  if (scale === 'week') return 'Date';
  if (scale === 'month') {
    if (!points.length) return 'Month';
    const last = plotDateParts(points[points.length - 1].date);
    return `Month (${utcMonthName(last.m, 'long')})`;
  }
  if (!points.length) return 'Year';
  const last = plotDateParts(points[points.length - 1].date);
  const first = plotDateParts(points[0].date);
  return first.y === last.y ? String(last.y) : `${first.y}–${last.y}`;
}

/** Short tick: day number on week/month, month name on year. */
export function formatPlotTick(date: string, scale: AnalyticsTimeScale): string {
  const p = plotDateParts(date);
  if (scale === 'year') return utcMonthName(p.m);
  return String(p.d);
}

export function shouldDrawPlotTick(
  date: string,
  scale: AnalyticsTimeScale,
  index: number,
  total: number,
): boolean {
  if (scale !== 'month') return true;
  const { d } = plotDateParts(date);
  if (MONTH_TICK_DAYS.has(d)) return true;
  return index === 0 || index === total - 1;
}

export function formatPlotTooltip(date: string, scale: AnalyticsTimeScale): string {
  const p = plotDateParts(date);
  if (scale === 'year') return `${utcMonthName(p.m)} ${p.y}`;
  return `${p.d} ${utcMonthName(p.m)} ${p.y}`;
}

export function dailyHasPlay(point: DailyPlotPoint): boolean {
  return point.sessionCount > 0;
}

export function dailyLinePath(
  points: DailyPlotPoint[],
  x: (index: number) => number,
  y: (value: number) => number,
  metric: AnalyticsMetricId,
  agg: DailyAggMode,
): string {
  const parts: string[] = [];
  let drawing = false;
  points.forEach((point, index) => {
    if (!dailyHasPlay(point)) {
      drawing = false;
      return;
    }
    const px = x(index).toFixed(1);
    const py = y(yValueForDaily(point, metric, agg)).toFixed(1);
    parts.push(`${drawing ? 'L' : 'M'} ${px} ${py}`);
    drawing = true;
  });
  return parts.join(' ');
}

export function dailyPolylineSegments(
  points: DailyPlotPoint[],
  x: (index: number) => number,
  y: (value: number) => number,
  metric: AnalyticsMetricId,
  agg: DailyAggMode,
): string[] {
  const segments: string[] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length >= 2) segments.push(current.join(' '));
    current = [];
  };
  points.forEach((point, index) => {
    if (!dailyHasPlay(point)) {
      flush();
      return;
    }
    current.push(`${x(index)},${y(yValueForDaily(point, metric, agg))}`);
  });
  flush();
  return segments;
}

export function yValueForDaily(
  point: DailyPlotPoint,
  metric: AnalyticsMetricId,
  agg: DailyAggMode,
): number {
  if (metric === 'accuracy') return agg === 'best' ? point.bestAccuracy : point.pooledAccuracy;
  if (metric === 'reaction') return agg === 'best' ? point.bestAvgReactionSec : point.pooledAvgReactionSec;
  if (metric === 'efficiency') return agg === 'best' ? point.bestEfficiency : point.pooledEfficiency;
  if (metric === 'duration') return agg === 'best' ? point.bestDurationSec : point.pooledDurationSec;
  if (metric === 'wrongTapRate') return point.wrongTapRate;
  return point.missRate;
}

export function buildGameSessionAnalytics(
  sessions: StoredGameSession[],
  options?: { maxDates?: number },
): GameSessionAnalytics {
  const sorted = sessions.slice().sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const dailyAll = poolSessionsByDate(sorted);
  const daily = selectDailyWindow(dailyAll, options?.maxDates);
  const playedDates = daily.filter((point) => point.sessionCount > 0).length;
  const attemptWeighted =
    sorted.length === 0
      ? null
      : round1(
          sorted.reduce((sum, row) => sum + row.accuracy * Math.max(1, attemptsOf(row)), 0) /
            Math.max(1, sorted.reduce((sum, row) => sum + Math.max(1, attemptsOf(row)), 0)),
        );
  return {
    sessions: sorted,
    daily,
    totals: {
      sessionCount: sorted.length,
      lastPlayedAt: sorted.length ? sorted[sorted.length - 1].recordedAt : null,
      avgAccuracy: attemptWeighted,
    },
    preliminary: playedDates > 0 && playedDates < 5,
  };
}
