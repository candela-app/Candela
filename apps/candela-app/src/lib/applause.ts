import { APPLAUSE_LEAD_IN_SEC } from '@candela/shared';

let current: HTMLAudioElement | null = null;
let primed: HTMLAudioElement | null = null;

const APPLAUSE_URL = '/sfx/applause-cheer.mp3';

function makeEl(): HTMLAudioElement {
  const audio = new Audio(APPLAUSE_URL);
  audio.preload = 'auto';
  audio.volume = 0.9;
  return audio;
}

export function preloadApplauseClip(): void {
  if (typeof window === 'undefined' || primed) return;
  primed = makeEl();
  primed.load();
}

export function playApplauseClip(): void {
  stopApplauseClip();
  if (typeof window === 'undefined') return;
  const audio = primed ?? makeEl();
  primed = null;
  current = audio;
  const startAtLeadIn = () => {
    if (current !== audio) return;
    try {
      audio.currentTime = APPLAUSE_LEAD_IN_SEC;
    } catch {
      // ignore seek errors on still-loading media
    }
    void audio.play().catch(() => {});
  };
  if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) startAtLeadIn();
  else audio.addEventListener('loadedmetadata', startAtLeadIn, { once: true });
}

export function stopApplauseClip(): void {
  if (!current) return;
  current.pause();
  current.currentTime = 0;
  current = null;
}
