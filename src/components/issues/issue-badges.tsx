import { StatusBadge } from '@/components/shared/status-badge';
import { ISSUE_PRIORITY_META, ISSUE_SEVERITY_META, ISSUE_TYPE_META } from '@/lib/shared-utils';
import { cn } from '@/lib/utils';
import type { IssueColoredRef, IssueListItem } from '@/redux/features/issues/issues-types';

/** A badge tinted with an API-provided hex color (statuses, categories) */
export function ColoredBadge({ item, className }: { item: IssueColoredRef; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium', className)}
      style={{ color: item.color, borderColor: `${item.color}40`, backgroundColor: `${item.color}14` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
      {item.name}
    </span>
  );
}

const Dash = () => <span className="text-sm text-muted-foreground">—</span>;

export function IssueStatusBadge({ issue }: { issue: Pick<IssueListItem, 'status'> }) {
  return issue.status ? <ColoredBadge item={issue.status} /> : <Dash />;
}

/** Category when set, otherwise the issue type */
export function IssueTypeBadge({ issue }: { issue: Pick<IssueListItem, 'category' | 'issue_type'> }) {
  if (issue.category) return <ColoredBadge item={issue.category} />;
  const meta = issue.issue_type ? ISSUE_TYPE_META[issue.issue_type] : null;
  return meta ? <StatusBadge label={meta.label} className={meta.badgeClass} /> : <Dash />;
}

export function IssuePriorityBadge({ priority }: { priority: IssueListItem['priority'] }) {
  const meta = priority ? ISSUE_PRIORITY_META[priority] : null;
  return meta ? <StatusBadge label={meta.label} className={meta.badgeClass} /> : <Dash />;
}

export function IssueSeverityBadge({ severity }: { severity: IssueListItem['severity'] }) {
  const meta = severity ? ISSUE_SEVERITY_META[severity] : null;
  return meta ? <StatusBadge label={meta.label} className={meta.badgeClass} /> : <Dash />;
}

/** Thin progress bar with a percentage; amber when only some assignees are done */
export function IssueProgress({ issue }: { issue: Pick<IssueListItem, 'progress' | 'is_partial'> }) {
  return (
    <div className="flex items-center gap-2" title={issue.is_partial ? 'Partially done: some assignees have finished' : undefined}>
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', issue.is_partial ? 'bg-amber-500' : 'bg-primary')}
          style={{ width: `${Math.min(100, Math.max(0, issue.progress))}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{issue.progress}%</span>
    </div>
  );
}
