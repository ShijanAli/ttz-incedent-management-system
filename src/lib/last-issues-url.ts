/**
 * Remembers the issues page's query (view, project and filters) so links back to it
 * from an issue, e.g. the breadcrumb, reopen the same board or filtered list.
 * Session storage keeps it per tab and across reloads; failures fall back to /issues.
 */
const KEY = 'ttz:last-issues-search';

export function rememberIssuesSearch(search: string) {
  try {
    sessionStorage.setItem(KEY, search);
  } catch {
    // Storage blocked; links just go to the plain list
  }
}

export function lastIssuesUrl(): string {
  try {
    return `/issues${sessionStorage.getItem(KEY) ?? ''}`;
  } catch {
    return '/issues';
  }
}
