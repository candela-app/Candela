import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'candela_access';
const REFRESH_KEY = 'candela_refresh';

let memoryAccess: string | null = null;
let memoryRefresh: string | null = null;

async function setItem(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    if (key === ACCESS_KEY) memoryAccess = value;
    else memoryRefresh = value;
  }
}

async function getItem(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return key === ACCESS_KEY ? memoryAccess : memoryRefresh;
  }
}

async function deleteItem(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    if (key === ACCESS_KEY) memoryAccess = null;
    else memoryRefresh = null;
  }
}

export async function getAccessToken(): Promise<string | null> {
  return getItem(ACCESS_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return getItem(REFRESH_KEY);
}

export async function saveTokens(accessToken?: string, refreshToken?: string): Promise<void> {
  if (accessToken) {
    await setItem(ACCESS_KEY, accessToken);
  }
  if (refreshToken) {
    await setItem(REFRESH_KEY, refreshToken);
  }
}

export async function clearTokens(): Promise<void> {
  memoryAccess = null;
  memoryRefresh = null;
  await deleteItem(ACCESS_KEY);
  await deleteItem(REFRESH_KEY);
}
