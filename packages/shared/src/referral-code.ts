/**
 * Doctor referral codes:
 * - exactly 6 characters
 * - 3 letters (A–Z) and 3 digits (0–9)
 * - first character is always a letter
 * - remaining characters may be in any order
 */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';

function pick(alphabet: string, random: () => number): string {
  return alphabet[Math.floor(random() * alphabet.length)];
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function generateReferralCode(random: () => number = Math.random): string {
  const letters = [pick(LETTERS, random), pick(LETTERS, random), pick(LETTERS, random)];
  const digits = [pick(DIGITS, random), pick(DIGITS, random), pick(DIGITS, random)];
  const [first, ...otherLetters] = letters;
  return first + shuffle([...otherLetters, ...digits], random).join('');
}

export function isValidReferralCode(code: string): boolean {
  if (!/^[A-Z][A-Z0-9]{5}$/.test(code)) {
    return false;
  }
  const letters = (code.match(/[A-Z]/g) || []).length;
  const digits = (code.match(/[0-9]/g) || []).length;
  return letters === 3 && digits === 3;
}
