import { describe, expect, it } from 'vitest';
import { buildLevelAnalytics, levelCardLines, levelContextMatchText } from './level-analytics';
import type { RotatoryDetail } from './session-detail';
import type { LevelAnalyticsRow } from './level-analytics';

const TZ = 'America/New_York';

function row(partial: Partial<LevelAnalyticsRow> & Pick<LevelAnalyticsRow, 'recordedAt'>): LevelAnalyticsRow {
  return {
    gameId: 'rotatory',
    levelId: 'uppercase',
    correct: 0,
    wrongTaps: 0,
    misses: 0,
    timeouts: 0,
    accuracy: 0,
    avgReactionSec: 0,
    reactionMs: [],
    stimuliCount: 0,
    ...partial,
  };
}

function rotatoryDetail(deviceTier: 'mobile' | 'tablet' | null, direction: 'cw' | 'ccw'): RotatoryDetail {
  return {
    detailVersion: 1,
    status: 'ok',
    gameId: 'rotatory',
    context: { deviceTier, levelId: 'uppercase' },
    notices: [],
    lateralityEligible: true,
    lateralitySuppressedReason: '',
    rotationDirection: direction,
  };
}

describe('level analytics identity', () => {
  it('rejects a row from another level instead of dropping it', () => {
    const result = buildLevelAnalytics({
      gameId: 'rotatory',
      levelId: 'uppercase',
      timeZone: TZ,
      rows: [row({ recordedAt: '2026-01-02T15:00:00.000Z', levelId: 'lowercase', correct: 1 })],
    });
    expect(result).toEqual({ status: 'invalid', reason: 'identity_mismatch' });
  });

  it('rejects a missing level id instead of summarizing every level', () => {
    const result = buildLevelAnalytics({
      gameId: 'rotatory',
      levelId: '',
      timeZone: TZ,
      rows: [],
    });
    expect(result.status).toBe('invalid');
  });
});

describe('level analytics performance', () => {
  it('returns no percentage when the level has no sessions', () => {
    const result = buildLevelAnalytics({
      gameId: 'rotatory',
      levelId: 'uppercase',
      timeZone: TZ,
      rows: [],
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.performanceValue).toBeNull();
    expect(result.sessionCount).toBe(0);
    expect(result.lastCompletedAt).toBeNull();
    expect(result.daily).toEqual([]);
    expect(levelCardLines(result).primary).toBe('No completed sessions');
    expect(levelCardLines(result).primary).not.toContain('0%');
  });

  it('pools valid attempts and ignores a large timeout count', () => {
    const result = buildLevelAnalytics({
      gameId: 'rotatory',
      levelId: 'uppercase',
      timeZone: TZ,
      rows: [
        row({ recordedAt: '2026-01-02T15:00:00.000Z', correct: 1, accuracy: 100 }),
        row({ recordedAt: '2026-01-03T15:00:00.000Z', correct: 0, wrongTaps: 100, timeouts: 50, accuracy: 0 }),
      ],
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.performanceValue).toBe(1);
    expect(result.sessionCount).toBe(2);
  });

  it('uses only correct and wrong taps for location memory', () => {
    const result = buildLevelAnalytics({
      gameId: 'location_memory',
      levelId: 'standard',
      timeZone: TZ,
      rows: [
        row({
          gameId: 'location_memory',
          levelId: 'standard',
          recordedAt: '2026-01-02T15:00:00.000Z',
          correct: 1,
          misses: 40,
          timeouts: 40,
        }),
      ],
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.performanceValue).toBe(100);
    expect(result.performanceLabel).toBe('Accuracy');
  });

  it('weights Bee path adherence and does not derive it from counts', () => {
    const result = buildLevelAnalytics({
      gameId: 'bee_tracing',
      levelId: 'straight',
      timeZone: TZ,
      rows: [
        row({
          gameId: 'bee_tracing',
          levelId: 'straight',
          recordedAt: '2026-01-02T15:00:00.000Z',
          correct: 10,
          stimuliCount: 10,
          accuracy: 80,
        }),
        row({
          gameId: 'bee_tracing',
          levelId: 'straight',
          recordedAt: '2026-01-03T15:00:00.000Z',
          correct: 3,
          stimuliCount: 4,
          accuracy: 40,
        }),
      ],
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.performanceLabel).toBe('Path adherence');
    expect(result.performanceValue).toBe(76.4);
  });

  it('leaves a zero-attempt sitting without a percentage', () => {
    const result = buildLevelAnalytics({
      gameId: 'rotatory',
      levelId: 'uppercase',
      timeZone: TZ,
      rows: [row({ recordedAt: '2026-01-02T15:00:00.000Z', timeouts: 4 })],
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.performanceValue).toBeNull();
    expect(result.sessionCount).toBe(1);
    expect(result.daily).toEqual([]);
    expect(levelCardLines(result).primary).toBe('Performance not available');
  });

  it('does not score Gaze Hold', () => {
    const result = buildLevelAnalytics({
      gameId: 'computer_vision',
      levelId: 'stationary',
      timeZone: TZ,
      rows: [],
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.performanceValue).toBeNull();
    expect(result.performanceKind).toBe('unavailable');
  });
});

describe('level analytics days and reaction', () => {
  it('groups by the requested timezone and omits a day with no valid attempts', () => {
    const result = buildLevelAnalytics({
      gameId: 'rotatory',
      levelId: 'uppercase',
      timeZone: TZ,
      rows: [
        row({
          recordedAt: '2026-01-02T02:30:00.000Z',
          correct: 2,
          wrongTaps: 2,
        }),
        row({
          recordedAt: '2026-01-02T15:00:00.000Z',
          timeouts: 3,
        }),
      ],
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.sessionCount).toBe(2);
    expect(result.daily).toEqual([{ date: '2026-01-01', sessionCount: 1, performance: 50 }]);
  });

  it('keeps reaction separate from accuracy', () => {
    const result = buildLevelAnalytics({
      gameId: 'rotatory',
      levelId: 'uppercase',
      timeZone: TZ,
      rows: [
        row({
          recordedAt: '2026-01-02T15:00:00.000Z',
          correct: 1,
          reactionMs: [1000, 3000],
        }),
      ],
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.performanceValue).toBe(100);
    expect(result.reactionLabel).toBe('Time to the correct hit');
    expect(result.reactionMeanSec).toBe(2);
    expect(result.reactionSource).toBe('samples');
    expect(result.daily[0]).toEqual({ date: '2026-01-02', sessionCount: 1, performance: 100 });
  });
});

describe('level analytics context', () => {
  it('counts a matching recorded setup and does not combine the measurements', () => {
    const result = buildLevelAnalytics({
      gameId: 'rotatory',
      levelId: 'uppercase',
      timeZone: TZ,
      rows: [
        row({ recordedAt: '2026-01-02T15:00:00.000Z', correct: 1, detail: rotatoryDetail('mobile', 'cw') }),
        row({ recordedAt: '2026-01-03T15:00:00.000Z', correct: 1, detail: rotatoryDetail('mobile', 'cw') }),
        row({ recordedAt: '2026-01-04T15:00:00.000Z', correct: 1, detail: rotatoryDetail('tablet', 'cw') }),
      ],
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    const hemifield = result.contextMatches.find((match) => match.measurement === 'rotatory.hemifield');
    expect(hemifield?.matchingSessions).toBe(2);
    expect(hemifield?.recordedSessions).toBe(3);
    expect(levelContextMatchText(hemifield!)).toContain('not a clinical comparison');
    expect(result.daily).toHaveLength(3);
  });
});
