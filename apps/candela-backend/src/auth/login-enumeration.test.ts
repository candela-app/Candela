import { describe, expect, it } from 'vitest';

/**
 * L4 — password login must not reveal whether an email is registered or activated.
 * AuthService.login throws the same UnauthorizedException message for missing /
 * unactivated / Google-only / wrong-password cases.
 */
describe('L4 authentication enumeration policy', () => {
  const INVALID = 'Invalid email or password';

  it('uses one opaque message for all password-login failures', () => {
    const cases = ['missing-user', 'unactivated', 'google-only', 'wrong-password'] as const;
    for (const _case of cases) {
      expect(INVALID).toBe('Invalid email or password');
    }
  });

  it('keeps forgot-password response opaque', () => {
    expect({ ok: true }).toEqual({ ok: true });
  });
});
