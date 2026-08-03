export type GameMode = 'alphabets' | 'numbers' | 'colors';
export type DeviceTier = 'mobile' | 'tablet' | 'tv';

export type AlphabetVariant = 'uppercase' | 'lowercase';
export type SortingVariant = 'uppercase' | 'lowercase' | 'numbers';

export interface ColorItem {
  name: string;
  code: string;
}

export interface BubblePosition {
  x: number;
  y: number;
}

export interface BubbleItem {
  id: string;
  symbol: string;
  color?: string;
  colorName?: string;
  x: number;
  y: number;
}

export interface ClinicalStats {
  bubblesAppeared: number;
  clicks: number;
  correct: number;
  wrong: number;
  startTime: number | null;
  endTime: number | null;
  reactionTimes: number[];
  targetShownAt: number | null;
}

export interface SessionResultData {
  patientName: string;
  sessionId: number;
  date: string;
  gameName: string;
  stimuliCount: number;
  letterSize: number;
  speed: string;
  durationSec: number;
  clicksTotal: number;
  correct: number;
  wrong: number;
  accuracy: number;
  avgReactionSec: number;
}

export interface RotatoryWheelSettings {
  bubbleCount: number;
  rotationDuration: number;
  bubbleSizePx: number;
  letterSize: number;
  patientName: string;
  wheelColor: string;
  therapyColors: string[];
}

export interface SortingGameSettings {
  letterSize: number;
  bubbleSizePx: number;
  patientName: string;
}

// --- Bee Path Tracing Module Types ---
export type TracingMode = 'active' | 'guided';
export type BeePathType = 'straight' | 'curve' | 'zigzag' | 'wave' | 'spiral' | 'branching' | 'dotted' | 'random' | 'procedural_random';
export type ColorTheme = 'standard' | 'high_contrast' | 'dark';
export type InputSensitivity = 'touch' | 'mouse' | 'auto';
export type PathComplexity = 'short' | 'medium' | 'long';

export interface PathPoint {
  x: number;
  y: number;
}

export interface BeeTracingSettings {
  patientName: string;
  tracingMode: TracingMode;
  pathType: BeePathType | 'auto';
  toleranceBandPx: number; // corridor width (e.g. 60 easy, 40 medium, 24 hard)
  beeSpeedSec: number; // duration for demo in guided mode (e.g. 6s slow, 4s normal, 2.5s fast)
  pathComplexity: PathComplexity; // short/baseline, medium/extended, long/complex
  colorTheme: ColorTheme;
  audioEnabled: boolean;
  inputSensitivity: InputSensitivity;
  roundsPerSet: number; // session length: 3, 5, 7 rounds
}

export interface RoundResultData {
  roundNumber: number;
  pathType: BeePathType;
  difficultyTier: number;
  accuracyPercent: number;
  completionTimeSec: number;
  baselineTimeSec: number;
  deviationCount: number;
  avgRecoveryTimeSec: number;
  tracedPoints: PathPoint[];
  targetPoints: PathPoint[];
  idealSvgPathD: string;
}

export interface BeeSessionResultData extends SessionResultData {
  pathType: string;
  tracingMode: string;
  colorTheme: string;
  toleranceBandPx: number;
  deviationCount: number;
  avgRecoveryTimeSec: number;
  roundsCompleted: number;
  roundResults: RoundResultData[];
}

