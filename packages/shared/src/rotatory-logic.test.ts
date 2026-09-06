import { describe, expect, it } from 'vitest';
import {
  advanceRotatoryToScored,
  beginRotatoryTrial,
  completeRotatoryTrial,
  createRotatorySession,
  noteRotatoryWrong,
  summarizeRotatorySession,
} from './rotatory-logic';

describe('rotatory session summary', () => {
  it('counts each wheel tap as a miss, not one miss per target', () => {
    const state = createRotatorySession('alphabets', 'uppercase', 'tablet');
    advanceRotatoryToScored(state);
    beginRotatoryTrial(state, {
      glyphId: 'A',
      bubbles: [{ id: 'a', symbol: 'A', color: '#fff', x: 50, y: 20 }],
      wheelRotationDeg: 0,
      angularSpeedDegPerSec: 30,
      nowMs: 1000,
      sessionStartMs: 0,
    });
    for (let i = 0; i < 5; i += 1) {
      noteRotatoryWrong(state, 'aim', { nowMs: 1100 + i * 20 });
    }
    completeRotatoryTrial(state, {
      tapLocalXPct: 50,
      tapLocalYPct: 20,
      wheelRotationDeg: 0,
      nowMs: 1500,
    });

    const result = summarizeRotatorySession(state, {
      patientName: 'Test',
      sessionId: 1,
      date: '06/09/2026',
      gameName: 'Rotatory Wheel',
      letterSize: 1,
      speed: '1x',
      durationSec: 10,
      clicksTotal: 6,
      wrong: 0,
    });

    expect(result.misses).toBe(5);
    expect(result.wrongTaps).toBe(0);
    expect(result.correct).toBe(1);
    expect(result.accuracy).toBe(16.7);
    expect(result.endedBy).toBe('cleared');
    expect(result.abandoned).toBe(false);
  });
});
