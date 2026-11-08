import { describe, expect, it } from 'vitest';
import {
  formatPatientSummary,
  formatSessionReport,
  mixedLevelNotice,
  showGazeHoldUnsupported,
  type SessionReportSource,
} from './session-report';

function row(partial: Partial<SessionReportSource> & { gameId: string }): SessionReportSource {
  return {
    id: partial.id || 'row-1',
    sessionNumber: partial.sessionNumber ?? 1,
    gameId: partial.gameId,
    levelId: partial.levelId ?? null,
    deviceTier: partial.deviceTier ?? null,
    recordedAt: partial.recordedAt || '2026-08-22T10:00:00.000Z',
    durationSec: partial.durationSec ?? 30,
    correct: partial.correct ?? 8,
    wrongTaps: partial.wrongTaps ?? 2,
    misses: partial.misses ?? 0,
    timeouts: partial.timeouts ?? 0,
    accuracy: partial.accuracy ?? 10,
    avgReactionSec: partial.avgReactionSec ?? 0.4,
    medianReactionSec: partial.medianReactionSec ?? 0.4,
    reactionMs: partial.reactionMs === undefined ? [400] : partial.reactionMs,
    stimuliCount: partial.stimuliCount ?? 8,
    gameName: partial.gameName ?? 'Session',
    contrastPercent: partial.contrastPercent ?? null,
  };
}

describe('session report outcomes', () => {
  it('keeps Rotatory and Sorting timeouts out of the attempt total', () => {
    const rotatory = formatSessionReport(row({ gameId: 'rotatory', timeouts: 4, levelId: 'uppercase' }));
    expect(rotatory.score.value).toBe(80);
    expect(rotatory.counts.map((line) => line.label)).toEqual(['Correct', 'Wrong tap', 'Wheel tap']);
    const sorting = formatSessionReport(row({ gameId: 'sorting', timeouts: 4, levelId: 'numbers' }));
    expect(sorting.score.value).toBe(80);
    expect(sorting.counts.find((line) => line.label === 'Wrong item')?.count).toBe(2);
  });

  it('keeps Bee deviations out of an attempt rate and uses stored adherence', () => {
    const report = formatSessionReport(
      row({
        gameId: 'bee_tracing',
        levelId: 'straight',
        correct: 3,
        misses: 12,
        accuracy: 85,
        reactionMs: [500],
      }),
    );
    expect(report.score).toEqual({ label: 'Path adherence', value: 85, kind: 'path_adherence' });
    expect(report.counts.map((line) => line.label)).toEqual(['Rounds', 'Off-path deviations']);
    expect(report.counts.every((line) => line.rate == null)).toBe(true);
    expect(report.time.label).toBe('Time to first grab');
    const rejected = formatSessionReport(row({ gameId: 'bee_tracing', accuracy: 140, reactionMs: [] }));
    expect(rejected.score.value).toBeNull();
    expect(rejected.notices).toContain('Path adherence was not stored.');
  });

  it('excludes Bubble Chase timeouts even when the column is non-zero', () => {
    const report = formatSessionReport(row({ gameId: 'mobile_target', timeouts: 4, levelId: 'uppercase' }));
    expect(report.score.value).toBe(80);
    expect(report.counts.map((line) => line.label)).not.toContain('Timeout');
    expect(report.duration.meaning).toBe('sum_of_trial_times');
  });

  it('labels Geoboard time as pattern completion and counts all four outcomes', () => {
    const report = formatSessionReport(
      row({ gameId: 'geoboard', levelId: '1', misses: 1, timeouts: 1, reactionMs: [2000] }),
    );
    expect(report.score.label).toBe('Pattern accuracy');
    expect(report.score.value).toBe(66.7);
    expect(report.time.label).toBe('Time to finish a correct pattern');
    expect(report.counts.map((line) => line.label)).toEqual([
      'Correct patterns',
      'Wrong pattern',
      'Incomplete pattern',
      'Timeout',
    ]);
  });

  it('ignores misses and timeouts for recall games', () => {
    for (const gameId of ['location_memory', 'direction_sense', 'familiar_faces']) {
      const report = formatSessionReport(row({ gameId, misses: 5, timeouts: 3 }));
      expect(report.score.value).toBe(80);
      expect(report.counts.map((line) => line.label)).toEqual(['Correct', 'Wrong tap']);
    }
  });
});

describe('session report time and levels', () => {
  it('uses the stored average when no sample list was saved', () => {
    const report = formatSessionReport(
      row({ gameId: 'rotatory', reactionMs: [], avgReactionSec: 0.4, medianReactionSec: 0.35, accuracy: 10 }),
    );
    expect(report.time.source).toBe('stored_average');
    expect(report.time.meanSec).toBe(0.4);
    expect(report.time.medianSec).toBe(0.35);
    expect(report.notices.join(' ')).toContain('Individual times were not saved');
    expect(formatPatientSummary(report).timeText).toContain('0.40s');
  });

  it('hides time when every stored sample is invalid', () => {
    const report = formatSessionReport(
      row({
        gameId: 'rotatory',
        reactionMs: [Number.NaN, -5],
        avgReactionSec: 0.4,
        medianReactionSec: 0.4,
      }),
    );
    expect(report.time.source).toBe('unavailable');
    expect(report.time.meanSec).toBeNull();
    expect(report.efficiency).toBeNull();
    expect(formatPatientSummary(report).timeText).toBeNull();
  });

  it('reconstructs the mean from valid samples instead of a disagreeing stored average', () => {
    const report = formatSessionReport(row({ gameId: 'sorting', reactionMs: [400], avgReactionSec: 9 }));
    expect(report.time.source).toBe('samples');
    expect(report.time.meanSec).toBe(0.4);
    expect(report.notices.join(' ')).toContain('reconstructed');
  });

  it('keeps each level on its own report and does not combine the scores', () => {
    const upper = formatSessionReport(row({ id: 'a', gameId: 'rotatory', levelId: 'uppercase', correct: 9, wrongTaps: 1 }));
    const numbers = formatSessionReport(row({ id: 'b', gameId: 'rotatory', levelId: 'numbers', correct: 1, wrongTaps: 1 }));
    expect(upper.levelName).toBe('Uppercase Rotatory');
    expect(numbers.levelName).toBe('Numeric Rotatory');
    expect(upper.score.value).toBe(90);
    expect(numbers.score.value).toBe(50);
    expect(mixedLevelNotice([upper.levelName, numbers.levelName])).toContain('Uppercase Rotatory');
    expect(mixedLevelNotice([upper.levelName, numbers.levelName])).toContain('not a combined score');
    expect(formatSessionReport(row({ gameId: 'rotatory', levelId: null })).levelName).toBe('Level not recorded');
  });
});

describe('computer vision identity', () => {
  it('does not call an unverified row Gaze Hold', () => {
    const report = formatSessionReport(
      row({ gameId: 'computer_vision', gameName: 'Practice block', levelId: null, reactionMs: [400] }),
    );
    expect(report.moduleName).toBe('Practice block');
    expect(report.notices).toContain('The activity type could not be verified from this session.');
    const pursuitRow = row({ gameId: 'computer_vision', gameName: 'Look Pursuit — Linear', levelId: 'stationary' });
    const pursuit = formatSessionReport(pursuitRow);
    expect(pursuit.moduleName).toBe('Look Pursuit');
    expect(pursuit.notices).toContain('This row is not a Gaze Hold measurement.');
    const holdRow = row({ gameId: 'computer_vision', gameName: 'Session', levelId: 'stationary' });
    const hold = formatSessionReport(holdRow);
    expect(hold.moduleName).toBe('Gaze Hold');
    expect(showGazeHoldUnsupported('computer_vision', [])).toBe(true);
    expect(showGazeHoldUnsupported('computer_vision', [pursuitRow])).toBe(true);
    expect(showGazeHoldUnsupported('computer_vision', [holdRow])).toBe(false);
  });
});
