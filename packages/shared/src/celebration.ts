/** Therapy-friendly party colors for results-modal confetti. */
export const CELEBRATION_CONFETTI_COLORS = [
  '#FBBF24',
  '#F59E0B',
  '#34D399',
  '#10B981',
  '#38BDF8',
  '#60A5FA',
  '#F472B6',
  '#FB7185',
  '#F8FAFC',
  '#A78BFA',
] as const;

/** Spoken name for celebration TTS. Empty → generic “you”. */
export function celebrationSpokenName(patientName?: string | null): string {
  const cleaned = (patientName || '')
    .trim()
    .replace(/[^A-Za-zÀ-ž0-9'.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || /^(demo(\s+patient)?|patient)$/i.test(cleaned)) return '';
  return cleaned;
}

export function clapForLine(patientName?: string | null): string {
  const name = celebrationSpokenName(patientName);
  return name ? `Clap for ${name}` : 'Clap for you';
}

/** On-screen prompt during results celebration. */
export const CLAP_ALONG_PROMPT = 'Clap along!';

/** Estimated spoken duration of the clap-for line (ms), matching TTS rate 0.92. */
export function clapLineSpeakMs(patientName?: string | null): number {
  const words = Math.max(1, clapForLine(patientName).trim().split(/\s+/).length);
  return Math.round((words / 2.35) * 1000 / 0.92) + 180;
}

/** Silent lead-in in `applause-cheer.mp3` before the first clap. */
export const APPLAUSE_LEAD_IN_SEC = 1.1;

/** Start the clip this many ms before the previous clap cue. */
export const APPLAUSE_EARLY_MS = 350;
