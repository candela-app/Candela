export type GameMode = 'alphabets' | 'numbers' | 'colors';

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
