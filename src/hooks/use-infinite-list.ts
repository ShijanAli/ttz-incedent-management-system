import { useCallback, useMemo, useState } from 'react';
import { flattenPages, type InfinitePages } from '@/redux/api/infinite';

/** The parts of an RTK Query infinite-query hook result this hook needs */
interface InfiniteQueryResult<T> {
  data?: InfinitePages<T>;
  error?: unknown;
  isLoading: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  isError: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => unknown;
  refetch: () => PromiseLike<unknown>;
}

/**
 * Turns any `use<Endpoint>InfiniteQuery` result into what a list UI needs:
 *
 *   const list = useInfiniteList(useGetThingsInfiniteQuery(filters));
 *   list.showSkeleton ? <TableSkeletonRows /> : list.items.map(...)
 *   <InfiniteScrollTrigger {...list.trigger} />
 */
export function useInfiniteList<T>(query: InfiniteQueryResult<T>) {
  const { data, error, isLoading, isFetching, isFetchingNextPage, isError, hasNextPage, fetchNextPage, refetch } = query;
  // Only a user-triggered refresh shows the skeleton; background refetches after a
  // mutation update rows in place so the table doesn't flash
  const [isRefreshing, setIsRefreshing] = useState(false);

  const items = useMemo(() => flattenPages(data), [data]);
  const total = data?.pages.at(-1)?.meta.total ?? 0;

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetching) fetchNextPage();
  }, [hasNextPage, isFetching, fetchNextPage]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  return {
    items,
    total,
    error,
    isError,
    isFetching,
    isRefreshing,
    /** First load, or a manual refresh */
    showSkeleton: isLoading || isRefreshing,
    loadMore,
    refresh,
    /** Spread onto <InfiniteScrollTrigger /> */
    trigger: {
      hasMore: hasNextPage,
      isLoadingMore: isFetchingNextPage,
      onLoadMore: loadMore,
      disabled: isLoading || isRefreshing || isError,
    },
  };
}
