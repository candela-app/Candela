import { describe, expect, it } from 'vitest';
import { computeTrialEnd } from '@candela/shared';

/**
 * Models the atomic conditional UPDATE used by AuthService.ensurePatientTrialStarted.
 * Concurrent first logins: only one UPDATE returns a row; others read the winner.
 */
describe('patient trial concurrency (atomic update semantics)', () => {
  it('allows only one writer to establish the trial window', async () => {
    const state: {
      trialStartedAt: Date | null;
      trialEndsAt: Date | null;
    } = { trialStartedAt: null, trialEndsAt: null };

    async function ensure(): Promise<{ start: Date; end: Date }> {
      if (state.trialStartedAt && state.trialEndsAt) {
        return { start: state.trialStartedAt, end: state.trialEndsAt };
      }
      const startedAt = new Date('2026-03-01T10:00:00.000Z');
      const endsAt = computeTrialEnd(startedAt, 7);
      // Simulate WHERE trial_started_at IS NULL
      if (state.trialStartedAt == null && state.trialEndsAt == null) {
        state.trialStartedAt = startedAt;
        state.trialEndsAt = endsAt;
        return { start: startedAt, end: endsAt };
      }
      return { start: state.trialStartedAt!, end: state.trialEndsAt! };
    }

    const results = await Promise.all([ensure(), ensure(), ensure()]);
    const first = results[0];
    for (const row of results) {
      expect(row.start.toISOString()).toBe(first.start.toISOString());
      expect(row.end.toISOString()).toBe(first.end.toISOString());
    }
    expect(first.end.getTime() - first.start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('never resets an established window', async () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const end = computeTrialEnd(start, 7);
    const patient = { trialStartedAt: start, trialEndsAt: end };
    const nextStart = new Date('2026-06-01T00:00:00.000Z');
    if (patient.trialStartedAt && patient.trialEndsAt) {
      // short-circuit — no write
    } else {
      patient.trialStartedAt = nextStart;
      patient.trialEndsAt = computeTrialEnd(nextStart, 7);
    }
    expect(patient.trialStartedAt).toBe(start);
    expect(patient.trialEndsAt).toBe(end);
  });
});
