import { reactionStatsFromMs } from './game-logic';
import type { SessionResultData } from './types';

/** One-decimal percent (thesis-style; never rounds a 0.4-point gain to zero). */
export function round1(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

/** Onset-to-tap reaction time in integer milliseconds. */
export function captureReactionMs(
  nowMs: number,
  targetShownAtMs: number | null | undefined,
): number | null {
  if (targetShownAtMs == null || !Number.isFinite(nowMs) || !Number.isFinite(targetShownAtMs)) {
    return null;
  }
  return Math.max(0, Math.round(nowMs - targetShownAtMs));
}

/**
 * Session accuracy: correct / (correct + errors).
 * Empty session is 0, never 100.
 */
export function sessionAccuracy(correct: number, errorCount: number): number {
  const safeCorrect = Math.max(0, correct);
  const safeErrors = Math.max(0, errorCount);
  const attempts = safeCorrect + safeErrors;
  if (attempts <= 0) return 0;
  return round1((safeCorrect / attempts) * 100);
}

export function sessionErrorRate(count: number, attempts: number): number {
  if (!(attempts > 0) || !Number.isFinite(count)) return 0;
  return round1((Math.max(0, count) / attempts) * 100);
}

/**
 * Speed-accuracy efficiency: accuracy (%) / mean reaction time (seconds).
 * Higher means both faster and more correct.
 */
export function efficiencyIndex(accuracyPercent: number, avgReactionSec: number): number {
  if (!(avgReactionSec > 0) || !Number.isFinite(accuracyPercent)) return 0;
  return round1(accuracyPercent / avgReactionSec);
}

export function isoSessionTimestamp(date = new Date()): string {
  return date.toISOString();
}

export function newClientEventId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* ignore */
  }
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface SessionMetricFields {
  accuracy: number;
  avgReactionSec: number;
  medianReactionSec: number;
  efficiencyIndex: number;
  /** Discrimination errors: tapped a stimulus that was not the target. */
  wrongTaps: number;
  /** Empty-space / wheel / background taps. */
  misses: number;
  /** Target expired with no valid hit. */
  timeouts: number;
  wrongTapRate: number;
  missRate: number;
  timeoutRate: number;
  /** Total errors (wrongTaps + misses + timeouts) for older `wrong` consumers. */
  wrong: number;
  recordedAt: string;
  clientEventId: string;
  reactionMs: number[];
}

export interface BuildSessionMetricsInput {
  correct: number;
  wrongTaps?: number;
  misses?: number;
  timeouts?: number;
  /** Correct-tap reaction samples in ms (unrounded values are rounded here). */
  reactionMs: number[];
  /**
   * Override accuracy when the game is not a correct/error count
   * (e.g. Bee path-adherence percent).
   */
  accuracyPercent?: number;
}

/** Shared session fields for results, CSV, and later analytics plots. */
export function buildSessionMetrics(input: BuildSessionMetricsInput): SessionMetricFields {
  const wrongTaps = Math.max(0, Math.round(input.wrongTaps ?? 0));
  const misses = Math.max(0, Math.round(input.misses ?? 0));
  const timeouts = Math.max(0, Math.round(input.timeouts ?? 0));
  const correct = Math.max(0, input.correct);
  const errorCount = wrongTaps + misses + timeouts;
  const attempts = correct + errorCount;
  const accuracy =
    input.accuracyPercent != null && Number.isFinite(input.accuracyPercent)
      ? round1(Math.min(100, Math.max(0, input.accuracyPercent)))
      : sessionAccuracy(correct, errorCount);
  const reaction = reactionStatsFromMs(input.reactionMs);
  const reactionMs = input.reactionMs
    .filter((ms) => Number.isFinite(ms) && ms >= 0)
    .map((ms) => Math.round(ms))
    .slice(0, 5000);

  return {
    accuracy,
    avgReactionSec: reaction.avgSec,
    medianReactionSec: reaction.medianSec,
    efficiencyIndex: efficiencyIndex(accuracy, reaction.avgSec),
    wrongTaps,
    misses,
    timeouts,
    wrongTapRate: sessionErrorRate(wrongTaps, attempts),
    missRate: sessionErrorRate(misses, attempts),
    timeoutRate: sessionErrorRate(timeouts, attempts),
    wrong: errorCount,
    recordedAt: isoSessionTimestamp(),
    clientEventId: newClientEventId(),
    reactionMs,
  };
}

export function formatReactionMsFromSec(sec: number | undefined | null): string {
  return `${Math.round((Number(sec) || 0) * 1000)}ms`;
}

export function sessionCountLabel(data: SessionResultData): string {
  const name = (data.gameName || '').toLowerCase();
  if ('boardId' in data && 'leftHalfAccuracy' in data) return 'Patterns Drawn';
  if ('digitsFound' in data) return 'Digits Found';
  if (name.includes('bee')) return 'Rounds';
  if (name.includes('familiar')) return 'Trials';
  if (name.includes('hold the code') || name.includes('pattern')) return 'Matches';
  return 'Bubbles Popped';
}

export function sessionCountValue(data: SessionResultData): string {
  if ('digitsFound' in data) {
    return String((data as { digitsFound?: number }).digitsFound ?? data.correct);
  }
  return String(data.stimuliCount);
}

export function sessionErrorCounts(data: SessionResultData): {
  wrongTaps: number;
  misses: number;
  timeouts: number;
} {
  return {
    wrongTaps: data.wrongTaps ?? 0,
    misses: data.misses ?? 0,
    timeouts: data.timeouts ?? 0,
  };
}

/** Parent-card headline metrics: Duration, Accuracy, Avg RT, count, Efficiency. */
export function parentSummaryCells(data: SessionResultData): {
  label: string;
  value: string;
  color: string;
}[] {
  return [
    { label: 'Duration', value: `${data.durationSec}s`, color: '#34D399' },
    { label: 'Accuracy', value: `${data.accuracy}%`, color: '#60A5FA' },
    {
      label: 'Avg Reaction Time',
      value: formatReactionMsFromSec(data.avgReactionSec),
      color: '#FBBF24',
    },
    {
      label: sessionCountLabel(data),
      value: sessionCountValue(data),
      color: '#C084FC',
    },
    {
      label: 'Efficiency',
      value: String(data.efficiencyIndex ?? 0),
      color: '#22D3EE',
    },
  ];
}

