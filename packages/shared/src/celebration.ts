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

/** First name only, safe to speak. Empty → generic “you”. */
export function celebrationFirstName(patientName?: string | null): string {
  const token = (patientName || '').trim().split(/\s+/)[0] || '';
  const cleaned = token.replace(/[^A-Za-zÀ-ž0-9'.-]/g, '');
  if (!cleaned || /^(demo|patient)$/i.test(cleaned)) return '';
  return cleaned;
}

export function clapForLine(patientName?: string | null): string {
  const first = celebrationFirstName(patientName);
  return first ? `Clap for ${first}` : 'Clap for you';
}

/** Silent lead-in in `applause-cheer.mp3` before the first clap. */
export const APPLAUSE_LEAD_IN_SEC = 1.1;

/** Start the clip this many ms before the previous clap cue. */
export const APPLAUSE_EARLY_MS = 350;
