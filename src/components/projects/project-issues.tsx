import { Link } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { TableSkeletonRows } from '@/components/shared/table-skeleton-rows';
import { InfiniteScrollTrigger } from '@/components/shared/infinite-scroll-trigger';
import { IssuePriorityBadge, IssueStatusBadge } from '@/components/issues/issue-badges';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { parseApiError } from '@/lib/api-error';
import { formatDate, isOverdue } from '@/lib/shared-utils';
import { cn } from '@/lib/utils';
import { useGetProjectIssuesInfiniteQuery } from '@/redux/features/issues/issues-api';

const COLUMN_COUNT = 6;

/** Issues tab: the project's issues from GET /projects/{id}/issues, loading more on scroll */
export function ProjectIssues({ projectId }: { projectId: number }) {
  const list = useInfiniteList(useGetProjectIssuesInfiniteQuery({ projectId }));
  const issues = list.items;

  return (
    <Card>
      <CardContent className="p-4">
        {list.isError ? (
          <div className="py-8 text-center text-sm">
            <p className="text-destructive">{parseApiError(list.error, 'Failed to load issues.').message}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={list.refresh}>Retry</Button>
          </div>
        ) : !list.showSkeleton && issues.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No issues in this project yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.showSkeleton ? (
                <TableSkeletonRows columns={COLUMN_COUNT} rows={4} />
              ) : (
                issues.map((issue) => {
                  const overdue = issue.progress < 100 && isOverdue(issue.due_date ?? undefined);
                  return (
                    <TableRow key={issue.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell>
                        <Link to={`/issues/${issue.id}`} className="font-mono text-xs text-primary hover:underline">
                          {issue.code}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link to={`/issues/${issue.id}`} className="text-sm hover:text-primary">
                          {issue.title}
                        </Link>
                      </TableCell>
                      <TableCell><IssueStatusBadge issue={issue} /></TableCell>
                      <TableCell><IssuePriorityBadge priority={issue.priority} /></TableCell>
                      <TableCell>
                        {/* The list only carries a count of assignees */}
                        {issue.assignee_count > 0 ? (
                          <span className="text-xs">
                            {issue.assignee_count} assignee{issue.assignee_count !== 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell className={cn('text-xs', overdue ? 'font-medium text-red-600' : 'text-muted-foreground')}>
                        {formatDate(issue.due_date ?? undefined)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}

        <InfiniteScrollTrigger
          {...list.trigger}
          disabled={list.trigger.disabled || list.showSkeleton}
          endMessage={issues.length > 25 ? 'No more issues' : undefined}
        />
      </CardContent>
    </Card>
  );
}
