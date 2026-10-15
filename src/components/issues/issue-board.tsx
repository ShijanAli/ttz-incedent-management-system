import { useMemo } from 'react';
import { Link } from 'react-router';
import { AlertCircle, MessageSquare, Paperclip, Users as UsersIcon } from 'lucide-react';
import { IssuePriorityBadge, IssueProgress } from '@/components/issues/issue-badges';
import { formatDate, isOverdue } from '@/lib/shared-utils';
import { cn } from '@/lib/utils';
import type { IssueListItem } from '@/redux/features/issues/issues-types';

const NO_STATUS = { id: -1, name: 'No status', color: '#94a3b8' };

interface IssueBoardProps {
  issues: IssueListItem[];
}

/**
 * Board view of the loaded issues, one column per status (in first-seen order,
 * since statuses differ between projects). Read-only until a status-change API exists.
 */
export function IssueBoard({ issues }: IssueBoardProps) {
  const columns = useMemo(() => {
    const byStatus = new Map<number, { status: typeof NO_STATUS; items: IssueListItem[] }>();
    for (const issue of issues) {
      const status = issue.status ?? NO_STATUS;
      const column = byStatus.get(status.id) ?? { status, items: [] };
      column.items.push(issue);
      byStatus.set(status.id, column);
    }
    return [...byStatus.values()];
  }, [issues]);

  if (columns.length === 0) {
    return <div className="py-12 text-center text-muted-foreground">No issues to show.</div>;
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {columns.map(({ status, items }) => (
        <section key={status.id} className="flex w-72 shrink-0 flex-col rounded-xl bg-muted/40 p-3" aria-label={status.name}>
          <header className="mb-3 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />
            <h3 className="text-sm font-semibold">{status.name}</h3>
            <span className="ml-auto rounded-full bg-background px-2 text-xs tabular-nums text-muted-foreground">{items.length}</span>
          </header>
          <div className="space-y-2">
            {items.map((issue) => {
              const overdue = issue.progress < 100 && isOverdue(issue.due_date ?? undefined);
              return (
                <Link
                  key={issue.id}
                  to={`/issues/${issue.id}`}
                  className="block rounded-lg border bg-background p-3 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{issue.code}</span>
                    <IssuePriorityBadge priority={issue.priority} />
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm font-medium">{issue.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{issue.project.name}</p>
                  <div className="mt-2.5">
                    <IssueProgress issue={issue} />
                  </div>
                  <div className="mt-2.5 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1" title="Assignees"><UsersIcon className="h-3 w-3" />{issue.assignee_count}</span>
                    <span className="flex items-center gap-1" title="Comments"><MessageSquare className="h-3 w-3" />{issue.comment_count}</span>
                    <span className="flex items-center gap-1" title="Attachments"><Paperclip className="h-3 w-3" />{issue.attachment_count}</span>
                    {issue.due_date && (
                      <span className={cn('ml-auto flex items-center gap-1', overdue && 'font-medium text-red-600')}>
                        {overdue && <AlertCircle className="h-3 w-3" />}
                        {formatDate(issue.due_date)}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
