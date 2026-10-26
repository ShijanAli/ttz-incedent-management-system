import { useCallback, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { format, isToday, isYesterday } from 'date-fns';
import { toast } from 'sonner';
import {
  Activity as ActivityIcon, AlertTriangle, ArrowRight, CheckCircle2, Download, FilePlus2, Filter, GitBranch,
  History as HistoryIcon, Loader2, MessageSquare, Paperclip, Pencil, RefreshCw, RotateCcw, RotateCw, Trash2,
  UserMinus, UserPlus, Users, X, type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { parseApiError } from '@/lib/api-error';
import { getAvatarColor } from '@/lib/shared-utils';
import { cn } from '@/lib/utils';
import { useExportProjectAuditMutation, useGetProjectAuditInfiniteQuery } from '@/redux/features/activity/audit-api';
import type { AuditEntry, AuditFilters, AuditTypeFilter } from '@/redux/features/activity/activity-types';
import { useGetProjectMembersQuery, useGetProjectsInfiniteQuery } from '@/redux/features/projects/projects-api';
import type { ProjectMemberUser } from '@/redux/features/projects/projects-types';
import { PageHeader } from '@/components/shared/page-header';
import { ProjectSelect } from '@/components/projects/project-select';
import { UserAvatar } from '@/components/shared/user-avatar';
import { UserHoverCard } from '@/components/shared/user-hover-card';
import { InfiniteScrollTrigger } from '@/components/shared/infinite-scroll-trigger';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ALL = 'all';

const TYPE_OPTIONS: { value: AuditTypeFilter; label: string }[] = [
  { value: 'status', label: 'Status changes' },
  { value: 'issue', label: 'Issues' },
  { value: 'comment', label: 'Comments' },
  { value: 'attachment', label: 'Attachments' },
  { value: 'member', label: 'Members' },
];

/** Icon, tile color and a short label per entry type; unknown types get a generic one */
const TYPE_META: Record<string, { icon: LucideIcon; color: string; label: string }> = {
  status: { icon: RefreshCw, color: 'text-amber-600 bg-amber-50 dark:bg-amber-500/15', label: 'Status' },
  'issue.created': { icon: FilePlus2, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/15', label: 'Created' },
  'issue.updated': { icon: Pencil, color: 'text-blue-600 bg-blue-50 dark:bg-blue-500/15', label: 'Edited' },
  'issue.deleted': { icon: Trash2, color: 'text-red-600 bg-red-50 dark:bg-red-500/15', label: 'Deleted' },
  'issue.confirmed': { icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/15', label: 'Confirmed' },
  'issue.rechecked': { icon: RotateCcw, color: 'text-orange-600 bg-orange-50 dark:bg-orange-500/15', label: 'Sent back' },
  'assignee.added': { icon: UserPlus, color: 'text-blue-600 bg-blue-50 dark:bg-blue-500/15', label: 'Assigned' },
  'assignee.removed': { icon: UserMinus, color: 'text-orange-600 bg-orange-50 dark:bg-orange-500/15', label: 'Unassigned' },
  'comment.added': { icon: MessageSquare, color: 'text-violet-600 bg-violet-50 dark:bg-violet-500/15', label: 'Comment' },
  'attachment.uploaded': { icon: Paperclip, color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-500/15', label: 'File' },
  'attachment.deleted': { icon: Paperclip, color: 'text-red-600 bg-red-50 dark:bg-red-500/15', label: 'File removed' },
  'member.added': { icon: Users, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/15', label: 'Member added' },
  'member.removed': { icon: Users, color: 'text-red-600 bg-red-50 dark:bg-red-500/15', label: 'Member removed' },
  'project.statuses_changed': { icon: GitBranch, color: 'text-slate-600 bg-slate-100 dark:bg-slate-500/15', label: 'Workflow' },
};

const typeMeta = (type: string) =>
  TYPE_META[type] ?? {
    icon: ActivityIcon,
    color: 'text-muted-foreground bg-muted',
    label: type.replace(/[._]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase()),
  };

/** Readable names for the `field` column */
const FIELD_LABELS: Record<string, string> = {
  issue_status: 'Status',
  assignee_status: 'Assignee status',
  assignee: 'Assignee',
  comment: 'Comment',
  description: 'Description',
  title: 'Title',
  priority: 'Priority',
  severity: 'Severity',
  due_date: 'Due date',
  labels: 'Labels',
  status_set: 'Workflow',
};

const fieldLabel = (field: string) => FIELD_LABELS[field] ?? field.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/** Values longer than this are folded behind "Show change" */
const LONG_VALUE = 80;

/** URL query key per filter, e.g. ?project=13&type=status&from=2026-10-01 */
const PARAM = { project: 'project', type: 'type', actor: 'actor', issue: 'issue', from: 'from', to: 'to' } as const;

function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEEE, MMM d, yyyy');
}

export default function ActivityPage() {
  const { session, hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const get = (key: keyof typeof PARAM) => searchParams.get(PARAM[key]) ?? '';
  const projectId = get('project');
  const type = get('type');
  const actor = get('actor');
  const issue = get('issue');
  const from = get('from');
  const to = get('to');

  const setParams = useCallback(
    (changes: Partial<Record<keyof typeof PARAM, string>>) =>
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          const name = PARAM[key as keyof typeof PARAM];
          if (value) next.set(name, value);
          else next.delete(name);
        }
        return next;
      }, { replace: true }),
    [setSearchParams],
  );

  // The audit trail is per project, so open the first one when none is picked.
  // Same args as ProjectSelect, so this reuses its cached list.
  const projectList = useInfiniteList(useGetProjectsInfiniteQuery({ status: 'active' }));
  useEffect(() => {
    if (!projectId && projectList.items.length > 0) setParams({ project: String(projectList.items[0].id) });
  }, [projectId, projectList.items, setParams]);

  const filters = useMemo<AuditFilters>(() => ({
    type: (type || undefined) as AuditTypeFilter | undefined,
    actor_id: actor ? Number(actor) : undefined,
    issue_id: issue ? Number(issue) : undefined,
    from: from || undefined,
    to: to || undefined,
  }), [type, actor, issue, from, to]);

  const hasProject = Boolean(projectId);
  const list = useInfiniteList(
    useGetProjectAuditInfiniteQuery({ projectId: Number(projectId), ...filters }, { skip: !hasProject }),
  );
  const { data: members = [] } = useGetProjectMembersQuery(Number(projectId), { skip: !hasProject });
  const membersById = useMemo(() => new Map(members.map((m) => [m.user.id, m.user])), [members]);
  const [exportAudit, { isLoading: exporting }] = useExportProjectAuditMutation();

  // Entries grouped under a heading per day, newest first (the API's order)
  const days = useMemo(() => {
    const groups: { label: string; entries: AuditEntry[] }[] = [];
    for (const entry of list.items) {
      const label = dayLabel(entry.occurred_at);
      const last = groups[groups.length - 1];
      if (last?.label === label) last.entries.push(entry);
      else groups.push({ label, entries: [entry] });
    }
    return groups;
  }, [list.items]);

  if (!session) return null;

  if (!hasPermission('activity.view')) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Activity Log" breadcrumbs={[{ label: 'Activity Log' }]} />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <HistoryIcon className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Access restricted</h3>
            <p className="mt-1 text-sm text-muted-foreground">You don&apos;t have permission to view the activity log.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canExport = hasPermission('activity.export');
  const filterCount = [type, actor, issue, from, to].filter(Boolean).length;
  // The row's own code reads better than a bare id in the "Issue" chip
  const issueCode = list.items.find((e) => String(e.issue?.id) === issue)?.issue?.code ?? `#${issue}`;

  const handleExport = async () => {
    const stamp = format(new Date(), 'yyyy-MM-dd');
    try {
      await exportAudit({ projectId: Number(projectId), ...filters, fileName: `audit-project-${projectId}-${stamp}.csv` }).unwrap();
      toast.success('Audit log exported');
    } catch (err) {
      toast.error('Export failed', { description: parseApiError(err).message });
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Activity Log"
        description="Who changed what, and when, in each project"
        breadcrumbs={[{ label: 'Activity Log' }]}
        actions={
          canExport && (
            <Button variant="outline" onClick={handleExport} disabled={!hasProject || exporting}>
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Export CSV
            </Button>
          )
        }
      />

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
          <FilterField label="Project">
            <ProjectSelect
              value={projectId}
              // A new project has other people and issues, so those filters reset
              onChange={(id) => setParams({ project: id, actor: '', issue: '' })}
              className="w-full"
            />
          </FilterField>
          <FilterField label="Type">
            <Select value={type || ALL} onValueChange={(v) => setParams({ type: v === ALL ? '' : v })}>
              <SelectTrigger aria-label="Filter by type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All types</SelectItem>
                {TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Done by">
            <Select value={actor || ALL} onValueChange={(v) => setParams({ actor: v === ALL ? '' : v })} disabled={!hasProject}>
              <SelectTrigger aria-label="Filter by person"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Anyone</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.user.id} value={String(m.user.id)}>{m.user.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="From" htmlFor="auditFrom">
            <Input id="auditFrom" type="date" value={from} max={to || undefined} onChange={(e) => setParams({ from: e.target.value })} />
          </FilterField>
          <FilterField label="To" htmlFor="auditTo">
            <Input id="auditTo" type="date" value={to} min={from || undefined} onChange={(e) => setParams({ to: e.target.value })} />
          </FilterField>
          <div className="flex items-end justify-between gap-2 lg:justify-end">
            {filterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setParams({ type: '', actor: '', issue: '', from: '', to: '' })}
              >
                <X className="mr-1.5 h-4 w-4" /> Clear
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={list.refresh}
              disabled={!hasProject || list.isFetching}
              aria-label="Refresh"
              title="Refresh"
            >
              <RotateCw className={cn('h-4 w-4', list.isRefreshing && 'animate-spin')} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {(issue || list.items.length > 0) && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {issue && (
            <Badge variant="secondary" className="gap-1 pr-1 font-normal">
              Issue {issueCode}
              <button
                type="button"
                onClick={() => setParams({ issue: '' })}
                className="rounded-sm p-0.5 hover:bg-muted-foreground/20"
                aria-label="Show all issues"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          <span className="ml-auto">{list.items.length} of {list.total} entr{list.total !== 1 ? 'ies' : 'y'}</span>
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          {!hasProject ? (
            projectList.showSkeleton ? <AuditSkeleton /> : (
              <EmptyState title="Pick a project" text="The activity log is kept per project. Choose one above." />
            )
          ) : list.showSkeleton ? (
            <AuditSkeleton />
          ) : list.isError ? (
            <div className="flex flex-col items-center gap-3 py-12 text-sm">
              <span className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {parseApiError(list.error, 'Failed to load the activity log.').message}
              </span>
              <Button variant="outline" size="sm" onClick={list.refresh}>Retry</Button>
            </div>
          ) : list.items.length === 0 ? (
            <EmptyState
              title="No activity found"
              text={filterCount > 0 ? 'No entries match your filters.' : 'Changes in this project will show up here.'}
            />
          ) : (
            <div className="space-y-6">
              {days.map((day) => (
                <section key={day.label}>
                  <h3 className="sticky top-0 z-10 mb-1 bg-card py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {day.label}
                  </h3>
                  <ol className="divide-y">
                    {day.entries.map((entry, i) => (
                      <AuditRow
                        key={`${entry.occurred_at}-${entry.type}-${entry.field}-${i}`}
                        entry={entry}
                        people={membersById}
                        onFilterIssue={(id) => setParams({ issue: String(id) })}
                        issueFiltered={Boolean(issue)}
                      />
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          )}
          <InfiniteScrollTrigger
            {...list.trigger}
            disabled={list.trigger.disabled || !hasProject || list.showSkeleton}
            endMessage={list.items.length > 0 ? 'No more entries' : undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function AuditRow({ entry, people, onFilterIssue, issueFiltered }: {
  entry: AuditEntry;
  people: Map<number, ProjectMemberUser>;
  onFilterIssue: (issueId: number) => void;
  issueFiltered: boolean;
}) {
  const meta = typeMeta(entry.type);
  const Icon = meta.icon;
  // Members carry the photo and contact details; the entry only has id + name
  const actor = entry.actor ? { ...entry.actor, ...people.get(entry.actor.id) } : null;
  const hasChange = entry.old !== null || entry.new !== null;
  const isLong = (entry.old?.length ?? 0) > LONG_VALUE || (entry.new?.length ?? 0) > LONG_VALUE;

  return (
    <li className="flex items-start gap-3 py-3">
      <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', meta.color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {actor ? (
            <span className="flex items-center gap-1.5">
              <UserHoverCard user={actor}>
                <UserAvatar name={actor.name} color={getAvatarColor(actor.id)} image={actor.photo_url ?? undefined} size="xs" />
              </UserHoverCard>
              <span className="font-medium">{actor.name}</span>
            </span>
          ) : (
            <span className="font-medium text-muted-foreground">System</span>
          )}
          <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">{meta.label}</Badge>
          {entry.field && (
            <span className="text-muted-foreground">
              {fieldLabel(entry.field)}
              {entry.subject_user && entry.field !== 'assignee' && <> of <span className="text-foreground">{entry.subject_user.name}</span></>}
            </span>
          )}
          {entry.issue && (
            <span className="flex min-w-0 items-center gap-1">
              <span className="text-muted-foreground">on</span>
              <Link to={`/issues/${entry.issue.id}`} className="font-mono text-xs text-primary hover:underline" title={entry.issue.title}>
                {entry.issue.code}
              </Link>
              <span className="hidden max-w-[260px] truncate text-muted-foreground md:inline">{entry.issue.title}</span>
              {!issueFiltered && (
                <button
                  type="button"
                  onClick={() => onFilterIssue(entry.issue!.id)}
                  className="rounded p-0.5 text-muted-foreground opacity-60 hover:bg-accent hover:opacity-100"
                  title={`Only show ${entry.issue.code}`}
                  aria-label={`Only show ${entry.issue.code}`}
                >
                  <Filter className="h-3 w-3" />
                </button>
              )}
            </span>
          )}
        </div>

        {hasChange && (
          entry.field === 'comment' ? (
            <p className="whitespace-pre-wrap rounded-md bg-muted/40 px-3 py-2 text-sm">{entry.new}</p>
          ) : isLong ? (
            <details className="group rounded-md border bg-muted/20 text-sm">
              <summary className="cursor-pointer select-none px-3 py-1.5 text-xs text-muted-foreground">Show change</summary>
              <div className="grid gap-2 border-t px-3 py-2 md:grid-cols-2">
                <ValueBlock label="Before" value={entry.old} tone="old" />
                <ValueBlock label="After" value={entry.new} tone="new" />
              </div>
            </details>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
              <ValueChip value={entry.old} tone="old" />
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              <ValueChip value={entry.new} tone="new" />
            </div>
          )
        )}

        {entry.note && <p className="text-sm italic text-muted-foreground">“{entry.note}”</p>}

        <div className="text-xs text-muted-foreground" title={new Date(entry.occurred_at).toLocaleString()}>
          {format(new Date(entry.occurred_at), 'hh:mm a')}
        </div>
      </div>
    </li>
  );
}

function ValueChip({ value, tone }: { value: string | null; tone: 'old' | 'new' }) {
  if (value === null) return <span className="text-xs italic text-muted-foreground">none</span>;
  return (
    <span
      className={cn(
        'rounded px-1.5 py-0.5 text-xs',
        tone === 'old'
          ? 'bg-red-50 text-red-700 line-through decoration-red-300 dark:bg-red-500/10 dark:text-red-300'
          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
      )}
    >
      {value}
    </span>
  );
}

function ValueBlock({ label, value, tone }: { label: string; value: string | null; tone: 'old' | 'new' }) {
  return (
    <div className="min-w-0">
      <div className={cn('mb-1 text-[10px] font-semibold uppercase', tone === 'old' ? 'text-red-600' : 'text-emerald-600')}>{label}</div>
      <p className="whitespace-pre-wrap break-words text-xs">{value ?? <span className="italic text-muted-foreground">none</span>}</p>
    </div>
  );
}

function FilterField({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <HistoryIcon className="mb-4 h-10 w-10 text-muted-foreground" />
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function AuditSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
