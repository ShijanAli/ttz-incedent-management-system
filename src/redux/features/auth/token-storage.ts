/**
 * Persists auth tokens. "Keep me signed in" uses localStorage (survives restarts);
 * otherwise sessionStorage (cleared when the tab closes).
 */
const STORAGE_KEY = 'ttz_auth_tokens';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds when the access token expires */
  expiresAt: number;
  remember: boolean;
}

function read(storage: Storage): StoredTokens | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTokens;
    return parsed.accessToken && parsed.refreshToken ? parsed : null;
  } catch {
    return null;
  }
}

export function loadTokens(): StoredTokens | null {
  if (typeof window === 'undefined') return null;
  return read(window.localStorage) ?? read(window.sessionStorage);
}

export function saveTokens(tokens: StoredTokens): void {
  if (typeof window === 'undefined') return;
  try {
    const target = tokens.remember ? window.localStorage : window.sessionStorage;
    const other = tokens.remember ? window.sessionStorage : window.localStorage;
    other.removeItem(STORAGE_KEY);
    target.setItem(STORAGE_KEY, JSON.stringify(tokens));
  } catch {
    // Storage can be unavailable (private mode, quota); the session then lasts for this page load only.
  }
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
