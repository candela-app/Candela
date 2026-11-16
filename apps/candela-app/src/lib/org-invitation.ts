const STORAGE_KEY = 'candela_org_invitation_token';

/** Persist invitation token across login redirect — never log the value. */
export function storeOrgInvitationToken(token: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = token.trim();
  if (!trimmed) return;
  window.sessionStorage.setItem(STORAGE_KEY, trimmed);
}

export function readOrgInvitationToken(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  return raw?.trim() || null;
}

export function clearOrgInvitationToken(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}
