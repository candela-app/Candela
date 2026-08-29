import { DeviceTier } from './types';

/**
 * Handheld remaining-vision field rules.
 * Phone/tablet are not a scaled large-display layout: fewer marks, larger size, real gaps.
 */

export const HANDHELD_MARK_COUNT: Record<DeviceTier, number> = {
  mobile: 2,
  tablet: 3,
  tv: 5,
};

/** Fraction of the short screen side used as mark diameter. */
export const HANDHELD_MARK_FRACTION: Record<DeviceTier, number> = {
  mobile: 0.28,
  tablet: 0.22,
  tv: 0.14,
};

export const HANDHELD_MARK_MIN_PX: Record<DeviceTier, number> = {
  mobile: 120,
  tablet: 132,
  tv: 112,
};

export const HANDHELD_MARK_MAX_PX = 220;

/** Extra gap between mark edges, as % of the play container. */
export const HANDHELD_GAP_PERCENT: Record<DeviceTier, number> = {
  mobile: 10,
  tablet: 8,
  tv: 5,
};

/** Keep parent HUD off the play field (px). */
export const HANDHELD_CHROME_INSET_PX = {
  bottom: 72,
  right: 88,
  top: 12,
} as const;

export function handheldMarkCount(tier: DeviceTier): number {
  return HANDHELD_MARK_COUNT[tier];
}

export function handheldShortSidePx(width?: number, height?: number): number {
  const w = width ?? (typeof window !== 'undefined' ? window.innerWidth : 400);
  const h = height ?? (typeof window !== 'undefined' ? window.innerHeight : 700);
  return Math.max(1, Math.min(w, h));
}

export function handheldMarkSizePx(
  tier: DeviceTier,
  width?: number,
  height?: number,
): number {
  const short = handheldShortSidePx(width, height);
  const raw = Math.round(short * HANDHELD_MARK_FRACTION[tier]);
  return Math.max(HANDHELD_MARK_MIN_PX[tier], Math.min(HANDHELD_MARK_MAX_PX, raw));
}

export function handheldGapPercent(tier: DeviceTier): number {
  return HANDHELD_GAP_PERCENT[tier];
}
