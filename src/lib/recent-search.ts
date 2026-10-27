/**
 * Projects and issues the user recently opened from the topbar search.
 * Kept in localStorage per user, so showing them needs no API call.
 */

export type RecentItem =
  | { kind: 'project'; id: number; name: string; color?: string | null; logo_url?: string | null; status?: string | null }
  | { kind: 'issue'; id: number; code: string; title: string; projectName?: string | null };

const MAX_ITEMS = 8;
const CHANGE_EVENT = 'recent-search-change';

const storageKey = (userId: string) => `ims.recent-search.${userId}`;

export function readRecent(userId: string): RecentItem[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as RecentItem[]).slice(0, MAX_ITEMS) : [];
  } catch {
    return [];
  }
}

function write(userId: string, items: RecentItem[]) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // Storage full or blocked: history is a convenience, so skip it
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Puts the item first, dropping an older copy of it */
export function rememberRecent(userId: string, item: RecentItem) {
  const rest = readRecent(userId).filter((r) => !(r.kind === item.kind && r.id === item.id));
  write(userId, [item, ...rest]);
}

/** Drops an item that no longer opens (deleted, or access removed) */
export function forgetRecent(userId: string, kind: RecentItem['kind'], id: number) {
  const items = readRecent(userId);
  const next = items.filter((r) => !(r.kind === kind && r.id === id));
  if (next.length !== items.length) write(userId, next);
}

export function clearRecent(userId: string) {
  write(userId, []);
}

/** Subscribe to changes made anywhere in the app */
export function onRecentChange(listener: () => void) {
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}

export const recentHref = (item: RecentItem) =>
  item.kind === 'project' ? `/projects/${item.id}` : `/issues/${item.id}`;
