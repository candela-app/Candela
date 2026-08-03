import { BeePathType, PathComplexity, PathPoint } from './types';

export interface GeneratedPath {
  pathType: BeePathType;
  difficultyTier: number;
  points: PathPoint[];
  svgPathD: string;
  startPoint: PathPoint;
  endPoint: PathPoint;
  distractorPoint?: PathPoint;
  distractorSvgPathD?: string;
  dashArray?: string;
  totalLength: number;
  baselineTimeSec: number;
}

export function generateBeePath(
  type: BeePathType,
  width: number,
  height: number,
  tier: number = 1,
  complexity: PathComplexity = 'medium'
): GeneratedPath {
  const complexityMult = complexity === 'short' ? 0.75 : complexity === 'long' ? 1.35 : 1.0;
  const marginX = Math.max(45, (width * 0.12) / complexityMult);
  const marginY = Math.max(45, (height * 0.12) / complexityMult);
  const usableWidth = width - marginX * 2;
  const usableHeight = height - marginY * 2;

  let points: PathPoint[] = [];
  let svgPathD = '';
  let startPoint: PathPoint = { x: marginX, y: height / 2 };
  let endPoint: PathPoint = { x: width - marginX, y: height / 2 };
  let distractorPoint: PathPoint | undefined = undefined;
  let distractorSvgPathD: string | undefined = undefined;
  let dashArray: string | undefined = undefined;

  const samples = Math.floor((150 + tier * 25) * complexityMult);

  let effectiveType = type;
  if (type === 'random') {
    const pool: BeePathType[] = ['straight', 'curve', 'zigzag', 'wave', 'spiral', 'branching', 'dotted'];
    effectiveType = pool[Math.floor(Math.random() * pool.length)];
  }

  switch (effectiveType) {
    case 'straight': {
      // Horizontal or slightly diagonal line based on tier
      const isDiagonal = tier > 2;
      const startY = isDiagonal ? marginY + 40 : height / 2;
      const endY = isDiagonal ? height - marginY - 40 : height / 2;

      startPoint = { x: marginX, y: startY };
      endPoint = { x: width - marginX, y: endY };

      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        points.push({
          x: startPoint.x + t * (endPoint.x - startPoint.x),
          y: startPoint.y + t * (endPoint.y - startPoint.y),
        });
      }
      svgPathD = `M ${startPoint.x} ${startPoint.y} L ${endPoint.x} ${endPoint.y}`;
      break;
    }

    case 'curve': {
      // Arc / quadratic curve
      startPoint = { x: marginX, y: height * 0.65 };
      endPoint = { x: width - marginX, y: height * 0.65 };
      const controlY = height * 0.15 - tier * 15;
      const controlX = width / 2;

      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const invT = 1 - t;
        const x = invT * invT * startPoint.x + 2 * invT * t * controlX + t * t * endPoint.x;
        const y = invT * invT * startPoint.y + 2 * invT * t * controlY + t * t * endPoint.y;
        points.push({ x, y });
      }
      svgPathD = `M ${startPoint.x} ${startPoint.y} Q ${controlX} ${controlY} ${endPoint.x} ${endPoint.y}`;
      break;
    }

    case 'zigzag': {
      // Sharp direction changes
      startPoint = { x: marginX, y: height / 2 };
      endPoint = { x: width - marginX, y: height / 2 };

      const numPeaks = 3 + Math.min(4, tier);
      const keyPoints: PathPoint[] = [startPoint];
      const segmentWidth = (endPoint.x - startPoint.x) / numPeaks;
      const amplitude = Math.min(usableHeight * 0.38, 120 + tier * 20);

      for (let k = 1; k < numPeaks; k++) {
        const dir = k % 2 === 1 ? -1 : 1;
        keyPoints.push({
          x: startPoint.x + k * segmentWidth,
          y: height / 2 + dir * amplitude,
        });
      }
      keyPoints.push(endPoint);

      svgPathD = `M ${keyPoints[0].x} ${keyPoints[0].y}`;
      for (let k = 1; k < keyPoints.length; k++) {
        svgPathD += ` L ${keyPoints[k].x} ${keyPoints[k].y}`;
      }

      // Sample along zigzag segments
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
      // S-curve / sine wave smooth pursuit
      startPoint = { x: marginX, y: height / 2 };
      endPoint = { x: width - marginX, y: height / 2 };

      const frequency = 1.5 + tier * 0.5; // Sine cycles
      const amplitude = Math.min(usableHeight * 0.35, 100 + tier * 15);

      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const x = startPoint.x + t * (endPoint.x - startPoint.x);
        const y = height / 2 + Math.sin(t * Math.PI * 2 * frequency) * amplitude;
        points.push({ x, y });
      }

      svgPathD = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i += 2) {
        svgPathD += ` L ${points[i].x} ${points[i].y}`;
      }
      break;
    }

    case 'spiral': {
      // Archimedean spiral starting center-left and spiraling towards end target
      const centerX = width * 0.48;
      const centerY = height / 2;
      const maxRadius = Math.min(usableWidth, usableHeight) * 0.38;
      const turns = 1.8 + tier * 0.3;

      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const angle = t * Math.PI * 2 * turns;
        const r = t * maxRadius;
        const x = centerX + r * Math.cos(angle);
        const y = centerY + r * Math.sin(angle);
        points.push({ x, y });
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
      // Path splits into main target and distractor flower
      startPoint = { x: marginX, y: height / 2 };
      const splitX = startPoint.x + usableWidth * 0.45;
      const splitY = height / 2;

      endPoint = { x: width - marginX, y: height * 0.3 };
      distractorPoint = { x: width - marginX, y: height * 0.7 };

      // Generate points for main path
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        if (t <= 0.45) {
          const tSub = t / 0.45;
          points.push({
            x: startPoint.x + tSub * (splitX - startPoint.x),
            y: startPoint.y,
          });
        } else {
          const tSub = (t - 0.45) / 0.55;
          // Smooth curve to upper flower
          const x = splitX + tSub * (endPoint.x - splitX);
          const y = splitY + (endPoint.y - splitY) * Math.sin((tSub * Math.PI) / 2);
          points.push({ x, y });
        }
      }

      // True path SVG
      svgPathD = `M ${startPoint.x} ${startPoint.y} L ${splitX} ${splitY} Q ${splitX + 60} ${splitY} ${endPoint.x} ${endPoint.y}`;

      // Distractor path SVG (fades or branches down)
      distractorSvgPathD = `M ${splitX} ${splitY} Q ${splitX + 60} ${splitY} ${distractorPoint.x} ${distractorPoint.y}`;
      break;
    }

    case 'dotted': {
      // Dotted/Intermittent path (gap filling predictive tracking)
      startPoint = { x: marginX, y: height * 0.55 };
      endPoint = { x: width - marginX, y: height * 0.55 };

      const frequency = 2;
      const amplitude = Math.min(usableHeight * 0.3, 90);

      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const x = startPoint.x + t * (endPoint.x - startPoint.x);
        const y = startPoint.y + Math.sin(t * Math.PI * 2 * frequency) * amplitude;
        points.push({ x, y });
      }

      svgPathD = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        svgPathD += ` L ${points[i].x} ${points[i].y}`;
      }

      dashArray = '16 20';
      break;
    }

    case 'procedural_random': {
      // 1. Pick random start Hive position anywhere on screen (with safe margin)
      const startX = marginX + Math.random() * (usableWidth * 0.35);
      const startY = marginY + Math.random() * usableHeight;
      startPoint = { x: startX, y: startY };

      // 2. Pick random end Flower position at least 45% of screen size away
      let endX = marginX + (0.5 + Math.random() * 0.5) * usableWidth;
      let endY = marginY + Math.random() * usableHeight;
      const minDistance = Math.hypot(width, height) * 0.45;

      let retries = 0;
      while (Math.hypot(endX - startX, endY - startY) < minDistance && retries < 20) {
        endX = marginX + Math.random() * usableWidth;
        endY = marginY + Math.random() * usableHeight;
        retries++;
      }
      endPoint = { x: endX, y: endY };

      // 3. Generate 2-4 random control waypoints between start and end
      const numControls = 2 + Math.floor(Math.random() * 3);
      const waypoints: PathPoint[] = [startPoint];

      const dx = endPoint.x - startPoint.x;
      const dy = endPoint.y - startPoint.y;
      const totalDist = Math.hypot(dx, dy);
      const mainAngle = Math.atan2(dy, dx);

      for (let k = 1; k <= numControls; k++) {
        const frac = k / (numControls + 1);
        const basePointX = startPoint.x + dx * frac;
        const basePointY = startPoint.y + dy * frac;

        // Offset perpendicular to main vector direction
        const side = k % 2 === 0 ? 1 : -1;
        const perpAngle = mainAngle + (side * Math.PI) / 2;
        const offsetDist = (0.2 + Math.random() * 0.35) * (totalDist / 2);

        const rawWpX = basePointX + Math.cos(perpAngle) * offsetDist;
        const rawWpY = basePointY + Math.sin(perpAngle) * offsetDist;

        const wpX = Math.max(marginX, Math.min(width - marginX, rawWpX));
        const wpY = Math.max(marginY, Math.min(height - marginY, rawWpY));
        waypoints.push({ x: wpX, y: wpY });
      }
      waypoints.push(endPoint);

      // 4. Sample smooth Catmull-Rom spline curve points
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
    dashArray,
    totalLength,
    baselineTimeSec,
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
