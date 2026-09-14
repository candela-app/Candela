import { describe, expect, it } from 'vitest';
import {
  pursuitBodiesOverlap,
  pursuitSeparationPx,
  resolvePursuitDecoyCollisions,
  scatterPursuitPair,
  spawnPursuitDecoys,
  stepPursuitBody,
  type ElementState,
} from './pursuit-motion-logic';

function body(x: number, y: number, vx = 0, vy = 0): ElementState {
  return { x, y, vx, vy };
}

describe('pursuit collisions', () => {
  it('keeps a minimum gap between decoys after scatter', () => {
    const minDist = pursuitSeparationPx(80);
    const { a, b } = scatterPursuitPair(body(100, 100, 40, 0), body(110, 100, -40, 0), minDist, 80, 80);
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThanOrEqual(minDist - 0.01);
    expect(a.vx).toBeLessThan(0);
    expect(b.vx).toBeGreaterThan(0);
  });

  it('does not move a kinematic target when a decoy hits it', () => {
    const target = body(200, 200, 10, 0);
    const minDist = pursuitSeparationPx(60);
    const { a, b } = scatterPursuitPair(body(205, 200, 80, 0), target, minDist, 90, 90, true);
    expect(b.x).toBe(200);
    expect(b.y).toBe(200);
    expect(b.vx).toBe(10);
    expect(Math.hypot(a.x - target.x, a.y - target.y)).toBeGreaterThanOrEqual(minDist - 0.01);
  });

  it('unsticks a stacked trio of decoys', () => {
    const size = 70;
    const minDist = pursuitSeparationPx(size);
    const resolved = resolvePursuitDecoyCollisions(
      [body(300, 300), body(302, 301), body(301, 303)],
      null,
      size,
      100,
    );
    expect(resolved).toHaveLength(3);
    for (let i = 0; i < resolved.length; i += 1) {
      for (let j = i + 1; j < resolved.length; j += 1) {
        expect(pursuitBodiesOverlap(resolved[i], resolved[j], minDist)).toBe(false);
      }
    }
  });

  it('bounces a decoy off the wall instead of leaving the field', () => {
    const stepped = stepPursuitBody(body(40, 200, -120, 0), 0.2, 400, 400, 80, 120);
    expect(stepped.x).toBeGreaterThanOrEqual(40);
    expect(stepped.vx).toBeGreaterThan(0);
  });

  it('spawns decoys without overlapping disks', () => {
    const size = 90;
    const minDist = pursuitSeparationPx(size);
    const decoys = spawnPursuitDecoys(3, 'linear_bounce', 900, 700, size, 110, 12, 'landscape', 'desktop');
    expect(decoys).toHaveLength(3);
    for (let i = 0; i < decoys.length; i += 1) {
      for (let j = i + 1; j < decoys.length; j += 1) {
        expect(pursuitBodiesOverlap(decoys[i], decoys[j], minDist)).toBe(false);
      }
    }
  });
});
