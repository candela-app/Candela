'use client';

import { useState } from 'react';
import { ResetConfirmDialog } from './ResetConfirmDialog';

/**
 * Opens clinical settings even mid-session.
 * Mid-game apply confirmation lives inside ClinicalSettingsModal (sessionLocked).
 */
export function useMidGameSettingsLock(_sessionInProgress: boolean) {
  const [lockedOpen, setLockedOpen] = useState(false);

  const requestOpenSettings = (openSettings: () => void) => {
    openSettings();
  };

  return { lockedOpen, setLockedOpen, requestOpenSettings };
}

/** @deprecated Prefer in-modal Apply confirm via ClinicalSettingsModal sessionLocked. */
export function MidGameSettingsLockedDialog({
  isOpen,
  onCancel,
  onReset,
  resetLabel = 'Reset Game',
}: {
  isOpen: boolean;
  onCancel: () => void;
  onReset: () => void;
  resetLabel?: string;
}) {
  return (
    <ResetConfirmDialog
      isOpen={isOpen}
      title="Settings locked"
      message="You cannot change the settings in the middle of a game. If you want to change the settings, reset the game."
      cancelLabel="Keep playing"
      confirmLabel={resetLabel}
      onCancel={onCancel}
      onConfirm={onReset}
    />
  );
}
