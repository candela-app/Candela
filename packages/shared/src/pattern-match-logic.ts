import { ALPHABETS, NUMBERS } from './constants';

/**
 * Hold the Code — visual memory + code discrimination.
 * Flash a target code, then tap every exact match in a near-miss field.
 * Levels: standard (digits) and compound (alphanumeric).
 */

export const DEFAULT_PATTERN_MATCH_BG = '#0B0F14';
export const DEFAULT_PATTERN_MATCH_CHAR_COLOR = '#F5F7FA';

export const PATTERN_MATCH_BG_COLORS: { name: string; code: string }[] = [
  { name: 'Ink', code: '#0B0F14' },
  { name: 'Slate', code: '#1E293B' },
  { name: 'Charcoal', code: '#111827' },
  { name: 'Paper', code: '#E8ECF0' },
  { name: 'White', code: '#F8FAFC' },
];

export const PATTERN_MATCH_CHAR_COLORS: { name: string; code: string }[] = [
  { name: 'Snow', code: '#F5F7FA' },
  { name: 'White', code: '#FFFFFF' },
  { name: 'Ink', code: '#0F172A' },
  { name: 'Amber', code: '#FBBF24' },
];

export const PATTERN_MATCH_CODE_LENGTH_PRESETS = [2, 3, 4] as const;
export const DEFAULT_PATTERN_MATCH_CODE_LENGTH = 2;

/** 0 = stay visible (discrimination). Otherwise flash duration in ms.
 * Tuned longer than reaction-time apps — low-vision encode needs more dwell. */
export const PATTERN_MATCH_FLASH_MS_PRESETS = [0, 1500, 2500, 3500, 5000] as const;
export const DEFAULT_PATTERN_MATCH_FLASH_MS = 3500;

export const PATTERN_MATCH_CELL_COUNT_PRESETS = [4, 6, 9, 12] as const;
export const DEFAULT_PATTERN_MATCH_CELL_COUNT = 4;

export const PATTERN_MATCH_COLUMNS = 2;

export const PATTERN_MATCH_TIME_LIMIT_PRESETS = [0, 30, 45, 60, 90] as const;
export const DEFAULT_PATTERN_MATCH_TIME_LIMIT_SEC = 0;

export type PatternMatchHardness = 'easy' | 'medium' | 'hard';
export const DEFAULT_PATTERN_MATCH_HARDNESS: PatternMatchHardness = 'easy';

/** Digits-only (Standard) vs mixed letters+digits (Compound). */
export type PatternMatchStimulusMode = 'digits' | 'compound';
export const DEFAULT_PATTERN_MATCH_STIMULUS: PatternMatchStimulusMode = 'digits';

export const PATTERN_MATCH_LETTER_SIZE_PRESETS = [1.8, 2.2, 2.8, 3.4, 4.2] as const;
export const DEFAULT_PATTERN_MATCH_LETTER_SIZE = 2.8;

/** How many encode→search boards to clear before session results. */
export const PATTERN_MATCH_ROUNDS_PRESETS = [1, 2, 3, 4, 5] as const;
export const DEFAULT_PATTERN_MATCH_ROUNDS = 1;

export interface PatternMatchCell {
  id: string;
  code: string;
  isMatch: boolean;
  /** Grid column 0..cols-1 */
  col: number;
  /** Grid row 0.. */
  row: number;
}

export function clampPatternMatchCodeLength(value: number): number {
  const presets = PATTERN_MATCH_CODE_LENGTH_PRESETS as readonly number[];
  if (presets.includes(value)) return value;
  const n = Math.round(value);
  let best = presets[0];
  let bestDist = Math.abs(n - best);
  for (const p of presets) {
    const d = Math.abs(n - p);
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

export function clampPatternMatchFlashMs(value: number): number {
  const presets = PATTERN_MATCH_FLASH_MS_PRESETS as readonly number[];
  if (presets.includes(value)) return value;
  const n = Math.round(value);
  if (n <= 0) return 0;
  let best = presets[1] ?? 1500;
  let bestDist = Math.abs(n - best);
  for (const p of presets) {
    if (p === 0) continue;
    const d = Math.abs(n - p);
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

export function patternMatchFlashLabel(ms: number): string {
  return ms <= 0 ? 'Always on' : `${ms} ms`;
}

export function clampPatternMatchCellCount(value: number): number {
  const presets = PATTERN_MATCH_CELL_COUNT_PRESETS as readonly number[];
  if (presets.includes(value)) return value;
  const n = Math.round(value);
  let best = presets[0];
  let bestDist = Math.abs(n - best);
  for (const p of presets) {
    const d = Math.abs(n - p);
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

export function patternMatchColumnCount(cellCount: number): number {
  const n = clampPatternMatchCellCount(cellCount);
  return n <= 6 ? 2 : 3;
}

export function clampPatternMatchHardness(value: unknown): PatternMatchHardness {
  if (value === 'easy' || value === 'medium' || value === 'hard') return value;
  return DEFAULT_PATTERN_MATCH_HARDNESS;
}

export function clampPatternMatchStimulusMode(value: unknown): PatternMatchStimulusMode {
  if (value === 'compound') return 'compound';
  return 'digits';
}

/** Map MODULE_LEVELS.pattern_match ids → stimulus mode. */
export function patternMatchStimulusFromLevelId(levelId: string | null | undefined): PatternMatchStimulusMode {
  if (levelId === 'compound') return 'compound';
  return 'digits'; // standard
}

/** Fixed preview codes for clinical settings live preview (not random). */
export function patternMatchPreviewCodes(
  length: number,
  mode: PatternMatchStimulusMode = 'digits',
): { target: string; field: string[] } {
  const len = clampPatternMatchCodeLength(length);
  const stimulus = clampPatternMatchStimulusMode(mode);
  if (stimulus === 'compound') {
    const compoundTargets = ['A3B', '7K2', 'M91', 'B4C'];
    const compoundField = ['A3B', 'A2B', '3AB', '7K2', 'K72', 'M91'];
    return {
      target: compoundTargets[0]!.slice(0, len).padEnd(len, '1').slice(0, len),
      // Prefer readable compound samples trimmed/padded to length
      field: compoundField.map((c) => {
        if (c.length >= len) return c.slice(0, len);
        return (c + 'X7').slice(0, len);
      }),
    };
  }
  const digitTarget = '33121'.slice(0, len);
  return {
    target: digitTarget,
    field: ['331', '313', '133', '321', '312', '231'].map((c) =>
      c.length >= len ? c.slice(0, len) : (c + '012').slice(0, len),
    ),
  };
}

export function patternMatchHardnessLabel(h: PatternMatchHardness): string {
  if (h === 'easy') return 'Easy distractors';
  if (h === 'hard') return 'Hard near-misses';
  return 'Medium';
}

export function clampPatternMatchTimeLimitSec(value: number): number {
  const presets = PATTERN_MATCH_TIME_LIMIT_PRESETS as readonly number[];
  if (presets.includes(value)) return value;
  let best = presets[0];
  let bestDist = Math.abs(value - best);
  for (const p of presets) {
    const d = Math.abs(value - p);
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

export function clampPatternMatchLetterSize(value: number): number {
  const presets = PATTERN_MATCH_LETTER_SIZE_PRESETS as readonly number[];
  if (presets.includes(value)) return value;
  let best = presets[0];
  let bestDist = Math.abs(value - best);
  for (const p of presets) {
    const d = Math.abs(value - p);
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

export function clampPatternMatchRounds(value: number): number {
  const presets = PATTERN_MATCH_ROUNDS_PRESETS as readonly number[];
  if (presets.includes(value)) return value;
  const n = Math.round(value);
  let best = presets[0];
  let bestDist = Math.abs(n - best);
  for (const p of presets) {
    const d = Math.abs(n - p);
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

function randomDigit(): string {
  return NUMBERS[Math.floor(Math.random() * NUMBERS.length)]!;
}

function randomLetter(): string {
  return ALPHABETS[Math.floor(Math.random() * ALPHABETS.length)]!;
}

function charPoolForMode(mode: PatternMatchStimulusMode): string {
  return mode === 'compound' ? ALPHABETS + NUMBERS : NUMBERS;
}

function randomCharForMode(mode: PatternMatchStimulusMode): string {
  const pool = charPoolForMode(mode);
  return pool[Math.floor(Math.random() * pool.length)]!;
}

function ensureCompoundMix(chars: string[]): void {
  const hasLetter = chars.some((c) => ALPHABETS.includes(c));
  const hasDigit = chars.some((c) => NUMBERS.includes(c));
  if (!hasLetter) chars[0] = randomLetter();
  if (!hasDigit) chars[chars.length - 1] = randomDigit();
}

/** Build a random code for the given stimulus mode. */
export function generatePatternMatchTarget(
  length: number,
  mode: PatternMatchStimulusMode = 'digits',
): string {
  const len = clampPatternMatchCodeLength(length);
  const stimulus = clampPatternMatchStimulusMode(mode);
  const chars: string[] = [];
  for (let i = 0; i < len; i++) {
    chars.push(randomCharForMode(stimulus));
  }
  if (stimulus === 'compound' && len > 1) {
    ensureCompoundMix(chars);
  }
  if (len > 1 && chars.every((c) => c === chars[0])) {
    chars[len - 1] = randomCharForMode(stimulus);
    if (chars[len - 1] === chars[0]) {
      chars[len - 1] =
        stimulus === 'compound' ? (NUMBERS.includes(chars[0]) ? randomLetter() : randomDigit()) : randomDigit();
    }
  }
  return chars.join('');
}

function swapAdjacent(code: string): string {
  if (code.length < 2) return code;
  const i = Math.floor(Math.random() * (code.length - 1));
  const arr = code.split('');
  const tmp = arr[i];
  arr[i] = arr[i + 1];
  arr[i + 1] = tmp;
  return arr.join('');
}

function substituteOne(code: string, mode: PatternMatchStimulusMode): string {
  const arr = code.split('');
  const i = Math.floor(Math.random() * arr.length);
  let next = randomCharForMode(mode);
  let guard = 0;
  while (next === arr[i] && guard < 8) {
    next = randomCharForMode(mode);
    guard += 1;
  }
  arr[i] = next;
  return arr.join('');
}

function reverseCode(code: string): string {
  return code.split('').reverse().join('');
}

function allSame(code: string): string {
  const d = code[0] ?? '0';
  return d.repeat(code.length);
}

/** Produce a distractor that is not equal to `target`. */
export function generatePatternMatchDistractor(
  target: string,
  hardness: PatternMatchHardness,
  mode: PatternMatchStimulusMode = 'digits',
): string {
  const stimulus = clampPatternMatchStimulusMode(mode);
  const strategies: Array<() => string> =
    hardness === 'easy'
      ? [
          () => generatePatternMatchTarget(target.length, stimulus),
          () => substituteOne(target, stimulus),
          () => allSame(target),
        ]
      : hardness === 'hard'
        ? [
            () => swapAdjacent(target),
            () => substituteOne(target, stimulus),
            () => reverseCode(target),
            () => swapAdjacent(target),
          ]
        : [
            () => swapAdjacent(target),
            () => substituteOne(target, stimulus),
            () => reverseCode(target),
            () => generatePatternMatchTarget(target.length, stimulus),
          ];

  for (let attempt = 0; attempt < 24; attempt++) {
    const fn = strategies[attempt % strategies.length];
    const d = fn();
    if (d !== target && d.length === target.length) return d;
  }
  // Guaranteed fallback
  const arr = target.split('');
  arr[0] = randomCharForMode(stimulus);
  if (arr[0] === target[0]) {
    arr[0] = stimulus === 'compound' ? randomLetter() : String((Number(target[0]) + 1) % 10);
  }
  return arr.join('');
}

/**
 * How many exact matches to place in the field (clamped to cell count).
 * Roughly 25–40% matches depending on hardness.
 */
export function patternMatchTargetDensity(cellCount: number, hardness: PatternMatchHardness): number {
  const n = clampPatternMatchCellCount(cellCount);
  const ratio = hardness === 'easy' ? 0.4 : hardness === 'hard' ? 0.25 : 0.33;
  return Math.max(2, Math.min(n - 1, Math.round(n * ratio)));
}

export function buildPatternMatchField(options: {
  target: string;
  cellCount?: number;
  columns?: number;
  hardness?: PatternMatchHardness;
  stimulusMode?: PatternMatchStimulusMode;
}): PatternMatchCell[] {
  const target = options.target;
  const cellCount = clampPatternMatchCellCount(options.cellCount ?? DEFAULT_PATTERN_MATCH_CELL_COUNT);
  const columns = options.columns && options.columns > 0 ? options.columns : patternMatchColumnCount(cellCount);
  const hardness = clampPatternMatchHardness(options.hardness);
  const stimulusMode = clampPatternMatchStimulusMode(options.stimulusMode);
  const matchCount = patternMatchTargetDensity(cellCount, hardness);

  const codes: { code: string; isMatch: boolean }[] = [];
  for (let i = 0; i < matchCount; i++) {
    codes.push({ code: target, isMatch: true });
  }
  while (codes.length < cellCount) {
    codes.push({
      code: generatePatternMatchDistractor(target, hardness, stimulusMode),
      isMatch: false,
    });
  }

  // Fisher–Yates shuffle
  for (let i = codes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = codes[i];
    codes[i] = codes[j];
    codes[j] = tmp;
  }

  return codes.map((c, index) => ({
    id: `pm-${index}-${c.code}-${Math.random().toString(36).slice(2, 7)}`,
    code: c.code,
    isMatch: c.isMatch,
    col: index % columns,
    row: Math.floor(index / columns),
  }));
}

export function patternMatchAccuracy(correct: number, wrong: number): number {
  const total = correct + wrong;
  if (total <= 0) return 100;
  return Math.round((correct / total) * 1000) / 10;
}

export function patternMatchDeviceDefaults(): {
  codeLength: number;
  flashMs: number;
  cellCount: number;
  hardness: PatternMatchHardness;
  letterSize: number;
  timeLimitSec: number;
  rounds: number;
} {
  return {
    codeLength: DEFAULT_PATTERN_MATCH_CODE_LENGTH,
    flashMs: DEFAULT_PATTERN_MATCH_FLASH_MS,
    cellCount: DEFAULT_PATTERN_MATCH_CELL_COUNT,
    hardness: DEFAULT_PATTERN_MATCH_HARDNESS,
    letterSize: DEFAULT_PATTERN_MATCH_LETTER_SIZE,
    timeLimitSec: DEFAULT_PATTERN_MATCH_TIME_LIMIT_SEC,
    rounds: DEFAULT_PATTERN_MATCH_ROUNDS,
  };
}
