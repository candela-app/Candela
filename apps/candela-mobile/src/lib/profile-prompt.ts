import * as SecureStore from 'expo-secure-store';
import { PROFILE_PROMPT_DISMISS_MS } from '@candela/shared/rn';

function key(userId: string): string {
  return `candela_profile_prompt_dismissed_${userId}`;
}

export async function isProfilePromptDismissed(userId: string): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(key(userId));
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < PROFILE_PROMPT_DISMISS_MS;
  } catch {
    return false;
  }
}

export async function dismissProfilePrompt(userId: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key(userId), String(Date.now()));
  } catch {
    // ignore
  }
}

export async function clearProfilePromptDismiss(userId: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key(userId));
  } catch {
    // ignore
  }
}
