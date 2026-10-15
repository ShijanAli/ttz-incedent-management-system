import { useCallback, useMemo } from 'react';
import { History, RotateCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ActivityFeed } from '@/components/activity/activity-feed';
import { InfiniteScrollTrigger } from '@/components/shared/infinite-scroll-trigger';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { parseApiError } from '@/lib/api-error';
import { cn } from '@/lib/utils';
import { useGetProjectActivityInfiniteQuery } from '@/redux/features/projects/projects-api';
import type { ApiProject } from '@/redux/features/projects/projects-types';

/** Activity tab: the project's audit log, newest first, loading older entries on scroll */
export function ProjectActivity({ project }: { project: ApiProject }) {
  const list = useInfiniteList(useGetProjectActivityInfiniteQuery(project.id));

  // Member events only carry user ids; name them from the project's members
  const memberNames = useMemo(
    () => new Map(project.members.map((m) => [m.user.id, m.user.name])),
    [project.members],
  );
  const resolveUserName = useCallback((id: number) => memberNames.get(id), [memberNames]);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Activity {list.total > 0 && `(${list.total})`}
          </h3>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={list.refresh}
            disabled={list.isFetching}
            aria-label="Refresh activity"
            title="Refresh"
          >
            <RotateCw className={cn('h-3.5 w-3.5', list.isRefreshing && 'animate-spin')} />
          </Button>
        </div>

        {list.showSkeleton ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-6 w-6 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : list.isError ? (
          <div className="py-8 text-center text-sm">
            <p className="text-destructive">{parseApiError(list.error, 'Failed to load activity.').message}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={list.refresh}>Retry</Button>
          </div>
        ) : list.items.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center text-muted-foreground">
            <History className="mb-2 h-8 w-8" />
            No activity recorded yet.
          </div>
        ) : (
          <ActivityFeed entries={list.items} resolveUserName={resolveUserName} contextType="Project" />
        )}

        <InfiniteScrollTrigger
          {...list.trigger}
          disabled={list.trigger.disabled || list.showSkeleton}
          endMessage={list.items.length > 0 ? 'That’s the beginning of this project’s history' : undefined}
        />
      </CardContent>
    </Card>
  );
}
