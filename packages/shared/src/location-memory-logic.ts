/**
 * Location Memory — spatial number-location binding (SVI-style).
 * Explore a grid (one cell open at a time), then recall where each number lived.
 */

import { sessionAccuracy } from './session-metrics';

export const DEFAULT_LOCATION_MEMORY_BG = '#0B0F14';
export const DEFAULT_LOCATION_MEMORY_CHAR_COLOR = '#F5F7FA';

export const LOCATION_MEMORY_BG_COLORS: { name: string; code: string }[] = [
  { name: 'Ink', code: '#0B0F14' },
  { name: 'Slate', code: '#1E293B' },
  { name: 'Charcoal', code: '#111827' },
  { name: 'Paper', code: '#E8ECF0' },
  { name: 'White', code: '#F8FAFC' },
];

export const LOCATION_MEMORY_CHAR_COLORS: { name: string; code: string }[] = [
  { name: 'Snow', code: '#F5F7FA' },
  { name: 'White', code: '#FFFFFF' },
  { name: 'Ink', code: '#0F172A' },
  { name: 'Amber', code: '#FBBF24' },
];

export const LOCATION_MEMORY_GRID_SIZE = 3;

/** Match Pairs / configurable board: 2×2, 3×3, or 4×4 (max). */
export const LOCATION_MEMORY_GRID_SIZE_PRESETS = [2, 3, 4] as const;
export const DEFAULT_LOCATION_MEMORY_GRID_SIZE = 2;
/** @deprecated Prefer LOCATION_MEMORY_GRID_SIZE_PRESETS — kept as max default. */
export const LOCATION_MEMORY_PAIRS_GRID_SIZE = DEFAULT_LOCATION_MEMORY_GRID_SIZE;
/** How many unique values for a full 4×4 pairs board (each appears twice). */
export const LOCATION_MEMORY_PAIR_COUNT = 8;
/** How long both mismatched cards stay visible before closing. */
export const LOCATION_MEMORY_MISMATCH_MS = 750;

/** How many cells carry a number (rest are blank distractors on the grid). */
export const LOCATION_MEMORY_ACTIVE_CELL_PRESETS = [2, 3, 4, 5, 7, 9] as const;
export const DEFAULT_LOCATION_MEMORY_ACTIVE_CELLS = 3;

export const LOCATION_MEMORY_ROUNDS_PRESETS = [1, 2, 3, 4, 5] as const;
export const DEFAULT_LOCATION_MEMORY_ROUNDS = 1;

/** 0 = unlimited explore before recall. */
export const LOCATION_MEMORY_EXPLORE_SEC_PRESETS = [0, 30, 60, 90, 120] as const;
export const DEFAULT_LOCATION_MEMORY_EXPLORE_SEC = 60;

/** Per-target recall time limit; 0 = off. Also used as overall session limit in Match Pairs. */
export const LOCATION_MEMORY_RECALL_SEC_PRESETS = [0, 15, 30, 45, 60] as const;
export const DEFAULT_LOCATION_MEMORY_RECALL_SEC = 30;

export const LOCATION_MEMORY_LETTER_SIZE_PRESETS = [1.8, 2.2, 2.8, 3.4, 4.2] as const;
export const DEFAULT_LOCATION_MEMORY_LETTER_SIZE = 2.8;

export type LocationMemoryPlayMode = 'recall' | 'pairs';

export interface LocationMemoryCell {
  id: string;
  index: number;
  row: number;
  col: number;
  /** null = inactive / blank cell on grid */
  value: number | null;
}

/** Active-cell choices that fit an N×N board (2×2 falls back to 2–4). */
export function locationMemoryActiveCellOptions(gridSize: number): number[] {
  const max = clampLocationMemoryGridSize(gridSize) ** 2;
  const filtered = (LOCATION_MEMORY_ACTIVE_CELL_PRESETS as readonly number[]).filter((n) => n <= max);
  if (filtered.length > 0) return [...filtered];
  return Array.from({ length: Math.max(1, max - 1) }, (_, i) => i + 2);
}

export function clampLocationMemoryActiveCells(
  value: number,
  gridSize: number = DEFAULT_LOCATION_MEMORY_GRID_SIZE,
): number {
  const presets = locationMemoryActiveCellOptions(gridSize);
  if (presets.includes(value)) return value;
  const n = Math.round(value);
  let best = presets[0]!;
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

export function clampLocationMemoryGridSize(value: number): number {
  const presets = LOCATION_MEMORY_GRID_SIZE_PRESETS as readonly number[];
  if (presets.includes(value as (typeof LOCATION_MEMORY_GRID_SIZE_PRESETS)[number])) return value;
  const n = Math.round(value);
  let best = presets[presets.length - 1]!;
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

export function locationMemoryGridLabel(size: number): string {
  const n = clampLocationMemoryGridSize(size);
  return `${n}×${n}`;
}

/** Pair count that fills a grid (odd grids leave one blank). */
export function locationMemoryPairsForGrid(gridSize: number): number {
  const n = clampLocationMemoryGridSize(gridSize);
  return Math.floor((n * n) / 2);
}

export function clampLocationMemoryRounds(value: number): number {
  const presets = LOCATION_MEMORY_ROUNDS_PRESETS as readonly number[];
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

export function clampLocationMemoryExploreSec(value: number): number {
  const presets = LOCATION_MEMORY_EXPLORE_SEC_PRESETS as readonly number[];
  if (presets.includes(value)) return value;
  const n = Math.round(value);
  if (n <= 0) return 0;
  let best = presets[1] ?? 30;
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

export function clampLocationMemoryRecallSec(value: number): number {
  const presets = LOCATION_MEMORY_RECALL_SEC_PRESETS as readonly number[];
  if (presets.includes(value)) return value;
  const n = Math.round(value);
  if (n <= 0) return 0;
  let best = presets[1] ?? 15;
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

export function clampLocationMemoryLetterSize(value: number): number {
  const presets = LOCATION_MEMORY_LETTER_SIZE_PRESETS as readonly number[];
  if (presets.includes(value)) return value;
  const n = Number(value);
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

export function locationMemoryExploreLabel(sec: number): string {
  return sec <= 0 ? 'Unlimited' : `${sec}s`;
}

export function locationMemoryRecallLabel(sec: number): string {
  return sec <= 0 ? 'Off' : `${sec}s`;
}

/** Map MODULE_LEVELS.location_memory ids → active cell count (recall modes only). */
export function locationMemoryActiveCellsFromLevelId(levelId: string | null | undefined): number {
  if (levelId === 'practice') return 5;
  return 9; // standard
}

export function locationMemoryModeFromLevelId(levelId: string | null | undefined): LocationMemoryPlayMode {
  if (levelId === 'match') return 'pairs';
  return 'recall';
}

/** Fisher–Yates shuffle (in-place copy). */
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Build an N×N board with `activeCount` numbered cells (1..activeCount) placed at random indices.
 * Remaining cells are blank (value null).
 */
export function buildLocationMemoryBoard(
  activeCount: number = DEFAULT_LOCATION_MEMORY_ACTIVE_CELLS,
  gridSize: number = DEFAULT_LOCATION_MEMORY_GRID_SIZE,
): LocationMemoryCell[] {
  const size = clampLocationMemoryGridSize(gridSize);
  const total = size * size;
  const active = Math.min(total, Math.max(1, clampLocationMemoryActiveCells(activeCount, size)));
  const indices = shuffle(Array.from({ length: total }, (_, i) => i));
  const activeIndices = new Set(indices.slice(0, active));
  const values = shuffle(Array.from({ length: active }, (_, i) => i + 1));

  let valueIdx = 0;
  const cells: LocationMemoryCell[] = [];
  for (let index = 0; index < total; index++) {
    const row = Math.floor(index / size);
    const col = index % size;
    const isActive = activeIndices.has(index);
    cells.push({
      id: `lm-${index}-${Math.random().toString(36).slice(2, 7)}`,
      index,
      row,
      col,
      value: isActive ? values[valueIdx++]! : null,
    });
  }
  return cells;
}

/**
 * Build a Match Pairs board: every value appears exactly twice.
 * Grid 2 → 2 pairs, 3 → 4 pairs (+1 blank), 4 → 8 pairs.
 */
export function buildLocationMemoryPairsBoard(
  gridSize: number = DEFAULT_LOCATION_MEMORY_GRID_SIZE,
  pairCount?: number,
): LocationMemoryCell[] {
  const size = clampLocationMemoryGridSize(gridSize);
  const total = size * size;
  const pairs = Math.min(
    pairCount ?? locationMemoryPairsForGrid(size),
    Math.floor(total / 2),
  );
  const deck: number[] = [];
  for (let v = 1; v <= pairs; v++) {
    deck.push(v, v);
  }
  while (deck.length < total) deck.push(0);
  const shuffled = shuffle(deck.slice(0, total));

  return shuffled.map((raw, index) => ({
    id: `lmp-${index}-${Math.random().toString(36).slice(2, 7)}`,
    index,
    row: Math.floor(index / size),
    col: index % size,
    value: raw > 0 ? raw : null,
  }));
}

/** Shuffled list of target numbers to recall (one trial per active cell). */
export function buildLocationMemoryRecallQueue(cells: LocationMemoryCell[]): number[] {
  const values = cells.map((c) => c.value).filter((v): v is number => v != null);
  return shuffle(values);
}

export function locationMemoryPairCount(cells: LocationMemoryCell[]): number {
  const values = cells.map((c) => c.value).filter((v): v is number => v != null);
  return Math.floor(values.length / 2);
}

export function locationMemoryAccuracy(correct: number, wrong: number): number {
  return sessionAccuracy(correct, wrong);
}

export function locationMemoryDeviceDefaults(): {
  activeCells: number;
  rounds: number;
  exploreSec: number;
  recallSec: number;
  letterSize: number;
  gridSize: number;
} {
  return {
    activeCells: DEFAULT_LOCATION_MEMORY_ACTIVE_CELLS,
    rounds: DEFAULT_LOCATION_MEMORY_ROUNDS,
    exploreSec: DEFAULT_LOCATION_MEMORY_EXPLORE_SEC,
    recallSec: DEFAULT_LOCATION_MEMORY_RECALL_SEC,
    letterSize: DEFAULT_LOCATION_MEMORY_LETTER_SIZE,
    gridSize: DEFAULT_LOCATION_MEMORY_GRID_SIZE,
  };
}
