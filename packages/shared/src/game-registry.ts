import { BeePathType, GameRegistryEntry, PursuitMovementPattern, TherapyModuleId } from './types';

/**
 * Shared central registry/catalog of games in the Candela vision therapy platform.
 */
export const GAME_CATALOG: Record<TherapyModuleId, GameRegistryEntry> = {
  rotatory: {
    id: 'rotatory',
    name: 'Rotatory Wheel',
    description: 'Dynamic wheel tracking & visual pursuit exercises with rotating targets.',
    supportedDevices: ['mobile', 'tablet', 'tv'],
    recommendedDevices: ['tablet', 'tv'],
  },
  sorting: {
    id: 'sorting',
    name: 'Sorting Module',
    description: 'Visual discrimination & sequential recognition exercises.',
    supportedDevices: ['mobile', 'tablet', 'tv'],
    recommendedDevices: ['mobile'],
  },
  bee_tracing: {
    id: 'bee_tracing',
    name: 'Bee Path Tracing',
    description: 'Smooth pursuit tracking & visual-motor path control.',
    supportedDevices: ['mobile', 'tablet', 'tv'],
    recommendedDevices: ['mobile'],
  },
  pursuit: {
    id: 'pursuit',
    name: 'Pursuit Module',
    description: 'Continuous visual pursuit and selective attention under motion with moving target & decoys.',
    supportedDevices: ['mobile', 'tablet', 'tv'],
    recommendedDevices: ['mobile'],
  },
  mobile_target: {
    id: 'mobile_target',
    name: 'Mobile Target Bouncing Pursuit',
    description: 'Standalone mobile-optimized 2-target bouncing pursuit with high contrast dark backdrop and set timers.',
    supportedDevices: ['mobile', 'tablet', 'tv'],
    recommendedDevices: ['mobile', 'tablet'],
  },
  geoboard: {
    id: 'geoboard',
    name: 'Draw a Pattern',
    description: 'Digitized Bernell/OEPF pattern reproduction exercise to train hand-eye coordination and spatial memory.',
    supportedDevices: ['mobile', 'tablet', 'tv'],
    recommendedDevices: ['mobile', 'tablet'],
  },
  peripheral_view: {
    id: 'peripheral_view',
    name: 'Peripheral View',
    description: 'Hex-hive peripheral field awareness — pop A–Z stimuli on left, right, or both sides.',
    supportedDevices: ['mobile', 'tablet', 'tv'],
    recommendedDevices: ['tablet', 'tv'],
  },
  number_search: {
    id: 'number_search',
    name: 'Number Search',
    description: 'Figure–ground visual search — find digits hidden in a crowded field of mixed letters.',
    supportedDevices: ['mobile', 'tablet', 'tv'],
    recommendedDevices: ['tablet', 'mobile'],
  },
};

export const ALL_MODULE_IDS: TherapyModuleId[] = Object.keys(GAME_CATALOG) as TherapyModuleId[];

export function getGameCatalogEntry(id: string): GameRegistryEntry | undefined {
  return GAME_CATALOG[id as TherapyModuleId];
}

export function isTherapyModuleId(id: string): id is TherapyModuleId {
  return id in GAME_CATALOG;
}

export interface GameLevelDef {
  id: string;
  name: string;
}

export const MODULE_LEVELS: Record<TherapyModuleId, GameLevelDef[]> = {
  rotatory: [
    { id: 'uppercase', name: 'Uppercase Rotatory' },
    { id: 'lowercase', name: 'Lowercase Rotatory' },
    { id: 'numbers', name: 'Numeric Rotatory' },
    { id: 'colors', name: 'Color Discriminant' },
  ],
  sorting: [
    { id: 'uppercase', name: 'Uppercase Alphabet Sorting' },
    { id: 'lowercase', name: 'Lowercase Alphabet Sorting' },
    { id: 'numbers', name: 'Numeric Sorting' },
  ],
  bee_tracing: [
    { id: 'straight', name: 'Straight Line' },
    { id: 'curve', name: 'Gentle Curve' },
    { id: 'zigzag', name: 'Zigzag Shifts' },
    { id: 'wave', name: 'S-Curve Wave' },
    { id: 'spiral', name: 'Spiral Pursuit' },
    { id: 'branching', name: 'Branching Path' },
    { id: 'dotted', name: 'Dotted Gap Fill' },
    { id: 'auto', name: 'Auto Progress' },
    { id: 'procedural_random', name: 'Dynamic Path' },
    { id: 'random', name: 'Random Preset Path' },
  ],
  pursuit: [
    { id: 'linear_bounce', name: 'Linear Bounce' },
    { id: 'circular_orbit', name: 'Circular Orbit' },
    { id: 'figure_eight', name: 'Figure Eight' },
    { id: 'random_walk', name: 'Random Walk' },
    { id: 'freeze_drift', name: 'Freeze & Drift' },
  ],
  mobile_target: [
    { id: 'uppercase', name: 'Uppercase Bubble Chase' },
    { id: 'lowercase', name: 'Lowercase Bubble Chase' },
    { id: 'numbers', name: 'Numeric Bubble Chase' },
    { id: 'colors', name: 'Color Discriminant Bubble Chase' },
  ],
  geoboard: [
    { id: '6', name: 'Stand and Steep' },
    { id: '1', name: 'Simple Lines' },
    { id: '2', name: 'Alphabets' },
    { id: '3', name: 'Geometric Shapes' },
    { id: '4', name: 'Numbers' },
    { id: '5', name: 'Compound Figures' },
  ],
  peripheral_view: [
    { id: 'left', name: 'Left Field' },
    { id: 'right', name: 'Right Field' },
    { id: 'both', name: 'Both Fields' },
  ],
  number_search: [
    { id: 'standard', name: 'Find the Numbers' },
  ],
};

export function resolveBeePathType(value?: string | null): BeePathType | 'auto' {
  const known = MODULE_LEVELS.bee_tracing.map((level) => level.id);
  if (value && known.includes(value)) return value as BeePathType | 'auto';
  return 'straight';
}

export function resolvePursuitPattern(value?: string | null): PursuitMovementPattern {
  const known = MODULE_LEVELS.pursuit.map((level) => level.id);
  if (value && known.includes(value)) return value as PursuitMovementPattern;
  return 'linear_bounce';
}

export function pursuitPatternName(pattern: PursuitMovementPattern): string {
  return MODULE_LEVELS.pursuit.find((level) => level.id === pattern)?.name ?? 'Linear Bounce';
}
