/** In-memory only — never put invitation tokens in analytics or logs. */
let pendingToken: string | null = null;

export function storeOrgInvitationToken(token: string): void {
  const trimmed = token.trim();
  pendingToken = trimmed || null;
}

export function readOrgInvitationToken(): string | null {
  return pendingToken;
}

export function clearOrgInvitationToken(): void {
  pendingToken = null;
}
