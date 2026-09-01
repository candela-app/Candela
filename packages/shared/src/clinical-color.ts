import type { ColorItem } from './types';

/** Default remaining-vision field — near-black, no clutter. */
export const CLINICAL_INK = '#0B0F14';
export const CLINICAL_PAPER = '#F8FAFC';
export const CLINICAL_INK_GLYPH = '#0F172A';
export const CLINICAL_WHITE = '#FFFFFF';
export const CLINICAL_YELLOW = '#FFD600';
export const CLINICAL_CYAN = '#00E5FF';

export const CLINICAL_CONTRAST_PRESETS = [1, 0.7, 0.45, 0.25] as const;

export const CLINICAL_BG_COLORS: ColorItem[] = [
  { name: 'Ink', code: CLINICAL_INK },
  { name: 'Slate', code: '#1E293B' },
  { name: 'Charcoal', code: '#111827' },
  { name: 'Midnight', code: '#0B1B3A' },
  { name: 'Paper', code: CLINICAL_PAPER },
];

/** High-luminance stimuli — usable with remaining vision; no red–green pair. */
export const CLINICAL_STIMULUS_COLORS: ColorItem[] = [
  { name: 'White', code: CLINICAL_WHITE },
  { name: 'Yellow', code: CLINICAL_YELLOW },
  { name: 'Cyan', code: CLINICAL_CYAN },
  { name: 'Ink', code: CLINICAL_INK_GLYPH },
];

export interface ClinicalColorPair {
  id: string;
  label: string;
  bg: string;
  stimulus: string;
}

export const CLINICAL_COLOR_PAIRS: ClinicalColorPair[] = [
  { id: 'white-ink', label: 'White on ink', bg: CLINICAL_INK, stimulus: CLINICAL_WHITE },
  { id: 'yellow-ink', label: 'Yellow on ink', bg: CLINICAL_INK, stimulus: CLINICAL_YELLOW },
  { id: 'cyan-ink', label: 'Cyan on ink', bg: CLINICAL_INK, stimulus: CLINICAL_CYAN },
  { id: 'ink-paper', label: 'Ink on paper', bg: CLINICAL_PAPER, stimulus: CLINICAL_INK_GLYPH },
];

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, '0');
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/**
 * Blend stimulus toward the background (Weber-style). 1 = full stimulus, 0.25 = hard to see.
 */
export function getContrastAdjustedColor(shapeColor: string, bgColor: string, contrast: number): string {
  const clamped = Math.max(0, Math.min(1, contrast));
  const [sr, sg, sb] = parseHex(shapeColor || CLINICAL_WHITE);
  const [br, bg, bb] = parseHex(bgColor || CLINICAL_INK);
  const mix = (s: number, b: number) => Math.round(b + (s - b) * clamped);
  const toHex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${toHex(mix(sr, br))}${toHex(mix(sg, bg))}${toHex(mix(sb, bb))}`;
}

export function matchClinicalPair(bg: string, stimulus: string): ClinicalColorPair | undefined {
  const b = bg.toLowerCase();
  const s = stimulus.toLowerCase();
  return CLINICAL_COLOR_PAIRS.find((p) => p.bg.toLowerCase() === b && p.stimulus.toLowerCase() === s);
}

export function clinicalColorSessionFields(bg: string, stimulus: string, contrast: number) {
  return {
    bgColor: bg,
    stimulusColor: stimulus,
    contrastPercent: Math.round(Math.max(0, Math.min(1, contrast)) * 100),
  };
}

export function clinicalColorSummaryItems(bg: string, stimulus: string, contrast: number) {
  const pair = matchClinicalPair(bg, stimulus);
  return [
    { label: 'Look', value: pair?.label ?? 'Custom pair' },
    { label: 'Contrast', value: `${Math.round(Math.max(0, Math.min(1, contrast)) * 100)}%` },
  ];
}

export function isDarkClinicalBg(hex: string): boolean {
  const [r, g, b] = parseHex(hex || CLINICAL_INK);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.45;
}
