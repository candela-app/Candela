/**
 * Pediatric Sound-Based Wind Chime Types & Clinical Analytics
 * Self-contained module for sensory processing, motor regulation, and auditory engagement.
 */

export type ChimeScalePreset = 'koshi_aria' | 'koshi_terra' | 'pentatonic_major' | 'zen_solfeggio';

export type SensoryTheme = 'garden' | 'twilight' | 'warm_sunset' | 'high_contrast';

export type TouchSensitivity = 'gentle' | 'normal' | 'firm';

export type InteractionMode = 'hybrid' | 'direct_only' | 'sail_only';

export interface WindChimeSettings {
  scalePreset: ChimeScalePreset;
  decayDurationSec: number;
  stereoPanning: boolean;
  touchSensitivity: TouchSensitivity;
  chimeScale: number; // 0.8 - 1.4 scale factor
  visualRipple: boolean;
  sensoryTheme: SensoryTheme;
  ambientBreeze: number; // 0 = still, 0.3 = gentle, 0.7 = active
  sessionDurationSec: number; // 60, 120, 300, or 0 (free play)
}

export const DEFAULT_WIND_CHIME_SETTINGS: WindChimeSettings = {
  scalePreset: 'koshi_aria',
  decayDurationSec: 3.2,
  stereoPanning: true,
  touchSensitivity: 'normal',
  chimeScale: 1.0,
  visualRipple: true,
  sensoryTheme: 'garden',
  ambientBreeze: 0.25,
  sessionDurationSec: 120, // 2 minutes default clinical set
};

export interface ChimeStrikeEvent {
  timestampMs: number;
  tubeIndex: number; // 0..5, or -1 for clapper/sail drag
  frequencyHz: number;
  noteName: string;
  velocityPxPerSec: number;
  forceCategory: 'gentle' | 'moderate' | 'heavy';
  lateralPosition: 'left' | 'center' | 'right';
  source: 'direct_touch' | 'clapper_strike' | 'ambient_wind';
}

export interface CadenceWindow {
  windowStartSec: number;
  windowEndSec: number;
  strikeCount: number;
  paceBpm: number;
}

export interface ChimeSessionAnalytics {
  totalStrikes: number;
  directStrikes: number;
  clapperStrikes: number;
  ambientStrikes: number;
  
  // Spatial / Midline
  leftStrikes: number;
  centerStrikes: number;
  rightStrikes: number;
  lateralSymmetryPercent: number; // 50 = perfect symmetry, 0-100
  
  // Motor Force Grading
  gentleCount: number;
  moderateCount: number;
  heavyCount: number;
  forceModulationGrade: 'well_graded' | 'predominantly_gentle' | 'predominantly_heavy';
  
  // Auditory & Pacing
  averageListeningDwellSec: number;
  longestListeningPauseSec: number;
  sensoryCalmingIndex: number; // 0..100 (percentage of regulation)
  
  // Cadence curve points over time (for graph)
  cadenceTimeline: CadenceWindow[];
  
  // Pediatric clinical badge
  badge: {
    title: string;
    description: string;
    emoji: string;
  };
}
