import { BeePathType, PathComplexity, PathPoint, ScreenOrientation } from './types';

export interface GeneratedPath {
  pathType: BeePathType;
  difficultyTier: number;
  points: PathPoint[];
  svgPathD: string;
  startPoint: PathPoint;
  endPoint: PathPoint;
  distractorPoint?: PathPoint;
  distractorSvgPathD?: string;
  distractorPoints?: PathPoint[];
  dashArray?: string;
  totalLength: number;
  baselineTimeSec: number;
  orientation: ScreenOrientation;
}

/**
 * Maps normalized coordinates (u along primary axis [0, 1], v along cross axis [-0.5, 0.5])
 * to physical pixel coordinates based on orientation.
 */
export function mapNormalizedPoint(
  u: number,
  v: number,
  width: number,
  height: number,
  marginX: number,
  marginY: number,
  orientation: ScreenOrientation
): PathPoint {
  const effMarginY = orientation === 'portrait' ? Math.max(85, marginY) : marginY;
  const effMarginX = orientation === 'landscape' ? Math.max(85, marginX) : marginX;

  const usableWidth = width - effMarginX * 2;
  const usableHeight = height - effMarginY * 2;

  if (orientation === 'portrait') {
    // Primary axis = Vertical Y (travels bottom to top: Hive at bottom, Flower at top)
    // u = 0 -> Y = height - effMarginY
    // u = 1 -> Y = effMarginY
    // Secondary axis = Horizontal X (centered around width / 2)
    const x = width / 2 + v * usableWidth;
    const y = (height - effMarginY) - u * usableHeight;
    return { x, y };
  } else {
    // Primary axis = Horizontal X (travels left to right: Hive at left, Flower at right)
    // u = 0 -> X = effMarginX
    // u = 1 -> X = width - effMarginX
    // Secondary axis = Vertical Y (centered around height / 2)
    const x = effMarginX + u * usableWidth;
    const y = height / 2 + v * usableHeight;
    return { x, y };
  }
}


export function generateBeePath(
  type: BeePathType,
  width: number,
  height: number,
  tier: number = 1,
  complexity: PathComplexity = 'medium',
  orientation: ScreenOrientation = 'landscape'
): GeneratedPath {
  const complexityMult = complexity === 'short' ? 0.7 : 1.0;
  const marginX = Math.max(45, (width * 0.12) / complexityMult);
  const marginY = Math.max(45, (height * 0.12) / complexityMult);

  let points: PathPoint[] = [];
  let svgPathD = '';
  let startPoint: PathPoint = mapNormalizedPoint(0, 0, width, height, marginX, marginY, orientation);
  let endPoint: PathPoint = mapNormalizedPoint(1, 0, width, height, marginX, marginY, orientation);
  let distractorPoint: PathPoint | undefined = undefined;
  let distractorSvgPathD: string | undefined = undefined;
  let distractorPoints: PathPoint[] | undefined = undefined;
  let dashArray: string | undefined = undefined;

  const samples = Math.floor((150 + tier * 25) * complexityMult);

  let effectiveType = type;
  if (type === 'random') {
    const pool: BeePathType[] = ['straight', 'curve', 'zigzag', 'wave', 'spiral', 'branching', 'dotted'];
    effectiveType = pool[Math.floor(Math.random() * pool.length)];
  }

  switch (effectiveType) {
    case 'straight': {
      const isDiagonal = tier > 2;
      const vStart = isDiagonal ? -0.2 : 0;
      const vEnd = isDiagonal ? 0.2 : 0;

      startPoint = mapNormalizedPoint(0, vStart, width, height, marginX, marginY, orientation);
      endPoint = mapNormalizedPoint(1, vEnd, width, height, marginX, marginY, orientation);

      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const u = t;
        const v = vStart + t * (vEnd - vStart);
        points.push(mapNormalizedPoint(u, v, width, height, marginX, marginY, orientation));
      }
      svgPathD = `M ${startPoint.x} ${startPoint.y} L ${endPoint.x} ${endPoint.y}`;
      break;
    }

    case 'curve': {
      // Arc / quadratic curve
      startPoint = mapNormalizedPoint(0, 0.15, width, height, marginX, marginY, orientation);
      endPoint = mapNormalizedPoint(1, 0.15, width, height, marginX, marginY, orientation);
      const controlV = -0.35 - tier * 0.03;
      const controlPt = mapNormalizedPoint(0.5, controlV, width, height, marginX, marginY, orientation);

      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const invT = 1 - t;
        const x = invT * invT * startPoint.x + 2 * invT * t * controlPt.x + t * t * endPoint.x;
        const y = invT * invT * startPoint.y + 2 * invT * t * controlPt.y + t * t * endPoint.y;
        points.push({ x, y });
      }
      svgPathD = `M ${startPoint.x} ${startPoint.y} Q ${controlPt.x} ${controlPt.y} ${endPoint.x} ${endPoint.y}`;
      break;
    }

    case 'zigzag': {
      startPoint = mapNormalizedPoint(0, 0, width, height, marginX, marginY, orientation);
      endPoint = mapNormalizedPoint(1, 0, width, height, marginX, marginY, orientation);

      const numPeaks = 3 + Math.min(4, tier);
      const keyPoints: PathPoint[] = [startPoint];
      const amplitudeV = Math.min(0.38, 0.22 + tier * 0.03);

      for (let k = 1; k < numPeaks; k++) {
        const dir = k % 2 === 1 ? -1 : 1;
        const u = k / numPeaks;
        const v = dir * amplitudeV;
        keyPoints.push(mapNormalizedPoint(u, v, width, height, marginX, marginY, orientation));
      }
      keyPoints.push(endPoint);

      svgPathD = `M ${keyPoints[0].x} ${keyPoints[0].y}`;
      for (let k = 1; k < keyPoints.length; k++) {
        svgPathD += ` L ${keyPoints[k].x} ${keyPoints[k].y}`;
      }

      const samplesPerSeg = Math.floor(samples / (keyPoints.length - 1));
      for (let k = 0; k < keyPoints.length - 1; k++) {
        const pA = keyPoints[k];
        const pB = keyPoints[k + 1];
        for (let j = 0; j < samplesPerSeg; j++) {
          const t = j / samplesPerSeg;
          points.push({
            x: pA.x + t * (pB.x - pA.x),
            y: pA.y + t * (pB.y - pA.y),
          });
        }
      }
      points.push(endPoint);
      break;
    }

    case 'wave': {
      startPoint = mapNormalizedPoint(0, 0, width, height, marginX, marginY, orientation);
      endPoint = mapNormalizedPoint(1, 0, width, height, marginX, marginY, orientation);

      const frequency = 1.5 + tier * 0.5;
      const amplitudeV = Math.min(0.35, 0.2 + tier * 0.03);

      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const u = t;
        const v = Math.sin(t * Math.PI * 2 * frequency) * amplitudeV;
        points.push(mapNormalizedPoint(u, v, width, height, marginX, marginY, orientation));
      }

      svgPathD = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i += 2) {
        svgPathD += ` L ${points[i].x} ${points[i].y}`;
      }
      break;
    }

    case 'spiral': {
      const edgePad = 8;
      const centerX = width / 2;
      const centerY = height / 2;
      const maxRadius = Math.max(
        48,
        Math.min(centerX, centerY, width - centerX, height - centerY) - edgePad,
      );
      const loopSpacing = Math.max(48, Math.min(width, height) * 0.075);
      const turns = Math.max(1.8, maxRadius / loopSpacing) * (complexity === 'short' ? 0.85 : 1);
      const spiralSamples = Math.max(samples, Math.floor(turns * 110));

      for (let i = 0; i <= spiralSamples; i++) {
        const t = i / spiralSamples;
        const angle = t * Math.PI * 2 * turns;
        const r = t * maxRadius;
        points.push({
          x: centerX + r * Math.cos(angle),
          y: centerY + r * Math.sin(angle),
        });
      }

      startPoint = points[0];
      endPoint = points[points.length - 1];

      svgPathD = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        svgPathD += ` L ${points[i].x} ${points[i].y}`;
      }
      break;
    }

    case 'branching': {
      startPoint = mapNormalizedPoint(0, 0, width, height, marginX, marginY, orientation);
      const splitPt = mapNormalizedPoint(0.45, 0, width, height, marginX, marginY, orientation);
      endPoint = mapNormalizedPoint(1.0, -0.28, width, height, marginX, marginY, orientation);
      distractorPoint = mapNormalizedPoint(1.0, 0.32, width, height, marginX, marginY, orientation);

      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        if (t <= 0.45) {
          const tSub = t / 0.45;
          points.push({
            x: startPoint.x + tSub * (splitPt.x - startPoint.x),
            y: startPoint.y + tSub * (splitPt.y - startPoint.y),
          });
        } else {
          const tSub = (t - 0.45) / 0.55;
          const u = 0.45 + tSub * 0.55;
          const v = -0.28 * Math.sin((tSub * Math.PI) / 2);
          points.push(mapNormalizedPoint(u, v, width, height, marginX, marginY, orientation));
        }
      }

      const mainControl = mapNormalizedPoint(0.72, -0.22, width, height, marginX, marginY, orientation);
      const distControl = mapNormalizedPoint(0.72, 0.28, width, height, marginX, marginY, orientation);

      svgPathD = `M ${startPoint.x} ${startPoint.y} L ${splitPt.x} ${splitPt.y} Q ${mainControl.x} ${mainControl.y} ${endPoint.x} ${endPoint.y}`;
      distractorSvgPathD = `M ${splitPt.x} ${splitPt.y} Q ${distControl.x} ${distControl.y} ${distractorPoint.x} ${distractorPoint.y}`;
      distractorPoints = [];
      for (let i = 0; i <= 48; i++) {
        const t = i / 48;
        const inv = 1 - t;
        distractorPoints.push({
          x: inv * inv * splitPt.x + 2 * inv * t * distControl.x + t * t * distractorPoint.x,
          y: inv * inv * splitPt.y + 2 * inv * t * distControl.y + t * t * distractorPoint.y,
        });
      }
      break;
    }

    case 'dotted': {
      startPoint = mapNormalizedPoint(0, 0.05, width, height, marginX, marginY, orientation);
      endPoint = mapNormalizedPoint(1, 0.05, width, height, marginX, marginY, orientation);

      const frequency = 2;
      const amplitudeV = Math.min(0.3, 0.18 + tier * 0.02);

      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const u = t;
        const v = 0.05 + Math.sin(t * Math.PI * 2 * frequency) * amplitudeV;
        points.push(mapNormalizedPoint(u, v, width, height, marginX, marginY, orientation));
      }

      svgPathD = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        svgPathD += ` L ${points[i].x} ${points[i].y}`;
      }

      dashArray = '2 22';
      break;
    }

    case 'procedural_random': {
      const startU = Math.random() * 0.2;
      const startV = (Math.random() - 0.5) * 0.6;
      startPoint = mapNormalizedPoint(startU, startV, width, height, marginX, marginY, orientation);

      const endU = 0.8 + Math.random() * 0.2;
      const endV = (Math.random() - 0.5) * 0.6;
      endPoint = mapNormalizedPoint(endU, endV, width, height, marginX, marginY, orientation);

      const numControls = 2 + Math.floor(Math.random() * 3);
      const waypoints: PathPoint[] = [startPoint];

      for (let k = 1; k <= numControls; k++) {
        const frac = k / (numControls + 1);
        const u = startU + (endU - startU) * frac;
        const side = k % 2 === 0 ? 1 : -1;
        const v = (Math.random() * 0.35) * side;
        waypoints.push(mapNormalizedPoint(u, v, width, height, marginX, marginY, orientation));
      }
      waypoints.push(endPoint);

      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const pt = sampleCatmullRomChain(waypoints, t);
        points.push(pt);
      }

      svgPathD = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        svgPathD += ` L ${points[i].x} ${points[i].y}`;
      }
      break;
    }
  }

  // Calculate total arc length
  let totalLength = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    totalLength += Math.sqrt(dx * dx + dy * dy);
  }

  // Baseline time expectation (e.g. 50-100 px/sec average pursuit speed)
  const expectedSpeedPxPerSec = 100 - tier * 8;
  const baselineTimeSec = Math.max(3.5, Math.round(totalLength / expectedSpeedPxPerSec));

  return {
    pathType: type,
    difficultyTier: tier,
    points,
    svgPathD,
    startPoint,
    endPoint,
    distractorPoint,
    distractorSvgPathD,
    distractorPoints,
    dashArray,
    totalLength,
    baselineTimeSec,
    orientation,
  };
}


/**
 * Helper to sample Catmull-Rom spline chain connecting random control waypoints.
 */
function sampleCatmullRomChain(pts: PathPoint[], t: number): PathPoint {
  if (pts.length < 2) return pts[0] || { x: 0, y: 0 };
  const numSegments = pts.length - 1;
  const globalT = t * numSegments;
  const segment = Math.min(numSegments - 1, Math.floor(globalT));
  const u = globalT - segment;

  const p0 = pts[Math.max(0, segment - 1)];
  const p1 = pts[segment];
  const p2 = pts[Math.min(pts.length - 1, segment + 1)];
  const p3 = pts[Math.min(pts.length - 1, segment + 2)];

  const catmull = (v0: number, v1: number, v2: number, v3: number, s: number) => {
    return 0.5 * (
      2 * v1 +
      (-v0 + v2) * s +
      (2 * v0 - 5 * v1 + 4 * v2 - v3) * s * s +
      (-v0 + 3 * v1 - 3 * v2 + v3) * s * s * s
    );
  };

  return {
    x: catmull(p0.x, p1.x, p2.x, p3.x, u),
    y: catmull(p0.y, p1.y, p2.y, p3.y, u),
  };
}

/**
 * Finds the closest point on the target path to point `p`, returning the nearest point,
 * minimum distance, and nearest point index.
 */
export function findNearestPathPoint(
  p: PathPoint,
  pathPoints: PathPoint[]
): { nearestPoint: PathPoint; distance: number; index: number } {
  let minDistance = Infinity;
  let nearestPoint: PathPoint = pathPoints[0] || { x: 0, y: 0 };
  let nearestIndex = 0;

  for (let i = 0; i < pathPoints.length; i++) {
    const pt = pathPoints[i];
    const dx = pt.x - p.x;
    const dy = pt.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < minDistance) {
      minDistance = dist;
      nearestPoint = pt;
      nearestIndex = i;
    }
  }

  return { nearestPoint, distance: minDistance, index: nearestIndex };
}

/**
 * Finds the closest point on target path within a sequential progress window.
 * Enforces strict sequential traversal along spirals and complex paths, preventing shortcuts.
 */
export function findNearestPathPointInWindow(
  p: PathPoint,
  pathPoints: PathPoint[],
  currentIndex: number,
  lookaheadWindow: number = 35
): { nearestPoint: PathPoint; distance: number; index: number } {
  if (pathPoints.length === 0) {
    return { nearestPoint: { x: 0, y: 0 }, distance: Infinity, index: 0 };
  }

  const startIdx = Math.max(0, currentIndex - 15);
  const endIdx = Math.min(pathPoints.length - 1, currentIndex + lookaheadWindow);

  let minDistance = Infinity;
  let nearestPoint: PathPoint = pathPoints[currentIndex] || pathPoints[0];
  let nearestIndex = currentIndex;

  for (let i = startIdx; i <= endIdx; i++) {
    const pt = pathPoints[i];
    const dx = pt.x - p.x;
    const dy = pt.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < minDistance) {
      minDistance = dist;
      nearestPoint = pt;
      nearestIndex = i;
    }
  }

  return { nearestPoint, distance: minDistance, index: nearestIndex };
}

/**
 * Evaluates tracing accuracy, deviation count, and recovery time metrics.
 */
export function evaluateTracingMetrics(
  tracedPoints: PathPoint[],
  targetPoints: PathPoint[],
  toleranceBandPx: number,
  timestamps: number[] // timestamps corresponding to tracedPoints in ms
): {
  accuracyPercent: number;
  deviationCount: number;
  avgRecoveryTimeSec: number;
} {
  if (tracedPoints.length === 0 || targetPoints.length === 0) {
    return { accuracyPercent: 100, deviationCount: 0, avgRecoveryTimeSec: 0 };
  }

  let inBandCount = 0;
  let deviationCount = 0;
  let currentDeviationStartTime: number | null = null;
  const recoveryTimesMs: number[] = [];

  for (let i = 0; i < tracedPoints.length; i++) {
    const p = tracedPoints[i];
    const t = timestamps[i] || 0;
    const { distance } = findNearestPathPoint(p, targetPoints);

    if (distance <= toleranceBandPx) {
      inBandCount++;
      if (currentDeviationStartTime !== null) {
        // Recovered back into band
        const duration = t - currentDeviationStartTime;
        if (duration > 50) {
          recoveryTimesMs.push(duration);
        }
        currentDeviationStartTime = null;
      }
    } else {
      if (currentDeviationStartTime === null) {
        deviationCount++;
        currentDeviationStartTime = t;
      }
    }
  }

  const accuracyPercent = Math.min(
    100,
    Math.max(0, Math.round((inBandCount / tracedPoints.length) * 100))
  );

  const avgRecoveryMs =
    recoveryTimesMs.length > 0
      ? recoveryTimesMs.reduce((a, b) => a + b, 0) / recoveryTimesMs.length
      : 0;

  return {
    accuracyPercent,
    deviationCount,
    avgRecoveryTimeSec: Math.round((avgRecoveryMs / 1000) * 10) / 10,
  };
}
