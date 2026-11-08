import { describe, expect, it } from 'vitest';
import { resolveAllowedModuleIds } from './auth-types';
import { chartAccuracy, localInclusiveRangeToUtc } from './game-session';
import { buildLevelAnalytics, LEVEL_IDENTITY_MISMATCH } from './level-analytics';
import { buildPracticeInsights, selectNewestOverview } from './practice-insights';
import {
  BEFORE_HISTORY_LABEL,
  EMPTY_LEVELS_LABEL,
  NO_ACTIVITIES_ASSIGNED_LABEL,
  NO_SESSION_SAVED_LABEL,
  PLAYABLE_EXCEPTION_NOTE,
  PREVIOUS_DOCTOR_LABEL,
  RECORDED_NOT_ASSIGNED_LABEL,
  PERIOD_SESSION_CAP,
  applyRevisionChange,
  assignmentLevelName,
  buildDoctorPrescriptionAnalytics,
  buildPrescriptionPeriod,
  classifyRecordedSession,
  migrationSnapshot,
  planNewSessionRevision,
  prescriptionStateAfterTransfer,
  projectPatientPrescriptionPeriod,
  projectPatientPrescriptionPractice,
  revisionInstantAfter,
  utcInstantMs,
  type AssignmentSnapshot,
  type PrescriptionPracticeSession,
  type PrescriptionRevision,
} from './prescription-coverage';
import { sanitizeSessionDetail } from './session-detail';

const T0 = '2026-01-01T00:00:00.000Z';
const T1 = '2026-02-01T00:00:00.000Z';
const T2 = '2026-03-01T00:00:00.000Z';
const MID = '2026-01-15T12:00:00.000Z';
const MID_MS = utcInstantMs(MID)!;

function revision(partial: Partial<PrescriptionRevision> & Pick<PrescriptionRevision, 'id' | 'assignments'>): PrescriptionRevision {
  return {
    patientId: 'patient-1',
    actorDoctorId: 'doctor-internal-id-9f3a',
    effectiveFrom: T0,
    effectiveTo: null,
    ...partial,
  };
}

function session(partial: Partial<PrescriptionPracticeSession> = {}): PrescriptionPracticeSession {
  return {
    id: partial.id ?? 'session-1',
    gameId: 'rotatory',
    levelId: 'uppercase',
    recordedAt: MID,
    receivedAtMs: MID_MS,
    prescriptionRevisionId: null,
    correct: 1,
    wrongTaps: 0,
    misses: 0,
    timeouts: 0,
    accuracy: 100,
    avgReactionSec: 1,
    reactionMs: [1000],
    stimuliCount: 1,
    ...partial,
  };
}

function state(revisions: PrescriptionRevision[], live: AssignmentSnapshot[] = []) {
  return { revisions, live };
}

describe('revision history', () => {
  it('creates the first revision from an empty history', () => {
    const next = applyRevisionChange(state([]), {
      at: T0,
      actorDoctorId: 'doctor-1',
      newRevisionId: 'r1',
      patientId: 'patient-1',
      nextLive: [{ moduleId: 'rotatory', levels: ['uppercase'] }],
    });
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.revisions).toHaveLength(1);
    expect(next.opened.effectiveTo).toBeNull();
    expect(next.closedId).toBeNull();
  });

  it('closes the previous revision when the last module is removed and stores an empty snapshot', () => {
    const first = applyRevisionChange(state([]), {
      at: T0,
      actorDoctorId: 'doctor-1',
      newRevisionId: 'r1',
      patientId: 'patient-1',
      nextLive: [{ moduleId: 'rotatory', levels: ['uppercase'] }],
    });
    if (!first.ok) throw new Error(first.reason);
    const removed = applyRevisionChange({ revisions: first.revisions, live: first.live }, {
      at: T1,
      actorDoctorId: 'doctor-1',
      newRevisionId: 'r2',
      patientId: 'patient-1',
      nextLive: [],
    });
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.revisions.find((item) => item.id === 'r1')?.effectiveTo).toBe(T1);
    expect(removed.opened.assignments).toEqual([]);
    expect(removed.live).toEqual([]);
  });

  it('rejects a second open revision instead of leaving two open', () => {
    const previous = state([
      revision({ id: 'r1', assignments: [{ moduleId: 'rotatory', levels: ['uppercase'] }] }),
      revision({ id: 'r2', effectiveFrom: T1, assignments: [{ moduleId: 'sorting', levels: ['numbers'] }] }),
    ]);
    const next = applyRevisionChange(previous, {
      at: T2,
      actorDoctorId: 'doctor-1',
      newRevisionId: 'r3',
      patientId: 'patient-1',
      nextLive: [],
    });
    expect(next.ok).toBe(false);
    if (next.ok) return;
    expect(next.reason).toBe('overlapping_open_revisions');
    expect(previous.revisions.filter((item) => item.effectiveTo == null)).toHaveLength(2);
  });

  it('leaves the previous live set and revisions unchanged when the change is invalid', () => {
    const previous = state(
      [revision({ id: 'r1', assignments: [{ moduleId: 'rotatory', levels: ['uppercase'] }] })],
      [{ moduleId: 'rotatory', levels: ['uppercase'] }],
    );
    const snapshot = JSON.stringify(previous);
    const next = applyRevisionChange(previous, {
      at: T0,
      actorDoctorId: 'doctor-1',
      newRevisionId: 'r2',
      patientId: 'patient-1',
      nextLive: [],
    });
    expect(next.ok).toBe(false);
    expect(JSON.stringify(previous)).toBe(snapshot);
  });

  it('rejects a missing or reversed effective window', () => {
    expect(revision({ id: 'bad', effectiveFrom: '2026-01-01', assignments: [] }) && true).toBe(true);
    const next = applyRevisionChange(state([]), {
      at: '2026-01-01',
      actorDoctorId: null,
      newRevisionId: 'r1',
      patientId: 'patient-1',
      nextLive: [],
    });
    expect(next).toMatchObject({ ok: false, reason: 'invalid_period' });
  });

  it('does not create a migration snapshot when nothing is currently assigned', () => {
    expect(migrationSnapshot({ id: 'm', patientId: 'p', actorDoctorId: 'd', at: T0, live: [] })).toBeNull();
    const created = migrationSnapshot({
      id: 'm',
      patientId: 'p',
      actorDoctorId: 'd',
      at: T0,
      live: [{ moduleId: 'rotatory', levels: [] }],
    });
    expect(created?.effectiveFrom).toBe(T0);
    expect(created?.assignments).toEqual([{ moduleId: 'rotatory', levels: [] }]);
  });

  it('keeps a transfer from moving revisions or session links', () => {
    const before = {
      revisions: [revision({ id: 'r1', assignments: [{ moduleId: 'rotatory', levels: ['uppercase'] }] })],
      sessions: [session({ prescriptionRevisionId: 'r1' })],
    };
    expect(prescriptionStateAfterTransfer(before)).toBe(before);
    expect(before.sessions[0].prescriptionRevisionId).toBe('r1');
  });
});

describe('recorded time', () => {
  const open = [revision({ id: 'r1', assignments: [{ moduleId: 'rotatory', levels: ['uppercase'] }] })];

  it('accepts Z and numeric offsets without using an unqualified parse', () => {
    expect(utcInstantMs('2026-01-01T05:30:00+05:30')).toBe(utcInstantMs(T0));
    expect(utcInstantMs('2026-01-01')).toBeNull();
    expect(utcInstantMs('2026-01-01T00:00:00')).toBeNull();
    expect(utcInstantMs('2026-02-31T00:00:00.000Z')).toBeNull();
  });

  it('includes the opening instant and excludes the closing instant', () => {
    const revisions = [
      revision({
        id: 'r1',
        effectiveTo: T1,
        assignments: [{ moduleId: 'rotatory', levels: ['uppercase'] }],
      }),
    ];
    expect(classifyRecordedSession({ ...session({ recordedAt: T0, receivedAtMs: utcInstantMs(T0)! }), revisions }).status).toBe('linked');
    expect(
      classifyRecordedSession({
        ...session({ recordedAt: T1, receivedAtMs: utcInstantMs(T1)! }),
        revisions,
      }),
    ).toMatchObject({ status: 'unattributed', reason: 'no_covering_assignment' });
  });

  it('does not attribute a date-only, zone-less, or future timestamp', () => {
    expect(classifyRecordedSession({ ...session({ recordedAt: '2026-01-15' }), revisions: open }).reason).toBe('timestamp_not_utc_instant');
    expect(classifyRecordedSession({ ...session({ recordedAt: '2026-01-15T12:00:00' }), revisions: open }).reason).toBe('timestamp_not_utc_instant');
    const future = '2026-01-15T12:06:00.000Z';
    expect(
      classifyRecordedSession({ ...session({ recordedAt: future, receivedAtMs: MID_MS }), revisions: open }),
    ).toMatchObject({ status: 'unattributed', reason: 'timestamp_not_reliable' });
    expect(
      planNewSessionRevision({
        existing: false,
        existingRevisionId: null,
        recordedAt: future,
        gameId: 'rotatory',
        levelId: 'uppercase',
        serverNowMs: MID_MS,
        revisions: open,
      }).prescriptionRevisionId,
    ).toBeNull();
  });

  it('matches a late sync to the completion window rather than the receipt window', () => {
    const revisions = [
      revision({ id: 'older', effectiveTo: T1, assignments: [{ moduleId: 'rotatory', levels: ['uppercase'] }] }),
      revision({ id: 'newer', effectiveFrom: T1, assignments: [{ moduleId: 'sorting', levels: ['numbers'] }] }),
    ];
    const classified = classifyRecordedSession({
      ...session({ recordedAt: MID, receivedAtMs: utcInstantMs('2026-04-01T00:00:00.000Z')! }),
      revisions,
    });
    expect(classified).toMatchObject({ status: 'linked', revisionId: 'older', source: 'inferred' });
  });
});

describe('session attribution', () => {
  it('returns the original revision link before looking at a newer assignment', () => {
    const newer = [revision({ id: 'newer', assignments: [{ moduleId: 'rotatory', levels: ['uppercase'] }] })];
    const plan = planNewSessionRevision({
      existing: true,
      existingRevisionId: 'original',
      recordedAt: MID,
      gameId: 'rotatory',
      levelId: 'uppercase',
      serverNowMs: MID_MS,
      revisions: newer,
    });
    expect(plan.prescriptionRevisionId).toBe('original');
  });

  it('keeps a stored link when the receipt clock is earlier than the recorded time', () => {
    const revisions = [revision({ id: 'stored', assignments: [{ moduleId: 'rotatory', levels: ['uppercase'] }] })];
    const classified = classifyRecordedSession({
      ...session({
        recordedAt: '2026-01-15T12:10:00.000Z',
        receivedAtMs: MID_MS,
        prescriptionRevisionId: 'stored',
      }),
      revisions,
    });
    expect(classified).toEqual({ status: 'linked', revisionId: 'stored', source: 'direct' });
  });

  it('does not fall back when a stored link has the wrong game', () => {
    const revisions = [
      revision({ id: 'stored', assignments: [{ moduleId: 'sorting', levels: ['numbers'] }] }),
      revision({ id: 'actual', assignments: [{ moduleId: 'rotatory', levels: ['uppercase'] }] }),
    ];
    const classified = classifyRecordedSession({
      ...session({ prescriptionRevisionId: 'stored' }),
      revisions,
    });
    expect(classified).toEqual({ status: 'unattributed', reason: 'direct_link_mismatch' });
  });

  it('does not fall back when a stored link has the wrong level', () => {
    const revisions = [
      revision({ id: 'stored', assignments: [{ moduleId: 'rotatory', levels: ['lowercase'] }] }),
      revision({ id: 'actual', assignments: [{ moduleId: 'rotatory', levels: ['uppercase'] }] }),
    ];
    const classified = classifyRecordedSession({
      ...session({ prescriptionRevisionId: 'stored' }),
      revisions,
    });
    expect(classified).toEqual({ status: 'unattributed', reason: 'direct_link_mismatch' });
  });

  it('does not fall back when a stored link is outside its revision window', () => {
    const revisions = [
      revision({ id: 'stored', effectiveTo: T1, assignments: [{ moduleId: 'rotatory', levels: ['uppercase'] }] }),
      revision({ id: 'later', effectiveFrom: T1, assignments: [{ moduleId: 'rotatory', levels: ['uppercase'] }] }),
    ];
    const classified = classifyRecordedSession({
      ...session({ recordedAt: T2, receivedAtMs: utcInstantMs(T2)!, prescriptionRevisionId: 'stored' }),
      revisions,
    });
    expect(classified).toEqual({ status: 'unattributed', reason: 'direct_link_mismatch' });
  });

  it('does not fall back when a stored link has the wrong game, level, or time', () => {
    const revisions = [
      revision({ id: 'stored', effectiveTo: T1, assignments: [{ moduleId: 'sorting', levels: ['numbers'] }] }),
      revision({ id: 'actual', effectiveFrom: T1, assignments: [{ moduleId: 'rotatory', levels: ['uppercase'] }] }),
    ];
    const classified = classifyRecordedSession({
      ...session({ recordedAt: T2, receivedAtMs: utcInstantMs(T2)!, prescriptionRevisionId: 'stored' }),
      revisions,
    });
    expect(classified).toEqual({ status: 'unattributed', reason: 'direct_link_mismatch' });
  });

  it('leaves a session before assignment history unattributed', () => {
    const revisions = [revision({ id: 'r1', effectiveFrom: T1, assignments: [{ moduleId: 'rotatory', levels: ['uppercase'] }] })];
    const classified = classifyRecordedSession({
      ...session({ recordedAt: T0, receivedAtMs: utcInstantMs(T1)! }),
      revisions,
    });
    expect(classified).toMatchObject({ status: 'unattributed', reason: 'before_history' });
  });

  it('does not choose either side of an overlap', () => {
    const revisions = [
      revision({ id: 'a', assignments: [{ moduleId: 'rotatory', levels: ['uppercase'] }] }),
      revision({ id: 'b', effectiveFrom: T0, assignments: [{ moduleId: 'rotatory', levels: ['uppercase'] }] }),
    ];
    expect(classifyRecordedSession({ ...session(), revisions })).toMatchObject({
      status: 'unattributed',
      reason: 'overlapping_assignments',
    });
  });

  it('does not let a null level satisfy an assigned level', () => {
    const revisions = [revision({ id: 'r1', assignments: [{ moduleId: 'rotatory', levels: ['uppercase'] }] })];
    expect(classifyRecordedSession({ ...session({ levelId: null }), revisions })).toMatchObject({
      status: 'unattributed',
      reason: 'level_not_recorded',
    });
  });

  it('treats Direction Sense mixed and straighten as the only alias', () => {
    const revisions = [revision({ id: 'r1', assignments: [{ moduleId: 'direction_sense', levels: ['mixed'] }] })];
    expect(
      classifyRecordedSession({ ...session({ gameId: 'direction_sense', levelId: 'straighten' }), revisions }),
    ).toMatchObject({ status: 'linked', revisionId: 'r1' });
    expect(
      classifyRecordedSession({ ...session({ gameId: 'bee_tracing', levelId: 'straight' }), revisions: [revision({ id: 'r1', assignments: [{ moduleId: 'bee_tracing', levels: ['curve'] }] })] }),
    ).toMatchObject({ status: 'not_assigned', kind: 'level_not_assigned' });
  });

  it('classifies a played level on an empty assignment as recorded but not assigned', () => {
    const revisions = [revision({ id: 'r1', assignments: [{ moduleId: 'rotatory', levels: [] }] })];
    const analytics = buildDoctorPrescriptionAnalytics({
      revisions,
      sessions: [session()],
    });
    expect(analytics.modulesWithoutLevels[0].label).toBe(EMPTY_LEVELS_LABEL);
    expect(analytics.activities).toHaveLength(0);
    expect(analytics.recordedButNotAssigned[0]).toMatchObject({
      label: RECORDED_NOT_ASSIGNED_LABEL,
      kind: 'level_not_assigned',
    });
  });

  it('keeps playable exceptions out of the assigned activities', () => {
    const revisions = [
      revision({
        id: 'r1',
        assignments: [
          { moduleId: 'geoboard', levels: ['1'] },
          { moduleId: 'computer_vision', levels: ['other'] },
          { moduleId: 'bee_tracing', levels: ['legacy-placeholder'] },
        ],
      }),
    ];
    const analytics = buildDoctorPrescriptionAnalytics({
      revisions,
      sessions: [
        session({ id: 'geo', gameId: 'geoboard', levelId: '6' }),
        session({ id: 'gaze', gameId: 'computer_vision', levelId: 'stationary' }),
        session({ id: 'bee', gameId: 'bee_tracing', levelId: 'straight' }),
        session({ id: 'never', gameId: 'sorting', levelId: 'numbers' }),
      ],
    });
    expect(analytics.recordedButNotAssigned.map((item) => item.kind)).toEqual([
      'playable_exception',
      'playable_exception',
      'playable_exception',
      'game_not_assigned',
    ]);
    expect(analytics.recordedButNotAssigned[0].note).toBe(PLAYABLE_EXCEPTION_NOTE);
    expect(analytics.recordedButNotAssigned[0].label).toBe(RECORDED_NOT_ASSIGNED_LABEL);
    expect(analytics.activities.every((activity) => activity.sessionCount === 0)).toBe(true);
  });
});

describe('coverage projections', () => {
  it('counts saved sessions for an assigned level and leaves another level blank', () => {
    const revisions = [
      revision({
        id: 'r1',
        assignments: [{ moduleId: 'rotatory', levels: ['uppercase', 'lowercase'] }],
      }),
    ];
    const analytics = buildDoctorPrescriptionAnalytics({
      revisions,
      sessions: [
        session({ id: 'a', recordedAt: MID }),
        session({ id: 'b', recordedAt: '2026-01-20T12:00:00.000Z', receivedAtMs: utcInstantMs('2026-01-20T12:00:00.000Z')! }),
      ],
      actorNames: {},
    });
    const upper = analytics.activities.find((activity) => activity.levelId === 'uppercase');
    const lower = analytics.activities.find((activity) => activity.levelId === 'lowercase');
    expect(upper).toMatchObject({ status: 'current', sessionCount: 2, availability: 'recorded' });
    expect(lower).toMatchObject({ sessionCount: 0, availability: 'none_saved' });
    expect(lower?.performanceValue).toBeNull();
    expect(analytics).not.toHaveProperty('performanceValue');
  });

  it('keeps sessions for a level that is no longer prescribed on that older assignment', () => {
    const first = applyRevisionChange(state([]), {
      at: T0,
      actorDoctorId: 'doctor-internal-id-9f3a',
      newRevisionId: 'r1',
      patientId: 'patient-1',
      nextLive: [{ moduleId: 'rotatory', levels: ['uppercase'] }],
    });
    if (!first.ok) throw new Error(first.reason);
    const second = applyRevisionChange({ revisions: first.revisions, live: first.live }, {
      at: T1,
      actorDoctorId: null,
      newRevisionId: 'r2',
      patientId: 'patient-1',
      nextLive: [{ moduleId: 'sorting', levels: ['numbers'] }],
    });
    if (!second.ok) throw new Error(second.reason);
    const analytics = buildDoctorPrescriptionAnalytics({
      revisions: second.revisions,
      sessions: [session({ prescriptionRevisionId: 'r1', receivedAtMs: utcInstantMs(T1)! })],
      actorNames: { 'doctor-internal-id-9f3a': 'Dr. Ada' },
    });
    expect(analytics.activities.find((activity) => activity.levelId === 'uppercase')).toMatchObject({
      status: 'no_longer_prescribed',
      sessionCount: 1,
    });
    expect(analytics.activities.find((activity) => activity.levelId === 'numbers')).toMatchObject({
      status: 'current',
      availability: 'none_saved',
    });
    expect(analytics.revisions[0].actorLabel).toBe('Dr. Ada');
    expect(analytics.revisions[1].actorLabel).toBe(PREVIOUS_DOCTOR_LABEL);
    const patient = projectPatientPrescriptionPractice(analytics);
    expect(patient.activities.map((activity) => activity.levelName)).toEqual(['Numeric Sorting']);
    expect(patient.emptyLabel).toBeNull();
    const encoded = JSON.stringify(patient);
    expect(encoded).not.toContain('doctor-internal-id-9f3a');
    expect(encoded).not.toContain('actorDoctorId');
    expect(encoded).not.toContain('prescriptionRevisionId');
    expect(encoded).not.toContain('direct_link_mismatch');
    expect(encoded).not.toContain('unattributed');
    expect(encoded).not.toContain(BEFORE_HISTORY_LABEL);
  });

  it('uses Bee weighting from the existing level aggregate', () => {
    const revisions = [revision({ id: 'r1', assignments: [{ moduleId: 'bee_tracing', levels: ['straight'] }] })];
    const analytics = buildDoctorPrescriptionAnalytics({
      revisions,
      sessions: [
        session({
          id: 'bee-1',
          gameId: 'bee_tracing',
          levelId: 'straight',
          correct: 10,
          stimuliCount: 10,
          accuracy: 80,
        }),
        session({
          id: 'bee-2',
          gameId: 'bee_tracing',
          levelId: 'straight',
          recordedAt: '2026-01-16T12:00:00.000Z',
          receivedAtMs: utcInstantMs('2026-01-16T12:00:00.000Z')!,
          correct: 3,
          stimuliCount: 4,
          accuracy: 40,
        }),
      ],
    });
    expect(analytics.activities[0]).toMatchObject({ performanceLabel: 'Path adherence', performanceValue: 76.4 });
  });

  it('says nothing is assigned when the open snapshot is empty', () => {
    const analytics = buildDoctorPrescriptionAnalytics({
      revisions: [revision({ id: 'r1', assignments: [] })],
      sessions: [],
    });
    expect(projectPatientPrescriptionPractice(analytics).emptyLabel).toBe(NO_ACTIVITIES_ASSIGNED_LABEL);
    expect(NO_SESSION_SAVED_LABEL).toBe('No session saved');
  });
});

describe('existing behavior stays in place', () => {
  it('keeps the phase 1 chart accuracy formula', () => {
    expect(chartAccuracy({ gameId: 'rotatory', correct: 1, wrongTaps: 1, misses: 0, timeouts: 0, accuracy: 0 })).toBe(50);
  });

  it('keeps detail rejection for a non-object', () => {
    expect(sanitizeSessionDetail('rotatory', 'nope')?.status).toBe('rejected');
  });

  it('keeps level identity mismatch', () => {
    expect(
      buildLevelAnalytics({
        gameId: 'rotatory',
        levelId: 'uppercase',
        timeZone: 'UTC',
        rows: [session({ gameId: 'sorting' })],
      }),
    ).toEqual({ status: 'invalid', reason: LEVEL_IDENTITY_MISMATCH });
  });

  it('keeps an empty practice week and the newest-2000 rule', () => {
    const practice = buildPracticeInsights([], { timeZone: 'America/New_York', from: '2026-01-05', to: '2026-01-11' });
    expect(practice.weeks.some((week) => week.availability === 'none_saved')).toBe(true);
    expect(selectNewestOverview([1, 2, 3], 2)).toMatchObject({ truncated: true, omitted: 'older', rows: [1, 2] });
  });

  it('keeps module access tied to the doctor link rather than a subscription', () => {
    const linked = resolveAllowedModuleIds({
      user: { role: 'patient' },
      allowedModuleIds: ['rotatory'],
      patient: { origin: 'doctor_created', doctorId: 'doctor-1' },
    });
    const unlinked = resolveAllowedModuleIds({
      user: { role: 'patient' },
      allowedModuleIds: [],
      patient: { origin: 'doctor_created', doctorId: null },
    });
    expect(linked).toEqual(['rotatory']);
    expect(unlinked).toContain('sorting');
  });

  it('moves a same-millisecond revision boundary forward without changing session instants', () => {
    expect(revisionInstantAfter(T0, T0)).toBe('2026-01-01T00:00:00.001Z');
    expect(utcInstantMs(MID)).toBe(MID_MS);
  });
});

function periodBounds(localFrom: string, localTo: string, timeZone = 'UTC') {
  const range = localInclusiveRangeToUtc(localFrom, localTo, timeZone);
  return { from: range.start, to: range.endExclusive, timeZone, localFrom, localTo };
}

function buildPeriod(
  revisions: PrescriptionRevision[],
  sessions: PrescriptionPracticeSession[],
  bounds = periodBounds('2026-01-01', '2026-01-31'),
) {
  return buildPrescriptionPeriod({ revisions, sessions, ...bounds });
}

describe('assigned activity period', () => {
  const open = [revision({ id: 'r1', assignments: [{ moduleId: 'rotatory', levels: ['uppercase'] }] })];

  it('returns no saved sessions for an empty period', () => {
    const period = buildPeriod(open, []);
    expect(period.activities[0]).toMatchObject({ sessionCount: 0, availability: 'none_saved', performanceValue: null, daily: [] });
  });

  it('counts one linked session inside the period', () => {
    const period = buildPeriod(open, [session({ prescriptionRevisionId: 'r1' })]);
    expect(period.activities[0]).toMatchObject({ sessionCount: 1, availability: 'recorded', performanceValue: 100 });
  });

  it('leaves a session outside the period uncounted', () => {
    const period = buildPeriod(open, [session({ recordedAt: T2, receivedAtMs: utcInstantMs(T2)! })]);
    expect(period.activities[0].sessionCount).toBe(0);
    expect(period.unattributed).toHaveLength(0);
  });

  it('includes the local opening midnight and excludes the next midnight', () => {
    const bounds = periodBounds('2026-01-15', '2026-01-15');
    const period = buildPeriod(
      open,
      [
        session({ id: 'open', recordedAt: '2026-01-15T00:00:00.000Z', receivedAtMs: utcInstantMs('2026-01-15T00:00:00.000Z')! }),
        session({ id: 'close', recordedAt: '2026-01-16T00:00:00.000Z', receivedAtMs: utcInstantMs('2026-01-16T00:00:00.000Z')! }),
        session({ id: 'late', recordedAt: '2026-01-15T23:59:59.000Z', receivedAtMs: utcInstantMs('2026-01-15T23:59:59.000Z')! }),
      ],
      bounds,
    );
    expect(period.activities[0].sessionCount).toBe(2);
    expect(period.activities[0].daily.map((day) => day.date)).toEqual(['2026-01-15']);
  });

  it('uses the requested timezone when the UTC date differs', () => {
    const period = buildPrescriptionPeriod({
      revisions: open,
      from: '2026-01-14T00:00:00.000Z',
      to: '2026-01-16T00:00:00.000Z',
      timeZone: 'America/New_York',
      localFrom: '2026-01-15',
      localTo: '2026-01-15',
      sessions: [
        session({
          id: 'previous-local',
          recordedAt: '2026-01-15T04:30:00.000Z',
          receivedAtMs: utcInstantMs('2026-01-15T04:30:00.000Z')!,
        }),
        session({
          id: 'local-day',
          recordedAt: '2026-01-15T05:30:00.000Z',
          receivedAtMs: utcInstantMs('2026-01-15T05:30:00.000Z')!,
        }),
      ],
    });
    expect(period.activities[0].sessionCount).toBe(1);
    expect(period.activities[0].daily[0].date).toBe('2026-01-15');
  });

  it('does not turn an empty level list into activities', () => {
    const period = buildPeriod(
      [revision({ id: 'r1', assignments: [{ moduleId: 'sorting', levels: [] }, { moduleId: 'rotatory', levels: ['uppercase'] }] })],
      [session({ gameId: 'sorting', levelId: 'numbers' })],
    );
    expect(period.activities.map((activity) => activity.moduleId)).toEqual(['rotatory']);
    expect(period.modulesWithoutLevels[0].label).toBe(EMPTY_LEVELS_LABEL);
    expect(period.recordedButNotAssigned).toHaveLength(1);
  });

  it('counts only the Direction Sense mixed and straighten alias', () => {
    const revisions = [revision({ id: 'r1', assignments: [{ moduleId: 'direction_sense', levels: ['mixed'] }] })];
    const matched = buildPeriod(revisions, [session({ gameId: 'direction_sense', levelId: 'straighten' })]);
    expect(matched.activities[0]).toMatchObject({ levelName: 'Straighten', sessionCount: 1 });
    const unmatched = buildPeriod(
      [revision({ id: 'r1', assignments: [{ moduleId: 'bee_tracing', levels: ['curve'] }] })],
      [session({ gameId: 'bee_tracing', levelId: 'straight' })],
    );
    expect(unmatched.activities[0].sessionCount).toBe(0);
    expect(unmatched.recordedButNotAssigned).toHaveLength(1);
    expect(assignmentLevelName('rotatory', 'retired-level')).toBe('retired-level');
  });

  it('does not match a null level', () => {
    const period = buildPeriod(open, [session({ levelId: null })]);
    expect(period.activities[0].sessionCount).toBe(0);
    expect(period.unattributed[0].reason).toBe('level_not_recorded');
  });

  it('counts a linked session that has no usable performance and keeps that day', () => {
    const period = buildPeriod(open, [
      session({
        correct: 0,
        wrongTaps: 0,
        misses: 0,
        timeouts: 0,
        accuracy: 0,
        avgReactionSec: 0,
        reactionMs: [],
        stimuliCount: 0,
      }),
    ]);
    expect(period.activities[0].sessionCount).toBe(1);
    expect(period.activities[0].performanceValue).toBeNull();
    expect(period.activities[0].daily).toEqual([{ date: '2026-01-15', sessionCount: 1, performance: null }]);
  });

  it('keeps Bee path-adherence weighting', () => {
    const period = buildPeriod(
      [revision({ id: 'r1', assignments: [{ moduleId: 'bee_tracing', levels: ['straight'] }] })],
      [
        session({ id: 'bee-1', gameId: 'bee_tracing', levelId: 'straight', correct: 10, stimuliCount: 10, accuracy: 80 }),
        session({
          id: 'bee-2',
          gameId: 'bee_tracing',
          levelId: 'straight',
          recordedAt: '2026-01-16T12:00:00.000Z',
          receivedAtMs: utcInstantMs('2026-01-16T12:00:00.000Z')!,
          correct: 3,
          stimuliCount: 4,
          accuracy: 40,
        }),
      ],
    );
    expect(period.activities[0]).toMatchObject({ performanceLabel: 'Path adherence', performanceValue: 76.4 });
  });

  it('uses reaction samples before a stored average', () => {
    const samples = buildPeriod(open, [session({ reactionMs: [1000, 3000], avgReactionSec: 9 })]);
    expect(samples.activities[0].reactionMeanSec).toBe(2);
    const stored = buildPeriod(open, [session({ reactionMs: [], avgReactionSec: 1.5 })]);
    expect(stored.activities[0].reactionMeanSec).toBe(1.5);
    const missing = buildPeriod(open, [session({ reactionMs: [], avgReactionSec: 0 })]);
    expect(missing.activities[0].reactionMeanSec).toBeNull();
  });

  it('leaves an overlap unattributed', () => {
    const revisions = [
      revision({ id: 'a', assignments: [{ moduleId: 'rotatory', levels: ['uppercase'] }] }),
      revision({ id: 'b', effectiveFrom: T0, assignments: [{ moduleId: 'rotatory', levels: ['uppercase'] }] }),
    ];
    const period = buildPeriod(revisions, [session()]);
    expect(period.unattributed[0].reason).toBe('overlapping_assignments');
    expect(period.activities.every((activity) => activity.sessionCount === 0)).toBe(true);
  });

  it('does not count an invalid stored link on another revision', () => {
    const revisions = [
      revision({ id: 'stored', effectiveTo: T1, assignments: [{ moduleId: 'rotatory', levels: ['lowercase'] }] }),
      revision({ id: 'current', effectiveFrom: T1, assignments: [{ moduleId: 'rotatory', levels: ['uppercase'] }] }),
    ];
    const period = buildPeriod(revisions, [session({ prescriptionRevisionId: 'stored' })]);
    expect(period.unattributed[0].reason).toBe('direct_link_mismatch');
    expect(period.activities.find((activity) => activity.levelId === 'uppercase')?.sessionCount).toBe(0);
  });

  it('counts a direct link and an inferred link', () => {
    const period = buildPeriod(open, [
      session({ id: 'direct', prescriptionRevisionId: 'r1' }),
      session({ id: 'inferred', recordedAt: '2026-01-16T12:00:00.000Z', receivedAtMs: utcInstantMs('2026-01-16T12:00:00.000Z')! }),
    ]);
    expect(period.activities[0].sessionCount).toBe(2);
  });

  it('keeps a removed activity that was assigned during the period', () => {
    const revisions = [
      revision({
        id: 'old',
        effectiveTo: T1,
        assignments: [{ moduleId: 'rotatory', levels: ['uppercase', 'lowercase'] }],
      }),
      revision({ id: 'current', effectiveFrom: T1, assignments: [{ moduleId: 'rotatory', levels: ['numbers'] }] }),
    ];
    const period = buildPeriod(
      revisions,
      [session({ prescriptionRevisionId: 'old' })],
      periodBounds('2026-01-01', '2026-03-01'),
    );
    expect(period.activities.find((activity) => activity.levelId === 'uppercase')).toMatchObject({
      status: 'no_longer_prescribed',
      sessionCount: 1,
      availability: 'recorded',
    });
    expect(period.activities.find((activity) => activity.levelId === 'lowercase')).toMatchObject({
      status: 'no_longer_prescribed',
      sessionCount: 0,
      availability: 'none_saved',
    });
    expect(period.activities.find((activity) => activity.levelId === 'numbers')).toMatchObject({
      status: 'current',
      sessionCount: 0,
      availability: 'none_saved',
    });
  });

  it('hides internal fields from the patient period', () => {
    const period = buildPeriod(open, [session({ prescriptionRevisionId: 'r1' })]);
    const patient = projectPatientPrescriptionPeriod(period);
    const encoded = JSON.stringify(patient);
    expect(patient.activities[0]).toEqual({
      moduleName: 'Rotatory Wheel',
      levelName: 'Uppercase Rotatory',
      sessionCount: 1,
      lastRecordedAt: MID,
      availability: 'recorded',
    });
    expect(encoded).not.toContain('actorDoctorId');
    expect(encoded).not.toContain('prescriptionRevisionId');
    expect(encoded).not.toContain('direct_link_mismatch');
    expect(encoded).not.toContain('no_longer_prescribed');
    expect(encoded).not.toContain('moduleId');
  });

  it('treats 2000 rows as complete and 2001 as an incomplete newer window', () => {
    const revisions = open;
    const rows = (count: number) =>
      Array.from({ length: count }, (_, index) => {
        const recordedAt = new Date(utcInstantMs('2026-01-15T00:00:00.000Z')! + index * 1000).toISOString();
        return session({ id: `s-${String(index).padStart(4, '0')}`, recordedAt, receivedAtMs: utcInstantMs(recordedAt)! });
      });
    const complete = buildPeriod(revisions, rows(PERIOD_SESSION_CAP));
    expect(complete).toMatchObject({ truncated: false, omitted: null, incomplete: false, cap: 2000 });
    expect(complete.activities[0].sessionCount).toBe(2000);
    const truncated = buildPeriod(revisions, rows(PERIOD_SESSION_CAP + 1));
    expect(truncated).toMatchObject({ truncated: true, omitted: 'older', incomplete: true });
    expect(truncated.activities[0].sessionCount).toBe(2000);
    expect(truncated.activities[0].firstRecordedAt).toBe(rows(PERIOD_SESSION_CAP + 1)[1].recordedAt);
    expect(truncated.activities[0].lastRecordedAt).toBe(rows(PERIOD_SESSION_CAP + 1)[2000].recordedAt);
    expect(truncated.activities[0].firstRecordedAt! < truncated.activities[0].lastRecordedAt!).toBe(true);
    expect(truncated.activities[0].daily[0].sessionCount).toBe(2000);
  });

  it('rejects a reversed period and an unknown timezone', () => {
    expect(() =>
      buildPrescriptionPeriod({
        revisions: open,
        sessions: [],
        from: T1,
        to: T0,
        timeZone: 'UTC',
        localFrom: '2026-01-01',
        localTo: '2026-01-02',
      }),
    ).toThrow('Invalid prescription period');
    expect(() =>
      buildPrescriptionPeriod({
        revisions: open,
        sessions: [],
        ...periodBounds('2026-01-01', '2026-01-02'),
        timeZone: 'Not/AZone',
      }),
    ).toThrow(/IANA/);
  });
});
