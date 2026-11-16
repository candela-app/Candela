import type { GoogleInvitationAcceptancePreview } from '@candela/shared/rn';

export type StoredGoogleInvitationAcceptance = {
  acceptanceToken: string;
  invitation: GoogleInvitationAcceptancePreview;
  message?: string;
};

let memoryStore: StoredGoogleInvitationAcceptance | null = null;

/** In-memory only — never put acceptance tokens in deep-link URLs. */
export function storeGoogleInvitationAcceptance(payload: StoredGoogleInvitationAcceptance): void {
  memoryStore = payload;
}

export function takeGoogleInvitationAcceptance(): StoredGoogleInvitationAcceptance | null {
  const value = memoryStore;
  memoryStore = null;
  return value;
}

export function peekGoogleInvitationAcceptance(): StoredGoogleInvitationAcceptance | null {
  return memoryStore;
}

export function clearGoogleInvitationAcceptance(): void {
  memoryStore = null;
}
