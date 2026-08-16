import { randomInt } from 'crypto';

/**
 * Doctor referral codes:
 * - exactly 6 characters
 * - 3 letters (A–Z) and 3 digits (0–9)
 * - first character is always a letter
 * - remaining characters may be in any order
 */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';

function pick(alphabet: string): string {
  return alphabet[randomInt(alphabet.length)];
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function generateReferralCode(): string {
  const letters = [pick(LETTERS), pick(LETTERS), pick(LETTERS)];
  const digits = [pick(DIGITS), pick(DIGITS), pick(DIGITS)];
  const [first, ...otherLetters] = letters;
  return first + shuffle([...otherLetters, ...digits]).join('');
}

export function isValidReferralCode(code: string): boolean {
  if (!/^[A-Z][A-Z0-9]{5}$/.test(code)) {
    return false;
  }
  const letterCount = (code.match(/[A-Z]/g) || []).length;
  const digitCount = (code.match(/[0-9]/g) || []).length;
  return letterCount === 3 && digitCount === 3;
}
