export const LOOK_DWELL_MS = 260;
export const LOOK_DWELL_MISS_GRACE_MS = 140;
export const LOOK_HIT_PADDING_PX = 96;
export const LOOK_YAW_RANGE_RAD = Math.PI / 5;
export const LOOK_PITCH_RANGE_RAD = Math.PI / 7;
export const LOOK_CAMERA_GAIN = 2.4;
export const LOOK_IRIS_GAIN = 0.9;
export const LOOK_BLEND_GAIN = 0.7;
export const LOOK_SMOOTH_ALPHA = 0.32;
export const LOOK_HEAD_WEIGHT = 0.28;
export const LOOK_EYE_WEIGHT = 0.36;
export const LOOK_BLEND_WEIGHT = 0.36;

export function lookNormFromWebEyePog(pogX: number, pogY: number): LookPoint {
  return {
    x: clamp01(0.5 - pogX),
    y: clamp01(0.5 - pogY),
  };
}

export function lookScreenToWebEyePog(screenX: number, screenY: number): LookPoint {
  return {
    x: 0.5 - screenX,
    y: 0.5 - screenY,
  };
}

export const LOOK_IRIS_RIGHT = 468;
export const LOOK_IRIS_LEFT = 473;
export const LOOK_EYE_IMAGE_LEFT_OUTER = 33;
export const LOOK_EYE_IMAGE_LEFT_INNER = 133;
export const LOOK_EYE_IMAGE_LEFT_TOP = 159;
export const LOOK_EYE_IMAGE_LEFT_BOTTOM = 145;
export const LOOK_EYE_IMAGE_RIGHT_OUTER = 263;
export const LOOK_EYE_IMAGE_RIGHT_INNER = 362;
export const LOOK_EYE_IMAGE_RIGHT_TOP = 386;
export const LOOK_EYE_IMAGE_RIGHT_BOTTOM = 374;

export interface LookPoint {
  x: number;
  y: number;
}

export interface LookBlendshapeScore {
  categoryName: string;
  score: number;
}

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function eulerFromFaceMatrix(m: ArrayLike<number>): { yawRad: number; pitchRad: number } {
  const r20 = m[2];
  const r21 = m[6];
  const r22 = m[10];
  const pitchRad = Math.asin(Math.max(-1, Math.min(1, -r21)));
  const yawRad = Math.atan2(r20, r22);
  return { yawRad, pitchRad };
}

export function lookNormFromHeadPose(yawRad: number, pitchRad: number): LookPoint {
  return {
    x: clamp01(0.5 - yawRad / LOOK_YAW_RANGE_RAD),
    y: clamp01(0.5 + pitchRad / LOOK_PITCH_RANGE_RAD),
  };
}

export function lookNormFromCameraPoint(rawX: number, rawY: number): LookPoint {
  return {
    x: clamp01(0.5 - (rawX - 0.5) * LOOK_CAMERA_GAIN),
    y: clamp01(0.5 + (rawY - 0.5) * LOOK_CAMERA_GAIN),
  };
}

export function lookNormFromHeadAndIris(input: {
  yawRad: number;
  pitchRad: number;
  irisX: number;
  irisY: number;
}): LookPoint {
  const head = lookNormFromHeadPose(input.yawRad, input.pitchRad);
  const iris = lookNormFromCameraPoint(input.irisX, input.irisY);
  return {
    x: clamp01(head.x * LOOK_HEAD_WEIGHT + iris.x * (1 - LOOK_HEAD_WEIGHT)),
    y: clamp01(head.y * LOOK_HEAD_WEIGHT + iris.y * (1 - LOOK_HEAD_WEIGHT)),
  };
}

export function lookNormFromIrisPair(
  left: LookPoint,
  right: LookPoint,
  matrix?: ArrayLike<number>,
): LookPoint {
  const rawX = (left.x + right.x) / 2;
  const rawY = (left.y + right.y) / 2;
  if (!matrix || matrix.length < 16) {
    return lookNormFromCameraPoint(rawX, rawY);
  }
  const { yawRad, pitchRad } = eulerFromFaceMatrix(matrix);
  return lookNormFromHeadAndIris({ yawRad, pitchRad, irisX: rawX, irisY: rawY });
}

export function lookNormFromFaceBounds(
  x: number,
  y: number,
  width: number,
  height: number,
  frameWidth: number,
  frameHeight: number,
): LookPoint {
  const rawX = (x + width / 2) / Math.max(1, frameWidth);
  const rawY = (y + height / 2) / Math.max(1, frameHeight);
  return lookNormFromCameraPoint(rawX, rawY);
}

function irisOffsetInSocket(
  iris: LookPoint,
  inner: LookPoint,
  outer: LookPoint,
  top: LookPoint,
  bottom: LookPoint,
): LookPoint {
  const cx = (inner.x + outer.x) / 2;
  const cy = (top.y + bottom.y) / 2;
  const halfW = Math.max(1e-4, Math.abs(outer.x - inner.x) / 2);
  const halfH = Math.max(1e-4, Math.abs(bottom.y - top.y) / 2);
  return {
    x: (iris.x - cx) / halfW,
    y: (iris.y - cy) / halfH,
  };
}

export function lookNormFromIrisInSockets(landmarks: ReadonlyArray<LookPoint>): LookPoint | null {
  if (landmarks.length <= LOOK_IRIS_LEFT) {
    return null;
  }
  const left = irisOffsetInSocket(
    landmarks[LOOK_IRIS_RIGHT],
    landmarks[LOOK_EYE_IMAGE_LEFT_INNER],
    landmarks[LOOK_EYE_IMAGE_LEFT_OUTER],
    landmarks[LOOK_EYE_IMAGE_LEFT_TOP],
    landmarks[LOOK_EYE_IMAGE_LEFT_BOTTOM],
  );
  const right = irisOffsetInSocket(
    landmarks[LOOK_IRIS_LEFT],
    landmarks[LOOK_EYE_IMAGE_RIGHT_INNER],
    landmarks[LOOK_EYE_IMAGE_RIGHT_OUTER],
    landmarks[LOOK_EYE_IMAGE_RIGHT_TOP],
    landmarks[LOOK_EYE_IMAGE_RIGHT_BOTTOM],
  );
  const nx = (left.x + right.x) / 2;
  const ny = (left.y + right.y) / 2;
  return {
    x: clamp01(0.5 - nx * LOOK_IRIS_GAIN),
    y: clamp01(0.5 + ny * LOOK_IRIS_GAIN),
  };
}

function blendScore(categories: ReadonlyArray<LookBlendshapeScore>, key: string): number {
  const want = key.replace(/_/g, '').toLowerCase();
  for (let i = 0; i < categories.length; i += 1) {
    if (categories[i].categoryName.replace(/_/g, '').toLowerCase() === want) {
      return categories[i].score;
    }
  }
  return 0;
}

export function lookNormFromBlendshapes(
  categories: ReadonlyArray<LookBlendshapeScore>,
): LookPoint | null {
  if (categories.length === 0) {
    return null;
  }
  const lookPersonLeft = blendScore(categories, 'eyeLookOutLeft') + blendScore(categories, 'eyeLookInRight');
  const lookPersonRight = blendScore(categories, 'eyeLookInLeft') + blendScore(categories, 'eyeLookOutRight');
  const lookUp = blendScore(categories, 'eyeLookUpLeft') + blendScore(categories, 'eyeLookUpRight');
  const lookDown = blendScore(categories, 'eyeLookDownLeft') + blendScore(categories, 'eyeLookDownRight');
  if (lookPersonLeft + lookPersonRight + lookUp + lookDown <= 0) {
    return null;
  }
  return {
    x: clamp01(0.5 - (lookPersonLeft - lookPersonRight) * LOOK_BLEND_GAIN),
    y: clamp01(0.5 + (lookDown - lookUp) * LOOK_BLEND_GAIN),
  };
}

function mixLook(parts: Array<{ point: LookPoint; weight: number }>): LookPoint | null {
  let total = 0;
  let x = 0;
  let y = 0;
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (part.weight <= 0) {
      continue;
    }
    total += part.weight;
    x += part.point.x * part.weight;
    y += part.point.y * part.weight;
  }
  if (total <= 0) {
    return null;
  }
  return { x: clamp01(x / total), y: clamp01(y / total) };
}

export function lookNormFromFace(input: {
  landmarks: ReadonlyArray<LookPoint>;
  matrix?: ArrayLike<number>;
  blendshapes?: ReadonlyArray<LookBlendshapeScore>;
}): LookPoint | null {
  if (input.landmarks.length < 468) {
    return null;
  }
  const parts: Array<{ point: LookPoint; weight: number }> = [];
  if (input.matrix && input.matrix.length >= 16) {
    const { yawRad, pitchRad } = eulerFromFaceMatrix(input.matrix);
    parts.push({ point: lookNormFromHeadPose(yawRad, pitchRad), weight: LOOK_HEAD_WEIGHT });
  }
  const eyes = lookNormFromIrisInSockets(input.landmarks);
  if (eyes) {
    parts.push({ point: eyes, weight: LOOK_EYE_WEIGHT });
  }
  const blends = input.blendshapes ? lookNormFromBlendshapes(input.blendshapes) : null;
  if (blends) {
    parts.push({ point: blends, weight: LOOK_BLEND_WEIGHT });
  }
  if (parts.length === 0) {
    const left = input.landmarks[LOOK_IRIS_LEFT];
    const right = input.landmarks[LOOK_IRIS_RIGHT];
    if (!left || !right) {
      return null;
    }
    return lookNormFromIrisPair(left, right);
  }
  return mixLook(parts);
}

export function lookNormFromLandmarks(
  landmarks: Array<LookPoint>,
  matrix: ArrayLike<number> | undefined,
): LookPoint | null {
  return lookNormFromFace({ landmarks, matrix });
}

export function smoothLookNorm(prev: LookPoint | null, next: LookPoint, alpha: number = LOOK_SMOOTH_ALPHA): LookPoint {
  if (!prev) {
    return next;
  }
  return {
    x: prev.x + (next.x - prev.x) * alpha,
    y: prev.y + (next.y - prev.y) * alpha,
  };
}

export function lookHitsBubble(
  lookX: number,
  lookY: number,
  bubbleX: number,
  bubbleY: number,
  bubbleSizePx: number,
): boolean {
  const r = bubbleSizePx / 2 + LOOK_HIT_PADDING_PX;
  const dx = lookX - bubbleX;
  const dy = lookY - bubbleY;
  return dx * dx + dy * dy <= r * r;
}

export function resolveLookOverId(
  lookX: number,
  lookY: number,
  target: { x: number; y: number },
  decoys: Array<{ x: number; y: number }>,
  bubbleSizePx: number,
): string | null {
  if (lookHitsBubble(lookX, lookY, target.x, target.y, bubbleSizePx)) {
    return 'target';
  }
  for (let i = 0; i < decoys.length; i += 1) {
    if (lookHitsBubble(lookX, lookY, decoys[i].x, decoys[i].y, bubbleSizePx)) {
      return `decoy-${i}`;
    }
  }
  return null;
}

export interface LookDwellState {
  overId: string | null;
  heldMs: number;
  missMs: number;
}

export function createLookDwellState(): LookDwellState {
  return { overId: null, heldMs: 0, missMs: 0 };
}

export function resetLookDwell(state: LookDwellState): void {
  state.overId = null;
  state.heldMs = 0;
  state.missMs = 0;
}

export function advanceLookDwell(
  state: LookDwellState,
  overId: string | null,
  dtMs: number,
  dwellMs: number = LOOK_DWELL_MS,
): string | null {
  if (!overId) {
    if (!state.overId) {
      return null;
    }
    state.missMs += dtMs;
    if (state.missMs >= LOOK_DWELL_MISS_GRACE_MS) {
      resetLookDwell(state);
    }
    return null;
  }
  state.missMs = 0;
  if (state.overId !== overId) {
    state.overId = overId;
    state.heldMs = 0;
    return null;
  }
  state.heldMs += dtMs;
  if (state.heldMs >= dwellMs) {
    resetLookDwell(state);
    return overId;
  }
  return null;
}

export interface LookSample {
  x: number;
  y: number;
  faceLost: boolean;
}
