import { reactionStatsFromMs, validReactionSamples } from './game-logic';
import { calendarDayKey } from './game-session';
import { MODULE_LEVELS, isTherapyModuleId } from './game-registry';
import { round1 } from './session-metrics';
import {
  pooledValidAttemptAccuracy,
  sessionTimeLabel,
  type SessionAttemptKey,
} from './session-report';
import { recordedContextMatches, type DetailMeasurementKey, type SessionDetail } from './session-detail';

export const LEVEL_IDENTITY_MISMATCH = 'identity_mismatch' as const;

const CONTEXT_MEASUREMENTS: Partial<Record<string, readonly DetailMeasurementKey[]>> = {
  rotatory: ['rotatory.hemifield', 'rotatory.form'],
  bee_tracing: ['bee.adherence', 'bee.axis'],
  pursuit: ['pursuit.tracking'],
  geoboard: ['geoboard.halfField'],
  peripheral_view: ['peripheral.outcome'],
  direction_sense: ['direction.errors'],
  mobile_target: ['mobile_target.set'],
};

const CONTEXT_LABEL: Record<DetailMeasurementKey, string> = {
  'rotatory.hemifield': 'Rotatory hemifield',
  'rotatory.form': 'Rotatory form',
  'bee.adherence': 'Bee path adherence detail',
  'bee.axis': 'Bee axis',
  'pursuit.tracking': 'Pursuit tracking',
  'geoboard.halfField': 'Pattern half field',
  'peripheral.outcome': 'Peripheral outcome',
  'direction.errors': 'Direction errors',
  'mobile_target.set': 'Bubble chase set',
};

export interface LevelAnalyticsRow {
  gameId: string;
  levelId: string | null;
  recordedAt: string;
  correct: number;
  wrongTaps: number;
  misses: number;
  timeouts: number;
  accuracy: number;
  avgReactionSec: number;
  reactionMs?: number[] | null;
  stimuliCount: number;
  detail?: SessionDetail | null;
}

export interface LevelDailyPoint {
  date: string;
  sessionCount: number;
  performance: number;
}

export interface LevelContextMatch {
  measurement: DetailMeasurementKey;
  label: string;
  matchingSessions: number;
  recordedSessions: number;
}

export interface LevelAnalyticsOk {
  status: 'ok';
  gameId: string;
  levelId: string;
  levelName: string;
  sessionCount: number;
  lastCompletedAt: string | null;
  performanceLabel: string | null;
  performanceValue: number | null;
  performanceKind: 'path_adherence' | 'count_accuracy' | 'unavailable';
  reactionLabel: string;
  reactionMeanSec: number | null;
  reactionSampleCount: number;
  reactionSource: 'samples' | 'stored_average' | 'unavailable';
  daily: LevelDailyPoint[];
  contextMatches: LevelContextMatch[];
}

export interface LevelAnalyticsInvalid {
  status: 'invalid';
  reason: typeof LEVEL_IDENTITY_MISMATCH;
}

export type LevelAnalytics = LevelAnalyticsOk | LevelAnalyticsInvalid;

export function levelEmptyMessage(levelName: string): string {
  return `No completed sessions for ${levelName}.`;
}

export function levelContextMatchText(match: LevelContextMatch): string {
  return `${match.matchingSessions} of ${match.recordedSessions} sessions share the recorded setup for ${match.label}. This checks recorded context only. It is not a clinical comparison.`;
}

export function levelCardLines(result: LevelAnalytics): { primary: string; secondary: string | null } {
  if (result.status !== 'ok') return { primary: 'Unable to summarize this level', secondary: null };
  if (result.sessionCount === 0) return { primary: 'No completed sessions', secondary: null };
  const primary =
    result.performanceValue == null || result.performanceLabel == null
      ? 'Performance not available'
      : `${result.performanceLabel} ${result.performanceValue}%`;
  const count = `${result.sessionCount} completed`;
  const date = formatLevelDate(result.lastCompletedAt);
  return { primary, secondary: date ? `${count} · ${date}` : count };
}

function formatLevelDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function levelNameFor(gameId: string, levelId: string): string {
  if (!isTherapyModuleId(gameId)) return levelId;
  return MODULE_LEVELS[gameId].find((level) => level.id === levelId)?.name ?? levelId;
}

function performanceMeta(gameId: string): Pick<LevelAnalyticsOk, 'performanceLabel' | 'performanceKind'> {
  if (gameId === 'computer_vision') return { performanceLabel: null, performanceKind: 'unavailable' };
  if (gameId === 'bee_tracing') return { performanceLabel: 'Path adherence', performanceKind: 'path_adherence' };
  if (gameId === 'geoboard') return { performanceLabel: 'Pattern accuracy', performanceKind: 'count_accuracy' };
  return { performanceLabel: 'Accuracy', performanceKind: 'count_accuracy' };
}

/** Stored path adherence. Weight matches the validated Bee chart rule. */
function beeWeight(row: Pick<LevelAnalyticsRow, 'stimuliCount' | 'correct'>): number {
  if (row.stimuliCount > 0 && row.correct > 0 && row.stimuliCount === row.correct) return row.stimuliCount;
  return 1;
}

function storedAdherence(row: Pick<LevelAnalyticsRow, 'accuracy'>): number | null {
  if (!Number.isFinite(row.accuracy) || row.accuracy < 0 || row.accuracy > 100) return null;
  return round1(row.accuracy);
}

function beePathAdherence(rows: readonly LevelAnalyticsRow[]): number | null {
  let weighted = 0;
  let weightSum = 0;
  for (const row of rows) {
    const adherence = storedAdherence(row);
    if (adherence == null) continue;
    const weight = beeWeight(row);
    weighted += adherence * weight;
    weightSum += weight;
  }
  if (weightSum <= 0) return null;
  return round1(weighted / weightSum);
}

function levelPerformance(gameId: string, rows: readonly LevelAnalyticsRow[]): number | null {
  if (rows.length === 0 || gameId === 'computer_vision') return null;
  if (gameId === 'bee_tracing') return beePathAdherence(rows);
  return pooledValidAttemptAccuracy(gameId, rows);
}

function pooledReaction(rows: readonly LevelAnalyticsRow[]): Pick<
  LevelAnalyticsOk,
  'reactionMeanSec' | 'reactionSampleCount' | 'reactionSource'
> {
  const samples: number[] = [];
  const storedMeans: number[] = [];
  for (const row of rows) {
    const list = row.reactionMs;
    if (Array.isArray(list) && list.length > 0) {
      const valid = validReactionSamples(list);
      if (valid.length > 0) samples.push(...valid);
      continue;
    }
    if (Number.isFinite(row.avgReactionSec) && row.avgReactionSec > 0) storedMeans.push(row.avgReactionSec);
  }
  if (samples.length > 0) {
    const stats = reactionStatsFromMs(samples);
    return {
      reactionMeanSec: stats.count > 0 ? stats.avgSec : null,
      reactionSampleCount: stats.count,
      reactionSource: stats.count > 0 ? 'samples' : 'unavailable',
    };
  }
  if (storedMeans.length > 0) {
    return {
      reactionMeanSec: round1(storedMeans.reduce((sum, value) => sum + value, 0) / storedMeans.length),
      reactionSampleCount: 0,
      reactionSource: 'stored_average',
    };
  }
  return { reactionMeanSec: null, reactionSampleCount: 0, reactionSource: 'unavailable' };
}

function largestContextCohort(details: SessionDetail[], measurement: DetailMeasurementKey): number {
  const recorded = details.filter((detail) => detail.status === 'ok');
  let best = 0;
  for (let index = 0; index < recorded.length; index += 1) {
    const anchor = recorded[index];
    if (!recordedContextMatches(anchor, anchor, measurement)) continue;
    let count = 0;
    for (const other of recorded) {
      if (recordedContextMatches(anchor, other, measurement)) count += 1;
    }
    if (count > best) best = count;
  }
  return best;
}

function contextMatchesFor(gameId: string, rows: readonly LevelAnalyticsRow[]): LevelContextMatch[] {
  const keys = CONTEXT_MEASUREMENTS[gameId] ?? [];
  if (keys.length === 0 || rows.length === 0) return [];
  const recorded = rows
    .map((row) => row.detail)
    .filter((detail): detail is SessionDetail => Boolean(detail) && detail?.status === 'ok');
  if (recorded.length === 0) return [];
  return keys.map((measurement) => ({
    measurement,
    label: CONTEXT_LABEL[measurement],
    matchingSessions: largestContextCohort(recorded, measurement),
    recordedSessions: recorded.length,
  }));
}

function latestCompletedAt(rows: readonly LevelAnalyticsRow[]): string | null {
  let latest = '';
  let latestMs = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    const ms = new Date(row.recordedAt).getTime();
    if (Number.isNaN(ms) || ms < latestMs) continue;
    latestMs = ms;
    latest = row.recordedAt;
  }
  return latest || null;
}

function identitiesMatch(row: LevelAnalyticsRow, gameId: string, levelId: string): boolean {
  return row.gameId === gameId && row.levelId === levelId;
}

/**
 * Level summary and daily series for one catalog level.
 * A mismatched gameId or levelId is an error. Rows are not filtered.
 */
export function buildLevelAnalytics(input: {
  gameId: string;
  levelId: string;
  timeZone: string;
  rows: readonly LevelAnalyticsRow[];
}): LevelAnalytics {
  const gameId = input.gameId;
  const levelId = input.levelId;
  if (!gameId || !levelId || input.rows.some((row) => !identitiesMatch(row, gameId, levelId))) {
    return { status: 'invalid', reason: LEVEL_IDENTITY_MISMATCH };
  }
  const rows = input.rows;
  const meta = performanceMeta(gameId);
  const reaction = pooledReaction(rows);
  const byDay = new Map<string, LevelAnalyticsRow[]>();
  for (const row of rows) {
    const date = calendarDayKey(row.recordedAt, input.timeZone);
    const list = byDay.get(date) ?? [];
    list.push(row);
    byDay.set(date, list);
  }
  const daily: LevelDailyPoint[] = [];
  for (const date of Array.from(byDay.keys()).sort()) {
    const dayRows = byDay.get(date) ?? [];
    const performance = levelPerformance(gameId, dayRows);
    if (performance == null) continue;
    daily.push({ date, sessionCount: dayRows.length, performance });
  }
  return {
    status: 'ok',
    gameId,
    levelId,
    levelName: levelNameFor(gameId, levelId),
    sessionCount: rows.length,
    lastCompletedAt: latestCompletedAt(rows),
    performanceLabel: meta.performanceLabel,
    performanceValue: levelPerformance(gameId, rows),
    performanceKind: meta.performanceKind,
    reactionLabel: sessionTimeLabel(gameId),
    reactionMeanSec: reaction.reactionMeanSec,
    reactionSampleCount: reaction.reactionSampleCount,
    reactionSource: reaction.reactionSource,
    daily,
    contextMatches: contextMatchesFor(gameId, rows),
  };
}

export type { SessionAttemptKey };
