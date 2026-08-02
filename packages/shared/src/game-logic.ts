import { BubblePosition, GameMode, ColorItem, SessionResultData, DeviceTier } from './types';
import { ALPHABETS, NUMBERS, BRIGHT_COLORS } from './constants';

/**
 * Detects device tier from viewport dimensions.
 * Mobile: < 600px width OR landscape mobile (< 1024px width & < 500px height).
 * Tablet: 600-1200px.
 * TV/Desktop: > 1200px.
 */
export function getDeviceTier(width?: number, height?: number): DeviceTier {
  const w = width ?? (typeof window !== 'undefined' ? window.innerWidth : 1024);
  const h = height ?? (typeof window !== 'undefined' ? window.innerHeight : 768);

  if (w < 600 || (w < 1024 && h < 500)) return 'mobile';
  if (w <= 1200) return 'tablet';
  return 'tv';
}

/**
 * Calculates dynamic minimum distance (in %) required between bubble centers to prevent overlaps.
 */
export function getMinDistancePercent(
  bubbleSizePx: number,
  containerSizePx: number,
  gapPercent: number = 2
): number {
  if (containerSizePx <= 0) return 12;
  const bubbleDiameterPercent = (bubbleSizePx / containerSizePx) * 100;
  return bubbleDiameterPercent + gapPercent;
}

export function checkOverlap(
  pos: BubblePosition,
  existingPositions: BubblePosition[],
  minDistance: number = 12
): boolean {
  for (const p of existingPositions) {
    const dx = p.x - pos.x;
    const dy = p.y - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDistance) {
      return true;
    }
  }
  return false;
}

/**
 * Deterministically places a bubble into one of N angular slots when 80 random retries fail.
 */
export function getSlotFallbackPosition(
  slotIndex: number,
  totalSlots: number,
  containerSize: number,
  bubbleSize: number
): BubblePosition {
  const maxR = containerSize / 2 - bubbleSize / 2 - 12;
  const radius = maxR * 0.65; // Place on 65% radius ring to avoid center & outer edge
  const angle = (2 * Math.PI * slotIndex) / Math.max(1, totalSlots);

  const x = 50 + (radius * Math.cos(angle)) / (containerSize / 100);
  const y = 50 + (radius * Math.sin(angle)) / (containerSize / 100);

  return { x, y };
}

export function getRandomSymbol(mode: GameMode, variant: 'uppercase' | 'lowercase' = 'uppercase'): string {
  if (mode === 'alphabets') {
    const letter = ALPHABETS[Math.floor(Math.random() * ALPHABETS.length)];
    return variant === 'lowercase' ? letter.toLowerCase() : letter;
  }
  if (mode === 'numbers') {
    return NUMBERS[Math.floor(Math.random() * NUMBERS.length)];
  }
  if (mode === 'colors') {
    return BRIGHT_COLORS[Math.floor(Math.random() * BRIGHT_COLORS.length)].name;
  }
  return ALPHABETS[Math.floor(Math.random() * ALPHABETS.length)];
}

export function getContrastColor(hexColor: string): string {
  if (!hexColor || !hexColor.startsWith('#')) return '#000000';
  let cleanHex = hexColor.slice(1);
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

export function exportSessionCSV(data: SessionResultData): void {
  if (typeof window === 'undefined') return;
  const headers = Object.keys(data).join(',');
  const values = Object.values(data).join(',');
  const csvContent = 'data:text/csv;charset=utf-8,' + headers + '\n' + values;
  const encodedUri = encodeURI(csvContent);
  const gameSlug = data.gameName
    ? data.gameName.toLowerCase().replace(/\s+/g, '-')
    : 'results';
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `game-session-completed-${gameSlug}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Safely request full screen mode across modern browsers, desktop, and tablets.
 * Catches iOS / browser restrictions silently without causing popup errors.
 */
export function requestFullScreenSafe(): void {
  if (typeof document === 'undefined') return;
  const elem = document.documentElement as any;
  try {
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(() => {});
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen();
    }
  } catch (_) {}
}

/**
 * Safely exit full screen mode.
 */
export function exitFullScreenSafe(): void {
  if (typeof document === 'undefined') return;
  const doc = document as any;
  try {
    if (doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement) {
      if (doc.exitFullscreen) {
        doc.exitFullscreen().catch(() => {});
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      } else if (doc.msExitFullscreen) {
        doc.msExitFullscreen();
      }
    }
  } catch (_) {}
}

