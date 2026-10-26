/**
 * Links into the issues page with filters already applied. The keys match the ones
 * the issues page reads from its URL (see FILTER_PARAMS in pages/issues.tsx).
 */
export interface IssuesLinkFilters {
  project?: number | string;
  status?: number | string;
  priority?: string;
  /** "me" or "unassigned" */
  assignee?: 'me' | 'unassigned';
  /** Only "me" is supported by the issues page */
  reporter?: 'me';
}

export function issuesUrl(filters: IssuesLinkFilters = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `/issues?${query}` : '/issues';
}
