import { describe, expect, it } from 'vitest';
import { isE164Phone, normalizePhoneInput } from './phone';

describe('E.164 phone', () => {
  it('accepts valid E.164 numbers', () => {
    expect(isE164Phone('+919876543210')).toBe(true);
    expect(isE164Phone('+14155552671')).toBe(true);
    expect(isE164Phone('+442071838750')).toBe(true);
  });

  it('rejects invalid numbers', () => {
    expect(isE164Phone('9876543210')).toBe(false);
    expect(isE164Phone('+0123')).toBe(false);
    expect(isE164Phone('+91 98765 43210')).toBe(false);
    expect(isE164Phone('')).toBe(false);
    expect(isE164Phone(null)).toBe(false);
    expect(isE164Phone('+123')).toBe(false);
  });

  it('normalizePhoneInput clears blanks', () => {
    expect(normalizePhoneInput('')).toBeNull();
    expect(normalizePhoneInput('  ')).toBeNull();
    expect(normalizePhoneInput('+919876543210')).toBe('+919876543210');
  });
});
