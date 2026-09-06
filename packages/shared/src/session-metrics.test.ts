import { describe, expect, it } from 'vitest';
import { getContrastAdjustedColor } from './clinical-color';
import {
  buildGameSessionAnalytics,
  inferTherapyModuleId,
  padDailyCalendar,
  emptyDailyPlotPoint,
  formatPlotAxisName,
  formatPlotTick,
  formatPlotTooltip,
  plotPointsForScale,
  payloadFromSessionResult,
  poolSessionsByDate,
  poolSessionsByMonth,
  sessionResultShouldPersist,
  shouldDrawPlotTick,
  zoomInScale,
  zoomOutScale,
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

  it('includes misses in accuracy, miss rate, and efficiency', () => {
    const metrics = buildSessionMetrics({
      correct: 8,
      wrongTaps: 1,
      misses: 1,
      reactionMs: [400, 400, 400, 400, 400, 400, 400, 400],
    });
    expect(metrics.accuracy).toBe(80);
    expect(metrics.wrongTapRate).toBe(10);
    expect(metrics.missRate).toBe(10);
    expect(metrics.wrong).toBe(2);
    expect(metrics.efficiencyIndex).toBe(200);
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

  it('pads a 7-day calendar so empty weeks still have ticks', () => {
    const points = padDailyCalendar([], { nowIso: '2026-09-06T12:00:00.000Z' });
    expect(points).toHaveLength(7);
    expect(points[0].date).toBe('2026-08-31');
    expect(points[6].date).toBe('2026-09-06');
    expect(points.every((p) => p.sessionCount === 0)).toBe(true);
  });

  it('keeps earlier played days so the week viewport can scroll', () => {
    const played = { ...emptyDailyPlotPoint('2026-08-20'), sessionCount: 1, pooledAccuracy: 80 };
    const points = padDailyCalendar([played], { nowIso: '2026-09-06T12:00:00.000Z' });
    expect(points[0].date).toBe('2026-08-20');
    expect(points[points.length - 1].date).toBe('2026-09-06');
    expect(points.find((p) => p.date === '2026-08-20')?.sessionCount).toBe(1);
  });

  it('zooms week to month to year and back', () => {
    expect(zoomOutScale('week')).toBe('month');
    expect(zoomOutScale('month')).toBe('year');
    expect(zoomOutScale('year')).toBe('year');
    expect(zoomInScale('year')).toBe('month');
    expect(zoomInScale('month')).toBe('week');
    expect(zoomInScale('week')).toBe('week');
  });

  it('pools a year-scale dot by month', () => {
    const monthly = poolSessionsByMonth([
      session({ sessionNumber: 1, recordedAt: '2026-08-02T10:00:00.000Z', correct: 9, wrongTaps: 1, misses: 0, timeouts: 0, accuracy: 90 }),
      session({ sessionNumber: 2, recordedAt: '2026-08-20T10:00:00.000Z', correct: 1, wrongTaps: 9, misses: 0, timeouts: 0, accuracy: 10 }),
    ]);
    expect(monthly).toHaveLength(1);
    expect(monthly[0].date).toBe('2026-08');
    expect(monthly[0].sessionCount).toBe(2);
    expect(monthly[0].pooledAccuracy).toBe(50);
  });

  it('year scale pads 12 months', () => {
    const points = plotPointsForScale([], [], 'year', { nowIso: '2026-09-06T12:00:00.000Z' });
    expect(points).toHaveLength(12);
    expect(points[0].date).toBe('2025-10');
    expect(points[11].date).toBe('2026-09');
  });

  it('names the axis after the latest month and thins month ticks', () => {
    const week = plotPointsForScale([], [], 'week', { nowIso: '2026-09-06T12:00:00.000Z' });
    const month = plotPointsForScale([], [], 'month', { nowIso: '2026-09-06T12:00:00.000Z' });
    const year = plotPointsForScale([], [], 'year', { nowIso: '2026-09-06T12:00:00.000Z' });
    expect(formatPlotAxisName(week, 'week')).toBe('Sep-09');
    expect(formatPlotAxisName(month, 'month')).toBe('September-09');
    expect(formatPlotAxisName(year, 'year')).toBe('2025–2026');
    expect(formatPlotTick('2026-09-06', 'week')).toBe('6');
    expect(formatPlotTick('2026-09-01', 'month')).toBe('1');
    expect(formatPlotTick('2026-08', 'year')).toBe('Aug');
    expect(shouldDrawPlotTick('2026-09-01', 'month', 0, 30)).toBe(true);
    expect(shouldDrawPlotTick('2026-09-02', 'month', 1, 30)).toBe(false);
    expect(shouldDrawPlotTick('2026-09-08', 'month', 7, 30)).toBe(true);
    expect(shouldDrawPlotTick('2026-09-06', 'week', 5, 7)).toBe(true);
    expect(formatPlotTooltip('2026-09-06', 'month')).toBe('6 Sep 2026');
    expect(formatPlotTooltip('2026-08', 'year')).toBe('Aug 2026');
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

describe('persist gate', () => {
  const finished = {
    patientName: 'T',
    sessionId: 1,
    date: '2026-09-06',
    gameName: 'Rotatory Wheel',
    stimuliCount: 10,
    letterSize: 1,
    speed: '1x',
    durationSec: 30,
    clicksTotal: 10,
    correct: 8,
    wrong: 2,
    accuracy: 80,
    avgReactionSec: 0.5,
    medianReactionSec: 0.5,
    efficiencyIndex: 160,
    wrongTaps: 1,
    misses: 1,
    timeouts: 0,
    wrongTapRate: 10,
    missRate: 10,
    timeoutRate: 0,
    recordedAt: '2026-09-06T12:00:00.000Z',
    endedBy: 'cleared' as const,
  };

  it('saves cleared and timeout plays', () => {
    expect(sessionResultShouldPersist(finished)).toBe(true);
    expect(payloadFromSessionResult(finished)?.gameId).toBe('rotatory');
    expect(payloadFromSessionResult({ ...finished, endedBy: 'timeout' })).not.toBeNull();
    expect(payloadFromSessionResult({ ...finished, endedBy: 'completed' })).not.toBeNull();
  });

  it('does not save abandoned or quit plays', () => {
    expect(sessionResultShouldPersist({ ...finished, endedBy: 'abandoned' })).toBe(false);
    expect(payloadFromSessionResult({ ...finished, endedBy: 'abandoned' })).toBeNull();
    expect(payloadFromSessionResult({ ...finished, abandoned: true })).toBeNull();
  });

  it('infers catalog level ids so analytics can filter by level', () => {
    expect(
      payloadFromSessionResult({
        ...finished,
        gameName: 'Rotatory Wheel (alphabets - uppercase)',
        alphabetVariant: 'uppercase',
        mode: 'alphabets',
      } as typeof finished & { mode: string; alphabetVariant: string })?.levelId,
    ).toBe('uppercase');
    expect(payloadFromSessionResult({ ...finished, gameName: 'Sorting Module (numbers)' })?.levelId).toBe(
      'numbers',
    );
    expect(
      payloadFromSessionResult({
        ...finished,
        gameName: 'Hold the Code',
        stimulusMode: 'compound',
      } as typeof finished & { stimulusMode: string })?.levelId,
    ).toBe('compound');
    expect(payloadFromSessionResult({ ...finished, gameName: 'Color Discriminant Bubble Chase' })?.levelId).toBe(
      'colors',
    );
  });
});
