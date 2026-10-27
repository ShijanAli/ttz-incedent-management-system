/** Options every "live" query starts with; a caller's own options still win */
const FRESH_OPTIONS = {
  // Each new subscriber (page or component mount) refetches instead of serving the cache
  refetchOnMountOrArgChange: true,
  // Catch up on changes made while the tab was in the background (only after a real
  // absence; see setupListeners in store.ts, so clicking back into the page doesn't refetch)
  refetchOnFocus: true,
} as const;

/**
 * Wraps a generated query hook so it always loads fresh data for modules whose
 * data changes under the user (issues, projects, groups, notifications).
 * RTK Query only takes these options per hook or per API, not per endpoint.
 * Requests already in flight are shared, so several components mounting at once
 * still make one call.
 *
 *   export const useGetThingsQuery = alwaysFresh(thingsApi.useGetThingsQuery);
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function alwaysFresh<Hook extends (arg: any, options?: any) => any>(hook: Hook): Hook {
  return ((arg: unknown, options?: object) => hook(arg, { ...FRESH_OPTIONS, ...options })) as Hook;
}
