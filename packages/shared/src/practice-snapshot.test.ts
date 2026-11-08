import { describe, expect, it } from 'vitest';
import { buildGameSessionAnalytics, type StoredGameSession } from './game-session';
import { buildPracticeSnapshot, streakCoverageNote } from './practice-snapshot';

function row(partial: Partial<StoredGameSession> = {}): StoredGameSession {
  return {
    id: 's1',
    sessionNumber: 1,
    gameId: 'rotatory',
    levelId: 'uppercase',
    deviceTier: null,
    recordedAt: '2026-01-15T12:00:00.000Z',
    durationSec: 10,
    correct: 1,
    wrongTaps: 0,
    misses: 0,
    timeouts: 0,
    accuracy: 100,
    avgReactionSec: 1,
    medianReactionSec: 1,
    efficiencyIndex: 100,
    reactionMs: [1000],
    stimuliCount: 1,
    gameName: 'Stored name',
    metricsVersion: 1,
    ...partial,
  };
}

describe('practice snapshot', () => {
  it('returns an empty record without a score', () => {
    const snapshot = buildPracticeSnapshot({ sessionCount: 0, latest: null });
    expect(snapshot).toEqual({
      sessionCount: 0,
      lastRecordedAt: null,
      lastGameId: null,
      lastGameName: null,
      lastLevelId: null,
      lastLevelName: null,
      availability: 'none_saved',
    });
    expect(snapshot).not.toHaveProperty('accuracy');
    expect(JSON.stringify(snapshot)).not.toMatch(/accuracy|reaction|efficiency|adherence|duration/i);
  });

  it('names one saved session from the catalog', () => {
    const snapshot = buildPracticeSnapshot({
      sessionCount: 1,
      latest: { recordedAt: '2026-01-15T12:00:00.000Z', gameId: 'rotatory', gameName: 'Stored name', levelId: 'uppercase' },
    });
    expect(snapshot).toMatchObject({
      sessionCount: 1,
      availability: 'recorded',
      lastGameName: 'Rotatory Wheel',
      lastLevelName: 'Uppercase Rotatory',
      lastRecordedAt: '2026-01-15T12:00:00.000Z',
    });
  });

  it('keeps the supplied newest session when the count covers more than one game', () => {
    const snapshot = buildPracticeSnapshot({
      sessionCount: 4,
      latest: { recordedAt: '2026-03-01T00:00:00.000Z', gameId: 'sorting', levelId: 'numbers' },
    });
    expect(snapshot).toMatchObject({
      sessionCount: 4,
      lastGameId: 'sorting',
      lastGameName: 'Sorting Module',
      lastLevelName: 'Numeric Sorting',
    });
  });

  it('leaves a null level unnamed', () => {
    const snapshot = buildPracticeSnapshot({
      sessionCount: 1,
      latest: { recordedAt: '2026-01-15T12:00:00.000Z', gameId: 'rotatory', levelId: null },
    });
    expect(snapshot.lastLevelId).toBeNull();
    expect(snapshot.lastLevelName).toBeNull();
  });

  it('keeps an unknown level id visible', () => {
    const snapshot = buildPracticeSnapshot({
      sessionCount: 1,
      latest: { recordedAt: '2026-01-15T12:00:00.000Z', gameId: 'rotatory', levelId: 'retired-level' },
    });
    expect(snapshot.lastLevelName).toBe('retired-level');
  });

  it('shows Direction Sense mixed as Straighten', () => {
    const snapshot = buildPracticeSnapshot({
      sessionCount: 1,
      latest: { recordedAt: '2026-01-15T12:00:00.000Z', gameId: 'direction_sense', levelId: 'mixed' },
    });
    expect(snapshot.lastLevelName).toBe('Straighten');
  });

  it('does not turn mixed games into a chart total', () => {
    const analytics = buildGameSessionAnalytics([
      row({ id: 'a', gameId: 'rotatory' }),
      row({ id: 'b', gameId: 'sorting', gameName: 'Sorting' }),
    ]);
    expect(analytics.totals.sessionCount).toBe(0);
    expect(analytics.totals.avgAccuracy).toBeNull();
  });

  it('qualifies a streak that does not cover every saved session', () => {
    expect(streakCoverageNote({ sessionCount: 0, loadedCount: 0, streak: 0 })).toBe('No session saved');
    expect(streakCoverageNote({ sessionCount: 3, loadedCount: 3, streak: 2 })).toBe('Consecutive days with a saved session');
    expect(streakCoverageNote({ sessionCount: 2000, loadedCount: 2000, streak: 2 })).toBe('Consecutive days with a saved session');
    expect(streakCoverageNote({ sessionCount: 2000, loadedCount: 2000, streak: 0 })).toBe('No current streak');
    expect(streakCoverageNote({ sessionCount: 2001, loadedCount: 2000, streak: 2 })).toBe(
      'Consecutive days in the newest 2,000 loaded sessions. This is not every saved session.',
    );
    expect(streakCoverageNote({ sessionCount: 2001, loadedCount: 2000, streak: 0 })).toBe(
      'No current streak in the newest 2,000 loaded sessions. This is not every saved session.',
    );
  });
});
