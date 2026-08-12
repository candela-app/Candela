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
export type DeviceOrientation = 'landscape' | 'portrait' | 'auto';
export type ScreenOrientation = 'landscape' | 'portrait';

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
  orientation?: DeviceOrientation;
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
  orientation?: ScreenOrientation;
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
  horizontalAccuracyPercent?: number;
  verticalAccuracyPercent?: number;
}

// --- Shared Game Catalog / Registry Types ---
export interface GameRegistryEntry {
  id: string;
  name: string;
  description: string;
  supportedDevices: DeviceTier[];
  recommendedDevices: DeviceTier[];
}

// --- Pursuit Module Types ---
export type PursuitMovementPattern =
  | 'linear_bounce'
  | 'circular_orbit'
  | 'figure_eight'
  | 'random_walk'
  | 'freeze_drift';

export type PursuitTargetColor = '#FFFFFF' | '#FFD600' | '#00E5FF';

export interface PursuitSettings {
  patientName: string;
  movementPattern: PursuitMovementPattern;
  bubbleSizePx: number; // e.g. 60-120px
  targetColor: PursuitTargetColor;
  decoyCount: number; // 1 to 3 decoys (max 4 total elements on screen)
  decoySalience: number; // 0.2 to 0.6 opacity/saturation fraction
  speedPxPerSec: number; // e.g. 100-300 px/s
  trialTimeoutSec: number; // 4 to 6 seconds per trial
  totalTrials: number; // 20 trials total
  blocksCount: number; // 4 blocks of 5
  orientation?: DeviceOrientation;
}

export interface PursuitTrialMetric {
  trialIndex: number; // 0..19
  blockIndex: number; // 0..3
  outcome: 'correct' | 'incorrect' | 'timeout'; // timeout = miss
  reactionTimeMs: number; // ms to tap
  trackingErrorPx: number; // distance in px between tap and target center
  anticipationRatio: number; // >0 anticipation (leading), <0 lag (trailing)
  targetPositionAtTap: { x: number; y: number };
  tapPosition: { x: number; y: number };
}

export interface PursuitBlockMetric {
  blockIndex: number;
  accuracyPercent: number;
  avgTrackingErrorPx: number;
  avgReactionTimeMs: number;
  trials: PursuitTrialMetric[];
}

export interface PursuitSessionResultData extends SessionResultData {
  movementPattern: PursuitMovementPattern;
  decoyCount: number;
  speedPxPerSec: number;
  avgTrackingErrorPx: number;
  anticipationVsLagScore: string; // e.g. "Optimal Leading (65% Anticipation)" or "Trailing Lag"
  blockMetrics: PursuitBlockMetric[];
  starRating: number; // 1 to 5 stars for child card
}

// --- Mobile Bouncing 2-Target Pursuit Module Types ---
export interface MobileTargetSettings {
  patientName: string;
  gameMode: GameMode;
  alphabetVariant?: AlphabetVariant;
  speedPxPerSec: number;
  setDurationSec: number;
  totalSets: number;
  bubbleSize?: number; // bubble size in px (e.g. 60-130px)
  letterSize?: number; // font size in px (e.g. 18-48px)
  movementAxis?: 'horizontal' | 'vertical' | 'random';
  hasBackground?: boolean; // true = filled bubble background, false = outline / no background
}

export interface MobileTargetSetMetric {
  setIndex: number;
  targetValue: string;
  targetColor?: string;
  distractorValue: string;
  distractorColor?: string;
  outcome: 'correct' | 'incorrect' | 'timeout';
  reactionTimeMs: number;
  wrongClicksCount: number;
}

export interface MobileTargetSessionResultData extends SessionResultData {
  gameMode: GameMode;
  speedPxPerSec: number;
  setDurationSec: number;
  totalSets: number;
  timeoutCount: number;
  setMetrics: MobileTargetSetMetric[];
  starRating: number;
}




