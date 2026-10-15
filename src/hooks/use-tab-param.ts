import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

/**
 * Keeps the active tab in the URL (e.g. `?tab=activity`) so a reload, a shared
 * link or the back button lands on the same tab. Unknown values fall back to the
 * default, and the default tab keeps the URL clean by dropping the param.
 *
 *   const [tab, setTab] = useTabParam(['overview', 'members'] as const, 'overview');
 *   <Tabs value={tab} onValueChange={setTab}>
 */
export function useTabParam<T extends string>(tabs: readonly T[], defaultTab: T, param = 'tab') {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get(param);
  const tab = raw && (tabs as readonly string[]).includes(raw) ? (raw as T) : defaultTab;

  const setTab = useCallback(
    (next: string) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === defaultTab) params.delete(param);
          else params.set(param, next);
          return params;
        },
        // Switching tabs shouldn't fill the history with one entry per click
        { replace: true },
      );
    },
    [defaultTab, param, setSearchParams],
  );

  return [tab, setTab] as const;
}
