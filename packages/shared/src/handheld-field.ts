import { DeviceTier } from './types';
import {
  BUBBLE_SIZE_PRESETS,
  PHONE_BUBBLE_SIZE_PX,
  TABLET_BUBBLE_SIZE_PX,
  clampBubbleSizeForTier,
  MOBILE_BUBBLE_SIZE_MAX_PX,
} from './constants';

/**
 * Handheld field packing: 4 marks on phone, 6 on tablet, using 60–120px chips.
 * Size is capped so those counts still fit the measured wheel.
 */

export const HANDHELD_MARK_COUNT: Record<DeviceTier, number> = {
  mobile: 4,
  tablet: 6,
  tv: 5,
};

/** Fraction of the short screen side used as mark diameter. */
export const HANDHELD_MARK_FRACTION: Record<DeviceTier, number> = {
  mobile: 0.22,
  tablet: 0.16,
  tv: 0.12,
};

export const HANDHELD_MARK_MIN_PX: Record<DeviceTier, number> = {
  mobile: 60,
  tablet: 80,
  tv: 80,
};

export const HANDHELD_MARK_MAX_PX = 120;

function markMaxPx(tier: DeviceTier): number {
  return tier === 'mobile' ? MOBILE_BUBBLE_SIZE_MAX_PX : HANDHELD_MARK_MAX_PX;
}

/** Extra gap between mark edges, as % of the play container. */
export const HANDHELD_GAP_PERCENT: Record<DeviceTier, number> = {
  mobile: 4,
  tablet: 4,
  tv: 4,
};

/** Keep parent HUD off the play field (px). */
export const HANDHELD_CHROME_INSET_PX = {
  bottom: 72,
  right: 88,
  top: 12,
} as const;

const DEFAULT_MARK_PX: Record<DeviceTier, number> = {
  mobile: PHONE_BUBBLE_SIZE_PX,
  tablet: TABLET_BUBBLE_SIZE_PX,
  tv: 120,
};

export function handheldMarkCount(tier: DeviceTier): number {
  return HANDHELD_MARK_COUNT[tier];
}

export function handheldShortSidePx(width?: number, height?: number): number {
  const w = width ?? (typeof window !== 'undefined' ? window.innerWidth : 400);
  const h = height ?? (typeof window !== 'undefined' ? window.innerHeight : 700);
  return Math.max(1, Math.min(w, h));
}

/**
 * Mark diameter for a circular play field.
 * Defaults to 80/100/120. If N marks cannot sit with a real gap, fit wins.
 */
export function handheldMarkSizeForContainer(options: {
  containerPx: number;
  count: number;
  tier: DeviceTier;
  requestedPx?: number;
}): number {
  const wheel = Math.max(1, options.containerPx);
  const n = Math.max(1, Math.round(options.count));
  const gapPx = (handheldGapPercent(options.tier) / 100) * wheel;
  const edgeInset = 8;
  const maxFit =
    n <= 1
      ? wheel - 2 * edgeInset
      : (wheel - 2 * edgeInset - (n - 1) * gapPx) / n;
  const cap = Math.max(24, Math.min(maxFit, markMaxPx(options.tier)));
  if (options.requestedPx != null && Number.isFinite(options.requestedPx)) {
    return clampBubbleSizeForTier(options.requestedPx, options.tier);
  }
  const target = DEFAULT_MARK_PX[options.tier];
  const allowed = BUBBLE_SIZE_PRESETS.filter((p) => p <= cap);
  if (!allowed.length) return Math.round(cap);
  return allowed.reduce((best, p) => (Math.abs(p - target) < Math.abs(best - target) ? p : best));
}

export function handheldMarkSizePx(
  tier: DeviceTier,
  width?: number,
  height?: number,
): number {
  const short = handheldShortSidePx(width, height);
  return handheldMarkSizeForContainer({
    containerPx: short,
    count: handheldMarkCount(tier),
    tier,
  });
}

export function handheldGapPercent(tier: DeviceTier): number {
  return HANDHELD_GAP_PERCENT[tier];
}
