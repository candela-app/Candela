import { GameRegistryEntry } from './types';

/**
 * Shared central registry/catalog of games in the Candela vision therapy platform.
 */
export const GAME_CATALOG: Record<string, GameRegistryEntry> = {
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
};

/**
 * Helper to get catalog entry for a specific game id.
 */
export function getGameCatalogEntry(id: string): GameRegistryEntry | undefined {
  return GAME_CATALOG[id];
}
