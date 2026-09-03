/**
 * Familiar Faces — name, find, and hold a known person from uploaded photos.
 */

import { sessionAccuracy } from './session-metrics';
import type { FamiliarFacesLevelId } from './types';

export const FAMILIAR_FACES_RELATION_PRESETS = [
  'Mother',
  'Father',
  'Grandmother',
  'Grandfather',
  'Brother',
  'Sister',
  'Aunt',
  'Uncle',
] as const;

export const FAMILIAR_FACES_MAX_PHOTOS = 20;
export const FAMILIAR_FACES_MAX_LABEL_LENGTH = 64;
export const FAMILIAR_FACES_MIN_PHOTOS = 2;
export const FAMILIAR_FACES_CHOICE_COUNT = 4;

/** 0 = stay until the photo is tapped. */
export const FAMILIAR_FACES_FLASH_MS_PRESETS = [0, 3000, 6000, 9000] as const;
export const DEFAULT_FAMILIAR_FACES_FLASH_MS = 3000;

export interface FamiliarFacePhoto {
  id: string;
  relationLabel: string;
  imageUrl: string;
}

export interface FamiliarFacesTrial {
  targetId: string;
  promptLabel: string;
  optionIds: string[];
  optionKind: 'photo' | 'label';
}

export function isFamiliarFacesLevelId(value: string | null | undefined): value is FamiliarFacesLevelId {
  return value === 'name_it' || value === 'find_them' || value === 'flash_match';
}

export function resolveFamiliarFacesLevelId(value?: string | null): FamiliarFacesLevelId {
  return isFamiliarFacesLevelId(value) ? value : 'name_it';
}

export function familiarFacesLevelLabel(levelId: string): string {
  if (levelId === 'find_them') return 'Find Them';
  if (levelId === 'flash_match') return 'Hold the Face';
  return 'Name It';
}

export function familiarFacesFlashLabel(flashMs: number): string {
  if (flashMs <= 0) return 'Off (tap to hide)';
  const sec = Math.round(flashMs / 1000);
  return `${sec}s`;
}

export function clampFamiliarFacesFlashMs(value: number): number {
  const presets = FAMILIAR_FACES_FLASH_MS_PRESETS as readonly number[];
  if (presets.includes(value)) return value;
  const n = Math.round(value);
  let best = presets[0]!;
  let bestDist = Math.abs(n - best);
  for (const preset of presets) {
    const dist = Math.abs(n - preset);
    if (dist < bestDist) {
      best = preset;
      bestDist = dist;
    }
  }
  return best;
}

export function normalizeRelationLabel(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, FAMILIAR_FACES_MAX_LABEL_LENGTH);
}

export function uniqueRelationLabels(photos: Pick<FamiliarFacePhoto, 'relationLabel'>[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const photo of photos) {
    const label = normalizeRelationLabel(photo.relationLabel);
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
  return labels;
}

export function familiarFacesAccuracy(correct: number, wrong: number): number {
  return sessionAccuracy(correct, wrong);
}

export function shuffleCopy<T>(items: readonly T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = next[i]!;
    next[i] = next[j]!;
    next[j] = a;
  }
  return next;
}

export function buildFamiliarFacesQueue(photos: FamiliarFacePhoto[]): FamiliarFacePhoto[] {
  return shuffleCopy(photos);
}

function optionCount(photoCount: number): number {
  return Math.max(2, Math.min(FAMILIAR_FACES_CHOICE_COUNT, photoCount));
}

export function buildNameItTrial(
  target: FamiliarFacePhoto,
  photos: FamiliarFacePhoto[],
): FamiliarFacesTrial {
  const labels = uniqueRelationLabels(photos);
  const targetLabel = normalizeRelationLabel(target.relationLabel);
  const distractors = shuffleCopy(labels.filter((label) => label.toLowerCase() !== targetLabel.toLowerCase()));
  const maxChoices = Math.max(2, Math.min(FAMILIAR_FACES_CHOICE_COUNT, labels.length));
  const options = shuffleCopy([targetLabel, ...distractors.slice(0, maxChoices - 1)]);
  return {
    targetId: target.id,
    promptLabel: targetLabel,
    optionIds: options,
    optionKind: 'label',
  };
}

export function buildFindThemTrial(
  target: FamiliarFacePhoto,
  photos: FamiliarFacePhoto[],
): FamiliarFacesTrial {
  return {
    targetId: target.id,
    promptLabel: normalizeRelationLabel(target.relationLabel),
    optionIds: shuffleCopy(photos.map((photo) => photo.id)),
    optionKind: 'photo',
  };
}

export function buildFlashMatchTrial(
  target: FamiliarFacePhoto,
  photos: FamiliarFacePhoto[],
): FamiliarFacesTrial {
  const distractors = shuffleCopy(photos.filter((photo) => photo.id !== target.id));
  const count = optionCount(photos.length);
  const options = shuffleCopy([target.id, ...distractors.slice(0, count - 1).map((photo) => photo.id)]);
  return {
    targetId: target.id,
    promptLabel: normalizeRelationLabel(target.relationLabel),
    optionIds: options,
    optionKind: 'photo',
  };
}

export function buildFamiliarFacesTrial(
  levelId: FamiliarFacesLevelId,
  target: FamiliarFacePhoto,
  photos: FamiliarFacePhoto[],
): FamiliarFacesTrial {
  if (levelId === 'name_it') return buildNameItTrial(target, photos);
  if (levelId === 'find_them') return buildFindThemTrial(target, photos);
  return buildFlashMatchTrial(target, photos);
}

export function familiarFacesChoiceIsCorrect(
  levelId: FamiliarFacesLevelId,
  trial: FamiliarFacesTrial,
  choiceId: string,
  photos: FamiliarFacePhoto[],
): boolean {
  if (trial.optionKind === 'label') {
    return choiceId.toLowerCase() === trial.promptLabel.toLowerCase();
  }
  if (choiceId === trial.targetId) return true;
  if (levelId !== 'find_them') return false;
  const chosen = photos.find((photo) => photo.id === choiceId);
  const target = photos.find((photo) => photo.id === trial.targetId);
  if (!chosen || !target) return false;
  return chosen.relationLabel.trim().toLowerCase() === target.relationLabel.trim().toLowerCase();
}
