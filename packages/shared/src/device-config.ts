import { DeviceOrientation, ScreenOrientation, DeviceTier } from './types';

/**
 * Resolves effective screen orientation based on requested setting, container dimensions, and optional device tier.
 *
 * Rules:
 * - If tier is 'tv' or requested is 'landscape', returns 'landscape'.
 * - If requested is 'portrait', returns 'portrait'.
 * - If requested is 'auto', dynamic detection via container width vs height:
 *   width >= height => 'landscape', width < height => 'portrait'.
 */
export function resolveOrientation(
  requested: DeviceOrientation = 'auto',
  width: number = 1024,
  height: number = 768,
  tier?: DeviceTier
): ScreenOrientation {
  if (tier === 'tv') {
    return 'landscape';
  }
  if (requested === 'landscape') {
    return 'landscape';
  }
  if (requested === 'portrait') {
    return 'portrait';
  }
  // Auto dynamic container detection
  return width >= height ? 'landscape' : 'portrait';
}
