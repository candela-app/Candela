'use client';

/**
 * Mid-game settings open is always allowed.
 * Apply confirmation lives inside ClinicalSettingsModal via `sessionLocked`
 * ("Start a fresh game?" when settings changed mid-session).
 *
 * @deprecated No longer used — kept only so old imports do not break builds.
 */
export function useMidGameSettingsLock(_sessionInProgress: boolean) {
  const requestOpenSettings = (openSettings: () => void) => {
    openSettings();
  };

  return { lockedOpen: false, setLockedOpen: () => {}, requestOpenSettings };
}

/** @deprecated Prefer in-modal Apply confirm via ClinicalSettingsModal sessionLocked. */
export function MidGameSettingsLockedDialog(_props: {
  isOpen: boolean;
  onCancel: () => void;
  onReset: () => void;
  resetLabel?: string;
}) {
  return null;
}
