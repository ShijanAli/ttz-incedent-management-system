import type { InfiniteData, InfiniteQueryConfigOptions } from '@reduxjs/toolkit/query';
import type { Paginated } from './types';

/** Laravel paginators are 1-indexed page numbers */
export type PageParam = number;

export type InfinitePages<T> = InfiniteData<Paginated<T>, PageParam>;

/**
 * `infiniteQueryOptions` for any Laravel-paginated endpoint. Use with
 * `build.infiniteQuery` so every list in the app pages the same way:
 *
 *   getThings: build.infiniteQuery<Paginated<Thing>, ThingFilters, PageParam>({
 *     infiniteQueryOptions: laravelInfiniteOptions(),
 *     query: ({ queryArg, pageParam }) => ({ url, params: { ...queryArg, page: pageParam } }),
 *     ...
 *   })
 */
export function laravelInfiniteOptions<T, QueryArg>(): InfiniteQueryConfigOptions<Paginated<T>, PageParam, QueryArg> {
  return {
    initialPageParam: 1,
    getNextPageParam: ({ meta }) => (meta.current_page < meta.last_page ? meta.current_page + 1 : undefined),
  };
}

/** Every item across the loaded pages, in order */
export function flattenPages<T>(data: InfinitePages<T> | undefined): T[] {
  return data?.pages.flatMap((page) => page.items) ?? [];
}

/**
 * Cache tags for an infinite list: one per item plus a LIST tag, so a mutation can
 * invalidate a single row or the whole list.
 */
export function provideInfiniteListTags<TagType extends string, T extends { id: number | string }>(
  type: TagType,
  data: InfinitePages<T> | undefined,
) {
  const listTag = { type, id: 'LIST' } as const;
  return data ? [...flattenPages(data).map(({ id }) => ({ type, id })), listTag] : [listTag];
}
