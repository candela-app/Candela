import { BubblePosition, GameMode, ColorItem, SessionResultData, DeviceTier, BubbleAppearance, DEFAULT_BUBBLE_APPEARANCE } from './types';
import {
  ALPHABETS,
  NUMBERS,
  BRIGHT_COLORS,
  DEFAULT_STIMULI_BUBBLE_COLOR,
  PHONE_BUBBLE_SIZE_PX,
  PHONE_SORTING_BUBBLE_SIZE_PX,
  STIMULI_BUBBLE_COLOR_OPTIONS,
  STIMULI_COLOR_MIXED,
  TABLET_BUBBLE_SIZE_PX,
  THERAPY_COLORS,
  DEFAULT_SORTING_NUMBER_FROM,
  DEFAULT_SORTING_NUMBER_TO,
  MAX_SORTING_NUMBER_COUNT,
  SORTING_BATCH_SIZE,
} from './constants';

/**
 * Detects device tier from viewport dimensions.
 * Mobile: < 600px width OR landscape mobile (< 1024px width & < 500px height).
 * Tablet: 600-1200px.
 * TV/Desktop: > 1200px.
 */
export function getDeviceTier(width?: number, height?: number): DeviceTier {
  const w = width ?? (typeof window !== 'undefined' ? window.innerWidth : 1024);
  const h = height ?? (typeof window !== 'undefined' ? window.innerHeight : 768);

  if (w < 600 || (w < 1024 && h < 500)) return 'mobile';
  if (w <= 1200) return 'tablet';
  return 'tv';
}

/** Rotatory/sorting bubble default: phones keep the smaller size; tabs and up use 100px. */
export function defaultBubbleSizePx(
  tier: DeviceTier = getDeviceTier(),
  game: 'rotatory' | 'sorting' = 'rotatory',
): number {
  if (tier === 'mobile') return game === 'sorting' ? PHONE_SORTING_BUBBLE_SIZE_PX : PHONE_BUBBLE_SIZE_PX;
  return TABLET_BUBBLE_SIZE_PX;
}

export function clampSortingNumberRange(from: number, to: number): { from: number; to: number } {
  let start = Number.isFinite(from) ? Math.round(from) : DEFAULT_SORTING_NUMBER_FROM;
  let end = Number.isFinite(to) ? Math.round(to) : DEFAULT_SORTING_NUMBER_TO;
  if (start > end) {
    const swap = start;
    start = end;
    end = swap;
  }
  if (end - start + 1 > MAX_SORTING_NUMBER_COUNT) {
    end = start + MAX_SORTING_NUMBER_COUNT - 1;
  }
  return { from: start, to: end };
}

export function sortingNumberSequence(from: number, to: number): string[] {
  const range = clampSortingNumberRange(from, to);
  const items: string[] = [];
  for (let n = range.from; n <= range.to; n += 1) items.push(String(n));
  return items;
}

export function sortingBatchPlan(total: number, tier: DeviceTier): number[] {
  const perRound = SORTING_BATCH_SIZE[tier] ?? 4;
  if (total <= 0) return [];
  const plan: number[] = [];
  let remaining = total;
  while (remaining > 0) {
    const count = Math.min(perRound, remaining);
    plan.push(count);
    remaining -= count;
  }
  if (plan.length >= 2 && plan[plan.length - 1] === 1) {
    plan[plan.length - 2] -= 1;
    plan[plan.length - 1] += 1;
  }
  return plan;
}

/**
 * Calculates dynamic minimum distance (in %) required between bubble centers to prevent overlaps.
 */
export function getMinDistancePercent(
  bubbleSizePx: number,
  containerSizePx: number,
  gapPercent: number = 2
): number {
  if (containerSizePx <= 0) return 12;
  const bubbleDiameterPercent = (bubbleSizePx / containerSizePx) * 100;
  return bubbleDiameterPercent + gapPercent;
}

export function checkOverlap(
  pos: BubblePosition,
  existingPositions: BubblePosition[],
  minDistance: number = 12
): boolean {
  for (const p of existingPositions) {
    const dx = p.x - pos.x;
    const dy = p.y - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDistance) {
      return true;
    }
  }
  return false;
}

/**
 * Deterministically places a bubble into one of N angular slots when 80 random retries fail.
 */
export function getSlotFallbackPosition(
  slotIndex: number,
  totalSlots: number,
  containerSize: number,
  bubbleSize: number
): BubblePosition {
  const maxR = containerSize / 2 - bubbleSize / 2 - 12;
  const radius = maxR * 0.65; // Place on 65% radius ring to avoid center & outer edge
  const angle = (2 * Math.PI * slotIndex) / Math.max(1, totalSlots);

  const x = 50 + (radius * Math.cos(angle)) / (containerSize / 100);
  const y = 50 + (radius * Math.sin(angle)) / (containerSize / 100);

  return { x, y };
}

export function getRandomSymbol(mode: GameMode, variant: 'uppercase' | 'lowercase' = 'uppercase'): string {
  if (mode === 'alphabets') {
    const letter = ALPHABETS[Math.floor(Math.random() * ALPHABETS.length)];
    return variant === 'lowercase' ? letter.toLowerCase() : letter;
  }
  if (mode === 'numbers') {
    return NUMBERS[Math.floor(Math.random() * NUMBERS.length)];
  }
  if (mode === 'colors') {
    return BRIGHT_COLORS[Math.floor(Math.random() * BRIGHT_COLORS.length)].name;
  }
  return ALPHABETS[Math.floor(Math.random() * ALPHABETS.length)];
}

export function getContrastColor(hexColor: string): string {
  if (!hexColor || !hexColor.startsWith('#')) return '#000000';
  let cleanHex = hexColor.slice(1);
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

/** Resolve letter/number bubble fill. `mixed` cycles therapy-grade colors; default is white. */
export function resolveStimuliBubbleColor(
  selection: string | undefined,
  index: number,
  mixedPalette: string[] = THERAPY_COLORS,
): string {
  const mode = selection ?? DEFAULT_STIMULI_BUBBLE_COLOR;
  if (mode === STIMULI_COLOR_MIXED) {
    return mixedPalette[index % Math.max(1, mixedPalette.length)] ?? DEFAULT_STIMULI_BUBBLE_COLOR;
  }
  return mode;
}

export function isStimuliColorMixed(selection: string | undefined): boolean {
  return selection === STIMULI_COLOR_MIXED;
}

export function stimuliColorLabel(selection: string | undefined): string {
  const mode = selection ?? DEFAULT_STIMULI_BUBBLE_COLOR;
  if (mode === STIMULI_COLOR_MIXED) return 'Mixed';
  const hit = STIMULI_BUBBLE_COLOR_OPTIONS.find(
    (c) => c.code.toLowerCase() === mode.toLowerCase(),
  );
  return hit?.name ?? mode;
}

export type BubblePaint = {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  textColor: string;
};

/**
 * Solid = filled bubble + contrast letter.
 * Border = outline in stimuli color + letter in that same color.
 */
export function resolveBubblePaint(
  appearance: BubbleAppearance | undefined,
  stimuliHex: string,
  options?: { borderFill?: string; solidBorderColor?: string; solidBorderWidth?: number },
): BubblePaint {
  const mode = appearance ?? DEFAULT_BUBBLE_APPEARANCE;
  if (mode === 'border') {
    return {
      backgroundColor: options?.borderFill ?? 'transparent',
      borderColor: stimuliHex,
      borderWidth: 4,
      textColor: stimuliHex,
    };
  }
  return {
    backgroundColor: stimuliHex,
    borderColor: options?.solidBorderColor ?? 'transparent',
    borderWidth: options?.solidBorderWidth ?? 0,
    textColor: getContrastColor(stimuliHex),
  };
}

export function bubbleAppearanceLabel(appearance: BubbleAppearance | undefined): string {
  return (appearance ?? DEFAULT_BUBBLE_APPEARANCE) === 'border' ? 'Border' : 'Solid';
}

/** Prefer explicit appearance; fall back to legacy hasBackground (true=solid). */
export function resolveBubbleAppearance(
  appearance?: BubbleAppearance,
  hasBackground?: boolean,
): BubbleAppearance {
  if (appearance === 'solid' || appearance === 'border') return appearance;
  if (hasBackground === true) return 'solid';
  if (hasBackground === false) return 'border';
  return DEFAULT_BUBBLE_APPEARANCE;
}

/** Average / median reaction time from millisecond samples (correct responses only). */
export function reactionStatsFromMs(reactionMs: number[]): {
  avgSec: number;
  medianSec: number;
  count: number;
} {
  if (reactionMs.length === 0) return { avgSec: 0, medianSec: 0, count: 0 };
  const avgMs = reactionMs.reduce((a, b) => a + b, 0) / reactionMs.length;
  const sorted = [...reactionMs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medianMs =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return {
    avgSec: parseFloat((avgMs / 1000).toFixed(3)),
    medianSec: parseFloat((medianMs / 1000).toFixed(3)),
    count: reactionMs.length,
  };
}

export function exportSessionCSV(data: SessionResultData): void {
  if (typeof window === 'undefined') return;
  const headers = Object.keys(data).join(',');
  const values = Object.values(data).join(',');
  const csvContent = 'data:text/csv;charset=utf-8,' + headers + '\n' + values;
  const encodedUri = encodeURI(csvContent);
  const gameSlug = data.gameName
    ? data.gameName.toLowerCase().replace(/\s+/g, '-')
    : 'results';
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `game-session-completed-${gameSlug}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Safely request full screen mode across modern browsers, desktop, and tablets.
 * Catches iOS / browser restrictions silently without causing popup errors.
 */
export function requestFullScreenSafe(): void {
  if (typeof document === 'undefined') return;
  const elem = document.documentElement as any;
  try {
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(() => {});
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen();
    }
  } catch (_) {}
}

/**
 * Safely exit full screen mode.
 */
export function exitFullScreenSafe(): void {
  if (typeof document === 'undefined') return;
  const doc = document as any;
  try {
    if (doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement) {
      if (doc.exitFullscreen) {
        doc.exitFullscreen().catch(() => {});
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      } else if (doc.msExitFullscreen) {
        doc.msExitFullscreen();
      }
    }
  } catch (_) {}
}

