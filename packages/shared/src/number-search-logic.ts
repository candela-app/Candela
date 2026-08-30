import { NUMBERS } from './constants';
import type { DeviceTier } from './types';

/** Engine background — high contrast dark default for figure–ground search. */
export const DEFAULT_NUMBER_SEARCH_BG = '#0B0F14';
/** Glyph color — light on dark for consistent contrast. */
export const DEFAULT_NUMBER_SEARCH_CHAR_COLOR = '#F5F7FA';

export const NUMBER_SEARCH_BG_COLORS: { name: string; code: string }[] = [
  { name: 'Ink', code: '#0B0F14' },
  { name: 'Slate', code: '#1E293B' },
  { name: 'Charcoal', code: '#111827' },
  { name: 'Paper', code: '#E8ECF0' },
  { name: 'White', code: '#F8FAFC' },
];

export const NUMBER_SEARCH_CHAR_COLORS: { name: string; code: string }[] = [
  { name: 'Snow', code: '#F5F7FA' },
  { name: 'White', code: '#FFFFFF' },
  { name: 'Ink', code: '#0F172A' },
  { name: 'Black', code: '#020617' },
  { name: 'Amber', code: '#FBBF24' },
];

export const NUMBER_SEARCH_LETTER_SIZE_PRESETS = [1.8, 2.2, 2.8, 3.4, 4.2] as const;
export const DEFAULT_NUMBER_SEARCH_LETTER_SIZE = 2.8;

/** Digits render larger than letters so guardians can spot them more easily. */
export const NUMBER_SEARCH_DIGIT_SIZE_SCALE = 1.32;

/**
 * Distractor letters only — skip glyphs that look like digits
 * (I/l/1, O/0, S/5, B/8, Z/2, G/6, D/0, Q/9).
 */
export const NUMBER_SEARCH_DISTRACTOR_LETTERS = 'ACEFHJKMNPRTUVWXY';

/** 0 = Off (clear all digits). Advanced: timed rounds. */
export const NUMBER_SEARCH_TIME_LIMIT_PRESETS = [0, 30, 45, 60, 90, 120] as const;
export const DEFAULT_NUMBER_SEARCH_TIME_LIMIT_SEC = 0;

export const NUMBER_SEARCH_TARGET_DIGIT_PRESETS = [2, 3, 5, 8, 10] as const;
export const DEFAULT_NUMBER_SEARCH_TARGET_DIGITS = 3;

/**
 * Total characters on the field (digits + letters).
 * `0` = Auto — pack as many as fit without overlap.
 */
export const NUMBER_SEARCH_FIELD_COUNT_PRESETS = [0, 8, 12, 20, 40, 60] as const;
export const DEFAULT_NUMBER_SEARCH_FIELD_COUNT = 12;

/** Organised grid vs scattered random placement. */
export type NumberSearchLayoutMode = 'grid' | 'random';
export const DEFAULT_NUMBER_SEARCH_LAYOUT: NumberSearchLayoutMode = 'grid';

/** Bottom-right menu / sliders control — keep glyphs out of this zone. */
export const NUMBER_SEARCH_MENU_RESERVE_W = 88;
export const NUMBER_SEARCH_MENU_RESERVE_H = 88;

export function clampNumberSearchLayoutMode(value: unknown): NumberSearchLayoutMode {
  return value === 'grid' ? 'grid' : 'random';
}

export function numberSearchLayoutLabel(mode: NumberSearchLayoutMode): string {
  return mode === 'grid' ? 'Organised grid' : 'Random scatter';
}

export function clampNumberSearchFieldCount(value: number): number {
  const presets = NUMBER_SEARCH_FIELD_COUNT_PRESETS as readonly number[];
  if (presets.includes(value)) return value;
  const n = Math.round(value);
  if (n <= 0) return 0;
  let best = presets[1] ?? 40;
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

export function numberSearchFieldCountLabel(count: number): string {
  return count <= 0 ? 'Auto' : String(count);
}

export const DEFAULT_NUMBER_SEARCH_GAP_PX = 18;
export const DEFAULT_NUMBER_SEARCH_PADDING_PX = 16;

export interface NumberSearchGlyph {
  id: string;
  char: string;
  /** Center X in play-field pixels */
  x: number;
  /** Center Y in play-field pixels */
  y: number;
  isDigit: boolean;
}

export function clampNumberSearchLetterSize(value: number): number {
  const presets = NUMBER_SEARCH_LETTER_SIZE_PRESETS as readonly number[];
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

export function clampNumberSearchTimeLimitSec(value: number): number {
  const presets = NUMBER_SEARCH_TIME_LIMIT_PRESETS as readonly number[];
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

export function clampNumberSearchTargetDigits(value: number): number {
  const presets = NUMBER_SEARCH_TARGET_DIGIT_PRESETS as readonly number[];
  if (presets.includes(value)) return value;
  const n = Math.round(value);
  if (n < presets[0]) return presets[0];
  if (n > presets[presets.length - 1]) return presets[presets.length - 1];
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

export function estimateGlyphBoxPx(letterSizeRem: number): { w: number; h: number } {
  const fontPx = letterSizeRem * 16;
  // Monospace-ish footprint so packing stays consistent across glyphs
  return { w: fontPx * 0.75, h: fontPx * 1.2 };
}

/** Packing footprint uses digit scale so larger numbers never collide with neighbors. */
export function estimatePackBoxPx(letterSizeRem: number): { w: number; h: number } {
  return estimateGlyphBoxPx(letterSizeRem * NUMBER_SEARCH_DIGIT_SIZE_SCALE);
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function randomMixedLetter(): string {
  const pool = NUMBER_SEARCH_DISTRACTOR_LETTERS;
  const upper = pool[Math.floor(Math.random() * pool.length)]!;
  return Math.random() < 0.5 ? upper : upper.toLowerCase();
}

function randomDigitChar(): string {
  return NUMBERS[Math.floor(Math.random() * NUMBERS.length)];
}

/** True if a glyph center would sit under the bottom-right menu control. */
function hitsMenuReserve(
  x: number,
  y: number,
  fieldW: number,
  fieldH: number,
  halfW: number,
  halfH: number,
): boolean {
  const zoneLeft = fieldW - NUMBER_SEARCH_MENU_RESERVE_W - halfW;
  const zoneTop = fieldH - NUMBER_SEARCH_MENU_RESERVE_H - halfH;
  return x + halfW > zoneLeft && y + halfH > zoneTop;
}

function buildGlyphs(
  positions: { x: number; y: number }[],
  targetDigitCount: number,
): NumberSearchGlyph[] {
  shuffleInPlace(positions);
  const digitCount = Math.min(Math.max(0, targetDigitCount), positions.length);
  const glyphs: NumberSearchGlyph[] = [];

  for (let i = 0; i < positions.length; i++) {
    const isDigit = i < digitCount;
    glyphs.push({
      id: `ns-${i}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      char: isDigit ? randomDigitChar() : randomMixedLetter(),
      x: positions[i].x,
      y: positions[i].y,
      isDigit,
    });
  }

  return glyphs;
}

function packGridPositions(options: {
  width: number;
  height: number;
  letterSizeRem: number;
  gapPx: number;
  padTop: number;
  padSide: number;
  padBottom: number;
}): { x: number; y: number }[] {
  const { width, height, letterSizeRem, gapPx, padTop, padSide, padBottom } = options;
  const { w, h } = estimatePackBoxPx(letterSizeRem);
  const halfW = w / 2;
  const halfH = h / 2;
  const cellW = w + gapPx;
  const cellH = h + gapPx;
  const innerW = width - padSide * 2;
  const innerH = height - padTop - padBottom;
  const cols = Math.max(1, Math.floor(innerW / cellW));
  const rows = Math.max(1, Math.floor(innerH / cellH));

  const usedW = cols * cellW;
  const usedH = rows * cellH;
  const originX = padSide + (innerW - usedW) / 2 + cellW / 2;
  const originY = padTop + (innerH - usedH) / 2 + cellH / 2;

  const slots: { x: number; y: number }[] = [];
  const maxJitter = Math.min(gapPx * 0.35, 3);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const jitterX = (Math.random() - 0.5) * 2 * maxJitter;
      const jitterY = (Math.random() - 0.5) * 2 * maxJitter;
      const x = originX + c * cellW + jitterX;
      const y = originY + r * cellH + jitterY;
      if (hitsMenuReserve(x, y, width, height, halfW, halfH)) continue;
      slots.push({ x, y });
    }
  }

  return slots;
}

function packRandomPositions(options: {
  width: number;
  height: number;
  letterSizeRem: number;
  gapPx: number;
  padTop: number;
  padSide: number;
  padBottom: number;
  fieldCount: number;
}): { x: number; y: number }[] {
  const { width, height, letterSizeRem, gapPx, padTop, padSide, padBottom, fieldCount } = options;
  const { w, h } = estimatePackBoxPx(letterSizeRem);
  const halfW = w / 2;
  const halfH = h / 2;
  const minX = padSide + halfW;
  const maxX = width - padSide - halfW;
  const minY = padTop + halfH;
  const maxY = height - padBottom - halfH;

  if (maxX <= minX || maxY <= minY) return [];

  const minDist = Math.hypot(w + gapPx, h + gapPx) * 0.55;
  const minDistSq = minDist * minDist;

  const area = (maxX - minX) * (maxY - minY);
  const cellArea = (w + gapPx) * (h + gapPx);
  const autoMax = Math.max(1, Math.floor((area / cellArea) * 0.92));
  const maxGlyphs = fieldCount > 0 ? Math.min(fieldCount, autoMax) : autoMax;
  const attemptsPerGlyph = 90;
  const positions: { x: number; y: number }[] = [];

  const overlaps = (x: number, y: number): boolean => {
    for (let i = 0; i < positions.length; i++) {
      const dx = positions[i].x - x;
      const dy = positions[i].y - y;
      if (dx * dx + dy * dy < minDistSq) return true;
    }
    return false;
  };

  for (let n = 0; n < maxGlyphs; n++) {
    let placed = false;
    for (let attempt = 0; attempt < attemptsPerGlyph; attempt++) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);
      if (hitsMenuReserve(x, y, width, height, halfW, halfH)) continue;
      if (!overlaps(x, y)) {
        positions.push({ x, y });
        placed = true;
        break;
      }
    }
    if (!placed) break;
  }

  return positions;
}

/**
 * Pack glyphs with no overlap — organised grid or random scatter.
 * Injects exactly `targetDigitCount` digits (or fewer if space runs out);
 * remaining slots are mixed-case letters.
 * Bottom-right menu zone is always kept clear.
 */
export function packNumberSearchField(options: {
  width: number;
  height: number;
  letterSizeRem: number;
  targetDigitCount: number;
  layoutMode?: NumberSearchLayoutMode;
  /** Total glyphs; 0 = auto fill. Applies strongly to random; caps grid too. */
  fieldCount?: number;
  gapPx?: number;
  paddingPx?: number;
  /** Extra top inset so HUD does not cover glyphs */
  paddingTopPx?: number;
}): NumberSearchGlyph[] {
  const {
    width,
    height,
    letterSizeRem,
    targetDigitCount,
    layoutMode = DEFAULT_NUMBER_SEARCH_LAYOUT,
    fieldCount = DEFAULT_NUMBER_SEARCH_FIELD_COUNT,
    gapPx = DEFAULT_NUMBER_SEARCH_GAP_PX,
    paddingPx = DEFAULT_NUMBER_SEARCH_PADDING_PX,
    paddingTopPx,
  } = options;

  if (width < 40 || height < 40) return [];

  const padTop = paddingTopPx ?? paddingPx;
  const padSide = paddingPx;
  const padBottom = paddingPx;
  const clampedField = clampNumberSearchFieldCount(fieldCount);

  let positions =
    layoutMode === 'grid'
      ? packGridPositions({
          width,
          height,
          letterSizeRem,
          gapPx,
          padTop,
          padSide,
          padBottom,
        })
      : packRandomPositions({
          width,
          height,
          letterSizeRem,
          gapPx,
          padTop,
          padSide,
          padBottom,
          fieldCount: clampedField,
        });

  // Cap organised grid when a field count is set
  if (layoutMode === 'grid' && clampedField > 0 && positions.length > clampedField) {
    shuffleInPlace(positions);
    positions = positions.slice(0, clampedField);
  }

  return buildGlyphs(positions, targetDigitCount);
}

export function numberSearchAccuracy(correct: number, wrong: number): number {
  const total = correct + wrong;
  if (total <= 0) return 0;
  return Math.round((correct / total) * 1000) / 10;
}

/** Suggested defaults by device (glyph size 2.2, 5 digits to find). */
export function numberSearchDeviceDefaults(_tier: DeviceTier): {
  letterSize: number;
  targetDigitCount: number;
  layoutMode: NumberSearchLayoutMode;
  fieldCount: number;
} {
  return {
    letterSize: DEFAULT_NUMBER_SEARCH_LETTER_SIZE,
    targetDigitCount: DEFAULT_NUMBER_SEARCH_TARGET_DIGITS,
    layoutMode: DEFAULT_NUMBER_SEARCH_LAYOUT,
    fieldCount: DEFAULT_NUMBER_SEARCH_FIELD_COUNT,
  };
}
