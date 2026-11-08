import { describe, expect, it } from 'vitest';
import { payloadFromSessionResult, prepareGameSessionInsert } from './game-session';
import { formatPatientSummary, formatSessionReport } from './session-report';
import {
  BUBBLE_CHASE_SET_CAP,
  DETAIL_ARRAY_CAPS,
  copyCompletedPursuitTrials,
  extractSessionDetail,
  formatDoctorDetail,
  persistedDetailVersion,
  recordedContextMatches,
  sanitizeSessionDetail,
  type PursuitCompletedTrial,
} from './session-detail';

function pursuitRow(index: number, error: number): PursuitCompletedTrial {
  return {
    trialIndex: index,
    outcome: 'correct',
    reactionTimeMs: 400,
    trackingErrorPx: error,
    anticipationRatio: 0.2,
  };
}

describe('session detail', () => {
  it('stores speed in px/s and keeps distance in px', () => {
    const detail = sanitizeSessionDetail('pursuit', {
      detailVersion: 1,
      gameId: 'pursuit',
      movementPattern: 'figure_eight',
      speedPxPerSec: 180.24,
      avgTrackingErrorPx: 12.6,
      meanAnticipationRatio: 0.1234,
      context: { deviceTier: 'tablet', levelId: 'figure_eight' },
    });
    expect(detail?.status).toBe('ok');
    if (detail?.status !== 'ok' || detail.gameId !== 'pursuit') return;
    expect(detail.speedPxPerSec).toEqual({ value: 180.2, unit: 'px/s', source: 'measured' });
    expect(detail.avgTrackingErrorPx).toEqual({ value: 13, unit: 'px', source: 'derived' });
    expect(detail.meanAnticipationRatio?.unit).toBe('ratio');
    expect(detail.meanAnticipationRatio?.value).toBe(0.123);
  });

  it('rejects a percent outside 0–100 and a proportion outside 0–1 without zeroing them', () => {
    const detail = sanitizeSessionDetail('rotatory', {
      detailVersion: 1,
      gameId: 'rotatory',
      lateralityEligible: true,
      rotationDirection: 'cw',
      leftFieldAccuracy: 140,
      cleanTapRate: 1.4,
      context: { deviceTier: 'mobile', levelId: 'uppercase' },
    });
    expect(detail?.status).toBe('ok');
    if (detail?.status !== 'ok' || detail.gameId !== 'rotatory') return;
    expect(detail.leftFieldAccuracy).toBeUndefined();
    expect(detail.cleanTapRate).toBeUndefined();
    expect(detail.notices.some((notice) => notice.includes('Left field accuracy'))).toBe(true);
    expect(detail.notices.some((notice) => notice.includes('Clean tap rate'))).toBe(true);
  });

  it('keeps an unsupported version out of a version-1 document', () => {
    const future = sanitizeSessionDetail('rotatory', { detailVersion: 4, gameId: 'rotatory', leftFieldAccuracy: 90 });
    expect(future?.status).toBe('unsupported_version');
    if (future?.status !== 'unsupported_version') return;
    expect(future.submittedVersion).toBe(4);
    expect('detailVersion' in future).toBe(false);
    expect(persistedDetailVersion(future)).toBeNull();
    expect(future.notices[0]).toContain('version 4');
    expect(JSON.stringify(future)).not.toContain('leftFieldAccuracy');

    const messy = sanitizeSessionDetail('rotatory', { detailVersion: 'later', gameId: 'rotatory' });
    expect(messy?.status).toBe('unsupported_version');
    if (messy?.status !== 'unsupported_version') return;
    expect(messy.submittedVersion).toBeUndefined();
    expect(persistedDetailVersion(messy)).toBeNull();
  });

  it('is idempotent for a sanitized document', () => {
    const once = sanitizeSessionDetail('pursuit', {
      detailVersion: 1,
      gameId: 'pursuit',
      movementPattern: 'linear_bounce',
      speedPxPerSec: 120,
      avgTrackingErrorPx: 8,
      context: { deviceTier: 'mobile', levelId: 'linear_bounce' },
    });
    expect(sanitizeSessionDetail('pursuit', once)).toEqual(once);
  });

  it('copies completed pursuit trials and does not keep positions', () => {
    const copied = copyCompletedPursuitTrials([
      {
        trialIndex: 0,
        blockIndex: 0,
        outcome: 'correct',
        reactionTimeMs: 500,
        trackingErrorPx: 4,
        anticipationRatio: 0.1,
        targetPositionAtTap: { x: 3, y: 4 },
        tapPosition: { x: 1, y: 2 },
      },
    ]);
    expect(copied).toEqual([
      { trialIndex: 0, outcome: 'correct', reactionTimeMs: 500, trackingErrorPx: 4, anticipationRatio: 0.1 },
    ]);
    expect(JSON.stringify(copied)).not.toContain('tapPosition');
  });

  it('keeps the full-session pursuit summary when the trial list is truncated', () => {
    const trials = Array.from({ length: 30 }, (_, index) => pursuitRow(index, index < 24 ? 1 : 100));
    const detail = sanitizeSessionDetail('pursuit', {
      detailVersion: 1,
      gameId: 'pursuit',
      movementPattern: 'figure_eight',
      speedPxPerSec: 180,
      decoyCount: 1,
      avgTrackingErrorPx: 50,
      meanAnticipationRatio: 0.4,
      trials,
      context: { deviceTier: 'tablet', levelId: 'figure_eight' },
    });
    if (detail?.status !== 'ok' || detail.gameId !== 'pursuit') throw new Error('expected pursuit detail');
    expect(detail.trials).toHaveLength(DETAIL_ARRAY_CAPS.pursuitTrials);
    expect(detail.avgTrackingErrorPx?.value).toBe(50);
    expect(detail.meanAnticipationRatio?.value).toBe(0.4);
    expect(detail.notices.some((notice) => notice.includes('incomplete'))).toBe(true);
  });

  it('derives a pursuit summary from the full list before the cap', () => {
    const trials = Array.from({ length: 30 }, (_, index) => pursuitRow(index, index < 24 ? 1 : 100));
    const detail = sanitizeSessionDetail('pursuit', {
      detailVersion: 1,
      gameId: 'pursuit',
      movementPattern: 'figure_eight',
      speedPxPerSec: 180,
      trials,
    });
    if (detail?.status !== 'ok' || detail.gameId !== 'pursuit') throw new Error('expected pursuit detail');
    expect(detail.avgTrackingErrorPx?.value).toBe(21);
    expect(detail.trials).toHaveLength(24);
  });

  it('caps Bubble Chase at the alphabet pool and marks a longer list incomplete', () => {
    expect(BUBBLE_CHASE_SET_CAP).toBe(26);
    const sets = Array.from({ length: 30 }, (_, setIndex) => ({
      setIndex,
      outcome: 'correct',
      reactionTimeMs: 300,
      wrongClicksCount: 0,
    }));
    const detail = sanitizeSessionDetail('mobile_target', {
      detailVersion: 1,
      gameId: 'mobile_target',
      gameMode: 'alphabets',
      speedPxPerSec: 90,
      sets,
    });
    if (detail?.status !== 'ok' || detail.gameId !== 'mobile_target') throw new Error('expected bubble chase detail');
    expect(detail.sets).toHaveLength(26);
    expect(detail.speedPxPerSec?.unit).toBe('px/s');
    expect(detail.notices.some((notice) => notice.includes('incomplete'))).toBe(true);
  });

  it('drops bee traces and keeps round summaries', () => {
    const detail = extractSessionDetail('bee_tracing', {
      tracingMode: 'active',
      toleranceBandPx: 40,
      horizontalAccuracyPercent: 80,
      verticalAccuracyPercent: 70,
      roundResults: [
        {
          roundNumber: 1,
          pathType: 'curve',
          difficultyTier: 1,
          accuracyPercent: 80,
          completionTimeSec: 4,
          baselineTimeSec: 3,
          deviationCount: 2,
          avgRecoveryTimeSec: 0.4,
          reactionTimeMs: 300,
          tracedPoints: [{ x: 1, y: 2 }],
          targetPoints: [{ x: 3, y: 4 }],
          idealSvgPathD: 'M0 0',
          orientation: 'landscape',
        },
      ],
    });
    expect(JSON.stringify(detail)).not.toContain('tracedPoints');
    expect(JSON.stringify(detail)).not.toContain('idealSvgPathD');
    if (detail?.status !== 'ok' || detail.gameId !== 'bee_tracing') throw new Error('expected bee detail');
    expect(detail.rounds?.[0].accuracyPercent.value).toBe(80);
    expect(detail.horizontalAccuracyPercent?.value).toBe(80);
  });

  it('matches recorded context only, and a shared unit is not enough', () => {
    const left = sanitizeSessionDetail('pursuit', {
      detailVersion: 1,
      gameId: 'pursuit',
      movementPattern: 'figure_eight',
      speedPxPerSec: 180,
      decoyCount: 1,
      context: { deviceTier: 'tablet', levelId: 'figure_eight' },
    });
    const otherDevice = sanitizeSessionDetail('pursuit', {
      detailVersion: 1,
      gameId: 'pursuit',
      movementPattern: 'figure_eight',
      speedPxPerSec: 180,
      decoyCount: 1,
      context: { deviceTier: 'mobile', levelId: 'figure_eight' },
    });
    const same = sanitizeSessionDetail('pursuit', {
      detailVersion: 1,
      gameId: 'pursuit',
      movementPattern: 'figure_eight',
      speedPxPerSec: 180,
      decoyCount: 1,
      context: { deviceTier: 'tablet', levelId: 'figure_eight' },
    });
    expect(recordedContextMatches(left, otherDevice, 'pursuit.tracking')).toBe(false);
    expect(recordedContextMatches(left, same, 'pursuit.tracking')).toBe(true);
  });

  it('treats a null device tier as unmatched context', () => {
    const left = sanitizeSessionDetail('pursuit', {
      detailVersion: 1,
      gameId: 'pursuit',
      movementPattern: 'figure_eight',
      speedPxPerSec: 180,
      decoyCount: 1,
      context: { deviceTier: null, levelId: 'figure_eight' },
    });
    const right = sanitizeSessionDetail('pursuit', {
      detailVersion: 1,
      gameId: 'pursuit',
      movementPattern: 'figure_eight',
      speedPxPerSec: 180,
      decoyCount: 1,
      context: { deviceTier: null, levelId: 'figure_eight' },
    });
    expect(recordedContextMatches(left, right, 'pursuit.tracking')).toBe(false);
  });

  it('leaves sorting and gaze hold without a document', () => {
    expect(extractSessionDetail('sorting', { gameName: 'Sorting' })).toBeNull();
    expect(extractSessionDetail('computer_vision', { gameName: 'Gaze Hold' })).toBeNull();
  });

  it('omits direction errors the transform cannot produce', () => {
    const detail = sanitizeSessionDetail('direction_sense', {
      detailVersion: 1,
      gameId: 'direction_sense',
      transformMode: 'face',
      choiceCount: 4,
      faceErrors: 2,
      flipErrors: 0,
    });
    if (detail?.status !== 'ok' || detail.gameId !== 'direction_sense') throw new Error('expected direction detail');
    expect(detail.faceErrors?.value).toBe(2);
    expect(detail.flipErrors).toBeUndefined();
  });

  it('does not put detail lines on the patient summary', () => {
    const summary = formatPatientSummary(
      formatSessionReport({
        id: 's1',
        sessionNumber: 1,
        gameId: 'pursuit',
        levelId: 'figure_eight',
        deviceTier: 'tablet',
        recordedAt: '2026-09-06T12:00:00.000Z',
        durationSec: 20,
        correct: 8,
        wrongTaps: 1,
        misses: 1,
        timeouts: 0,
        accuracy: 80,
        avgReactionSec: 0.4,
        medianReactionSec: 0.4,
        reactionMs: [400],
        stimuliCount: 10,
        gameName: 'Pursuit',
      }),
    );
    expect(Object.keys(summary).sort()).toEqual(['durationText', 'levelName', 'moduleName', 'scoreText', 'timeText']);
    const doctor = formatDoctorDetail(
      sanitizeSessionDetail('pursuit', {
        detailVersion: 1,
        gameId: 'pursuit',
        movementPattern: 'figure_eight',
        speedPxPerSec: 180,
        avgTrackingErrorPx: 12,
        trials: [pursuitRow(0, 12)],
      }),
    );
    expect(doctor.some((line) => line.label === 'Tracking error')).toBe(true);
    expect(doctor.some((line) => line.value.includes('px/s') || line.label === 'Speed')).toBe(true);
    expect(JSON.stringify(summary)).not.toContain('trialIndex');
  });

  it('puts Tier 1 and Tier 2 detail on a new session payload', () => {
    const base = {
      patientName: 'A',
      sessionId: 1,
      date: '2026-09-06',
      stimuliCount: 1,
      letterSize: 1,
      speed: '1x',
      durationSec: 1,
      clicksTotal: 1,
      correct: 1,
      wrong: 0,
      accuracy: 100,
      avgReactionSec: 0.4,
      medianReactionSec: 0.4,
      efficiencyIndex: 250,
      wrongTaps: 0,
      misses: 0,
      timeouts: 0,
      wrongTapRate: 0,
      missRate: 0,
      timeoutRate: 0,
      recordedAt: '2026-09-06T12:00:00.000Z',
      endedBy: 'cleared' as const,
      reactionMs: [400],
    };
    const pursuit = payloadFromSessionResult({
      ...base,
      gameName: 'Pursuit — Figure Eight',
      movementPattern: 'figure_eight',
      decoyCount: 1,
      speedPxPerSec: 180,
      avgTrackingErrorPx: 12,
      meanAnticipationRatio: 0.2,
      completedTrials: [pursuitRow(0, 12)],
      anticipationVsLagScore: 'Balanced Pursuit (Centered)',
      blockMetrics: [],
      starRating: 5,
    });
    expect(pursuit?.detail?.status).toBe('ok');
    if (pursuit?.detail?.status === 'ok' && pursuit.detail.gameId === 'pursuit') {
      expect(pursuit.detail.avgTrackingErrorPx?.value).toBe(12);
      expect(pursuit.detail.speedPxPerSec?.unit).toBe('px/s');
      expect(JSON.stringify(pursuit.detail)).not.toContain('Balanced Pursuit');
    }
    const direction = payloadFromSessionResult({
      ...base,
      gameName: 'Direction Sense',
      transformMode: 'face',
      faceErrors: 1,
      flipErrors: 0,
      choiceCount: 4,
      trialsConfigured: 4,
      trialsCompleted: 4,
      deviceTier: 'mobile',
    });
    expect(direction?.detail?.status).toBe('ok');
    if (direction?.detail?.status === 'ok' && direction.detail.gameId === 'direction_sense') {
      expect(direction.detail.faceErrors?.value).toBe(1);
      expect(direction.detail.flipErrors).toBeUndefined();
    }
    const code = payloadFromSessionResult({
      ...base,
      gameName: 'Hold the Code',
      targetCode: '4815',
      codeLength: 4,
      flashMs: 800,
      timeLimitSec: 30,
      roundsCompleted: 1,
      stimulusMode: 'digits',
      matchesConfigured: 3,
      matchesFound: 1,
      matchesRemaining: 2,
      roundsConfigured: 1,
      deviceTier: 'mobile',
    });
    expect(JSON.stringify(code?.detail ?? null)).not.toContain('4815');
  });

  it('returns the original row, including its original detail, before sanitizing a retry', () => {
    const stored = {
      id: 'row-1',
      accuracy: 10,
      detail: { status: 'ok', gameId: 'pursuit', marker: 'original' },
    };
    const plan = prepareGameSessionInsert(stored, {
      gameId: 'pursuit',
      correct: 8,
      wrongTaps: 2,
      misses: 0,
      timeouts: 0,
      accuracy: 99,
      reactionMs: [400],
    });
    expect(plan.kind).toBe('existing');
    if (plan.kind !== 'existing') return;
    expect(plan.record).toBe(stored);
    expect(plan.record.detail).toEqual({ status: 'ok', gameId: 'pursuit', marker: 'original' });
  });
});
