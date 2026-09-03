import { describe, expect, it } from 'vitest';
import { getContrastAdjustedColor } from './clinical-color';
import {
  buildGameSessionAnalytics,
  inferTherapyModuleId,
  poolSessionsByDate,
  sampleDailyPlotPoints,
  type StoredGameSession,
} from './game-session';
import { reactionStatsFromMs } from './game-logic';
import {
  buildSessionMetrics,
  efficiencyIndex,
  round1,
  sessionAccuracy,
} from './session-metrics';

function session(partial: Partial<StoredGameSession> & { recordedAt: string; sessionNumber: number }): StoredGameSession {
  return {
    id: partial.id || `id-${partial.sessionNumber}`,
    sessionNumber: partial.sessionNumber,
    gameId: partial.gameId || 'rotatory',
    levelId: partial.levelId ?? null,
    deviceTier: partial.deviceTier ?? 'tablet',
    recordedAt: partial.recordedAt,
    durationSec: partial.durationSec ?? 30,
    correct: partial.correct ?? 8,
    wrongTaps: partial.wrongTaps ?? 1,
    misses: partial.misses ?? 1,
    timeouts: partial.timeouts ?? 0,
    accuracy: partial.accuracy ?? 80,
    avgReactionSec: partial.avgReactionSec ?? 0.5,
    medianReactionSec: partial.medianReactionSec ?? 0.5,
    efficiencyIndex: partial.efficiencyIndex ?? 160,
    reactionMs: partial.reactionMs ?? [400, 500, 600],
    stimuliCount: partial.stimuliCount ?? 10,
    gameName: partial.gameName ?? 'Rotatory Wheel',
    metricsVersion: 1,
  };
}

describe('session metrics', () => {
  it('returns 0 accuracy for an empty session', () => {
    expect(sessionAccuracy(0, 0)).toBe(0);
    const empty = buildSessionMetrics({ correct: 0, reactionMs: [] });
    expect(empty.accuracy).toBe(0);
    expect(empty.avgReactionSec).toBe(0);
    expect(empty.efficiencyIndex).toBe(0);
  });

  it('includes timeouts in the accuracy denominator', () => {
    expect(sessionAccuracy(8, 2)).toBe(80);
    const metrics = buildSessionMetrics({
      correct: 8,
      timeouts: 2,
      reactionMs: [320, 410, 500, 280, 350, 390, 440],
    });
    expect(metrics.accuracy).toBe(80);
    expect(metrics.timeoutRate).toBe(20);
    expect(metrics.avgReactionSec).toBe(0.384);
    expect(metrics.medianReactionSec).toBe(0.39);
    expect(metrics.efficiencyIndex).toBe(208.3);
  });

  it('scores slow-perfect lower than fast-sloppy on efficiency', () => {
    const slow = efficiencyIndex(100, 2);
    const fast = efficiencyIndex(50, 0.4);
    expect(slow).toBe(50);
    expect(fast).toBe(125);
  });

  it('uses even-length median of two middle samples', () => {
    expect(reactionStatsFromMs([100, 200, 300, 400]).medianSec).toBe(0.25);
    expect(reactionStatsFromMs([100, 200, 300]).medianSec).toBe(0.2);
  });

  it('round1 keeps tenth-point gains', () => {
    expect(round1(0.44)).toBe(0.4);
    expect(round1(0.45)).toBe(0.5);
  });
});

describe('daily pooling', () => {
  it('weights the daily dot by attempts, not best-of-day', () => {
    const points = poolSessionsByDate([
      session({
        sessionNumber: 1,
        recordedAt: '2026-08-22T10:00:00.000Z',
        correct: 9,
        wrongTaps: 1,
        misses: 0,
        timeouts: 0,
        accuracy: 90,
        reactionMs: [400, 400, 400, 400, 400, 400, 400, 400, 400],
      }),
      session({
        sessionNumber: 2,
        recordedAt: '2026-08-22T15:00:00.000Z',
        correct: 1,
        wrongTaps: 9,
        misses: 0,
        timeouts: 0,
        accuracy: 10,
        reactionMs: [200],
      }),
    ]);
    expect(points).toHaveLength(1);
    expect(points[0].sessionCount).toBe(2);
    expect(points[0].pooledAccuracy).toBe(50);
    expect(points[0].bestAccuracy).toBe(90);
    expect(points[0].sessions.map((s) => s.sessionNumber)).toEqual([1, 2]);
  });

  it('marks fewer than 5 dates as preliminary', () => {
    const analytics = buildGameSessionAnalytics([
      session({ sessionNumber: 1, recordedAt: '2026-08-20T10:00:00.000Z' }),
      session({ sessionNumber: 2, recordedAt: '2026-08-21T10:00:00.000Z' }),
    ]);
    expect(analytics.preliminary).toBe(true);
    expect(analytics.totals.sessionCount).toBe(2);
  });

  it('builds an interactive sample series when there is no saved play', () => {
    const points = sampleDailyPlotPoints(8);
    expect(points).toHaveLength(8);
    const accuracy = points.map((p) => p.pooledAccuracy);
    const reaction = points.map((p) => p.pooledAvgReactionSec);
    expect(accuracy.some((v, i) => i > 0 && v < accuracy[i - 1])).toBe(true);
    expect(accuracy.some((v, i) => i > 0 && v > accuracy[i - 1])).toBe(true);
    expect(reaction.some((v, i) => i > 0 && v > reaction[i - 1])).toBe(true);
    expect(reaction.some((v, i) => i > 0 && v < reaction[i - 1])).toBe(true);
    expect(points[0].sessions.length).toBeGreaterThan(0);
  });
});

describe('module inference and contrast', () => {
  it('maps results titles to catalog ids', () => {
    expect(inferTherapyModuleId('Look Pursuit — Linear Bounce')).toBe('computer_vision');
    expect(inferTherapyModuleId('Pursuit — Figure Eight')).toBe('pursuit');
    expect(inferTherapyModuleId('Crowded Search')).toBe('number_search');
    expect(inferTherapyModuleId('Hold the Code')).toBe('pattern_match');
  });

  it('blends stimulus toward background by contrast', () => {
    expect(getContrastAdjustedColor('#FFFFFF', '#000000', 1)).toBe('#ffffff');
    expect(getContrastAdjustedColor('#FFFFFF', '#000000', 0)).toBe('#000000');
    expect(getContrastAdjustedColor('#FFFFFF', '#000000', 0.5)).toBe('#808080');
  });
});
