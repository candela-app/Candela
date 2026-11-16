import type { GoogleInvitationAcceptancePreview } from '@candela/shared';

const STORAGE_KEY = 'candela.googleInvitationAcceptance';

export type StoredGoogleInvitationAcceptance = {
  acceptanceToken: string;
  invitation: GoogleInvitationAcceptancePreview;
  message?: string;
};

export function storeGoogleInvitationAcceptance(payload: StoredGoogleInvitationAcceptance): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function clearGoogleInvitationAcceptance(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}

export function readGoogleInvitationAcceptance(): StoredGoogleInvitationAcceptance | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredGoogleInvitationAcceptance;
    if (!parsed?.acceptanceToken || !parsed?.invitation) return null;
    return parsed;
  } catch {
    return null;
  }
}
