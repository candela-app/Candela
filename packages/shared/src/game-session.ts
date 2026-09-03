import { reactionStatsFromMs } from './game-logic';
import { GAME_CATALOG, isTherapyModuleId } from './game-registry';
import { efficiencyIndex, round1, sessionAccuracy, sessionErrorRate } from './session-metrics';
import type { DeviceTier, SessionResultData, TherapyModuleId } from './types';

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
  /** Best-of-day: highest accuracy / lowest median RT / highest efficiency. */
  bestAccuracy: number;
  bestAvgReactionSec: number;
  bestEfficiency: number;
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

export function utcDateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export function payloadFromSessionResult(
  data: SessionResultData,
  extra?: { gameId?: TherapyModuleId; levelId?: string | null; deviceTier?: string | null },
): CreateGameSessionPayload | null {
  const gameId = extra?.gameId || inferTherapyModuleId(data.gameName);
  if (!gameId || !isTherapyModuleId(gameId)) return null;
  const clientEventId = data.clientEventId || `${data.recordedAt || data.date}-${data.durationSec}-${data.correct}`;
  return {
    clientEventId,
    gameId,
    levelId: extra?.levelId || undefined,
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
  const byDate = new Map<string, StoredGameSession[]>();
  for (const row of sessions) {
    const key = utcDateKey(row.recordedAt);
    const list = byDate.get(key) || [];
    list.push(row);
    byDate.set(key, list);
  }
  const dates = Array.from(byDate.keys()).sort();
  return dates.map((date) => {
    const rows = byDate.get(date) || [];
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
      bestAccuracy,
      bestAvgReactionSec,
      bestEfficiency,
      sessions: rows
        .slice()
        .sort((a, b) => a.sessionNumber - b.sessionNumber)
        .map((row) => ({
          sessionNumber: row.sessionNumber,
          recordedAt: row.recordedAt,
          accuracy: row.accuracy,
          avgReactionSec: row.avgReactionSec,
          efficiencyIndex: row.efficiencyIndex,
          wrongTaps: row.wrongTaps,
          misses: row.misses,
          timeouts: row.timeouts,
        })),
    };
  });
}

export function selectDailyWindow(daily: DailyPlotPoint[], maxDates = 10): DailyPlotPoint[] {
  if (daily.length <= maxDates) return daily;
  return daily.slice(daily.length - maxDates);
}

export function yValueForDaily(
  point: DailyPlotPoint,
  metric: 'accuracy' | 'reaction' | 'efficiency' | 'wrongTapRate' | 'missRate',
  agg: DailyAggMode,
): number {
  if (metric === 'accuracy') return agg === 'best' ? point.bestAccuracy : point.pooledAccuracy;
  if (metric === 'reaction') return agg === 'best' ? point.bestAvgReactionSec : point.pooledAvgReactionSec;
  if (metric === 'efficiency') return agg === 'best' ? point.bestEfficiency : point.pooledEfficiency;
  if (metric === 'wrongTapRate') return point.wrongTapRate;
  return point.missRate;
}

/** Hand-shaped daily values: real sessions wobble; they do not climb in a straight line. */
const SAMPLE_DAILY_SEED: Array<{
  accuracy: number;
  reaction: number;
  wrongTapRate: number;
  missRate: number;
  timeoutRate: number;
  sessionCount: 1 | 2;
}> = [
  { accuracy: 68.4, reaction: 1.62, wrongTapRate: 18.2, missRate: 13.6, timeoutRate: 5.1, sessionCount: 1 },
  { accuracy: 74.1, reaction: 1.48, wrongTapRate: 14.8, missRate: 10.9, timeoutRate: 3.8, sessionCount: 2 },
  { accuracy: 70.6, reaction: 1.55, wrongTapRate: 16.9, missRate: 12.4, timeoutRate: 4.6, sessionCount: 1 },
  { accuracy: 79.2, reaction: 1.31, wrongTapRate: 11.4, missRate: 8.7, timeoutRate: 2.9, sessionCount: 1 },
  { accuracy: 63.8, reaction: 1.79, wrongTapRate: 21.5, missRate: 16.2, timeoutRate: 6.4, sessionCount: 2 },
  { accuracy: 76.0, reaction: 1.41, wrongTapRate: 13.6, missRate: 10.1, timeoutRate: 3.4, sessionCount: 1 },
  { accuracy: 82.4, reaction: 1.26, wrongTapRate: 9.8, missRate: 7.5, timeoutRate: 2.2, sessionCount: 1 },
  { accuracy: 77.3, reaction: 1.37, wrongTapRate: 12.7, missRate: 9.6, timeoutRate: 3.1, sessionCount: 2 },
];

/** Demo series for empty analytics so charts stay interactive before real play is saved. */
export function sampleDailyPlotPoints(days = 8): DailyPlotPoint[] {
  const count = Math.max(2, Math.round(days));
  const origin = new Date();
  origin.setUTCHours(12, 0, 0, 0);
  const seed = SAMPLE_DAILY_SEED;
  const points: DailyPlotPoint[] = [];
  let sessionNumber = 1;
  for (let i = 0; i < count; i += 1) {
    const day = new Date(origin);
    day.setUTCDate(day.getUTCDate() - (count - 1 - i));
    const src = seed[Math.round((i / (count - 1)) * (seed.length - 1))];
    const pooledAccuracy = round1(src.accuracy);
    const pooledAvgReactionSec = round1(src.reaction);
    const bestAccuracy = round1(Math.min(99, pooledAccuracy + 3.2));
    const bestAvgReactionSec = round1(Math.max(0.4, pooledAvgReactionSec - 0.11));
    const pooledEfficiency = efficiencyIndex(pooledAccuracy, pooledAvgReactionSec);
    const bestEfficiency = efficiencyIndex(bestAccuracy, bestAvgReactionSec);
    const recordedAt = day.toISOString();
    const sessions = Array.from({ length: src.sessionCount }, (_, s) => {
      const offset = s === 0 ? 0 : -2.4;
      const accuracy = round1(Math.max(0, pooledAccuracy + offset));
      const avgReactionSec = round1(pooledAvgReactionSec - offset * 0.02);
      const n = sessionNumber;
      sessionNumber += 1;
      return {
        sessionNumber: n,
        recordedAt,
        accuracy,
        avgReactionSec,
        efficiencyIndex: efficiencyIndex(accuracy, avgReactionSec),
        wrongTaps: Math.max(0, Math.round(src.wrongTapRate / 5)),
        misses: Math.max(0, Math.round(src.missRate / 5)),
        timeouts: src.timeoutRate >= 5 && s === 0 ? 1 : 0,
      };
    });
    points.push({
      date: utcDateKey(recordedAt),
      pooledAccuracy,
      pooledAvgReactionSec,
      pooledMedianReactionSec: pooledAvgReactionSec,
      pooledEfficiency,
      wrongTapRate: round1(src.wrongTapRate),
      missRate: round1(src.missRate),
      timeoutRate: round1(src.timeoutRate),
      sessionCount: src.sessionCount,
      bestAccuracy,
      bestAvgReactionSec,
      bestEfficiency,
      sessions,
    });
  }
  return points;
}

export function buildGameSessionAnalytics(
  sessions: StoredGameSession[],
  options?: { maxDates?: number },
): GameSessionAnalytics {
  const sorted = sessions.slice().sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const dailyAll = poolSessionsByDate(sorted);
  const daily = selectDailyWindow(dailyAll, options?.maxDates ?? 10);
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
    preliminary: daily.length > 0 && daily.length < 5,
  };
}
