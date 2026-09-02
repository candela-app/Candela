import { ColorItem, DeviceTier } from './types';

export const BUBBLES_PER_ROUND: Record<DeviceTier, number> = {
  mobile: 4,
  tablet: 4,
  tv: 5,
};

// TODO: device-config — lift hardcoded colors to device configuration system in future refactor
export const BRIGHT_COLORS: ColorItem[] = [
  { name: 'Yellow', code: '#FFD600' },
  { name: 'Cyan', code: '#00E5FF' },
  { name: 'White', code: '#FFFFFF' },
  { name: 'Orange', code: '#FF9100' },
];

// Kid-friendly names for color-discriminant games: high luminance, wide hue spacing.
export const THERAPY_COLOR_ITEMS: ColorItem[] = [
  { name: 'Yellow', code: '#FFD600' },
  { name: 'Light Blue', code: '#00F0FF' },
  { name: 'Red', code: '#FF3D00' },
  { name: 'Green', code: '#00E676' },
  { name: 'Pink', code: '#FF2E93' },
  { name: 'Blue', code: '#2979FF' },
  { name: 'Orange', code: '#FF9100' },
  { name: 'Purple', code: '#D500F9' },
];

export const THERAPY_COLORS: string[] = THERAPY_COLOR_ITEMS.map((item) => item.code);

/**
 * Bubble fill for letter/number games (not color-discrimination).
 * `mixed` cycles therapy-grade colors; otherwise a single hex (White default).
 */
export const STIMULI_COLOR_MIXED = 'mixed';
export const DEFAULT_STIMULI_BUBBLE_COLOR = '#FFFFFF';
export const STIMULI_BUBBLE_COLOR_OPTIONS: ColorItem[] = [
  { name: 'White', code: '#FFFFFF' },
  ...THERAPY_COLOR_ITEMS,
];

export const ALPHABETS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const NUMBERS = '0123456789';

// Speed presets (0.5, 1, 1.25, 1.5, 2)
export const SPEED_PRESETS = [0.5, 1, 1.25, 1.5, 2];

export const DEFAULT_BUBBLE_COUNT = 12;
export const DEFAULT_BASE_ANIMATION_DURATION = 25; // seconds for 1x speed

export const DEFAULT_SORTING_NUMBER_FROM = 1;
export const DEFAULT_SORTING_NUMBER_TO = 20;
export const MAX_SORTING_NUMBER_COUNT = 20;

export const SORTING_BATCH_SIZE: Record<DeviceTier, number> = {
  mobile: 2,
  tablet: 3,
  tv: 5,
};

/** Phone bubble diameter (rotatory). Tablet / TV / desktop uses TABLET_BUBBLE_SIZE_PX. */
export const PHONE_BUBBLE_SIZE_PX = 120;
export const TABLET_BUBBLE_SIZE_PX = 140;
export const PHONE_SORTING_BUBBLE_SIZE_PX = 128;
export const BUBBLE_SIZE_PRESETS = [100, 120, 140, 180, 220];

/** Preset wheel backgrounds for rotatory / sorting clinical settings. */
export const WHEEL_COLOR_PRESETS: ColorItem[] = [
  { name: 'Ink', code: '#0B0F14' },
  { name: 'Black', code: '#000000' },
  { name: 'Midnight', code: '#0B1B3A' },
  { name: 'Charcoal', code: '#1A1A1A' },
  { name: 'Slate', code: '#111827' },
  { name: 'Paper', code: '#F8FAFC' },
];

export function wheelColorLabel(hex: string | undefined): string {
  if (!hex) return 'Black';
  const match = WHEEL_COLOR_PRESETS.find((c) => c.code.toLowerCase() === hex.toLowerCase());
  return match?.name ?? hex;
}

export const DEFAULT_BEE_TARGET_DOT_COLOR = '#E56B9A';
export const BEE_TARGET_DOT_COLORS: ColorItem[] = [
  { name: 'Pink', code: '#E56B9A' },
  { name: 'Rose', code: '#F43F5E' },
  { name: 'Yellow', code: '#FBBF24' },
  { name: 'Cyan', code: '#22D3EE' },
  { name: 'White', code: '#F8FAFC' },
  { name: 'Lime', code: '#84CC16' },
];
