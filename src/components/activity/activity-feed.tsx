import { useMemo } from 'react';
import {
  ArrowRight, GitBranch, Link2, Pencil, Plus, Trash2, UserPlus, Activity as ActivityIcon, type LucideIcon,
} from 'lucide-react';
import { UserAvatar } from '@/components/shared/user-avatar';
import { Badge } from '@/components/ui/badge';
import {
  activityDayLabel, describeActivity, type ActivityDescription, type ActivityTone,
} from '@/lib/activity-utils';
import { formatRelativeTime, getAvatarColor } from '@/lib/shared-utils';
import { cn } from '@/lib/utils';
import type { ActivityEntry } from '@/redux/features/activity/activity-types';

const TONE_STYLE: Record<ActivityTone, { icon: LucideIcon; className: string }> = {
  create: { icon: Plus, className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' },
  update: { icon: Pencil, className: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400' },
  delete: { icon: Trash2, className: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400' },
  member: { icon: UserPlus, className: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400' },
  group: { icon: Link2, className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400' },
  workflow: { icon: GitBranch, className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' },
  neutral: { icon: ActivityIcon, className: 'bg-muted text-muted-foreground' },
};

interface ActivityFeedProps {
  entries: ActivityEntry[];
  /** Maps user ids found in entries (e.g. the added member) to names */
  resolveUserName?: (id: number) => string | undefined;
  /** The page's own subject type, so its entries read "the project" */
  contextType?: string;
}

/** Activity timeline grouped by day. Data-agnostic: pass entries from any activity endpoint. */
export function ActivityFeed({ entries, resolveUserName = () => undefined, contextType = 'Project' }: ActivityFeedProps) {
  const days = useMemo(() => {
    const groups: { label: string; items: ActivityEntry[] }[] = [];
    for (const entry of entries) {
      const label = activityDayLabel(entry.created_at);
      const last = groups[groups.length - 1];
      if (last?.label === label) last.items.push(entry);
      else groups.push({ label, items: [entry] });
    }
    return groups;
  }, [entries]);

  return (
    <div className="space-y-6">
      {days.map((day) => (
        <section key={day.label} aria-label={day.label}>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{day.label}</h4>
          <ol className="relative space-y-4 border-l pl-6">
            {day.items.map((entry) => (
              <ActivityItem
                key={entry.id}
                entry={entry}
                description={describeActivity(entry, resolveUserName, contextType)}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function ActivityItem({ entry, description }: { entry: ActivityEntry; description: ActivityDescription }) {
  const tone = TONE_STYLE[description.tone];
  const Icon = tone.icon;
  const actor = entry.causer?.name ?? 'System';

  return (
    <li className="relative">
      <span
        className={cn('absolute -left-[37px] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background', tone.className)}
        aria-hidden
      >
        <Icon className="h-3 w-3" />
      </span>

      <div className="flex items-start gap-2.5">
        {entry.causer && <UserAvatar name={entry.causer.name} color={getAvatarColor(entry.causer.id)} size="xs" />}
        <div className="min-w-0 flex-1 text-sm">
          <p>
            <span className="font-medium">{actor}</span>{' '}
            <span className="text-muted-foreground">{description.action}</span>
          </p>
          <time
            dateTime={entry.created_at}
            title={new Date(entry.created_at).toLocaleString()}
            className="text-xs text-muted-foreground"
          >
            {formatRelativeTime(entry.created_at)}
          </time>

          {description.changes.length > 0 && entry.event !== 'created' && (
            <dl className="mt-2 space-y-1 rounded-lg border bg-muted/30 p-2.5 text-xs">
              {description.changes.map((change) => (
                <div key={change.field} className="flex flex-wrap items-center gap-1.5">
                  <dt className="font-medium">{change.field}:</dt>
                  <dd className="flex flex-wrap items-center gap-1.5">
                    <span className="text-muted-foreground line-through decoration-muted-foreground/50">{change.from}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" aria-label="changed to" />
                    <span>{change.to}</span>
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {description.workflow && (
            <div className="mt-2 space-y-1.5 rounded-lg border bg-muted/30 p-2.5 text-xs">
              <div className="flex flex-wrap items-center gap-1">
                {description.workflow.order.map((name, i) => (
                  <span key={name} className="flex items-center gap-1">
                    {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground" aria-hidden />}
                    <Badge
                      variant={name === description.workflow?.initial ? 'default' : 'secondary'}
                      className="text-[10px] font-normal"
                    >
                      {name}
                    </Badge>
                  </span>
                ))}
              </div>
              {description.workflow.added.length > 0 && (
                <p className="text-emerald-700 dark:text-emerald-400">Added: {description.workflow.added.join(', ')}</p>
              )}
              {description.workflow.removed.length > 0 && (
                <p className="text-rose-700 dark:text-rose-400">Removed: {description.workflow.removed.join(', ')}</p>
              )}
              {description.workflow.reordered && <p className="text-muted-foreground">Statuses were reordered.</p>}
              {description.workflow.terminal.length > 0 && (
                <p className="text-muted-foreground">Final: {description.workflow.terminal.join(', ')}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
