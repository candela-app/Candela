import { DeviceTier } from './types';
import { getDeviceTier, getContrastColor } from './game-logic';

/** Field hemisphere for Peripheral View (dashboard levels). */
export type PeripheralField = 'left' | 'right' | 'both';

export interface HexCell {
  id: string;
  q: number;
  r: number;
  cx: number;
  cy: number;
}

export const PERIPHERAL_HEX_SIZE_MIN = 36;
export const PERIPHERAL_HEX_SIZE_MAX = 120;
export const PERIPHERAL_STIMULI_MIN = 4;
export const PERIPHERAL_STIMULI_MAX = 48;
export const PERIPHERAL_BATCHES_MIN = 1;
export const PERIPHERAL_BATCHES_MAX = 20;
export const PERIPHERAL_DEFAULT_BATCHES = 6;

/** Few fixed steps — same pattern as bubble / letter size presets elsewhere. */
export const PERIPHERAL_HEX_SIZE_PRESETS = [64, 72, 80, 96, 120] as const;
/** Few fixed steps — tier caps keep phone batches smaller than iPad / desktop. */
export const PERIPHERAL_STIMULI_PRESETS_BY_TIER: Record<DeviceTier, readonly number[]> = {
  mobile: [2, 3, 4, 6],
  tablet: [4, 6, 8, 12],
  tv: [8, 12, 16, 20],
};

/** @deprecated Use peripheralStimuliPresets(tier) — mobile tier presets. */
export const PERIPHERAL_STIMULI_PRESETS = PERIPHERAL_STIMULI_PRESETS_BY_TIER.mobile;
export const PERIPHERAL_BATCH_PRESETS = [4, 6, 8, 10] as const;
/** Same stepped presets as rotatory wheel letter size. */
export const PERIPHERAL_LETTER_SIZE_PRESETS = [2, 2.5, 3, 3.5, 4] as const;
export const DEFAULT_PERIPHERAL_LETTER_SIZE = 3;
/** Per-target response timer: 0 = off. */
export const PERIPHERAL_TARGET_TIMEOUT_PRESETS = [0, 4, 5, 6] as const;
/** Hex stimulus rendering — filled vs outline-only. */
export type PeripheralBubbleType = 'solid' | 'boundary';
export const DEFAULT_PERIPHERAL_BUBBLE_TYPE: PeripheralBubbleType = 'solid';

/** High-luminance therapy hues that stay readable on dark hive backgrounds. */
export const PERIPHERAL_STIMULUS_COLORS: Array<{ name: string; code: string }> = [
  { name: 'White', code: '#FFFFFF' },
  { name: 'Yellow', code: '#FFD600' },
  { name: 'Cyan', code: '#00F0FF' },
  { name: 'Lime', code: '#00E676' },
  { name: 'Orange', code: '#FF9100' },
  { name: 'Pink', code: '#FF2E93' },
];

/** Engine play-area backgrounds — dark enough for high-luminance stimuli. */
export const PERIPHERAL_BG_COLORS: Array<{ name: string; code: string }> = [
  { name: 'Near Black', code: '#06070D' },
  { name: 'Ink', code: '#0A0A12' },
  { name: 'Slate', code: '#0F172A' },
  { name: 'Navy', code: '#0B1B3A' },
  { name: 'Charcoal', code: '#111827' },
  { name: 'Deep Teal', code: '#042F2E' },
];

export const DEFAULT_PERIPHERAL_STIMULUS_COLOR = '#FFFFFF';
/** Bright white — used for the tap-to-start triangle glow. */
export const DEFAULT_PERIPHERAL_FIXATION_COLOR = '#FFFFFF';
export const DEFAULT_PERIPHERAL_BG_COLOR = '#06070D';

/** Uppercase A–Z only for v1. TODO: lowercase / numbers later. */
export const PERIPHERAL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const CENTER_DEAD_ZONE_RATIO = 0.02;
/** Render scale for hex radius vs configured hexSizePx — slightly larger to use play area. */
export const PERIPHERAL_HEX_RENDER_SCALE = 0.94;
const HEX_EDGE_INSET_PX = 1;

function nearestPreset(n: number, presets: readonly number[]): number {
  const v = Number.isFinite(n) ? Math.round(n) : presets[0];
  return presets.reduce((best, p) => (Math.abs(p - v) < Math.abs(best - v) ? p : best), presets[0]);
}

export function clampHexSizePx(n: number): number {
  return nearestPreset(n, PERIPHERAL_HEX_SIZE_PRESETS);
}

export function peripheralStimuliPresets(tier: DeviceTier = getDeviceTier()): readonly number[] {
  return PERIPHERAL_STIMULI_PRESETS_BY_TIER[tier];
}

export function peripheralMaxStimuliCount(tier: DeviceTier = getDeviceTier()): number {
  const presets = peripheralStimuliPresets(tier);
  return presets[presets.length - 1] ?? PERIPHERAL_STIMULI_MIN;
}

export function clampStimuliCount(n: number, tier: DeviceTier = getDeviceTier()): number {
  return nearestPreset(n, peripheralStimuliPresets(tier));
}

/** Cap configured batch size by device tier and eligible hive cells. */
export function effectiveStimuliCount(
  requested: number,
  eligibleCount: number,
  tier: DeviceTier = getDeviceTier(),
): number {
  if (eligibleCount <= 0) return 0;
  return Math.min(clampStimuliCount(requested, tier), eligibleCount);
}

export function clampBatchesPerSession(n: number): number {
  return nearestPreset(n, PERIPHERAL_BATCH_PRESETS);
}

export function clampPeripheralLetterSize(n: number): number {
  return nearestPreset(n, PERIPHERAL_LETTER_SIZE_PRESETS);
}

export function clampPeripheralTargetTimeoutSec(n: number): number {
  const v = Number.isFinite(n) ? Math.round(n) : 0;
  return (PERIPHERAL_TARGET_TIMEOUT_PRESETS as readonly number[]).includes(v)
    ? v
    : PERIPHERAL_TARGET_TIMEOUT_PRESETS.reduce(
        (best, p) => (Math.abs(p - v) < Math.abs(best - v) ? p : best),
        0,
      );
}

/** Letter glyph size inside a hex cell (px). */
export function peripheralLetterFontPx(hexSizePx: number, letterSize: number): number {
  const hex = clampHexSizePx(hexSizePx);
  const letter = clampPeripheralLetterSize(letterSize);
  return Math.max(14, Math.round(hex * 0.55 * (letter / DEFAULT_PERIPHERAL_LETTER_SIZE)));
}

export function resolvePeripheralBubbleType(value?: string | null): PeripheralBubbleType {
  return value === 'boundary' ? 'boundary' : 'solid';
}

export function peripheralHexPaint(options: {
  bubbleType: PeripheralBubbleType;
  isActive: boolean;
  stimulusColor: string;
}): { fill: string; stroke: string; strokeWidth: number } {
  const { bubbleType, isActive, stimulusColor } = options;
  if (bubbleType === 'boundary') {
    return {
      fill: 'transparent',
      stroke: isActive ? stimulusColor : '#334155',
      strokeWidth: isActive ? 2.75 : 1.25,
    };
  }
  return {
    fill: isActive ? stimulusColor : '#111827',
    stroke: isActive ? '#94A3B8' : '#1F2937',
    strokeWidth: isActive ? 2 : 1.25,
  };
}

/** Letter fill: in boundary mode matches the hex outline color. */
export function peripheralLetterColor(options: {
  bubbleType: PeripheralBubbleType;
  stimulusColor: string;
}): string {
  const { bubbleType, stimulusColor } = options;
  if (bubbleType === 'boundary') {
    return stimulusColor;
  }
  return getContrastColor(stimulusColor);
}

export function peripheralSessionAccuracy(correct: number, wrong: number): number {
  const attempts = correct + wrong;
  return attempts > 0 ? Math.round((correct / attempts) * 100) : 100;
}

export function peripheralMedianReactionMs(reactions: number[]): number {
  if (reactions.length === 0) return 0;
  const sorted = [...reactions].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

export function peripheralHexRenderRadius(hexSizePx: number): number {
  return clampHexSizePx(hexSizePx) * PERIPHERAL_HEX_RENDER_SCALE;
}

/** Soft defaults by device tier — settings starting points, not hard caps. */
export function peripheralDeviceDefaults(tier: DeviceTier = getDeviceTier()): {
  hexSizePx: number;
  stimuliCount: number;
  batchesPerSession: number;
} {
  if (tier === 'mobile') {
    return { hexSizePx: 96, stimuliCount: 3, batchesPerSession: PERIPHERAL_DEFAULT_BATCHES };
  }
  if (tier === 'tablet') {
    return { hexSizePx: 96, stimuliCount: 6, batchesPerSession: 6 };
  }
  return { hexSizePx: 80, stimuliCount: 12, batchesPerSession: 6 };
}

/**
 * Flat-top hex honeycomb covering the viewport.
 * `hexSizePx` is the distance from center to vertex (outer radius).
 */
export function buildHexHive(width: number, height: number, hexSizePx: number): HexCell[] {
  const size = clampHexSizePx(hexSizePx);
  if (width <= 0 || height <= 0) return [];

  const w = Math.sqrt(3) * size;
  const h = 2 * size;
  const horiz = w;
  const vert = h * 0.75;

  const cols = Math.ceil(width / horiz) + 2;
  const rows = Math.ceil(height / vert) + 2;
  const cells: HexCell[] = [];

  for (let r = -1; r < rows; r += 1) {
    for (let q = -1; q < cols; q += 1) {
      const cx = q * horiz + (r % 2 !== 0 ? horiz / 2 : 0) + horiz / 2;
      const cy = r * vert + size;
      if (cx < -size || cy < -size || cx > width + size || cy > height + size) continue;
      // Keep centers that land inside or near the play area so edge hexes still render.
      if (cx < -w * 0.25 || cy < -h * 0.25 || cx > width + w * 0.25 || cy > height + h * 0.25) continue;
      cells.push({ id: `${q},${r}`, q, r, cx, cy });
    }
  }
  return cells;
}

/** Six vertices of a flat-top hex centered at (cx, cy). */
export function hexVertices(cx: number, cy: number, size: number): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    points.push({ x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle) });
  }
  return points;
}

export function hexPointsAttribute(cx: number, cy: number, size: number): string {
  return hexVertices(cx, cy, size)
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ');
}

/**
 * True when the rendered hex sits fully inside the play area.
 * Prevents active stimuli from being clipped by screen edges.
 */
export function isHexFullyInside(
  cell: HexCell,
  width: number,
  height: number,
  hexSizePx: number,
  insetPx: number = HEX_EDGE_INSET_PX,
): boolean {
  const size = peripheralHexRenderRadius(hexSizePx);
  // Pointy-top hex bounding box
  const halfW = (Math.sqrt(3) / 2) * size;
  const halfH = size;
  return (
    cell.cx - halfW >= insetPx &&
    cell.cx + halfW <= width - insetPx &&
    cell.cy - halfH >= insetPx &&
    cell.cy + halfH <= height - insetPx
  );
}

/** True when the play area is landscape (Peripheral View is landscape-only). */
export function isPeripheralLandscape(width: number, height: number): boolean {
  return width > 0 && height > 0 && width >= height;
}

/**
 * Eligible spawn cells for the chosen field.
 * Landscape-only: left / right halves (vertical midline).
 * Portrait is gated in the UI — do not spawn while `!isPeripheralLandscape`.
 * Only cells whose full hex fits on-screen are included.
 */
export function eligibleCellIds(
  cells: HexCell[],
  field: PeripheralField,
  width: number,
  height: number = width,
  hexSizePx: number = 64,
): string[] {
  if (!isPeripheralLandscape(width, height)) return [];

  const mid = width / 2;
  const dead = width * CENTER_DEAD_ZONE_RATIO;

  return cells
    .filter((cell) => {
      if (!isHexFullyInside(cell, width, height, hexSizePx)) return false;
      if (field === 'left') return cell.cx < mid;
      if (field === 'right') return cell.cx >= mid;
      return cell.cx < mid - dead || cell.cx > mid + dead;
    })
    .map((c) => c.id);
}

function shuffleInPlace<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Assign up to `count` random A–Z letters onto random eligible cells.
 * Letters may repeat when count > 26.
 */
export function spawnBatch(
  eligibleIds: string[],
  count: number,
  rng: () => number = Math.random,
  tier: DeviceTier = getDeviceTier(),
  cells: HexCell[] = [],
  width: number = 0,
): Record<string, string> {
  if (eligibleIds.length === 0 || count <= 0) return {};
  const n = effectiveStimuliCount(count, eligibleIds.length, tier);
  let pool = [...eligibleIds];
  if (cells.length > 0 && width > 0 && n <= 8) {
    const byId = new Map(cells.map((cell) => [cell.id, cell]));
    const mid = width / 2;
    pool = [...eligibleIds].sort((a, b) => {
      const ca = byId.get(a);
      const cb = byId.get(b);
      return Math.abs((cb?.cx ?? 0) - mid) - Math.abs((ca?.cx ?? 0) - mid);
    });
    pool = pool.slice(0, Math.max(n, Math.min(pool.length, n * 3)));
  }
  const picks = shuffleInPlace(pool, rng).slice(0, n);
  const out: Record<string, string> = {};
  for (const id of picks) {
    const letter = PERIPHERAL_LETTERS[Math.floor(rng() * PERIPHERAL_LETTERS.length)];
    out[id] = letter;
  }
  return out;
}

export function resolvePeripheralField(value?: string | null): PeripheralField {
  if (value === 'left' || value === 'right' || value === 'both') return value;
  return 'both';
}

/** Landscape-only field labels (left / right / both). */
export function peripheralFieldLabel(field: PeripheralField): string {
  if (field === 'left') return 'Left Field';
  if (field === 'right') return 'Right Field';
  return 'Both Fields';
}

/**
 * Upward equilateral triangle vertices (attention-drawing fixation mark).
 * `size` is roughly the distance from center to a vertex.
 */
export function fixationTriangleVertices(
  cx: number,
  cy: number,
  size: number,
): Array<{ x: number; y: number }> {
  const r = Math.max(4, size);
  // Flat-bottom equilateral, tip up — high salience at screen center.
  return [
    { x: cx, y: cy - r },
    { x: cx + r * 0.866, y: cy + r * 0.5 },
    { x: cx - r * 0.866, y: cy + r * 0.5 },
  ];
}

export function fixationTrianglePointsAttribute(cx: number, cy: number, size: number): string {
  return fixationTriangleVertices(cx, cy, size)
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ');
}
