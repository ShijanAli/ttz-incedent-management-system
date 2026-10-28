import { useCallback, useMemo } from 'react';
import { History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ActivityFeed } from '@/components/activity/activity-feed';
import { InfiniteScrollTrigger } from '@/components/shared/infinite-scroll-trigger';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { parseApiError } from '@/lib/api-error';
import { useGetIssueActivityInfiniteQuery } from '@/redux/features/issues/issue-detail-api';

interface IssueActivityProps {
  issueId: number;
  /** People known on the issue, so events that only carry a user id can be named */
  people: { id: number; name: string }[];
}

/** Everything that happened to the issue: field edits, comments, attachments and assignments */
export function IssueActivity({ issueId, people }: IssueActivityProps) {
  const list = useInfiniteList(useGetIssueActivityInfiniteQuery(issueId));

  const names = useMemo(() => new Map(people.map((p) => [p.id, p.name])), [people]);
  const resolveUserName = useCallback((id: number) => names.get(id), [names]);

  if (list.showSkeleton) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }

  if (list.isError) {
    return (
      <div className="py-6 text-center text-sm">
        <p className="text-destructive">{parseApiError(list.error, 'Failed to load activity.').message}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={list.refresh}>Retry</Button>
      </div>
    );
  }

  if (list.items.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center text-sm text-muted-foreground">
        <History className="mb-2 h-8 w-8" />
        No activity recorded yet.
      </div>
    );
  }

  return (
    <>
      <ActivityFeed entries={list.items} resolveUserName={resolveUserName} contextType="Issue" />
      <InfiniteScrollTrigger
        {...list.trigger}
        disabled={list.trigger.disabled}
        endMessage="That’s the beginning of this issue’s history"
      />
    </>
  );
}
