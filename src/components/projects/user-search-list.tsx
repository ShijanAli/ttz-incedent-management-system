import { useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/shared/user-avatar';
import { InfiniteScrollTrigger } from '@/components/shared/infinite-scroll-trigger';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { parseApiError } from '@/lib/api-error';
import { getAvatarColor } from '@/lib/shared-utils';
import { useGetUsersInfiniteQuery } from '@/redux/features/users/users-api';
import type { AdminUser } from '@/redux/features/users/users-types';

interface UserSearchListProps {
  /** Users to leave out, e.g. existing members */
  excludeIds: Set<number>;
  /** Rendered on the right of each row, e.g. an Add button or checkbox */
  renderAction: (user: AdminUser) => React.ReactNode;
  emptyMessage?: string;
  className?: string;
}

/**
 * Searchable, infinitely scrolling list of active users from the users API.
 * Search runs on the server, debounced.
 */
export function UserSearchList({
  excludeIds, renderAction, emptyMessage = 'No users found.', className,
}: UserSearchListProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());
  const list = useInfiniteList(
    useGetUsersInfiniteQuery({ status: 'active', search: debouncedSearch || undefined }),
  );
  const users = list.items.filter((u) => !excludeIds.has(u.id));
  const searching = search.trim() !== debouncedSearch || (list.isFetching && !list.trigger.isLoadingMore);

  return (
    <div className={className}>
      <div className="relative mb-3">
        {searching ? (
          <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          type="search"
          placeholder="Search users to add..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          aria-label="Search users"
        />
      </div>

      <div className="max-h-[320px] overflow-y-auto rounded-lg border">
        {list.showSkeleton ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading users...
          </div>
        ) : list.isError ? (
          <div className="py-8 text-center text-sm text-destructive">
            {parseApiError(list.error, 'Failed to load users.').message}
          </div>
        ) : users.length === 0 && !list.trigger.hasMore ? (
          <div className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</div>
        ) : (
          <div className="divide-y">
            {users.map((user) => (
              <div key={user.id} className="flex items-center gap-3 px-3 py-2.5">
                <UserAvatar name={user.name} color={getAvatarColor(user.id)} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{user.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[user.designation, user.default_role].filter(Boolean).join(' · ') || user.email}
                  </div>
                </div>
                {renderAction(user)}
              </div>
            ))}
          </div>
        )}
        <InfiniteScrollTrigger {...list.trigger} disabled={list.trigger.disabled || list.showSkeleton} />
      </div>
    </div>
  );
}
