import { ALPHABETS, BRIGHT_COLORS, NUMBERS } from './constants';
import type {
  AlphabetVariant,
  BubbleItem,
  BubblePosition,
  DeviceTier,
  GameMode,
  SessionResultData,
} from './types';
import {
  checkOverlap,
  findNonOverlappingBubblePosition,
  getMinDistancePercent,
  resolveStimuliBubbleColor,
} from './game-logic';
import { buildSessionMetrics, sessionAccuracy } from './session-metrics';

/**
 * Unique A–Z (or a–z) once per session.
 * Digits: unique 0–9 once — do not invent 26 numbers.
 * Colors: only 4 hues, so unique-on-wheel cycles (no two the same at once).
 */
export const ROTATORY_COLOR_CYCLES = 6;
export const ROTATORY_WARMUP_TRIALS = 3;
export const ROTATORY_MIDLINE_DEADZONE_PCT = 10;
export const ROTATORY_HEMIFIELD_QUOTA = 10;
export const ROTATORY_LATERALITY_IMBALANCE_MAX = 0.33;
export const ROTATORY_MIN_SUBGROUP_N = 8;
export const ROTATORY_MIN_PARENT_DIRECTIONAL_N = 15;
export const ROTATORY_MIN_VALID_SESSION_N = 8;

/** Assessment set size is locked per device. Therapy may vary; assessment must not. */
export const ROTATORY_BUBBLES_PER_ROUND: Record<DeviceTier, number> = {
  mobile: 4,
  tablet: 5,
  tv: 5,
};

export type RotatoryGlyphClass =
  | 'simple_stroke'
  | 'open_round'
  | 'closed_round'
  | 'dense_stroke'
  | 'symmetric'
  | 'diagonal'
  | 'hue';

export type RotatoryHemifield = 'left' | 'right' | 'midline';
export type RotatoryVertical = 'upper' | 'lower';
export type RotatoryQuadrant = 1 | 2 | 3 | 4;
export type RotatoryTrialPhase = 'warmup' | 'scored';
export type RotatoryCueMode = 'both' | 'visual' | 'audio';
export type RotatoryHandUsed = 'left' | 'right' | 'unspecified';
export type RotatoryRotationDirection = 'cw' | 'ccw';
export type RotatoryEccentricityBin = 'inner' | 'middle' | 'outer';
export type RotatoryTrialOutcome = 'correct' | 'wrong_then_correct' | 'invalid';

/** Screen-space sample of a mark on the wheel (onset hemifield, not eye or literacy). */
export interface RotatoryPolarSample {
  xPct: number;
  yPct: number;
  /** 0 = top of screen, clockwise. */
  angleClockDeg: number;
  radiusNorm: number;
  hemifield: RotatoryHemifield;
  vertical: RotatoryVertical;
  quadrant: RotatoryQuadrant;
}

export interface RotatoryClassSummary {
  n: number;
  medianRtSec: number;
  iqrRtSec: number;
  cleanTapRate: number;
  discriminationErrorRate: number;
  motorMissRate: number;
  sufficient: boolean;
}

export interface RotatoryBinSummary extends RotatoryClassSummary {
  bin: string;
}

export interface RotatoryTrialRecord {
  trialIndex: number;
  scoredIndex: number;
  batchIndex: number;
  phase: RotatoryTrialPhase;
  glyphId: string;
  glyphClass: RotatoryGlyphClass;
  confusableWith: string;
  confusablePresent: boolean;
  distractorIds: string;
  distractorCount: number;
  minAngularSepDeg: number;
  crowdingRatio: number;
  eccentricityBin: RotatoryEccentricityBin;
  outcome: RotatoryTrialOutcome;
  validForRt: boolean;
  interrupted: boolean;
  pauseCount: number;
  reactionMs: number;
  movementTimeMs: number;
  firstTapWasCorrect: boolean;
  firstTapKind: 'correct' | 'discrimination' | 'aim' | '';
  totalTaps: number;
  wrongTaps: number;
  aimTaps: number;
  onsetAtMs: number;
  onsetAngleClockDeg: number;
  onsetRadiusNorm: number;
  onsetHemifield: RotatoryHemifield;
  onsetVertical: RotatoryVertical;
  onsetQuadrant: RotatoryQuadrant;
  onsetXPct: number;
  onsetYPct: number;
  tapAngleClockDeg: number;
  tapRadiusNorm: number;
  tapHemifield: RotatoryHemifield;
  tapVertical: RotatoryVertical;
  tapQuadrant: RotatoryQuadrant;
  tapXPct: number;
  tapYPct: number;
  fingerXPct: number;
  fingerYPct: number;
  tapErrorXPct: number;
  tapErrorYPct: number;
  seatXPct: number;
  seatYPct: number;
  fieldCrossed: boolean;
  midlineCrossingCount: number;
  angularDriftDeg: number;
  prevSeatSame: boolean;
  angularDisplacementFromPrevDeg: number;
  prevOnsetHemifield: RotatoryHemifield | '';
  consecutiveSameSectorCount: number;
  ttsFinishedBeforeTap: boolean | null;
  wheelRotationDegOnset: number;
  wheelRotationDegTap: number;
  angularSpeedDegPerSec: number;
}

export interface RotatorySessionResultData extends SessionResultData {
  mode: GameMode;
  alphabetVariant?: AlphabetVariant;
  deviceTier: DeviceTier;
  trialsConfigured: number;
  trialsCompleted: number;
  validTrials: number;
  excludedTrials: number;
  warmupTrials: number;
  medianReactionSec: number;
  iqrReactionSec: number;
  cleanTrialMedianRtSec: number;
  cleanTapRate: number;
  discriminationErrorRate: number;
  motorMissRate: number;
  fieldCrossingRate: number;
  lateralityEligible: boolean;
  lateralitySuppressedReason: string;
  leftOnsetN: number;
  rightOnsetN: number;
  midlineOnsetN: number;
  leftFieldAccuracy: number;
  rightFieldAccuracy: number;
  leftFieldMedianRtSec: number;
  rightFieldMedianRtSec: number;
  upperFieldMedianRtSec: number;
  lowerFieldMedianRtSec: number;
  simpleStrokeMedianRtSec: number;
  closedRoundMedianRtSec: number;
  openRoundMedianRtSec: number;
  denseStrokeMedianRtSec: number;
  formClasses: Record<string, RotatoryClassSummary>;
  eccentricityBins: RotatoryBinSummary[];
  crowdingBins: RotatoryBinSummary[];
  cueMode: RotatoryCueMode;
  handUsed: RotatoryHandUsed;
  viewingDistanceCm: number | null;
  rotationDirection: RotatoryRotationDirection;
  bubbleCount: number;
  angularSpeedDegPerSec: number;
  screenWidthPx: number;
  screenHeightPx: number;
  orientation: 'portrait' | 'landscape';
  pausedDuringSession: boolean;
  settingsChanged: boolean;
  abandoned: boolean;
  tooFewTrials: boolean;
  qualityFlags: string;
  trials: RotatoryTrialRecord[];
}

export interface RotatoryOpenTrial {
  trialIndex: number;
  scoredIndex: number;
  batchIndex: number;
  phase: RotatoryTrialPhase;
  glyphId: string;
  glyphClass: RotatoryGlyphClass;
  confusableWith: string;
  distractorIds: string[];
  minAngularSepDeg: number;
  onsetAtMs: number;
  onset: RotatoryPolarSample;
  seatXPct: number;
  seatYPct: number;
  wheelRotationDegOnset: number;
  angularSpeedDegPerSec: number;
  wrongTaps: number;
  aimTaps: number;
  targetShownAt: number;
  interrupted: boolean;
  pauseCount: number;
  firstTapAtMs: number | null;
  firstTapKind: 'correct' | 'discrimination' | 'aim' | null;
  firstTapXPct: number | null;
  firstTapYPct: number | null;
  ttsStartedAt: number | null;
  ttsEndedAt: number | null;
}

export interface RotatorySessionState {
  mode: GameMode;
  variant: AlphabetVariant;
  deviceTier: DeviceTier;
  bubblesPerRound: number;
  phase: RotatoryTrialPhase;
  warmupDeck: string[];
  warmupDealt: number;
  deck: string[];
  batchPlan: number[];
  batchIndex: number;
  dealtCount: number;
  trials: RotatoryTrialRecord[];
  openTrial: RotatoryOpenTrial | null;
  cueMode: RotatoryCueMode;
  handUsed: RotatoryHandUsed;
  viewingDistanceCm: number | null;
  rotationDirection: RotatoryRotationDirection;
  pausedDuringSession: boolean;
  settingsChanged: boolean;
  abandoned: boolean;
}

export interface RotatorySessionOptions {
  cueMode?: RotatoryCueMode;
  handUsed?: RotatoryHandUsed;
  viewingDistanceCm?: number | null;
  rotationDirection?: RotatoryRotationDirection;
}

function shuffleCopy<T>(items: readonly T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = next[i]!;
    next[i] = next[j]!;
    next[j] = a;
  }
  return next;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function sourceGlyphs(mode: GameMode, variant: AlphabetVariant): string[] {
  if (mode === 'alphabets') {
    const letters = ALPHABETS.split('');
    return variant === 'lowercase' ? letters.map((l) => l.toLowerCase()) : letters;
  }
  if (mode === 'numbers') return NUMBERS.split('');
  return BRIGHT_COLORS.map((c) => c.name);
}

export function rotatoryBubblesPerRound(tier: DeviceTier, mode: GameMode): number {
  const cap =
    mode === 'colors' ? BRIGHT_COLORS.length : mode === 'numbers' ? NUMBERS.length : ALPHABETS.length;
  return Math.min(ROTATORY_BUBBLES_PER_ROUND[tier] ?? 3, cap);
}

export function rotatoryBatchPlan(total: number, perRound: number): number[] {
  if (total <= 0 || perRound <= 0) return [];
  const plan: number[] = [];
  let remaining = total;
  while (remaining > 0) {
    plan.push(Math.min(perRound, remaining));
    remaining -= plan[plan.length - 1]!;
  }
  if (plan.length >= 2 && plan[plan.length - 1] === 1) {
    plan[plan.length - 2] -= 1;
    plan[plan.length - 1] += 1;
  }
  return plan;
}

/** Unique session deck — one pass of the stimulus set (colors: unique cycles). */
export function buildRotatoryDeck(mode: GameMode, variant: AlphabetVariant = 'uppercase'): string[] {
  if (mode === 'alphabets') {
    const letters = ALPHABETS.split('');
    const cased = variant === 'lowercase' ? letters.map((l) => l.toLowerCase()) : letters;
    return shuffleCopy(cased);
  }
  if (mode === 'numbers') {
    return shuffleCopy(NUMBERS.split(''));
  }
  const names = BRIGHT_COLORS.map((c) => c.name);
  const deck: string[] = [];
  for (let i = 0; i < ROTATORY_COLOR_CYCLES; i += 1) {
    deck.push(...shuffleCopy(names));
  }
  return deck;
}

export function buildRotatoryWarmupDeck(
  mode: GameMode,
  variant: AlphabetVariant = 'uppercase',
  count = ROTATORY_WARMUP_TRIALS,
): string[] {
  const source = sourceGlyphs(mode, variant);
  if (source.length === 0) return [];
  const picked: string[] = [];
  const unique = shuffleCopy(source);
  for (let i = 0; i < Math.min(count, unique.length); i += 1) picked.push(unique[i]!);
  while (picked.length < count) {
    picked.push(source[Math.floor(Math.random() * source.length)]!);
  }
  return picked;
}

export function createRotatorySession(
  mode: GameMode,
  variant: AlphabetVariant,
  deviceTier: DeviceTier,
  bubblesPerRound?: number,
  options: RotatorySessionOptions = {},
): RotatorySessionState {
  const deck = buildRotatoryDeck(mode, variant);
  const cap =
    mode === 'colors' ? BRIGHT_COLORS.length : mode === 'numbers' ? NUMBERS.length : ALPHABETS.length;
  const perRound = Math.min(
    bubblesPerRound ?? rotatoryBubblesPerRound(deviceTier, mode),
    cap,
  );
  return {
    mode,
    variant,
    deviceTier,
    bubblesPerRound: perRound,
    phase: 'warmup',
    warmupDeck: buildRotatoryWarmupDeck(mode, variant),
    warmupDealt: 0,
    deck,
    batchPlan: rotatoryBatchPlan(deck.length, perRound),
    batchIndex: 0,
    dealtCount: 0,
    trials: [],
    openTrial: null,
    cueMode: options.cueMode ?? 'both',
    handUsed: options.handUsed ?? 'unspecified',
    viewingDistanceCm: options.viewingDistanceCm ?? null,
    rotationDirection: options.rotationDirection ?? 'cw',
    pausedDuringSession: false,
    settingsChanged: false,
    abandoned: false,
  };
}

function takeFillerSymbol(state: RotatorySessionState, avoid: ReadonlySet<string>): string | null {
  const pool = sourceGlyphs(state.mode, state.variant).filter((glyph) => !avoid.has(glyph));
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

function takeWarmupSymbol(state: RotatorySessionState, avoid: ReadonlySet<string>): string | null {
  const remaining = state.warmupDeck.slice(state.warmupDealt);
  const pick = remaining.findIndex((symbol) => !avoid.has(symbol));
  if (pick >= 0) {
    if (pick > 0) {
      const symbol = remaining[pick]!;
      remaining.splice(pick, 1);
      remaining.unshift(symbol);
      state.warmupDeck = [...state.warmupDeck.slice(0, state.warmupDealt), ...remaining];
    }
    const symbol = state.warmupDeck[state.warmupDealt];
    if (!symbol) return takeFillerSymbol(state, avoid);
    state.warmupDealt += 1;
    return symbol;
  }
  return takeFillerSymbol(state, avoid);
}

export function warmupTrialCount(state: RotatorySessionState): number {
  return state.trials.filter((t) => t.phase === 'warmup').length;
}

export function scoredTrialCount(state: RotatorySessionState): number {
  return state.trials.filter((t) => t.phase === 'scored').length;
}

export function rotatoryWarmupComplete(state: RotatorySessionState): boolean {
  return warmupTrialCount(state) >= ROTATORY_WARMUP_TRIALS;
}

export function advanceRotatoryToScored(state: RotatorySessionState): void {
  state.phase = 'scored';
  state.openTrial = null;
}

export function nextRotatoryBatch(state: RotatorySessionState): string[] | null {
  if (state.phase === 'warmup') {
    if (rotatoryWarmupComplete(state)) return null;
    const symbols: string[] = [];
    const avoid = new Set<string>();
    while (symbols.length < state.bubblesPerRound) {
      const next = takeWarmupSymbol(state, avoid);
      if (!next) break;
      symbols.push(next);
      avoid.add(next);
    }
    return symbols.length ? symbols : null;
  }
  if (state.batchIndex >= state.batchPlan.length) return null;
  const count = state.batchPlan[state.batchIndex] ?? 0;
  const symbols = state.deck.slice(state.dealtCount, state.dealtCount + count);
  state.dealtCount += symbols.length;
  state.batchIndex += 1;
  return symbols.length ? symbols : null;
}

/** Next unused deck item that is not already on the wheel (same slot refill). */
export function takeNextRotatorySymbol(
  state: RotatorySessionState,
  avoid: ReadonlySet<string> = new Set(),
): string | null {
  if (state.phase === 'warmup') {
    if (rotatoryWarmupComplete(state)) return null;
    return takeWarmupSymbol(state, avoid);
  }
  if (state.dealtCount >= state.deck.length) return null;
  const remaining = state.deck.slice(state.dealtCount);
  const pick = remaining.findIndex((symbol) => !avoid.has(symbol));
  if (pick < 0) return null;
  if (pick > 0) {
    const symbol = remaining[pick]!;
    remaining.splice(pick, 1);
    remaining.unshift(symbol);
    state.deck = [...state.deck.slice(0, state.dealtCount), ...remaining];
  }
  const symbol = state.deck[state.dealtCount];
  if (!symbol) return null;
  state.dealtCount += 1;
  return symbol;
}

export function rotatoryBubbleValue(bubble: BubbleItem, mode: GameMode): string {
  return mode === 'colors' ? bubble.colorName || bubble.symbol : bubble.symbol;
}

export function makeRotatoryBubbleItem(
  symbol: string,
  mode: GameMode,
  pos: { x: number; y: number },
  stimuliColor: string,
  index: number,
): BubbleItem {
  if (mode === 'colors') {
    const colorObj = BRIGHT_COLORS.find((c) => c.name === symbol) || BRIGHT_COLORS[0];
    return {
      id: `bubble-${index}-${Date.now()}-${Math.random()}`,
      symbol: colorObj.name,
      color: colorObj.code,
      colorName: colorObj.name,
      x: pos.x,
      y: pos.y,
    };
  }
  return {
    id: `bubble-${index}-${Date.now()}-${Math.random()}`,
    symbol,
    color: resolveStimuliBubbleColor(stimuliColor, index),
    colorName: '',
    x: pos.x,
    y: pos.y,
  };
}

const LETTER_CLASS: Record<string, RotatoryGlyphClass> = {
  I: 'simple_stroke',
  L: 'simple_stroke',
  T: 'simple_stroke',
  F: 'simple_stroke',
  J: 'simple_stroke',
  C: 'open_round',
  G: 'open_round',
  S: 'open_round',
  U: 'open_round',
  O: 'closed_round',
  D: 'closed_round',
  Q: 'closed_round',
  P: 'closed_round',
  B: 'dense_stroke',
  R: 'dense_stroke',
  E: 'dense_stroke',
  A: 'symmetric',
  H: 'symmetric',
  M: 'symmetric',
  W: 'symmetric',
  V: 'symmetric',
  N: 'symmetric',
  K: 'diagonal',
  X: 'diagonal',
  Y: 'diagonal',
  Z: 'diagonal',
};

const DIGIT_CLASS: Record<string, RotatoryGlyphClass> = {
  '0': 'closed_round',
  '1': 'simple_stroke',
  '2': 'open_round',
  '3': 'open_round',
  '4': 'diagonal',
  '5': 'dense_stroke',
  '6': 'closed_round',
  '7': 'simple_stroke',
  '8': 'dense_stroke',
  '9': 'closed_round',
};

const CONFUSABLE: Record<string, string> = {
  O: 'Q',
  Q: 'O',
  C: 'G',
  G: 'C',
  E: 'F',
  F: 'E',
  M: 'W',
  W: 'M',
  I: 'L',
  L: 'I',
  P: 'R',
  R: 'P',
  '0': 'O',
  '1': 'I',
  '8': 'B',
  '5': 'S',
  '2': 'Z',
  '6': 'G',
  '9': 'Q',
};

export function rotatoryGlyphClass(glyphId: string, mode: GameMode): RotatoryGlyphClass {
  if (mode === 'colors') return 'hue';
  const key = glyphId.toUpperCase();
  if (mode === 'numbers') return DIGIT_CLASS[key] ?? 'dense_stroke';
  return LETTER_CLASS[key] ?? 'simple_stroke';
}

export function rotatoryConfusableWith(glyphId: string): string {
  return CONFUSABLE[glyphId.toUpperCase()] ?? '';
}

export function rotatoryEccentricityBin(radiusNorm: number): RotatoryEccentricityBin {
  if (radiusNorm < 0.45) return 'inner';
  if (radiusNorm < 0.75) return 'middle';
  return 'outer';
}

export function rotatoryCrowdingRatio(minAngularSepDeg: number, radiusNorm: number): number {
  return round3(minAngularSepDeg / Math.max(radiusNorm, 0.05));
}

export function rotatoryCueShouldSpeak(cueMode: RotatoryCueMode): boolean {
  return cueMode === 'both' || cueMode === 'audio';
}

export function rotatoryCueShowsBanner(cueMode: RotatoryCueMode): boolean {
  return cueMode === 'both' || cueMode === 'visual';
}

/**
 * CSS rotate(θ) is clockwise with y-down.
 * Clock angle: 0 at top of the screen, clockwise — onset hemifield, not eye or literacy.
 * |x| < 10% of playfield width is midline, not forced right.
 */
export function rotatoryScreenPolar(
  localXPct: number,
  localYPct: number,
  wheelRotationDeg: number,
): RotatoryPolarSample {
  const dx = localXPct - 50;
  const dy = localYPct - 50;
  const rad = (wheelRotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const sx = dx * cos - dy * sin;
  const sy = dx * sin + dy * cos;
  const angleClockDeg = (Math.atan2(sx, -sy) * (180 / Math.PI) + 360) % 360;
  const radiusNorm = Math.min(1, Math.hypot(dx, dy) / 50);
  const hemifield: RotatoryHemifield =
    Math.abs(sx) < ROTATORY_MIDLINE_DEADZONE_PCT ? 'midline' : sx < 0 ? 'left' : 'right';
  const vertical: RotatoryVertical = sy < 0 ? 'upper' : 'lower';
  let quadrant: RotatoryQuadrant = 4;
  if (sx >= 0 && sy < 0) quadrant = 1;
  else if (sx < 0 && sy < 0) quadrant = 2;
  else if (sx < 0 && sy >= 0) quadrant = 3;
  return {
    xPct: round1(50 + sx),
    yPct: round1(50 + sy),
    angleClockDeg: round1(angleClockDeg),
    radiusNorm: round3(radiusNorm),
    hemifield,
    vertical,
    quadrant,
  };
}

export function cssMatrixRotationDeg(transform: string): number | null {
  if (!transform || transform === 'none') return null;
  const match = transform.match(/matrix\(([^)]+)\)/);
  if (!match?.[1]) return null;
  const values = match[1].split(',').map(Number);
  if (values.length < 2 || !Number.isFinite(values[0]) || !Number.isFinite(values[1])) return null;
  return (Math.atan2(values[1], values[0]) * 180) / Math.PI;
}

export function angularSeparationDeg(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

export function rotatoryMinAngularSepDeg(
  target: RotatoryPolarSample,
  others: RotatoryPolarSample[],
): number {
  if (others.length === 0) return 180;
  let min = 180;
  for (const other of others) {
    const sep = angularSeparationDeg(target.angleClockDeg, other.angleClockDeg);
    if (sep < min) min = sep;
  }
  return round1(min);
}

function countMeridianCrossings(onsetAngleDeg: number, driftDeg: number): number {
  if (driftDeg <= 0) return 0;
  let count = 0;
  for (const mer of [0, 180]) {
    let first = (mer - onsetAngleDeg + 360) % 360;
    if (first === 0) first = 360;
    if (first <= driftDeg) count += 1 + Math.floor((driftDeg - first) / 360);
  }
  return count;
}

export function placeInitialRotatoryPositions(
  count: number,
  options: { containerSize: number; bubbleSize: number },
): BubblePosition[] {
  const positions: BubblePosition[] = [];
  for (let i = 0; i < count; i += 1) {
    positions.push(
      findNonOverlappingBubblePosition(positions, {
        containerSize: options.containerSize,
        bubbleSize: options.bubbleSize,
        slotIndex: i,
        totalSlots: count,
        gapPercent: 4,
        randomAttempts: 160,
      }),
    );
  }
  return positions;
}

function scatterRotatoryPosition(
  occupied: BubblePosition[],
  containerSize: number,
  bubbleSize: number,
): BubblePosition {
  return findNonOverlappingBubblePosition(occupied, {
    containerSize,
    bubbleSize,
    slotIndex: occupied.length,
    totalSlots: occupied.length + 1,
    gapPercent: 4,
    randomAttempts: 160,
  });
}

/** Mix scatter / far / same-seat so the ring is not a memorized clock. */
export function nextRotatoryRefillPosition(
  popped: BubblePosition,
  occupied: BubblePosition[],
  options: { containerSize: number; bubbleSize: number },
): BubblePosition {
  const { containerSize, bubbleSize } = options;
  const roll = Math.random();
  const minDistance = getMinDistancePercent(bubbleSize, containerSize, 4);

  if (roll < 0.55) {
    return scatterRotatoryPosition(occupied, containerSize, bubbleSize);
  }

  if (roll < 0.85) {
    const far = { x: 100 - popped.x, y: 100 - popped.y };
    if (!checkOverlap(far, occupied, minDistance)) {
      return far;
    }
    return scatterRotatoryPosition(occupied, containerSize, bubbleSize);
  }

  if (!checkOverlap(popped, occupied, minDistance)) {
    return { x: popped.x, y: popped.y };
  }
  return scatterRotatoryPosition(occupied, containerSize, bubbleSize);
}

function scoredOnsetTrials(state: RotatorySessionState): RotatoryTrialRecord[] {
  return state.trials.filter((t) => t.phase === 'scored');
}

/**
 * Constrained randomization: reserve 10 left and 10 right scored onsets.
 * Midline does not count toward either quota. Avoid forced L-R-L-R.
 */
export function pickBalancedRotatoryTarget(
  bubbles: BubbleItem[],
  mode: GameMode,
  wheelRotationDeg: number,
  state: RotatorySessionState,
): string | null {
  const candidates = bubbles
    .map((bubble) => {
      const glyph = rotatoryBubbleValue(bubble, mode);
      if (!glyph) return null;
      return { glyph, polar: rotatoryScreenPolar(bubble.x, bubble.y, wheelRotationDeg) };
    })
    .filter((row): row is { glyph: string; polar: RotatoryPolarSample } => row != null);
  if (candidates.length === 0) return null;

  if (state.phase === 'warmup') {
    return candidates[Math.floor(Math.random() * candidates.length)]!.glyph;
  }

  const scored = scoredOnsetTrials(state);
  const remainingScored = Math.max(0, state.deck.length - scored.length);
  let left = 0;
  let right = 0;
  let upper = 0;
  let lower = 0;
  const quadrants = [0, 0, 0, 0, 0];
  for (const trial of scored) {
    if (trial.onsetHemifield === 'left') left += 1;
    else if (trial.onsetHemifield === 'right') right += 1;
    if (trial.onsetVertical === 'upper') upper += 1;
    else lower += 1;
    quadrants[trial.onsetQuadrant] += 1;
  }
  const leftNeed = Math.max(0, ROTATORY_HEMIFIELD_QUOTA - left);
  const rightNeed = Math.max(0, ROTATORY_HEMIFIELD_QUOTA - right);
  const last = scored.length > 0 ? scored[scored.length - 1] : undefined;

  const sideAllowed = (side: RotatoryHemifield): boolean => {
    if (remainingScored <= 0) return true;
    const nextLeftNeed = side === 'left' ? Math.max(0, leftNeed - 1) : leftNeed;
    const nextRightNeed = side === 'right' ? Math.max(0, rightNeed - 1) : rightNeed;
    const nextNeed = side === 'midline' ? leftNeed + rightNeed : nextLeftNeed + nextRightNeed;
    return remainingScored - 1 >= nextNeed;
  };

  const allowed = candidates.filter((row) => sideAllowed(row.polar.hemifield));
  const pool = allowed.length > 0 ? allowed : candidates;

  const scoredRows = pool.map((row) => {
    let score = Math.random() * 0.4;
    if (row.polar.hemifield === 'left' || row.polar.hemifield === 'right') {
      score -= row.polar.hemifield === 'left' ? left : right;
    }
    score -= row.polar.vertical === 'upper' ? upper : lower;
    score -= (quadrants[row.polar.quadrant] ?? 0) * 0.4;
    if (last) {
      if (row.polar.vertical === last.onsetVertical) score -= 0.5;
      if (angularSeparationDeg(row.polar.angleClockDeg, last.onsetAngleClockDeg) < 50) {
        score -= 4;
      }
    }
    return { glyph: row.glyph, score };
  });

  const best = Math.max(...scoredRows.map((row) => row.score));
  const top = scoredRows.filter((row) => row.score === best);
  return top[Math.floor(Math.random() * top.length)]!.glyph;
}

export function beginRotatoryTrial(
  state: RotatorySessionState,
  options: {
    glyphId: string;
    bubbles: BubbleItem[];
    wheelRotationDeg: number;
    angularSpeedDegPerSec: number;
    nowMs: number;
    sessionStartMs: number | null;
  },
): RotatoryOpenTrial {
  const { glyphId, bubbles, wheelRotationDeg, angularSpeedDegPerSec, nowMs, sessionStartMs } = options;
  const targetBubble = bubbles.find((b) => rotatoryBubbleValue(b, state.mode) === glyphId);
  const onset = rotatoryScreenPolar(
    targetBubble?.x ?? 50,
    targetBubble?.y ?? 50,
    wheelRotationDeg,
  );
  const others = bubbles
    .filter((b) => rotatoryBubbleValue(b, state.mode) !== glyphId)
    .map((b) => rotatoryScreenPolar(b.x, b.y, wheelRotationDeg));
  const open: RotatoryOpenTrial = {
    trialIndex: state.trials.length,
    scoredIndex: state.phase === 'scored' ? scoredTrialCount(state) : -1,
    batchIndex: state.phase === 'scored' ? Math.max(0, state.batchIndex - 1) : 0,
    phase: state.phase,
    glyphId,
    glyphClass: rotatoryGlyphClass(glyphId, state.mode),
    confusableWith: rotatoryConfusableWith(glyphId),
    distractorIds: others.length
      ? bubbles
          .filter((b) => rotatoryBubbleValue(b, state.mode) !== glyphId)
          .map((b) => rotatoryBubbleValue(b, state.mode))
      : [],
    minAngularSepDeg: rotatoryMinAngularSepDeg(onset, others),
    onsetAtMs: sessionStartMs != null ? Math.round(nowMs - sessionStartMs) : 0,
    onset,
    seatXPct: round1(targetBubble?.x ?? 50),
    seatYPct: round1(targetBubble?.y ?? 50),
    wheelRotationDegOnset: round1(wheelRotationDeg),
    angularSpeedDegPerSec: round1(angularSpeedDegPerSec),
    wrongTaps: 0,
    aimTaps: 0,
    targetShownAt: nowMs,
    interrupted: false,
    pauseCount: 0,
    firstTapAtMs: null,
    firstTapKind: null,
    firstTapXPct: null,
    firstTapYPct: null,
    ttsStartedAt: null,
    ttsEndedAt: null,
  };
  state.openTrial = open;
  return open;
}

function recordFirstTap(
  open: RotatoryOpenTrial,
  kind: 'correct' | 'discrimination' | 'aim',
  nowMs: number,
  xPct?: number,
  yPct?: number,
): void {
  if (open.firstTapAtMs != null) return;
  open.firstTapAtMs = nowMs;
  open.firstTapKind = kind;
  open.firstTapXPct = xPct ?? null;
  open.firstTapYPct = yPct ?? null;
}

export function noteRotatoryWrong(
  state: RotatorySessionState,
  kind: 'discrimination' | 'aim',
  tap?: { nowMs: number; xPct?: number; yPct?: number },
): void {
  if (!state.openTrial) return;
  if (kind === 'aim') state.openTrial.aimTaps += 1;
  else state.openTrial.wrongTaps += 1;
  if (tap) recordFirstTap(state.openTrial, kind, tap.nowMs, tap.xPct, tap.yPct);
}

export function interruptRotatoryTrial(state: RotatorySessionState): void {
  if (!state.openTrial) return;
  state.openTrial.interrupted = true;
  state.openTrial.pauseCount += 1;
  state.pausedDuringSession = true;
}

export function noteRotatoryTts(
  state: RotatorySessionState,
  event: 'start' | 'end',
  nowMs: number,
): void {
  if (!state.openTrial) return;
  if (event === 'start') state.openTrial.ttsStartedAt = nowMs;
  else state.openTrial.ttsEndedAt = nowMs;
}

export function completeRotatoryTrial(
  state: RotatorySessionState,
  options: {
    tapLocalXPct: number;
    tapLocalYPct: number;
    wheelRotationDeg: number;
    nowMs: number;
    fingerXPct?: number;
    fingerYPct?: number;
    targetXPct?: number;
    targetYPct?: number;
  },
): RotatoryTrialRecord | null {
  const open = state.openTrial;
  if (!open) return null;
  recordFirstTap(
    open,
    'correct',
    options.nowMs,
    options.fingerXPct ?? options.tapLocalXPct,
    options.fingerYPct ?? options.tapLocalYPct,
  );
  const fingerX = options.fingerXPct ?? options.tapLocalXPct;
  const fingerY = options.fingerYPct ?? options.tapLocalYPct;
  const targetX = options.targetXPct ?? open.seatXPct;
  const targetY = options.targetYPct ?? open.seatYPct;
  const tap = rotatoryScreenPolar(fingerX, fingerY, options.wheelRotationDeg);
  const reactionMs = Math.max(0, Math.round(options.nowMs - open.targetShownAt));
  const movementTimeMs =
    open.firstTapAtMs != null ? Math.max(0, Math.round(options.nowMs - open.firstTapAtMs)) : 0;
  const angularDriftDeg = round1(open.angularSpeedDegPerSec * (reactionMs / 1000));
  const prev = state.trials.length > 0 ? state.trials[state.trials.length - 1] : undefined;
  const prevSeatSame = prev
    ? Math.hypot(open.seatXPct - prev.seatXPct, open.seatYPct - prev.seatYPct) < 8
    : false;
  const consecutiveSameSectorCount = prev
    ? open.onset.quadrant === prev.onsetQuadrant
      ? prev.consecutiveSameSectorCount + 1
      : 1
    : 1;
  const ttsFinishedBeforeTap =
    open.ttsEndedAt != null ? open.ttsEndedAt <= options.nowMs : open.ttsStartedAt != null ? false : null;
  const interrupted = open.interrupted;
  const rawOutcome: RotatoryTrialOutcome =
    interrupted ? 'invalid' : open.wrongTaps > 0 || open.aimTaps > 0 ? 'wrong_then_correct' : 'correct';
  const validForRt = open.phase === 'scored' && !interrupted;
  const trial: RotatoryTrialRecord = {
    trialIndex: open.trialIndex,
    scoredIndex: open.scoredIndex,
    batchIndex: open.batchIndex,
    phase: open.phase,
    glyphId: open.glyphId,
    glyphClass: open.glyphClass,
    confusableWith: open.confusableWith,
    confusablePresent: open.confusableWith
      ? open.distractorIds.some((id) => id.toUpperCase() === open.confusableWith.toUpperCase())
      : false,
    distractorIds: open.distractorIds.join('|'),
    distractorCount: open.distractorIds.length,
    minAngularSepDeg: open.minAngularSepDeg,
    crowdingRatio: rotatoryCrowdingRatio(open.minAngularSepDeg, open.onset.radiusNorm),
    eccentricityBin: rotatoryEccentricityBin(open.onset.radiusNorm),
    outcome: rawOutcome,
    validForRt,
    interrupted,
    pauseCount: open.pauseCount,
    reactionMs,
    movementTimeMs,
    firstTapWasCorrect: open.firstTapKind === 'correct',
    firstTapKind: open.firstTapKind ?? '',
    totalTaps: 1 + open.wrongTaps + open.aimTaps,
    wrongTaps: open.wrongTaps,
    aimTaps: open.aimTaps,
    onsetAtMs: open.onsetAtMs,
    onsetAngleClockDeg: open.onset.angleClockDeg,
    onsetRadiusNorm: open.onset.radiusNorm,
    onsetHemifield: open.onset.hemifield,
    onsetVertical: open.onset.vertical,
    onsetQuadrant: open.onset.quadrant,
    onsetXPct: open.onset.xPct,
    onsetYPct: open.onset.yPct,
    tapAngleClockDeg: tap.angleClockDeg,
    tapRadiusNorm: tap.radiusNorm,
    tapHemifield: tap.hemifield,
    tapVertical: tap.vertical,
    tapQuadrant: tap.quadrant,
    tapXPct: tap.xPct,
    tapYPct: tap.yPct,
    fingerXPct: round1(fingerX),
    fingerYPct: round1(fingerY),
    tapErrorXPct: round1(fingerX - targetX),
    tapErrorYPct: round1(fingerY - targetY),
    seatXPct: open.seatXPct,
    seatYPct: open.seatYPct,
    fieldCrossed: open.onset.hemifield !== tap.hemifield,
    midlineCrossingCount: countMeridianCrossings(open.onset.angleClockDeg, angularDriftDeg),
    angularDriftDeg,
    prevSeatSame,
    angularDisplacementFromPrevDeg: prev
      ? round1(angularSeparationDeg(open.onset.angleClockDeg, prev.onsetAngleClockDeg))
      : 0,
    prevOnsetHemifield: prev?.onsetHemifield ?? '',
    consecutiveSameSectorCount,
    ttsFinishedBeforeTap,
    wheelRotationDegOnset: open.wheelRotationDegOnset,
    wheelRotationDegTap: round1(options.wheelRotationDeg),
    angularSpeedDegPerSec: open.angularSpeedDegPerSec,
  };
  state.trials.push(trial);
  state.openTrial = null;
  return trial;
}

export function finalizeRotatoryOpenTrial(
  state: RotatorySessionState,
  options: { nowMs: number; wheelRotationDeg: number },
): RotatoryTrialRecord | null {
  if (!state.openTrial) return null;
  state.openTrial.interrupted = true;
  return completeRotatoryTrial(state, {
    tapLocalXPct: state.openTrial.seatXPct,
    tapLocalYPct: state.openTrial.seatYPct,
    wheelRotationDeg: options.wheelRotationDeg,
    nowMs: options.nowMs,
    fingerXPct: state.openTrial.seatXPct,
    fingerYPct: state.openTrial.seatYPct,
    targetXPct: state.openTrial.seatXPct,
    targetYPct: state.openTrial.seatYPct,
  });
}

export function rotatoryDeckComplete(state: RotatorySessionState): boolean {
  return scoredTrialCount(state) >= state.deck.length;
}

function medianMs(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! * (hi - pos) + sorted[hi]! * (pos - lo);
}

function iqrMs(values: number[]): number {
  if (values.length < 2) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return quantile(sorted, 0.75) - quantile(sorted, 0.25);
}

function rate(count: number, total: number): number {
  if (total <= 0) return 0;
  return parseFloat((count / total).toFixed(3));
}

function summarizeSubset(trials: RotatoryTrialRecord[], minN = ROTATORY_MIN_SUBGROUP_N): RotatoryClassSummary {
  const n = trials.length;
  const rt = trials.filter((t) => t.validForRt).map((t) => t.reactionMs);
  const clean = trials.filter((t) => t.wrongTaps === 0 && t.aimTaps === 0).length;
  const disc = trials.filter((t) => t.wrongTaps > 0).length;
  const miss = trials.filter((t) => t.aimTaps > 0).length;
  return {
    n,
    medianRtSec: parseFloat((medianMs(rt) / 1000).toFixed(3)),
    iqrRtSec: parseFloat((iqrMs(rt) / 1000).toFixed(3)),
    cleanTapRate: rate(clean, n),
    discriminationErrorRate: rate(disc, n),
    motorMissRate: rate(miss, n),
    sufficient: n >= minN,
  };
}

function fieldSlice(
  trials: RotatoryTrialRecord[],
  pred: (t: RotatoryTrialRecord) => boolean,
): { accuracy: number; medianRtSec: number; n: number } {
  const subset = trials.filter(pred);
  if (subset.length === 0) return { accuracy: 0, medianRtSec: 0, n: 0 };
  const clean = subset.filter((t) => t.wrongTaps === 0 && t.aimTaps === 0).length;
  return {
    accuracy: sessionAccuracy(clean, subset.length - clean),
    medianRtSec: parseFloat((medianMs(subset.filter((t) => t.validForRt).map((t) => t.reactionMs)) / 1000).toFixed(3)),
    n: subset.length,
  };
}

function classMedian(trials: RotatoryTrialRecord[], glyphClass: RotatoryGlyphClass): number {
  const subset = trials.filter((t) => t.glyphClass === glyphClass && t.validForRt);
  if (subset.length < ROTATORY_MIN_SUBGROUP_N) return 0;
  return parseFloat((medianMs(subset.map((t) => t.reactionMs)) / 1000).toFixed(3));
}

export function rotatoryLateralityEligible(
  leftN: number,
  rightN: number,
  handUsed: RotatoryHandUsed,
): { eligible: boolean; reason: string } {
  if (handUsed === 'unspecified') {
    return { eligible: false, reason: 'hand_not_recorded' };
  }
  if (leftN < ROTATORY_HEMIFIELD_QUOTA || rightN < ROTATORY_HEMIFIELD_QUOTA) {
    return { eligible: false, reason: 'too_few_per_side' };
  }
  const imbalance = Math.abs(leftN - rightN) / Math.max(leftN, rightN);
  if (imbalance > ROTATORY_LATERALITY_IMBALANCE_MAX) {
    return { eligible: false, reason: 'imbalanced' };
  }
  return { eligible: true, reason: '' };
}

export function isRotatorySessionResult(
  data: SessionResultData,
): data is RotatorySessionResultData {
  return (
    'leftFieldAccuracy' in data &&
    'rightFieldAccuracy' in data &&
    Array.isArray((data as RotatorySessionResultData).trials)
  );
}

export interface RotatorySummaryExtras extends Omit<
  SessionResultData,
  | 'stimuliCount'
  | 'correct'
  | 'accuracy'
  | 'avgReactionSec'
  | 'medianReactionSec'
  | 'efficiencyIndex'
  | 'clicksTotal'
  | 'wrong'
  | 'wrongTaps'
  | 'misses'
  | 'timeouts'
  | 'wrongTapRate'
  | 'missRate'
  | 'timeoutRate'
  | 'recordedAt'
  | 'clientEventId'
  | 'reactionMs'
> {
  clicksTotal: number;
  wrong: number;
  screenWidthPx?: number;
  screenHeightPx?: number;
  orientation?: 'portrait' | 'landscape';
}

export function summarizeRotatorySession(
  state: RotatorySessionState,
  extras: RotatorySummaryExtras,
): RotatorySessionResultData {
  const scored = state.trials.filter((t) => t.phase === 'scored');
  const valid = scored.filter((t) => t.validForRt);
  const excluded = scored.filter((t) => !t.validForRt);
  const reactionMs = valid.map((t) => t.reactionMs);
  const cleanRt = valid.filter((t) => t.wrongTaps === 0 && t.aimTaps === 0).map((t) => t.reactionMs);
  const cleanTrials = valid.filter((t) => t.wrongTaps === 0 && t.aimTaps === 0).length;
  const discTrials = valid.filter((t) => t.wrongTaps > 0).length;
  const missOnlyTrials = valid.filter((t) => t.aimTaps > 0 && t.wrongTaps === 0).length;
  const metrics = buildSessionMetrics({
    correct: cleanTrials,
    wrongTaps: discTrials,
    misses: missOnlyTrials,
    timeouts: 0,
    reactionMs,
  });
  const avgSec = metrics.avgReactionSec;
  const medianSec = metrics.medianReactionSec;
  const iqrSec = parseFloat((iqrMs(reactionMs) / 1000).toFixed(3));
  const leftTrials = valid.filter((t) => t.onsetHemifield === 'left');
  const rightTrials = valid.filter((t) => t.onsetHemifield === 'right');
  const midlineTrials = valid.filter((t) => t.onsetHemifield === 'midline');
  const laterality = rotatoryLateralityEligible(leftTrials.length, rightTrials.length, state.handUsed);
  const left = fieldSlice(valid, (t) => t.onsetHemifield === 'left');
  const right = fieldSlice(valid, (t) => t.onsetHemifield === 'right');
  const upper = fieldSlice(valid, (t) => t.onsetVertical === 'upper');
  const lower = fieldSlice(valid, (t) => t.onsetVertical === 'lower');
  const cleanTapRate = rate(
    valid.filter((t) => t.wrongTaps === 0 && t.aimTaps === 0).length,
    valid.length,
  );
  const discriminationErrorRate = rate(valid.filter((t) => t.wrongTaps > 0).length, valid.length);
  const motorMissRate = rate(valid.filter((t) => t.aimTaps > 0).length, valid.length);
  const fieldCrossingRate = rate(valid.filter((t) => t.fieldCrossed).length, valid.length);
  const tooFewTrials = valid.length < ROTATORY_MIN_VALID_SESSION_N;
  const flags: string[] = [];
  if (state.pausedDuringSession) flags.push('paused');
  if (state.settingsChanged) flags.push('settings_changed');
  if (state.abandoned) flags.push('abandoned');
  if (tooFewTrials) flags.push('too_few_trials');
  if (!laterality.eligible) flags.push(`laterality_${laterality.reason || 'suppressed'}`);
  if (excluded.length > 0) flags.push('invalid_trials');
  if (state.handUsed === 'unspecified') flags.push('hand_unspecified');
  if (state.viewingDistanceCm == null) flags.push('viewing_distance_missing');

  const classIds: RotatoryGlyphClass[] = [
    'simple_stroke',
    'open_round',
    'closed_round',
    'dense_stroke',
    'symmetric',
    'diagonal',
    'hue',
  ];
  const formClasses: Record<string, RotatoryClassSummary> = {};
  for (const id of classIds) {
    const subset = valid.filter((t) => t.glyphClass === id);
    if (subset.length === 0) continue;
    formClasses[id] = summarizeSubset(subset);
  }

  const eccentricityBins: RotatoryBinSummary[] = (['inner', 'middle', 'outer'] as RotatoryEccentricityBin[]).map(
    (bin) => ({ bin, ...summarizeSubset(valid.filter((t) => t.eccentricityBin === bin)) }),
  );

  const crowdingSorted = [...valid].sort((a, b) => a.crowdingRatio - b.crowdingRatio);
  const third = Math.ceil(crowdingSorted.length / 3) || 1;
  const crowdingBins: RotatoryBinSummary[] = [
    { bin: 'low', ...summarizeSubset(crowdingSorted.slice(0, third)) },
    { bin: 'mid', ...summarizeSubset(crowdingSorted.slice(third, third * 2)) },
    { bin: 'high', ...summarizeSubset(crowdingSorted.slice(third * 2)) },
  ].filter((row) => row.n > 0);

  const screenWidthPx = extras.screenWidthPx ?? 0;
  const screenHeightPx = extras.screenHeightPx ?? 0;
  const orientation =
    extras.orientation ?? (screenWidthPx >= screenHeightPx ? 'landscape' : 'portrait');

  return {
    ...extras,
    ...metrics,
    stimuliCount: valid.length,
    clicksTotal: extras.clicksTotal,
    correct: cleanTrials,
    accuracy: metrics.accuracy,
    avgReactionSec: avgSec,
    mode: state.mode,
    alphabetVariant: state.mode === 'alphabets' ? state.variant : undefined,
    deviceTier: state.deviceTier,
    trialsConfigured: state.deck.length,
    trialsCompleted: scored.length,
    validTrials: valid.length,
    excludedTrials: excluded.length,
    warmupTrials: warmupTrialCount(state),
    medianReactionSec: medianSec,
    iqrReactionSec: iqrSec,
    cleanTrialMedianRtSec: parseFloat((medianMs(cleanRt) / 1000).toFixed(3)),
    cleanTapRate,
    discriminationErrorRate,
    motorMissRate,
    fieldCrossingRate,
    lateralityEligible: laterality.eligible,
    lateralitySuppressedReason: laterality.reason,
    leftOnsetN: leftTrials.length,
    rightOnsetN: rightTrials.length,
    midlineOnsetN: midlineTrials.length,
    leftFieldAccuracy: left.accuracy,
    rightFieldAccuracy: right.accuracy,
    leftFieldMedianRtSec: left.medianRtSec,
    rightFieldMedianRtSec: right.medianRtSec,
    upperFieldMedianRtSec: upper.medianRtSec,
    lowerFieldMedianRtSec: lower.medianRtSec,
    simpleStrokeMedianRtSec: classMedian(valid, 'simple_stroke'),
    closedRoundMedianRtSec: classMedian(valid, 'closed_round'),
    openRoundMedianRtSec: classMedian(valid, 'open_round'),
    denseStrokeMedianRtSec: classMedian(valid, 'dense_stroke'),
    formClasses,
    eccentricityBins,
    crowdingBins,
    cueMode: state.cueMode,
    handUsed: state.handUsed,
    viewingDistanceCm: state.viewingDistanceCm,
    rotationDirection: state.rotationDirection,
    bubbleCount: state.bubblesPerRound,
    angularSpeedDegPerSec: valid[0]?.angularSpeedDegPerSec ?? 0,
    screenWidthPx,
    screenHeightPx,
    orientation,
    pausedDuringSession: state.pausedDuringSession,
    settingsChanged: state.settingsChanged,
    abandoned: state.abandoned,
    tooFewTrials,
    qualityFlags: flags.join('|'),
    trials: state.trials,
  };
}
