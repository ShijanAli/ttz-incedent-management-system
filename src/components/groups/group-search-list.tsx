import { useState } from 'react';
import { Loader2, Search, UsersRound } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { InfiniteScrollTrigger } from '@/components/shared/infinite-scroll-trigger';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { parseApiError } from '@/lib/api-error';
import { useGetGroupsInfiniteQuery } from '@/redux/features/groups/groups-api';
import type { ApiGroup } from '@/redux/features/groups/groups-types';

interface GroupSearchListProps {
  /** Groups to leave out, e.g. ones already attached */
  excludeIds: Set<number>;
  /** Rendered on the right of each row, e.g. an Attach button */
  renderAction: (group: ApiGroup) => React.ReactNode;
  emptyMessage?: string;
}

/**
 * Searchable, infinitely scrolling list of active groups. Only active groups can
 * be attached to projects, so inactive ones are filtered out on the server.
 */
export function GroupSearchList({ excludeIds, renderAction, emptyMessage = 'No groups found.' }: GroupSearchListProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());
  const list = useInfiniteList(
    useGetGroupsInfiniteQuery({ is_active: 1, search: debouncedSearch || undefined }),
  );
  const groups = list.items.filter((g) => !excludeIds.has(g.id));
  const searching = search.trim() !== debouncedSearch || (list.isFetching && !list.trigger.isLoadingMore);

  return (
    <div>
      <div className="relative mb-3">
        {searching ? (
          <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          type="search"
          placeholder="Search groups to attach..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          aria-label="Search groups"
        />
      </div>

      <div className="max-h-[320px] overflow-y-auto rounded-lg border">
        {list.showSkeleton ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading groups...
          </div>
        ) : list.isError ? (
          <div className="py-8 text-center text-sm text-destructive">
            {parseApiError(list.error, 'Failed to load groups.').message}
          </div>
        ) : groups.length === 0 && !list.trigger.hasMore ? (
          <div className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</div>
        ) : (
          <div className="divide-y">
            {groups.map((group) => (
              <div key={group.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <UsersRound className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{group.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {group.member_count} member{group.member_count !== 1 ? 's' : ''}
                    {group.description ? ` · ${group.description}` : ''}
                  </div>
                </div>
                {renderAction(group)}
              </div>
            ))}
          </div>
        )}
        <InfiniteScrollTrigger {...list.trigger} disabled={list.trigger.disabled || list.showSkeleton} />
      </div>
    </div>
  );
}
