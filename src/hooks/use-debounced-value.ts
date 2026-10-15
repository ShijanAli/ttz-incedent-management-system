import { useEffect, useState } from 'react';

export const SEARCH_DEBOUNCE_MS = 400;

/**
 * Returns `value` once it has stopped changing for `delay` ms. Use it to keep
 * an input responsive while only sending the settled value to the API:
 *
 *   const [search, setSearch] = useState('');
 *   const debouncedSearch = useDebouncedValue(search);
 *   useGetThingsInfiniteQuery({ search: debouncedSearch || undefined });
 */
export function useDebouncedValue<T>(value: T, delay = SEARCH_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
