import { describe, expect, it } from 'vitest';
import { computeTrialEnd, toPatientTrialStatus } from './patient-trial';

describe('toPatientTrialStatus', () => {
  it('is inactive without timestamps', () => {
    expect(toPatientTrialStatus(null, null).active).toBe(false);
  });

  it('computes a 7-day end from start', () => {
    const start = new Date('2026-06-01T00:00:00.000Z');
    const end = computeTrialEnd(start);
    expect(end.toISOString()).toBe('2026-06-08T00:00:00.000Z');
  });
});
