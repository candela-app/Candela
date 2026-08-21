'use client';

import { useEffect } from 'react';

/**
 * Traps browser Back so leaving a therapy session is only possible via Quit.
 */
export function useGameSessionLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const trap = () => {
      window.history.pushState({ candelaSessionLock: 1 }, '', window.location.href);
    };
    trap();
    window.addEventListener('popstate', trap);
    return () => window.removeEventListener('popstate', trap);
  }, [locked]);
}
