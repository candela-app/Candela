import { ColorItem } from './types';

// TODO: device-config — lift hardcoded colors to device configuration system in future refactor
export const BRIGHT_COLORS: ColorItem[] = [
  { name: 'Red', code: '#FF1E1E' },
  { name: 'Blue', code: '#0084FF' },
  { name: 'Green', code: '#00D26A' },
  { name: 'Yellow', code: '#FFD600' },
];

// Bright, high-contrast, vision-therapy friendly colors
export const THERAPY_COLORS: string[] = [
  '#FFD600', // Bright Yellow
  '#00B0FF', // Vivid Sky Blue
  '#FF3D00', // Vivid Coral Red
  '#00E676', // Vivid Emerald Green
  '#9C27B0', // Vivid Purple
  '#FF9100', // Vibrant Amber Orange
  '#FF4081', // Vivid Hot Pink
];

export const ALPHABETS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const NUMBERS = '0123456789';

// Speed presets (0.5, 1, 1.25, 1.5, 2)
export const SPEED_PRESETS = [0.5, 1, 1.25, 1.5, 2];

export const DEFAULT_BUBBLE_COUNT = 12;
export const DEFAULT_BASE_ANIMATION_DURATION = 25; // seconds for 1x speed
