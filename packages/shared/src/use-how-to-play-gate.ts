import { useCallback, useState } from 'react';

export type HowToPlayMode = 'entry' | 'review';

/**
 * Entry: how-to-play first, then settings.
 * Review: reopen from the game menu without jumping to settings.
 */
export function useHowToPlayGate() {
  const [showHowToPlay, setShowHowToPlay] = useState(true);
  const [howToPlayMode, setHowToPlayMode] = useState<HowToPlayMode>('entry');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const finishHowToPlay = useCallback(() => {
    setShowHowToPlay(false);
    setHowToPlayMode('entry');
    setIsSettingsOpen(true);
  }, []);

  const openHowToPlay = useCallback(() => {
    setHowToPlayMode('review');
    setShowHowToPlay(true);
  }, []);

  const closeHowToPlay = useCallback(() => {
    setShowHowToPlay(false);
  }, []);

  /** Pause the engine while how-to-play, settings, or the drawer menu is up. */
  const playBlocked = showHowToPlay || isSettingsOpen || isMenuOpen;

  return {
    showHowToPlay,
    howToPlayMode,
    isSettingsOpen,
    setIsSettingsOpen,
    isMenuOpen,
    setIsMenuOpen,
    finishHowToPlay,
    openHowToPlay,
    closeHowToPlay,
    playBlocked,
  };
}
