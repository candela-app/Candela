import {
  PursuitMovementPattern,
  ScreenOrientation,
  DeviceTier,
} from './types';

export interface ElementState {
  x: number; // Center X in container px
  y: number; // Center Y in container px
  vx: number; // Velocity X (px/s)
  vy: number; // Velocity Y (px/s)
  isFrozen?: boolean;
}

/**
 * Normalizes a triangle wave into [0, maxVal] range.
 */
function triangleWave(val: number, maxVal: number): number {
  if (maxVal <= 0) return 0;
  const doubleMax = maxVal * 2;
  const mod = ((val % doubleMax) + doubleMax) % doubleMax;
  return mod < maxVal ? mod : doubleMax - mod;
}

function freezeDriftProgress(phase: number, driftDuration: number, ease: number): number {
  const duration = Math.max(0.001, driftDuration);
  const easeWindow = Math.min(ease, duration * 0.35);
  const cruise = Math.max(0, duration - 2 * easeWindow);
  const easeArea = easeWindow / 3;
  const total = 2 * easeArea + cruise;
  const t = Math.max(0, Math.min(duration, phase));
  let integrated = 0;
  if (t <= easeWindow) {
    integrated = easeWindow * Math.pow(t / Math.max(0.001, easeWindow), 3) / 3;
  } else if (t <= easeWindow + cruise) {
    integrated = easeArea + (t - easeWindow);
  } else {
    const u = (t - easeWindow - cruise) / Math.max(0.001, easeWindow);
    integrated = easeArea + cruise + easeWindow * (1 - Math.pow(1 - u, 3)) / 3;
  }
  return total > 0 ? integrated / total : 1;
}

function freezeDriftSpeedScale(phase: number, driftDuration: number, ease: number): number {
  const duration = Math.max(0.001, driftDuration);
  const easeWindow = Math.min(ease, duration * 0.35);
  if (phase <= 0 || phase >= duration) return 0;
  if (phase < easeWindow) {
    const u = phase / Math.max(0.001, easeWindow);
    return u * u;
  }
  if (phase > duration - easeWindow) {
    const u = (duration - phase) / Math.max(0.001, easeWindow);
    return u * u;
  }
  return 1;
}

/**
 * Calculates current position and velocity vector for a moving bubble element
 * given movement pattern, elapsed time, container bounds, orientation, and seed.
 */
export function getMovementPath(
  pattern: PursuitMovementPattern,
  timeSec: number,
  containerWidth: number,
  containerHeight: number,
  bubbleSizePx: number,
  speedPxPerSec: number,
  elementIndex: number = 0,
  seed: number = 0,
  orientation: ScreenOrientation = 'landscape',
  tier: DeviceTier = 'mobile'
): ElementState {
  const halfBubble = bubbleSizePx / 2;
  const minX = halfBubble;
  const minY = halfBubble;
  const maxX = Math.max(minX + 10, containerWidth - halfBubble);
  const maxY = Math.max(minY + 10, containerHeight - halfBubble);

  const spanX = maxX - minX;
  const spanY = maxY - minY;

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  // Orientation bias: in portrait, expand Y span relative to X; in landscape, expand X
  const isPortrait = orientation === 'portrait';
  const scaleX = isPortrait ? 0.7 : 0.95;
  const scaleY = isPortrait ? 0.95 : 0.7;

  // Offset seed for decoys so they start at different phases and move differently
  const phaseOffset = seed * 1.7 + elementIndex * 2.39;
  const effectiveSpeed = speedPxPerSec * (elementIndex === 0 ? 1.0 : 0.85 + (elementIndex % 2) * 0.3);

  let x = centerX;
  let y = centerY;
  let vx = 0;
  let vy = 0;
  let isFrozen = false;

  switch (pattern) {
    case 'linear_bounce': {
      // Linear bounce off container edges
      // Angles: 30 deg, 45 deg, 60 deg offset by seed
      const angle = (Math.PI / 4) + (elementIndex * Math.PI / 6) + (seed % 1);
      const rawVx = Math.cos(angle) * effectiveSpeed;
      const rawVy = Math.sin(angle) * effectiveSpeed;

      const totalX = timeSec * Math.abs(rawVx) + (seed * 100);
      const totalY = timeSec * Math.abs(rawVy) + (seed * 150);

      x = minX + triangleWave(totalX, spanX);
      y = minY + triangleWave(totalY, spanY);

      // Determine velocity direction from triangle wave slope
      const periodX = spanX * 2;
      const modX = ((totalX % periodX) + periodX) % periodX;
      const periodY = spanY * 2;
      const modY = ((totalY % periodY) + periodY) % periodY;

      vx = modX < spanX ? Math.abs(rawVx) : -Math.abs(rawVx);
      vy = modY < spanY ? Math.abs(rawVy) : -Math.abs(rawVy);
      break;
    }

    case 'circular_orbit': {
      // Elliptical / circular orbit
      const rx = (spanX / 2) * scaleX;
      const ry = (spanY / 2) * scaleY;
      const omega = (effectiveSpeed / Math.max(1, (rx + ry) / 2));
      const tPhased = timeSec * omega + phaseOffset;

      x = centerX + rx * Math.cos(tPhased);
      y = centerY + ry * Math.sin(tPhased);

      vx = -rx * omega * Math.sin(tPhased);
      vy = ry * omega * Math.cos(tPhased);
      break;
    }

    case 'figure_eight': {
      // Gerono lemniscate, oriented to the longer screen axis so the 8 is readable
      // on both portrait phones and landscape tablets without clipping.
      const pad = 0.84;
      const availW = spanX * pad;
      const availH = spanY * pad;
      const vertical = isPortrait || spanY >= spanX * 0.92;
      const decoyScale = elementIndex === 0 ? 1 : Math.max(0.55, 0.86 - elementIndex * 0.12);
      const loop = Math.max(
        36,
        (vertical ? Math.min(availW, availH / 2) : Math.min(availH, availW / 2)) * decoyScale,
      );
      const omega = effectiveSpeed / Math.max(72, loop * 0.92);
      const phi = timeSec * omega + phaseOffset + Math.PI / 2;
      // Slow the crossing (center) and spend more time on the outer loops.
      const t = phi - 0.32 * Math.sin(2 * phi);
      const tDot = omega * (1 - 0.64 * Math.cos(2 * phi));
      const s1 = Math.sin(t);
      const c1 = Math.cos(t);
      const s2 = Math.sin(2 * t);
      const c2 = Math.cos(2 * t);

      if (vertical) {
        x = centerX + (loop / 2) * s2;
        y = centerY + loop * s1;
        vx = loop * tDot * c2;
        vy = loop * tDot * c1;
      } else {
        x = centerX + loop * s1;
        y = centerY + (loop / 2) * s2;
        vx = loop * tDot * c1;
        vy = loop * tDot * c2;
      }
      break;
    }

    case 'random_walk': {
      // Momentum-based smooth random walk (harmonic summation with continuous derivatives)
      const w1 = (effectiveSpeed * 0.003) + 0.4;
      const w2 = w1 * 1.618;
      const w3 = w1 * 2.718;

      const offsetPh = phaseOffset;
      const normX =
        0.5 * Math.sin(w1 * timeSec + offsetPh) +
        0.3 * Math.sin(w2 * timeSec + offsetPh * 1.5) +
        0.2 * Math.sin(w3 * timeSec + offsetPh * 2.2);

      const normY =
        0.5 * Math.cos(w1 * timeSec * 0.9 + offsetPh * 1.2) +
        0.3 * Math.cos(w2 * timeSec * 1.1 + offsetPh * 1.8) +
        0.2 * Math.cos(w3 * timeSec * 0.8 + offsetPh * 2.5);

      const rx = (spanX / 2) * scaleX;
      const ry = (spanY / 2) * scaleY;

      x = centerX + rx * normX;
      y = centerY + ry * normY;

      const dNormX =
        0.5 * w1 * Math.cos(w1 * timeSec + offsetPh) +
        0.3 * w2 * Math.cos(w2 * timeSec + offsetPh * 1.5) +
        0.2 * w3 * Math.cos(w3 * timeSec + offsetPh * 2.2);

      const dNormY =
        -0.5 * w1 * 0.9 * Math.sin(w1 * timeSec * 0.9 + offsetPh * 1.2) -
        0.3 * w2 * 1.1 * Math.sin(w2 * timeSec * 1.1 + offsetPh * 1.8) -
        0.2 * w3 * 0.8 * Math.sin(w3 * timeSec * 0.8 + offsetPh * 2.5);

      vx = rx * dNormX;
      vy = ry * dNormY;
      break;
    }

    case 'stationary': {
      x = centerX;
      y = centerY;
      vx = 0;
      vy = 0;
      break;
    }

    case 'freeze_drift': {
      // Slow harmonic drift that actually pauses in place, then eases back into motion.
      // Wall-clock time keeps running during a freeze; motion time does not, so there is no teleport.
      const cycleDuration = 4.8 + (elementIndex % 3) * 0.65 + (seed % 1) * 0.45;
      const freezeDuration = 0.8 + (elementIndex % 2) * 0.22 + ((seed * 3) % 1) * 0.18;
      const driftDuration = Math.max(2.4, cycleDuration - freezeDuration);
      const ease = Math.min(0.7, driftDuration * 0.28);
      const shifted = timeSec + phaseOffset * 0.35;
      const cycleIndex = Math.floor(shifted / cycleDuration);
      const phase = shifted - cycleIndex * cycleDuration;
      const frozen = phase >= driftDuration;
      const driftPhase = frozen ? driftDuration : phase;
      const progress = freezeDriftProgress(driftPhase, driftDuration, ease);
      const speedScale = frozen ? 0 : freezeDriftSpeedScale(driftPhase, driftDuration, ease);
      const motionTime = (cycleIndex + progress) * driftDuration * 0.9;

      const driftState = getMovementPath(
        'random_walk',
        motionTime,
        containerWidth,
        containerHeight,
        bubbleSizePx,
        effectiveSpeed * 0.48,
        elementIndex,
        seed,
        orientation,
        tier,
      );
      x = driftState.x;
      y = driftState.y;
      isFrozen = frozen;
      vx = frozen ? 0 : driftState.vx * speedScale;
      vy = frozen ? 0 : driftState.vy * speedScale;
      break;
    }

    default: {
      x = centerX;
      y = centerY;
      vx = 0;
      vy = 0;
      break;
    }
  }

  // Ensure bounds safety
  x = Math.max(minX, Math.min(maxX, x));
  y = Math.max(minY, Math.min(maxY, y));

  return { x, y, vx, vy, isFrozen };
}

/**
 * Calculates Euclidean tracking error in pixels between tap location and target center at tap time.
 */
export function calculateTrackingError(
  tapX: number,
  tapY: number,
  targetX: number,
  targetY: number
): number {
  const dx = tapX - targetX;
  const dy = tapY - targetY;
  return Math.round(Math.sqrt(dx * dx + dy * dy));
}

/**
 * Computes dot product alignment of tap error vector relative to target motion vector.
 * Returns ratio > 0 for Anticipation (leading target), < 0 for Lag (trailing target).
 */
export function calculateAnticipationVsLag(
  tapX: number,
  tapY: number,
  targetX: number,
  targetY: number,
  vx: number,
  vy: number
): { ratio: number; label: string } {
  const speed = Math.sqrt(vx * vx + vy * vy);
  if (speed < 1) {
    return { ratio: 0, label: 'Stationary / Centered' };
  }

  // Normalized velocity vector
  const nVx = vx / speed;
  const nVy = vy / speed;

  // Vector from target center to tap point
  const tapDx = tapX - targetX;
  const tapDy = tapY - targetY;

  // Dot product
  const dot = tapDx * nVx + tapDy * nVy;

  if (dot > 8) {
    return { ratio: Math.min(1.0, dot / 50), label: 'Anticipating (Leading Target)' };
  } else if (dot < -8) {
    return { ratio: Math.max(-1.0, dot / 50), label: 'Lagging (Trailing Target)' };
  } else {
    return { ratio: 0, label: 'Centered (On Target)' };
  }
}
