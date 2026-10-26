/**
 * @mentions in comment bodies. The body stays plain text with "@Name" in it; the ids
 * travel separately as `mentioned_user_ids`.
 */

export interface MentionUser {
  id: number;
  name: string;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Matches "@Name" for any of the given names, longest name first so "@Ali Khan" beats "@Ali" */
function mentionPattern(names: string[]): RegExp | null {
  const unique = [...new Set(names.filter(Boolean))].sort((a, b) => b.length - a.length);
  if (unique.length === 0) return null;
  return new RegExp(`(?<![\\p{L}\\p{N}])@(${unique.map(escapeRegExp).join('|')})(?![\\p{L}\\p{N}])`, 'gu');
}

/**
 * The "@query" being typed at the caret, if any. `start` is the index of the "@".
 * The query may hold spaces since names do ("@Mobile App"); the picker closes when nothing matches.
 */
export function findMentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const match = /(?:^|\s)@([^@\n]{0,40})$/.exec(text.slice(0, caret));
  if (!match) return null;
  return { start: caret - match[1].length - 1, query: match[1] };
}

/**
 * Ids of everyone tagged in the body. `preferredIds` (people picked from the list) win
 * when two candidates share a name.
 */
export function extractMentionIds(body: string, candidates: MentionUser[], preferredIds: Iterable<number> = []): number[] {
  const preferred = new Set(preferredIds);
  const byName = new Map<string, number>();
  for (const u of candidates) {
    if (!byName.has(u.name) || preferred.has(u.id)) byName.set(u.name, u.id);
  }
  const pattern = mentionPattern([...byName.keys()]);
  if (!pattern) return [];
  const ids = new Set<number>();
  for (const m of body.matchAll(pattern)) {
    const id = byName.get(m[1]);
    if (id !== undefined) ids.add(id);
  }
  return [...ids];
}

/** Splits a body into plain text and the tagged users, for highlighting */
export function splitMentions<U extends MentionUser>(body: string, users: U[]): (string | U)[] {
  const byName = new Map(users.map((u) => [u.name, u]));
  const pattern = mentionPattern([...byName.keys()]);
  if (!pattern) return [body];
  const parts: (string | U)[] = [];
  let last = 0;
  for (const m of body.matchAll(pattern)) {
    const user = byName.get(m[1]);
    if (!user || m.index === undefined) continue;
    if (m.index > last) parts.push(body.slice(last, m.index));
    parts.push(user);
    last = m.index + m[0].length;
  }
  if (last < body.length) parts.push(body.slice(last));
  return parts;
}
