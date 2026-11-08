import { describe, expect, it } from 'vitest';
import {
  OVERVIEW_SESSION_CAP,
  buildPatientOverview,
  buildPracticeInsights,
  insightPresetRange,
  mondayWeekKey,
  projectPatientOverview,
  selectNewestOverview,
  type PracticeInsightRow,
} from './practice-insights';
import type { RotatoryDetail } from './session-detail';

const TZ = 'America/New_York';
const RANGE = { timeZone: TZ, from: '2025-12-29', to: '2026-01-11' };

function row(partial: Partial<PracticeInsightRow> & Pick<PracticeInsightRow, 'recordedAt' | 'gameId'>): PracticeInsightRow {
  return {
    id: partial.id ?? partial.recordedAt,
    sessionNumber: partial.sessionNumber ?? 1,
    levelId: 'uppercase',
    deviceTier: null,
    durationSec: 60,
    correct: 1,
    wrongTaps: 0,
    misses: 0,
    timeouts: 0,
    accuracy: 100,
    avgReactionSec: 0,
    medianReactionSec: 0,
    reactionMs: [],
    stimuliCount: 1,
    gameName: 'Rotatory Wheel',
    ...partial,
  };
}

function rotatoryDetail(): RotatoryDetail {
  return {
    detailVersion: 1,
    status: 'ok',
    gameId: 'rotatory',
    context: { deviceTier: 'mobile', levelId: 'uppercase' },
    notices: [],
    lateralityEligible: true,
    lateralitySuppressedReason: '',
    rotationDirection: 'cw',
  };
}

describe('practice calendar', () => {
  it('returns empty counts and no percentage when nothing was saved', () => {
    const practice = buildPracticeInsights([], RANGE);
    expect(practice.sessionCount).toBe(0);
    expect(practice.activeDays).toBe(0);
    expect(practice.duration.totalSec).toBeNull();
    expect(practice.medianIntervalSec).toBeNull();
    expect(practice.latestIntervalSec).toBeNull();
    expect(practice.sessionsPerWeek).toBe(0);
    expect(practice.weeks.some((week) => week.availability === 'none_saved')).toBe(true);
    expect(practice.months.some((month) => month.availability === 'none_saved')).toBe(true);
  });

  it('starts weeks on Monday and leaves an empty week inside the range', () => {
    expect(mondayWeekKey('2026-01-04')).toBe('2025-12-29');
    expect(mondayWeekKey('2026-01-05')).toBe('2026-01-05');
    const practice = buildPracticeInsights(
      [row({ recordedAt: '2026-01-02T15:00:00.000Z', gameId: 'rotatory' })],
      RANGE,
    );
    const first = practice.weeks.find((week) => week.key === '2025-12-29');
    const second = practice.weeks.find((week) => week.key === '2026-01-05');
    expect(first).toMatchObject({ sessionCount: 1, availability: 'recorded' });
    expect(second).toMatchObject({ sessionCount: 0, availability: 'none_saved' });
    expect(practice.sessionsPerWeek).toBe(0.5);
    expect(practice.months.find((month) => month.key === '2026-01')?.sessionCount).toBe(1);
    expect(practice.months.find((month) => month.key === '2025-12')?.availability).toBe('none_saved');
  });

  it('places a timezone boundary on the local day', () => {
    const practice = buildPracticeInsights(
      [
        row({ recordedAt: '2026-01-05T04:30:00.000Z', gameId: 'rotatory' }),
        row({ recordedAt: '2026-01-05T05:30:00.000Z', gameId: 'rotatory', sessionNumber: 2 }),
      ],
      RANGE,
    );
    expect(practice.activeDays).toBe(2);
    expect(practice.weeks.find((week) => week.key === '2025-12-29')?.sessionCount).toBe(1);
    expect(practice.weeks.find((week) => week.key === '2026-01-05')?.sessionCount).toBe(1);
  });

  it('builds a 7-day preset as today and the previous 6 local days', () => {
    expect(insightPresetRange('7d', '2026-01-08T03:30:00.000Z', TZ)).toEqual({
      from: '2026-01-01',
      to: '2026-01-07',
    });
  });
});

describe('practice duration and intervals', () => {
  it('counts a session with no valid performance as a session and an active day', () => {
    const practice = buildPracticeInsights(
      [row({ recordedAt: '2026-01-02T15:00:00.000Z', gameId: 'rotatory', correct: 0, timeouts: 4, durationSec: 0 })],
      RANGE,
    );
    expect(practice.sessionCount).toBe(1);
    expect(practice.activeDays).toBe(1);
    expect(practice.duration.availability).toBe('unavailable');
    expect(practice.duration.totalSec).toBeNull();
  });

  it('excludes zero and invalid durations from the average', () => {
    const practice = buildPracticeInsights(
      [
        row({ recordedAt: '2026-01-02T15:00:00.000Z', gameId: 'rotatory', durationSec: 0 }),
        row({ recordedAt: '2026-01-03T15:00:00.000Z', gameId: 'rotatory', durationSec: Number.NaN, sessionNumber: 2 }),
        row({ recordedAt: '2026-01-04T15:00:00.000Z', gameId: 'rotatory', durationSec: 30, sessionNumber: 3 }),
        row({ recordedAt: '2026-01-04T16:00:00.000Z', gameId: 'rotatory', durationSec: 90, sessionNumber: 4 }),
      ],
      RANGE,
    );
    expect(practice.duration.totalSec).toBe(120);
    expect(practice.duration.averageSec).toBe(60);
    expect(practice.duration.countedSessions).toBe(2);
    expect(practice.duration.excludedSessions).toBe(2);
  });

  it('reports the median gap and the latest gap separately', () => {
    const practice = buildPracticeInsights(
      [
        row({ recordedAt: '2026-01-02T15:00:00.000Z', gameId: 'rotatory' }),
        row({ recordedAt: '2026-01-02T15:01:00.000Z', gameId: 'rotatory', sessionNumber: 2 }),
        row({ recordedAt: '2026-01-02T15:03:00.000Z', gameId: 'rotatory', sessionNumber: 3 }),
      ],
      RANGE,
    );
    expect(practice.medianIntervalSec).toBe(90);
    expect(practice.latestIntervalSec).toBe(120);
  });
});

describe('longitudinal overview', () => {
  it('keeps games separate and labels Pursuit and Bubble Chase duration', () => {
    const overview = buildPatientOverview(
      [
        row({ recordedAt: '2026-01-02T15:00:00.000Z', gameId: 'pursuit', levelId: 'linear_bounce', durationSec: 12, gameName: 'Pursuit' }),
        row({ recordedAt: '2026-01-03T15:00:00.000Z', gameId: 'mobile_target', levelId: 'uppercase', durationSec: 8, gameName: 'Bubble', sessionNumber: 2 }),
      ],
      RANGE,
    );
    expect(overview.games.map((game) => game.gameId)).toEqual(['pursuit', 'mobile_target']);
    expect(overview.games.every((game) => game.durationMeaning === 'sum_of_trial_times')).toBe(true);
    expect(overview.games.every((game) => game.durationLabel === 'Sum of trial times')).toBe(true);
    expect(overview).not.toHaveProperty('performanceValue');
    expect(overview.durationNote).toContain('not continuous time');
  });

  it('uses Bee weighting from buildLevelAnalytics', () => {
    const overview = buildPatientOverview(
      [
        row({
          recordedAt: '2026-01-02T15:00:00.000Z',
          gameId: 'bee_tracing',
          levelId: 'straight',
          correct: 10,
          stimuliCount: 10,
          accuracy: 80,
          gameName: 'Bee',
        }),
        row({
          recordedAt: '2026-01-03T15:00:00.000Z',
          gameId: 'bee_tracing',
          levelId: 'straight',
          correct: 3,
          stimuliCount: 4,
          accuracy: 40,
          gameName: 'Bee',
          sessionNumber: 2,
        }),
      ],
      RANGE,
    );
    expect(overview.games[0].levels[0].performanceLabel).toBe('Path adherence');
    expect(overview.games[0].levels[0].performanceValue).toBe(76.4);
  });

  it('counts a null level without giving it a score', () => {
    const overview = buildPatientOverview(
      [row({ recordedAt: '2026-01-02T15:00:00.000Z', gameId: 'rotatory', levelId: null, correct: 4 })],
      RANGE,
    );
    const level = overview.games[0].levels[0];
    expect(level.levelName).toBe('Level not recorded');
    expect(level.performanceValue).toBeNull();
    expect(level.analyticsStatus).toBe('unrecorded');
    expect(overview.games[0].durationLabel).toBe('Time to finish');
    expect(overview.practice.sessionCount).toBe(1);
  });

  it('orders levels by the first saved timestamp', () => {
    const overview = buildPatientOverview(
      [
        row({ recordedAt: '2026-01-04T15:00:00.000Z', gameId: 'rotatory', levelId: 'uppercase' }),
        row({ recordedAt: '2026-01-02T15:00:00.000Z', gameId: 'rotatory', levelId: 'lowercase', sessionNumber: 2 }),
      ],
      RANGE,
    );
    expect(overview.games[0].sequence.map((stop) => stop.levelId)).toEqual(['lowercase', 'uppercase']);
  });

  it('keeps context matches off the patient view and does not pool detail', () => {
    const overview = buildPatientOverview(
      [
        row({ recordedAt: '2026-01-02T15:00:00.000Z', gameId: 'rotatory', detail: rotatoryDetail() }),
        row({ recordedAt: '2026-01-03T15:00:00.000Z', gameId: 'rotatory', detail: rotatoryDetail(), sessionNumber: 2 }),
      ],
      RANGE,
    );
    expect(overview.games[0].levels[0].contextMatches[0].matchingSessions).toBe(2);
    expect(overview.games[0].levels[0]).not.toHaveProperty('pooledDetail');
    const patient = projectPatientOverview(overview);
    const encoded = JSON.stringify(patient);
    expect(encoded).not.toContain('contextMatches');
    expect(encoded).not.toContain('detailRecorded');
    expect(encoded).not.toContain('"detail"');
    expect(patient.games[0].levels[0].performanceValue).toBe(100);
  });
});

describe('overview window', () => {
  it('keeps a complete list of fewer than 2000 rows', () => {
    const selected = selectNewestOverview([1, 2, 3]);
    expect(selected.truncated).toBe(false);
    expect(selected.omitted).toBeNull();
    expect(selected.rows).toEqual([1, 2, 3]);
  });

  it('keeps a complete list of exactly 2000 rows', () => {
    const rows = Array.from({ length: OVERVIEW_SESSION_CAP }, (_, index) => index);
    const selected = selectNewestOverview(rows);
    expect(selected.truncated).toBe(false);
    expect(selected.omitted).toBeNull();
    expect(selected.rows).toHaveLength(2000);
  });

  it('keeps the newest 2000 and marks older rows omitted', () => {
    const newestFirst = Array.from({ length: 2001 }, (_, index) => 2000 - index);
    const selected = selectNewestOverview(newestFirst);
    expect(selected.truncated).toBe(true);
    expect(selected.omitted).toBe('older');
    expect(selected.rows[0]).toBe(2000);
    expect(selected.rows[1999]).toBe(1);
    expect(selected.rows).not.toContain(0);
  });
});
