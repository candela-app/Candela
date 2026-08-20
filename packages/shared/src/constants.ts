import { ColorItem, DeviceTier } from './types';

export const BUBBLES_PER_ROUND: Record<DeviceTier, number> = {
  mobile: 4,
  tablet: 5,
  tv: 10,
};

// TODO: device-config — lift hardcoded colors to device configuration system in future refactor
export const BRIGHT_COLORS: ColorItem[] = [
  { name: 'Red', code: '#FF1E1E' },
  { name: 'Blue', code: '#0084FF' },
  { name: 'Green', code: '#00D26A' },
  { name: 'Yellow', code: '#FFD600' },
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

export const ALPHABETS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const NUMBERS = '0123456789';

// Speed presets (0.5, 1, 1.25, 1.5, 2)
export const SPEED_PRESETS = [0.5, 1, 1.25, 1.5, 2];

export const DEFAULT_BUBBLE_COUNT = 12;
export const DEFAULT_BASE_ANIMATION_DURATION = 25; // seconds for 1x speed
