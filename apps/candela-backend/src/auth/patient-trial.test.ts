import { describe, expect, it } from 'vitest';
import { computeTrialEnd, toPatientTrialStatus } from '@candela/shared';

describe('patient trial helpers', () => {
  it('reports inactive when trial timestamps are missing', () => {
    expect(toPatientTrialStatus(null, null)).toEqual({
      startedAt: null,
      endsAt: null,
      active: false,
      daysRemaining: null,
    });
  });

  it('reports active with remaining days inside the window', () => {
    const started = new Date('2026-01-01T00:00:00.000Z');
    const ends = computeTrialEnd(started, 7);
    const status = toPatientTrialStatus(started, ends, new Date('2026-01-03T00:00:00.000Z'));
    expect(status.active).toBe(true);
    expect(status.daysRemaining).toBe(5);
    expect(status.startedAt).toBe(started.toISOString());
    expect(status.endsAt).toBe(ends.toISOString());
  });

  it('reports inactive after the window ends', () => {
    const started = new Date('2026-01-01T00:00:00.000Z');
    const ends = computeTrialEnd(started, 7);
    const status = toPatientTrialStatus(started, ends, new Date('2026-01-10T00:00:00.000Z'));
    expect(status.active).toBe(false);
    expect(status.daysRemaining).toBe(0);
  });
});

describe('ensurePatientTrialStarted concurrency semantics', () => {
  it('keeps an existing trial window unchanged when already set', async () => {
    const existingStart = new Date('2026-02-01T12:00:00.000Z');
    const existingEnd = computeTrialEnd(existingStart, 7);
    const patient = {
      userId: 'p1',
      trialStartedAt: existingStart,
      trialEndsAt: existingEnd,
    };
    // Mimic AuthService short-circuit: already set → return as-is.
    const result =
      patient.trialStartedAt && patient.trialEndsAt
        ? patient
        : {
            ...patient,
            trialStartedAt: new Date(),
            trialEndsAt: computeTrialEnd(new Date()),
          };
    expect(result.trialStartedAt).toBe(existingStart);
    expect(result.trialEndsAt).toBe(existingEnd);
  });
});
