import { ArrowRight, History as HistoryIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { InfiniteScrollTrigger } from '@/components/shared/infinite-scroll-trigger';
import { ColoredBadge } from '@/components/issues/issue-badges';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { parseApiError } from '@/lib/api-error';
import { formatRelativeTime } from '@/lib/shared-utils';
import { useGetIssueHistoryInfiniteQuery } from '@/redux/features/issues/issue-detail-api';
import type { IssueHistoryEntry } from '@/redux/features/issues/issues-types';

/** Status timeline: overall moves and each assignee's own changes */
export function IssueHistory({ issueId }: { issueId: number }) {
  const list = useInfiniteList(useGetIssueHistoryInfiniteQuery(issueId));

  if (list.showSkeleton) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }

  if (list.isError) {
    return (
      <div className="py-6 text-center text-sm">
        <p className="text-destructive">{parseApiError(list.error, 'Failed to load history.').message}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={list.refresh}>Retry</Button>
      </div>
    );
  }

  if (list.items.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">No history recorded.</p>;
  }

  return (
    <div className="space-y-2">
      {list.items.map((h) => (
        <div key={h.id} className="flex items-start gap-3 text-sm py-2 border-b last:border-0">
          <div className="mt-0.5">
            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
              <HistoryIcon className="h-3 w-3 text-muted-foreground" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <HistorySentence entry={h} />
            {h.note && <p className="mt-1 rounded-md bg-muted/40 px-2.5 py-1.5 text-xs whitespace-pre-wrap">{h.note}</p>}
            <div className="text-xs text-muted-foreground mt-0.5" title={new Date(h.created_at).toLocaleString()}>
              {formatRelativeTime(h.created_at)}
            </div>
          </div>
        </div>
      ))}
      <InfiniteScrollTrigger {...list.trigger} disabled={list.trigger.disabled} />
    </div>
  );
}

function HistorySentence({ entry }: { entry: IssueHistoryEntry }) {
  const actor = <span className="font-medium">{entry.actor?.name || 'Unknown'}</span>;
  const to = entry.to_status && <ColoredBadge item={entry.to_status} />;

  // First entry of an issue: no previous status
  if (!entry.from_status) {
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        {actor} created this issue as {to}
      </span>
    );
  }

  // Assignee-scoped change, possibly made by someone else (an override)
  const whose = entry.scope !== 'overall' && entry.subject
    ? entry.subject.id === entry.actor?.id ? 'their status' : `${entry.subject.name}'s status`
    : 'the status';

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {actor} changed {whose} from <ColoredBadge item={entry.from_status} />
      <ArrowRight className="h-3 w-3 text-muted-foreground" aria-label="to" />
      {to}
    </span>
  );
}
