/**
 * E.164 phone helpers for Phase 1 identity / account contracts.
 * Format: + followed by 8–15 digits total (country code + subscriber), no spaces.
 */

const E164 = /^\+[1-9]\d{7,14}$/;

export function isE164Phone(value: string | null | undefined): boolean {
  if (value == null) return false;
  return E164.test(value.trim());
}

/** Trim; empty → null. Does not invent a country code. */
export function normalizePhoneInput(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function assertE164Phone(value: string, field = 'phone'): string {
  const normalized = value.trim();
  if (!isE164Phone(normalized)) {
    throw new Error(`${field} must be an E.164 number (e.g. +919876543210)`);
  }
  return normalized;
}
