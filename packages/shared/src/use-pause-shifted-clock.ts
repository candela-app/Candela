import { useEffect, useRef } from 'react';

export function pauseClockNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/**
 * Freeze elapsed time of the form `now - startTime` while `paused` is true.
 * On resume, shift start timestamps forward by the pause so the clock continues
 * from the frozen value instead of jumping ahead.
 *
 * `clockIdentity` should be the live start timestamp (or another value that
 * changes when the session is restarted). If the clock is reset during the
 * pause — e.g. applying settings mid-game — the pending shift is dropped so
 * elapsed time cannot go negative.
 */
export function usePauseShiftedClock(
  paused: boolean,
  active: boolean,
  applyShift: (deltaMs: number) => void,
  clockIdentity?: number | null,
): void {
  const pauseBeganRef = useRef<number | null>(null);
  const identityAtPauseRef = useRef<number | null | undefined>(undefined);
  const applyRef = useRef(applyShift);
  applyRef.current = applyShift;

  useEffect(() => {
    if (!active) {
      pauseBeganRef.current = null;
      identityAtPauseRef.current = undefined;
      return;
    }
    if (paused) {
      if (pauseBeganRef.current == null) {
        pauseBeganRef.current = pauseClockNow();
        identityAtPauseRef.current = clockIdentity;
      } else if (clockIdentity !== identityAtPauseRef.current) {
        pauseBeganRef.current = pauseClockNow();
        identityAtPauseRef.current = clockIdentity;
      }
      return;
    }
    if (pauseBeganRef.current != null) {
      const identityUnchanged = clockIdentity === identityAtPauseRef.current;
      const delta = pauseClockNow() - pauseBeganRef.current;
      pauseBeganRef.current = null;
      identityAtPauseRef.current = undefined;
      if (identityUnchanged && delta > 0) applyRef.current(delta);
    }
  }, [paused, active, clockIdentity]);
}
