import { describe, expect, it } from 'vitest';
import { handheldMarkSizeForContainer } from './handheld-field';
import { rotatoryBubblesPerRound, rotatoryFieldBubbleSizePx } from './rotatory-logic';

describe('handheld mark sizing', () => {
  it('caps diameter so four phone bubbles still fit the wheel', () => {
    const size = handheldMarkSizeForContainer({ containerPx: 320, count: 4, tier: 'mobile' });
    expect(4 * size).toBeLessThan(320);
  });

  it('stays on the 60/80/100/120 chips by default', () => {
    const size = handheldMarkSizeForContainer({ containerPx: 390, count: 4, tier: 'mobile' });
    expect([60, 80, 100, 120]).toContain(size);
  });

  it('keeps a settings chip size when the clinician requests it', () => {
    const size = handheldMarkSizeForContainer({
      containerPx: 240,
      count: 4,
      tier: 'mobile',
      requestedPx: 100,
    });
    expect(size).toBe(100);
  });

  it('caps mobile bubble size at 100px', () => {
    expect(handheldMarkSizeForContainer({
      containerPx: 400,
      count: 4,
      tier: 'mobile',
      requestedPx: 120,
    })).toBe(100);
  });

  it('fits six tablet bubbles without overlap', () => {
    const size = handheldMarkSizeForContainer({ containerPx: 800, count: 6, tier: 'tablet' });
    expect(6 * size).toBeLessThan(800);
  });

  it('uses four bubbles per round on phones and six on tablets', () => {
    expect(rotatoryBubblesPerRound('mobile', 'alphabets')).toBe(4);
    expect(rotatoryBubblesPerRound('tablet', 'alphabets')).toBe(6);
  });

  it('sizes rotatory marks from the measured wheel', () => {
    const small = rotatoryFieldBubbleSizePx({ containerPx: 300, tier: 'mobile', mode: 'alphabets' });
    const large = rotatoryFieldBubbleSizePx({ containerPx: 1100, tier: 'tv', mode: 'alphabets' });
    expect(large).toBeGreaterThanOrEqual(small);
  });
});
