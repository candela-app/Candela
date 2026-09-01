import { BeePathType, GameRegistryEntry, PursuitMovementPattern, TherapyFamilyId, TherapyModuleId } from './types';

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
    name: 'Crowded Search',
    description: 'Figure–ground visual search — find digits hidden in a crowded field of mixed letters.',
    supportedDevices: ['mobile', 'tablet', 'tv'],
    recommendedDevices: ['tablet', 'mobile'],
  },
  pattern_match: {
    id: 'pattern_match',
    name: 'Hold the Code',
    description:
      'Visual memory & code discrimination — hold a flashed code and tap every exact match in a near-miss field.',
    supportedDevices: ['mobile', 'tablet', 'tv'],
    recommendedDevices: ['tablet', 'mobile'],
  },
  location_memory: {
    id: 'location_memory',
    name: 'Location Memory',
    description:
      'Spatial number-location memory — explore a grid one cell at a time, then recall where each number was.',
    supportedDevices: ['mobile', 'tablet', 'tv'],
    recommendedDevices: ['tablet', 'mobile'],
  },
  direction_sense: {
    id: 'direction_sense',
    name: 'Direction Sense',
    description:
      'Spatial rotation — see a letter and a rotate arrow, then pick the matching 90° turn.',
    supportedDevices: ['mobile', 'tablet', 'tv'],
    recommendedDevices: ['tablet', 'mobile'],
  },
  computer_vision: {
    id: 'computer_vision',
    name: 'Look Pursuit',
    description:
      'Pursuit with look-to-select — track the bright target among dim decoys and pop it by looking.',
    supportedDevices: ['mobile', 'tablet', 'tv'],
    recommendedDevices: ['mobile', 'tablet'],
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
    { id: 'standard', name: 'Crowded Search' },
  ],
  pattern_match: [
    { id: 'standard', name: 'Standard' },
    { id: 'compound', name: 'Compound' },
  ],
  location_memory: [
    { id: 'practice', name: 'Practice' },
    { id: 'standard', name: 'Full Grid' },
    { id: 'match', name: 'Match Pairs' },
  ],
  direction_sense: [
    { id: 'face', name: 'Face' },
    { id: 'flip', name: 'Flip' },
    { id: 'straighten', name: 'Straighten' },
  ],
  computer_vision: [
    { id: 'linear_bounce', name: 'Linear Bounce' },
    { id: 'circular_orbit', name: 'Circular Orbit' },
    { id: 'figure_eight', name: 'Figure Eight' },
    { id: 'random_walk', name: 'Random Walk' },
    { id: 'freeze_drift', name: 'Freeze & Drift' },
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

export interface GameFamily {
  id: TherapyFamilyId;
  title: string;
  body: string;
  accent: string;
  bar: string;
  moduleIds: TherapyModuleId[];
}

/** Dashboard families — activities stay the existing games. */
export const GAME_FAMILIES: GameFamily[] = [
  {
    id: 'spin_field',
    title: 'Spin Field',
    body: 'Turning and sequential work on a field',
    accent: '#1D4ED8',
    bar: '#3B82F6',
    moduleIds: ['rotatory', 'sorting'],
  },
  {
    id: 'tap_timing',
    title: 'Tap Timing',
    body: 'Reach, tap, and react under motion',
    accent: '#059669',
    bar: '#34D399',
    moduleIds: ['mobile_target', 'pursuit', 'computer_vision'],
  },
  {
    id: 'look_jumps',
    title: 'Look Jumps',
    body: 'Find the next mark and land on it',
    accent: '#B45309',
    bar: '#F59E0B',
    moduleIds: ['number_search', 'peripheral_view'],
  },
  {
    id: 'glimpse_hold',
    title: 'Glimpse Hold',
    body: 'See it briefly, then use what you held',
    accent: '#BE123C',
    bar: '#FB7185',
    moduleIds: ['pattern_match', 'location_memory', 'direction_sense'],
  },
  {
    id: 'trace_build',
    title: 'Trace & Build',
    body: 'Follow a path or rebuild a form',
    accent: '#0D9488',
    bar: '#14B8A6',
    moduleIds: ['bee_tracing', 'geoboard'],
  },
];

export function isTherapyFamilyId(id: string): id is TherapyFamilyId {
  return GAME_FAMILIES.some((family) => family.id === id);
}

export function getGameFamily(id: string | null | undefined): GameFamily | undefined {
  if (!id) return undefined;
  return GAME_FAMILIES.find((family) => family.id === id);
}

export function familyForModuleId(moduleId: string): GameFamily | undefined {
  return GAME_FAMILIES.find((family) => family.moduleIds.includes(moduleId as TherapyModuleId));
}
