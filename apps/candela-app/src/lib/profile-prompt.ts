import { PROFILE_PROMPT_DISMISS_MS } from '@candela/shared';

function key(userId: string): string {
  return `candela_profile_prompt_dismissed:${userId}`;
}

export function isProfilePromptDismissed(userId: string): boolean {
  if (typeof window === 'undefined') return false;
  const raw = window.localStorage.getItem(key(userId));
  if (!raw) return false;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < PROFILE_PROMPT_DISMISS_MS;
}

export function dismissProfilePrompt(userId: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key(userId), String(Date.now()));
}

export function clearProfilePromptDismiss(userId: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(key(userId));
}
