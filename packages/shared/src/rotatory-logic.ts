import {
  ALPHABETS,
  BUBBLES_PER_ROUND,
  BRIGHT_COLORS,
  NUMBERS,
} from './constants';
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

/**
 * Unique A–Z (or a–z) once per session.
 * Digits: unique 0–9 once — do not invent 26 numbers.
 * Colors: only 4 hues, so unique-on-wheel cycles (no two the same at once).
 */
export const ROTATORY_COLOR_CYCLES = 6;

export type RotatoryGlyphClass =
  | 'simple_stroke'
  | 'open_round'
  | 'closed_round'
  | 'dense_stroke'
  | 'symmetric'
  | 'diagonal'
  | 'hue';

export type RotatoryHemifield = 'left' | 'right';
export type RotatoryVertical = 'upper' | 'lower';
export type RotatoryQuadrant = 1 | 2 | 3 | 4;

/** Screen-space sample of a mark on the wheel (visual field, not literacy). */
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

export interface RotatoryTrialRecord {
  trialIndex: number;
  batchIndex: number;
  glyphId: string;
  glyphClass: RotatoryGlyphClass;
  confusableWith: string;
  distractorIds: string;
  distractorCount: number;
  minAngularSepDeg: number;
  outcome: 'correct' | 'wrong_then_correct';
  reactionMs: number;
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
  medianReactionSec: number;
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
  trials: RotatoryTrialRecord[];
}

export interface RotatoryOpenTrial {
  trialIndex: number;
  batchIndex: number;
  glyphId: string;
  glyphClass: RotatoryGlyphClass;
  confusableWith: string;
  distractorIds: string[];
  minAngularSepDeg: number;
  onsetAtMs: number;
  onset: RotatoryPolarSample;
  wheelRotationDegOnset: number;
  angularSpeedDegPerSec: number;
  wrongTaps: number;
  aimTaps: number;
  targetShownAt: number;
}

export interface RotatorySessionState {
  mode: GameMode;
  variant: AlphabetVariant;
  deviceTier: DeviceTier;
  deck: string[];
  batchPlan: number[];
  batchIndex: number;
  dealtCount: number;
  trials: RotatoryTrialRecord[];
  openTrial: RotatoryOpenTrial | null;
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

export function rotatoryBubblesPerRound(tier: DeviceTier, mode: GameMode): number {
  const cap =
    mode === 'colors' ? BRIGHT_COLORS.length : mode === 'numbers' ? NUMBERS.length : ALPHABETS.length;
  return Math.min(BUBBLES_PER_ROUND[tier] ?? 4, cap);
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

export function createRotatorySession(
  mode: GameMode,
  variant: AlphabetVariant,
  deviceTier: DeviceTier,
  bubblesPerRound?: number,
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
    deck,
    batchPlan: rotatoryBatchPlan(deck.length, perRound),
    batchIndex: 0,
    dealtCount: 0,
    trials: [],
    openTrial: null,
  };
}

export function nextRotatoryBatch(state: RotatorySessionState): string[] | null {
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

/**
 * CSS rotate(θ) is clockwise with y-down.
 * Clock angle: 0 at top of the screen, clockwise — visual field, not wheel slot.
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
  const hemifield: RotatoryHemifield = sx < 0 ? 'left' : 'right';
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

/**
 * Pick the next called mark so screen-side samples stay even.
 * Random among remaining bubbles clusters on the left after same-slot refill.
 */
export function pickBalancedRotatoryTarget(
  bubbles: BubbleItem[],
  mode: GameMode,
  wheelRotationDeg: number,
  trials: RotatoryTrialRecord[],
): string | null {
  const candidates = bubbles
    .map((bubble) => {
      const glyph = rotatoryBubbleValue(bubble, mode);
      if (!glyph) return null;
      return { glyph, polar: rotatoryScreenPolar(bubble.x, bubble.y, wheelRotationDeg) };
    })
    .filter((row): row is { glyph: string; polar: RotatoryPolarSample } => row != null);
  if (candidates.length === 0) return null;

  let left = 0;
  let right = 0;
  let upper = 0;
  let lower = 0;
  const quadrants = [0, 0, 0, 0, 0];
  for (const trial of trials) {
    if (trial.onsetHemifield === 'left') left += 1;
    else right += 1;
    if (trial.onsetVertical === 'upper') upper += 1;
    else lower += 1;
    quadrants[trial.onsetQuadrant] += 1;
  }
  const last = trials.length > 0 ? trials[trials.length - 1] : undefined;

  const scored = candidates.map((row) => {
    let score = 0;
    score -= row.polar.hemifield === 'left' ? left : right;
    score -= row.polar.vertical === 'upper' ? upper : lower;
    score -= quadrants[row.polar.quadrant] ?? 0;
    if (last) {
      if (row.polar.hemifield === last.onsetHemifield) score -= 3;
      if (row.polar.vertical === last.onsetVertical) score -= 1;
      if (angularSeparationDeg(row.polar.angleClockDeg, last.onsetAngleClockDeg) < 50) {
        score -= 4;
      }
    }
    return { glyph: row.glyph, score };
  });

  const best = Math.max(...scored.map((row) => row.score));
  const top = scored.filter((row) => row.score === best);
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
    batchIndex: Math.max(0, state.batchIndex - 1),
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
    wheelRotationDegOnset: round1(wheelRotationDeg),
    angularSpeedDegPerSec: round1(angularSpeedDegPerSec),
    wrongTaps: 0,
    aimTaps: 0,
    targetShownAt: nowMs,
  };
  state.openTrial = open;
  return open;
}

export function noteRotatoryWrong(state: RotatorySessionState, kind: 'discrimination' | 'aim'): void {
  if (!state.openTrial) return;
  if (kind === 'aim') state.openTrial.aimTaps += 1;
  else state.openTrial.wrongTaps += 1;
}

export function completeRotatoryTrial(
  state: RotatorySessionState,
  options: {
    tapLocalXPct: number;
    tapLocalYPct: number;
    wheelRotationDeg: number;
    nowMs: number;
  },
): RotatoryTrialRecord | null {
  const open = state.openTrial;
  if (!open) return null;
  const tap = rotatoryScreenPolar(options.tapLocalXPct, options.tapLocalYPct, options.wheelRotationDeg);
  const reactionMs = Math.max(0, Math.round(options.nowMs - open.targetShownAt));
  const trial: RotatoryTrialRecord = {
    trialIndex: open.trialIndex,
    batchIndex: open.batchIndex,
    glyphId: open.glyphId,
    glyphClass: open.glyphClass,
    confusableWith: open.confusableWith,
    distractorIds: open.distractorIds.join('|'),
    distractorCount: open.distractorIds.length,
    minAngularSepDeg: open.minAngularSepDeg,
    outcome: open.wrongTaps > 0 || open.aimTaps > 0 ? 'wrong_then_correct' : 'correct',
    reactionMs,
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
    wheelRotationDegOnset: open.wheelRotationDegOnset,
    wheelRotationDegTap: round1(options.wheelRotationDeg),
    angularSpeedDegPerSec: open.angularSpeedDegPerSec,
  };
  state.trials.push(trial);
  state.openTrial = null;
  return trial;
}

export function rotatoryDeckComplete(state: RotatorySessionState): boolean {
  return state.trials.length >= state.deck.length;
}

function medianMs(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function fieldSlice(
  trials: RotatoryTrialRecord[],
  pred: (t: RotatoryTrialRecord) => boolean,
): { accuracy: number; medianRtSec: number } {
  const subset = trials.filter(pred);
  if (subset.length === 0) return { accuracy: 0, medianRtSec: 0 };
  const clean = subset.filter((t) => t.wrongTaps === 0 && t.aimTaps === 0).length;
  return {
    accuracy: Math.round((clean / subset.length) * 100),
    medianRtSec: parseFloat((medianMs(subset.map((t) => t.reactionMs)) / 1000).toFixed(3)),
  };
}

function classMedian(trials: RotatoryTrialRecord[], glyphClass: RotatoryGlyphClass): number {
  const subset = trials.filter((t) => t.glyphClass === glyphClass);
  if (subset.length === 0) return 0;
  return parseFloat((medianMs(subset.map((t) => t.reactionMs)) / 1000).toFixed(3));
}

export function isRotatorySessionResult(
  data: SessionResultData,
): data is RotatorySessionResultData {
  return 'leftFieldAccuracy' in data && 'rightFieldAccuracy' in data && Array.isArray((data as RotatorySessionResultData).trials);
}

export function summarizeRotatorySession(
  state: RotatorySessionState,
  extras: Omit<
    SessionResultData,
    'stimuliCount' | 'correct' | 'accuracy' | 'avgReactionSec' | 'clicksTotal' | 'wrong'
  > & {
    clicksTotal: number;
    wrong: number;
  },
): RotatorySessionResultData {
  const trials = state.trials;
  const reactionMs = trials.map((t) => t.reactionMs);
  const avgMs = reactionMs.length ? reactionMs.reduce((a, b) => a + b, 0) / reactionMs.length : 0;
  const avgSec = parseFloat((avgMs / 1000).toFixed(3));
  const medianSec = parseFloat((medianMs(reactionMs) / 1000).toFixed(3));
  const left = fieldSlice(trials, (t) => t.onsetHemifield === 'left');
  const right = fieldSlice(trials, (t) => t.onsetHemifield === 'right');
  const upper = fieldSlice(trials, (t) => t.onsetVertical === 'upper');
  const lower = fieldSlice(trials, (t) => t.onsetVertical === 'lower');
  const correct = trials.length;
  const accuracy =
    extras.clicksTotal > 0 ? Math.round((correct / extras.clicksTotal) * 100) : 100;

  return {
    ...extras,
    stimuliCount: correct,
    clicksTotal: extras.clicksTotal,
    correct,
    wrong: extras.wrong,
    accuracy,
    avgReactionSec: avgSec,
    mode: state.mode,
    alphabetVariant: state.mode === 'alphabets' ? state.variant : undefined,
    deviceTier: state.deviceTier,
    trialsConfigured: state.deck.length,
    trialsCompleted: trials.length,
    medianReactionSec: medianSec,
    leftFieldAccuracy: left.accuracy,
    rightFieldAccuracy: right.accuracy,
    leftFieldMedianRtSec: left.medianRtSec,
    rightFieldMedianRtSec: right.medianRtSec,
    upperFieldMedianRtSec: upper.medianRtSec,
    lowerFieldMedianRtSec: lower.medianRtSec,
    simpleStrokeMedianRtSec: classMedian(trials, 'simple_stroke'),
    closedRoundMedianRtSec: classMedian(trials, 'closed_round'),
    openRoundMedianRtSec: classMedian(trials, 'open_round'),
    denseStrokeMedianRtSec: classMedian(trials, 'dense_stroke'),
    trials,
  };
}
