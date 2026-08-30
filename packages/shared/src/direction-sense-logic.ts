/**
 * Direction Sense — letter + 90° curved arrow; child picks the matching rotation.
 * Arrow is always one quarter-turn, clockwise or anticlockwise (clinical setting).
 */

export const DEFAULT_DIRECTION_SENSE_BG = '#0B0F14';
export const DEFAULT_DIRECTION_SENSE_SHAPE_COLOR = '#F5F7FA';
export const DEFAULT_DIRECTION_SENSE_ARROW_COLOR = '#FFFFFF';

export const DIRECTION_SENSE_BG_COLORS: { name: string; code: string }[] = [
  { name: 'Ink', code: '#0B0F14' },
  { name: 'Slate', code: '#1E293B' },
  { name: 'Charcoal', code: '#111827' },
  { name: 'Paper', code: '#E8ECF0' },
  { name: 'White', code: '#F8FAFC' },
];

export const DIRECTION_SENSE_SHAPE_COLORS: { name: string; code: string }[] = [
  { name: 'Snow', code: '#F5F7FA' },
  { name: 'White', code: '#FFFFFF' },
  { name: 'Ink', code: '#0F172A' },
  { name: 'Amber', code: '#FBBF24' },
  { name: 'Cyan', code: '#22D3EE' },
];

export type DirectionSenseTurnDirection = 'cw' | 'ccw';
export type DirectionSenseTurnDeg = 0 | 90 | 180 | 270 | 360;
export type DirectionSenseMode = 'face' | 'flip';
export type DirectionSenseShapeId =
  | 'ell'
  | 'ellInv'
  | 'ellSlant'
  | 'cee'
  | 'jay'
  | 'tee'
  | 'eee'
  | 'eff'
  | 'seven'
  | 'pee'
  | 'arr'
  | 'yuu';

/** 0 = upright, 1 = 90° CW, 2 = 180°, 3 = 270° CW */
export type DirectionSenseOrientation = 0 | 1 | 2 | 3;

export interface DirectionSensePose {
  orientation: DirectionSenseOrientation;
  flipH: boolean;
}

export interface DirectionSenseOption {
  id: string;
  pose: DirectionSensePose;
  isCorrect: boolean;
}

export interface DirectionSenseTrial {
  id: string;
  shapeId: DirectionSenseShapeId;
  mode: DirectionSenseMode;
  turnDeg: DirectionSenseTurnDeg;
  turnDirection: DirectionSenseTurnDirection;
  probe: DirectionSensePose;
  options: DirectionSenseOption[];
  /** Straighten level: starting tilt of the rotatable letter (degrees CW). */
  startDeg?: number;
}

export const DIRECTION_SENSE_TURN_DEGS: DirectionSenseTurnDeg[] = [90];
export const DEFAULT_DIRECTION_SENSE_TURN_DEG: DirectionSenseTurnDeg = 90;
export const DEFAULT_DIRECTION_SENSE_TURN_DIRECTION: DirectionSenseTurnDirection = 'cw';

export const DIRECTION_SENSE_SHAPE_IDS: DirectionSenseShapeId[] = [
  'ell',
  'ellInv',
  'ellSlant',
  'cee',
  'jay',
  'tee',
  'eee',
  'eff',
  'seven',
  'pee',
  'arr',
  'yuu',
];

/** Stroke width in the 100×100 viewBox. */
export const DIRECTION_SENSE_SHAPE_STROKE_WIDTH = 8;
export const DIRECTION_SENSE_ARROW_STROKE_WIDTH = 5.5;

/** Open letter-figures; canonical pose is the upright character. */
export const DIRECTION_SENSE_SHAPE_PATHS: Record<DirectionSenseShapeId, string> = {
  ell: 'M30 16 L30 82 L76 82',
  ellInv: 'M26 18 L74 18 M26 18 L26 84',
  ellSlant: 'M44 14 L26 84 L80 84',
  cee: 'M72 26 L30 26 L30 74 L72 74',
  jay: 'M64 16 L64 64 Q64 84 44 84 Q26 84 26 66',
  tee: 'M18 22 L82 22 M50 22 L50 84',
  eee: 'M72 20 L28 20 L28 80 L72 80 M28 50 L60 50',
  eff: 'M28 84 L28 20 L72 20 M28 50 L60 50',
  seven: 'M24 20 L76 20 L40 84',
  pee: 'M28 84 L28 18 L68 18 L68 48 L28 48',
  arr: 'M28 84 L28 18 L68 18 L68 48 L28 48 M48 48 L74 84',
  yuu: 'M26 18 L26 74 L74 74 L74 18',
};

export const DIRECTION_SENSE_CHOICE_COUNT_PRESETS = [3, 4] as const;
export const DEFAULT_DIRECTION_SENSE_CHOICE_COUNT = 3;

export const DIRECTION_SENSE_TRIALS_PRESETS = [8, 12, 16, 20] as const;
export const DEFAULT_DIRECTION_SENSE_TRIALS = 12;

export const DIRECTION_SENSE_SHAPE_SIZE_PRESETS = [120, 160, 200, 240] as const;
export const DEFAULT_DIRECTION_SENSE_SHAPE_SIZE = 160;

export const DIRECTION_SENSE_TIME_LIMIT_PRESETS = [0, 30, 45, 60, 90] as const;
export const DEFAULT_DIRECTION_SENSE_TIME_LIMIT_SEC = 0;

export function clampDirectionSenseChoiceCount(value: number): number {
  const presets = DIRECTION_SENSE_CHOICE_COUNT_PRESETS as readonly number[];
  if (presets.includes(value)) return value;
  return value >= 4 ? 4 : 3;
}

export function clampDirectionSenseTrials(value: number): number {
  const presets = DIRECTION_SENSE_TRIALS_PRESETS as readonly number[];
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

export function clampDirectionSenseShapeSize(value: number): number {
  const presets = DIRECTION_SENSE_SHAPE_SIZE_PRESETS as readonly number[];
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

export function clampDirectionSenseTimeLimitSec(value: number): number {
  const presets = DIRECTION_SENSE_TIME_LIMIT_PRESETS as readonly number[];
  if (presets.includes(value)) return value;
  return value > 0 ? 60 : 0;
}

export function clampDirectionSenseTurnDirection(
  value: string | undefined | null,
): DirectionSenseTurnDirection {
  return value === 'ccw' ? 'ccw' : 'cw';
}

export function clampDirectionSenseMode(value: string | undefined | null): DirectionSenseMode {
  return value === 'flip' ? 'flip' : 'face';
}

export function directionSenseModeFromLevelId(levelId?: string | null): DirectionSenseMode {
  if (levelId === 'flip') return 'flip';
  return 'face';
}

export function directionSenseLevelIsStraighten(levelId?: string | null): boolean {
  return levelId === 'straighten' || levelId === 'mixed';
}

/** @deprecated Use directionSenseLevelIsStraighten — Mixed was replaced by Straighten. */
export function directionSenseLevelUsesMixed(levelId?: string | null): boolean {
  return directionSenseLevelIsStraighten(levelId);
}

export function directionSenseLevelLabel(levelId?: string | null): string {
  if (directionSenseLevelIsStraighten(levelId)) return 'Straighten';
  if (levelId === 'flip') return 'Flip';
  return 'Face';
}

export function normalizeDirectionSenseLevelId(
  levelId?: string | null,
): 'face' | 'flip' | 'straighten' {
  if (levelId === 'flip') return 'flip';
  if (directionSenseLevelIsStraighten(levelId)) return 'straighten';
  return 'face';
}

export function directionSensePrescribedAllows(levelId: string, prescribed: string[]): boolean {
  const id = normalizeDirectionSenseLevelId(levelId);
  if (id === 'straighten') {
    return prescribed.includes('straighten') || prescribed.includes('mixed');
  }
  return prescribed.includes(id);
}

export function canonicalizeDirectionSenseLevels(levels: string[]): string[] {
  return Array.from(new Set(levels.map((id) => (id === 'mixed' ? 'straighten' : id))));
}

export function directionSenseModeLabel(mode: DirectionSenseMode): string {
  return mode === 'flip' ? 'Flip' : 'Face';
}

export function directionSenseTurnDirectionLabel(dir: DirectionSenseTurnDirection): string {
  return dir === 'ccw' ? 'Anticlockwise' : 'Clockwise';
}

export function orientationToDegrees(ori: DirectionSenseOrientation): number {
  return ori * 90;
}

/** Apply a clockwise/anticlockwise turn. 360° equals 0°. */
export function applyDirectionSenseTurn(
  start: DirectionSenseOrientation,
  turnDeg: DirectionSenseTurnDeg,
  direction: DirectionSenseTurnDirection,
): DirectionSenseOrientation {
  const steps = (turnDeg / 90) % 4;
  const delta = direction === 'cw' ? steps : (4 - steps) % 4;
  return ((start + delta) % 4) as DirectionSenseOrientation;
}

function poseKey(pose: DirectionSensePose): string {
  return `${pose.orientation}:${pose.flipH ? 1 : 0}`;
}

function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Kids mix-ups are one-step turns: 0°, 90° CW, 90° CCW, then 180°.
 * Always keep the 90° “cantilever” (ori 1) in a 3-choice set when it is not the target.
 */
function pickFoils(correct: DirectionSensePose, count: number): DirectionSensePose[] {
  const preferred: DirectionSenseOrientation[] = [0, 1, 3, 2];
  const foils: DirectionSensePose[] = [];
  for (const orientation of preferred) {
    if (foils.length >= count) break;
    if (orientation === correct.orientation) continue;
    foils.push({ orientation, flipH: false });
  }
  return foils;
}

let trialSeq = 0;

export function buildDirectionSenseTrial(args: {
  mode: DirectionSenseMode;
  choiceCount?: number;
  shapeId?: DirectionSenseShapeId;
  turnDirection?: DirectionSenseTurnDirection;
  turnDeg?: DirectionSenseTurnDeg;
}): DirectionSenseTrial {
  const choiceCount = clampDirectionSenseChoiceCount(args.choiceCount ?? DEFAULT_DIRECTION_SENSE_CHOICE_COUNT);
  const mode = clampDirectionSenseMode(args.mode);
  const shapeId = args.shapeId ?? randomItem(DIRECTION_SENSE_SHAPE_IDS);
  const turnDirection = clampDirectionSenseTurnDirection(args.turnDirection);
  const turnDeg: DirectionSenseTurnDeg = DEFAULT_DIRECTION_SENSE_TURN_DEG;
  const probe: DirectionSensePose = { orientation: 0, flipH: false };
  const correct: DirectionSensePose = {
    orientation: applyDirectionSenseTurn(probe.orientation, turnDeg, turnDirection),
    flipH: false,
  };

  const foilCount = Math.max(1, choiceCount - 1);
  const foils = pickFoils(correct, foilCount);
  const options: DirectionSenseOption[] = shuffleInPlace([
    { id: `opt-correct-${trialSeq}`, pose: correct, isCorrect: true },
    ...foils.map((pose, i) => ({
      id: `opt-foil-${trialSeq}-${i}`,
      pose,
      isCorrect: false,
    })),
  ]);

  trialSeq += 1;
  return {
    id: `trial-${trialSeq}-${poseKey(correct)}-${turnDeg}-${turnDirection}`,
    shapeId,
    mode,
    turnDeg,
    turnDirection,
    probe,
    options,
  };
}

export function directionSenseAccuracy(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 1000) / 10;
}

export function directionSenseDeviceDefaults(): {
  choiceCount: number;
  trials: number;
  shapeSizePx: number;
  turnDirection: DirectionSenseTurnDirection;
} {
  return {
    choiceCount: DEFAULT_DIRECTION_SENSE_CHOICE_COUNT,
    trials: DEFAULT_DIRECTION_SENSE_TRIALS,
    shapeSizePx: DEFAULT_DIRECTION_SENSE_SHAPE_SIZE,
    turnDirection: DEFAULT_DIRECTION_SENSE_TURN_DIRECTION,
  };
}

/** SVG transform for a pose centered in a 100×100 viewBox. */
export function directionSensePoseTransform(pose: DirectionSensePose): string {
  const deg = orientationToDegrees(pose.orientation);
  const flip = pose.flipH ? 'translate(100 0) scale(-1 1)' : '';
  const rotate = `rotate(${deg} 50 50)`;
  return flip ? `${rotate} ${flip}` : rotate;
}

/**
 * Stroke rotate glyph (¾-circle + right-angle head), matching a clockwise refresh icon.
 * Anticlockwise is a horizontal mirror.
 */
export const DIRECTION_SENSE_ROTATE_ARROW_PATH =
  'M68.2 81.2 A36 36 0 1 1 79.5 29.3 M79.5 12 L79.5 29.3 L56 29.3';

export function directionSenseArrowTransform(direction: DirectionSenseTurnDirection): string {
  const quarter = 'rotate(90 50 50)';
  return direction === 'ccw' ? `${quarter} translate(100 0) scale(-1 1)` : quarter;
}

export function directionSenseCurvedArrowPath(
  _turnDeg: DirectionSenseTurnDeg,
  _direction: DirectionSenseTurnDirection,
): string {
  return DIRECTION_SENSE_ROTATE_ARROW_PATH;
}

/** How close to upright counts as straight on the Straighten level. */
export const DIRECTION_SENSE_STRAIGHTEN_TOLERANCE_DEG = 15;

/** Max diameter of the Straighten rotate pad (website + mobile). */
export const DIRECTION_SENSE_ROTATE_PAD_MAX_PX = 440;

/** Pad uses this fraction of the short screen edge, then caps at max. */
export const DIRECTION_SENSE_ROTATE_PAD_VMIN = 0.72;

/** Rotating letter fills this fraction of the pad diameter. */
export const DIRECTION_SENSE_ROTATE_GLYPH_RATIO = 0.74;

export function directionSenseRotatePadSize(shortEdgePx: number): number {
  const edge = Math.max(1, shortEdgePx);
  return Math.round(Math.min(DIRECTION_SENSE_ROTATE_PAD_MAX_PX, edge * DIRECTION_SENSE_ROTATE_PAD_VMIN));
}

export function directionSenseRotateGlyphSize(padPx: number): number {
  return Math.round(padPx * DIRECTION_SENSE_ROTATE_GLYPH_RATIO);
}

/** Straighten finger-trail stays visible this long after lift, then vanishes. */
export const DIRECTION_SENSE_TRAIL_HOLD_MS = 4000;

/** Play an SVI move-whoosh after this much rotation while dragging. */
export const DIRECTION_SENSE_MOVE_SOUND_DEG = 12;

/** Minimum gap between move-whoosh pulses so they stay distinct. */
export const DIRECTION_SENSE_MOVE_SOUND_MIN_MS = 80;

export interface DirectionSenseMoveCueState {
  accumDeg: number;
  lastAtMs: number;
}

export function resetDirectionSenseMoveCue(state: DirectionSenseMoveCueState): void {
  state.accumDeg = 0;
  state.lastAtMs = 0;
}

/** True when enough rotation has happened to play the next motion whoosh. */
export function takeDirectionSenseMoveCue(
  state: DirectionSenseMoveCueState,
  absDeltaDeg: number,
  nowMs: number,
): boolean {
  state.accumDeg += absDeltaDeg;
  if (state.accumDeg < DIRECTION_SENSE_MOVE_SOUND_DEG) return false;
  if (nowMs - state.lastAtMs < DIRECTION_SENSE_MOVE_SOUND_MIN_MS) return false;
  state.accumDeg = 0;
  state.lastAtMs = nowMs;
  return true;
}

export interface DirectionSenseTrailPoint {
  x: number;
  y: number;
}

export function directionSenseTrailPolyline(points: DirectionSenseTrailPoint[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(' ');
}

export function directionSenseTrailArrowPoints(
  points: DirectionSenseTrailPoint[],
  size = 12,
): string | null {
  if (points.length < 2) return null;
  const a = points[points.length - 2]!;
  const b = points[points.length - 1]!;
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const left = {
    x: b.x - size * Math.cos(ang - 0.5),
    y: b.y - size * Math.sin(ang - 0.5),
  };
  const right = {
    x: b.x - size * Math.cos(ang + 0.5),
    y: b.y - size * Math.sin(ang + 0.5),
  };
  return `${b.x},${b.y} ${left.x},${left.y} ${right.x},${right.y}`;
}

export function shouldAppendTrailPoint(
  prev: DirectionSenseTrailPoint | undefined,
  next: DirectionSenseTrailPoint,
  minDist = 3,
): boolean {
  if (!prev) return true;
  const dx = next.x - prev.x;
  const dy = next.y - prev.y;
  return dx * dx + dy * dy >= minDist * minDist;
}

export function normalizeDirectionSenseDeg(deg: number): number {
  let n = deg % 360;
  if (n < 0) n += 360;
  return n;
}

/** Signed shortest turn from `fromDeg` to `toDeg` in (-180, 180]. */
export function directionSenseDeltaDeg(fromDeg: number, toDeg: number): number {
  let d = normalizeDirectionSenseDeg(toDeg) - normalizeDirectionSenseDeg(fromDeg);
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

export function directionSenseUprightErrorDeg(deg: number): number {
  const n = normalizeDirectionSenseDeg(deg);
  return Math.min(n, 360 - n);
}

export function isDirectionSenseUpright(
  deg: number,
  toleranceDeg = DIRECTION_SENSE_STRAIGHTEN_TOLERANCE_DEG,
): boolean {
  return directionSenseUprightErrorDeg(deg) <= toleranceDeg;
}

export function pointerAngleDeg(x: number, y: number, cx: number, cy: number): number {
  return (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
}

/** Random tilt that is clearly not upright. */
export function randomDirectionSenseTiltDeg(): number {
  return 40 + Math.random() * 280;
}

export function buildDirectionSenseStraightenTrial(shapeId?: DirectionSenseShapeId): DirectionSenseTrial {
  const id = shapeId ?? randomItem(DIRECTION_SENSE_SHAPE_IDS);
  const startDeg = randomDirectionSenseTiltDeg();
  trialSeq += 1;
  return {
    id: `trial-straighten-${trialSeq}-${Math.round(startDeg)}`,
    shapeId: id,
    mode: 'face',
    turnDeg: DEFAULT_DIRECTION_SENSE_TURN_DEG,
    turnDirection: DEFAULT_DIRECTION_SENSE_TURN_DIRECTION,
    probe: { orientation: 0, flipH: false },
    options: [],
    startDeg,
  };
}
