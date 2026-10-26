import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { format, isToday, isYesterday } from 'date-fns';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, CheckCheck, CheckCircle2, ChevronRight,
  CircleDot, Clock, FilePlus2, FileText, FolderKanban, MessageSquare, Paperclip, Pause, Pencil, Play,
  RefreshCw, RotateCcw, RotateCw, ShieldCheck, UserMinus, UserPlus, type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useAppSelector } from '@/redux/hooks';
import { selectAuth } from '@/redux/features/auth/auth-slice';
import { parseApiError } from '@/lib/api-error';
import {
  ISSUE_PRIORITY_META, formatDate, formatRelativeTime, getAvatarColor, isIssueClosed, isOverdue,
} from '@/lib/shared-utils';
import { getProjectInitials } from '@/lib/project-utils';
import { issuesUrl } from '@/lib/issues-url';
import { useGetDashboardQuery } from '@/redux/features/dashboard/dashboard-api';
import type { DashboardActivity, DashboardData, DashboardProject, DashboardStatusCount } from '@/redux/features/dashboard/dashboard-types';
import { useGetIssuesInfiniteQuery } from '@/redux/features/issues/issues-api';
import { IssuePriorityBadge, IssueStatusBadge } from '@/components/issues/issue-badges';
import { ProjectSelect } from '@/components/projects/project-select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** Icon per status slug; statuses are configurable, so unknown ones get a dot */
const STATUS_ICONS: Record<string, LucideIcon> = {
  new: FileText,
  pending: Clock,
  'on-hold': Pause,
  progress: Play,
  'in-progress': Play,
  reassign: RotateCcw,
  resolved: CheckCircle2,
  closed: CheckCheck,
};

const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  status: RefreshCw,
  'issue.created': FilePlus2,
  'issue.updated': Pencil,
  'issue.confirmed': ShieldCheck,
  'assignee.added': UserPlus,
  'assignee.removed': UserMinus,
  'comment.added': MessageSquare,
  'attachment.uploaded': Paperclip,
};

type SortKey = 'open' | 'progress' | 'due' | 'name';

const SORT_LABELS: Record<SortKey, string> = {
  open: 'Most open issues',
  progress: 'Least progress',
  due: 'Due soonest',
  name: 'Name',
};

const ISSUES_PER_PROJECT = 5;

/**
 * Whose issues each project card lists. Super admins oversee everything, so they see
 * every open issue; reporters raise issues rather than work on them, so they see what
 * they reported; everyone else sees what's assigned to them.
 */
type IssueFocus = 'all' | 'assigned' | 'reported';

const FOCUS_TEXT: Record<IssueFocus, { empty: string; more: string }> = {
  all: { empty: 'No open issues in this project.', more: 'the open issues' },
  assigned: { empty: 'No open issues assigned to you in this project.', more: 'your open issues' },
  reported: { empty: 'No open issues reported by you in this project.', more: 'the open issues you reported' },
};

/** The list filter for each focus; "all" sends no person filter at all */
function focusFilter(focus: IssueFocus, myId: number) {
  if (focus === 'assigned') return { assignee_id: myId };
  if (focus === 'reported') return { reported_by: myId };
  return {};
}

/** The issues page filtered the same way as the card */
function focusIssuesUrl(focus: IssueFocus, projectId: number) {
  if (focus === 'assigned') return issuesUrl({ project: projectId, assignee: 'me' });
  if (focus === 'reported') return issuesUrl({ project: projectId, reporter: 'me' });
  return issuesUrl({ project: projectId });
}
const ACTIVITY_LIMIT = 8;

function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatUpdated(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return `Today, ${format(d, 'hh:mm a')}`;
  if (isYesterday(d)) return `Yesterday, ${format(d, 'hh:mm a')}`;
  return format(d, 'MMM d, yyyy, hh:mm a');
}

const openCount = (p: DashboardProject) => p.total - p.closed;

function sortProjects(projects: DashboardProject[], sortBy: SortKey): DashboardProject[] {
  const list = [...projects];
  switch (sortBy) {
    case 'open':
      return list.sort((a, b) => openCount(b) - openCount(a));
    case 'progress':
      return list.sort((a, b) => a.progress - b.progress);
    case 'due':
      // Projects without a due date go last
      return list.sort((a, b) =>
        (a.due_date ? Date.parse(a.due_date) : Infinity) - (b.due_date ? Date.parse(b.due_date) : Infinity));
    case 'name':
      return list.sort((a, b) => a.name.localeCompare(b.name));
  }
}

/** The dashboard for every role; the API scopes the numbers to what the user can see */
export function DashboardOverview() {
  const { session, isSuperAdmin } = useAuth();
  const defaultRole = useAppSelector(selectAuth).user?.default_role;
  const focus: IssueFocus = isSuperAdmin ? 'all' : defaultRole === 'Reporter' ? 'reported' : 'assigned';
  const [sortBy, setSortBy] = useState<SortKey>('open');
  // ?project=13 shows that project's dashboard; kept in the URL so a reload stays on it
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get('project') ?? '';
  const setProjectId = (id: string) =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set('project', id);
      else next.delete('project');
      return next;
    }, { replace: true });

  const { data, isLoading, isError, error, isFetching, refetch } = useGetDashboardQuery(
    projectId ? Number(projectId) : undefined,
  );
  const projects = useMemo(() => (data ? sortProjects(data.projects, sortBy) : []), [data, sortBy]);

  if (!session) return null;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Greeting + scope */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {greeting()}, {session.user.name} <span aria-hidden>👋</span>
          </h1>
          <p className="mt-1 text-muted-foreground">
            {data?.scope.project
              ? `Here's the overview of ${data.scope.project.name}.`
              : isSuperAdmin
                ? 'System overview across all projects and teams.'
                : "Here's your project and incident overview."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ProjectSelect value={projectId} onChange={setProjectId} allLabel="All projects" className="w-full sm:w-[220px]" />
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Refresh dashboard"
            title="Refresh"
          >
            <RotateCw className={cn('h-4 w-4', isFetching && !isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <DashboardSkeleton />
      ) : isError || !data ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-sm">
            <span className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {parseApiError(error, 'Failed to load the dashboard.').message}
            </span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Status counters: exactly the statuses the API sends (they differ by role and project) */}
          {data.by_status.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
              {data.by_status.map((s) => (
                <StatusCard key={s.status_id} status={s} to={issuesUrl({ project: projectId, status: s.status_id })} />
              ))}
            </div>
          )}

          <WeekSummary data={data} myIssuesUrl={issuesUrl({ project: projectId, assignee: 'me' })} />

          <div className="grid gap-6 lg:grid-cols-2">
            {data.projects.length > 0 && <IssueProgressCard projects={projects} />}
            <PriorityCard data={data} />
          </div>

          {/* My projects */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold tracking-tight">{data.scope.project ? 'Project' : isSuperAdmin ? 'Projects' : 'My Projects'}</h2>
              {data.projects.length > 1 && (
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                  <SelectTrigger className="h-9 w-[200px] bg-card">
                    <span className="flex items-center gap-1 truncate">
                      <span className="text-muted-foreground">Sort by:</span>
                      <span className="font-medium"><SelectValue /></span>
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                      <SelectItem key={key} value={key}>{SORT_LABELS[key]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {projects.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <FolderKanban className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="mt-4 font-semibold">No projects yet</h3>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Projects you are added to, and the issues assigned to you, will show up here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              projects.map((p) => (
                <ProjectIssuesCard
                  key={p.id}
                  project={p}
                  myId={Number(session.user.id)}
                  focus={focus}
                  // Super admins read the admin list, which covers projects they aren't a member of
                  scope={isSuperAdmin ? 'admin' : 'my'}
                />
              ))
            )}
          </section>

          <RecentActivityCard activity={data.latest} />
        </>
      )}
    </div>
  );
}

/** One workflow status, tinted with its own color; opens the issues page filtered to it */
function StatusCard({ status, to }: { status: DashboardStatusCount; to: string }) {
  const Icon = STATUS_ICONS[status.slug] ?? CircleDot;
  const c = status.color;
  return (
    <Link
      to={to}
      className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      title={`See ${status.name} issues`}
    >
    <Card
      className="h-full shadow-none transition-shadow hover:shadow-md"
      style={{ borderColor: `${c}33`, backgroundColor: `${c}0d` }}
    >
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${c}26`, color: c }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0" style={{ color: c }}>
          <div className="truncate text-sm font-medium">{status.name}</div>
          <div className="text-2xl font-bold leading-tight">{status.count}</div>
        </div>
      </CardContent>
    </Card>
    </Link>
  );
}

/** Totals plus how this week compares with the last one */
function WeekSummary({ data, myIssuesUrl }: { data: DashboardData; myIssuesUrl: string }) {
  const { counters, trends } = data;
  const change = trends.issues_created_change_pct;
  const items: { label: string; value: number; hint?: React.ReactNode; tone?: string; to?: string }[] = [
    { label: 'Open issues', value: counters.open, hint: `${counters.closed} closed of ${counters.total}` },
    { label: 'Assigned to me', value: counters.my_open, hint: 'still open', to: myIssuesUrl },
    {
      label: 'Created this week',
      value: trends.issues_created_this_week,
      hint: change === null ? `${trends.issues_created_last_week} last week` : (
        <span className={cn('inline-flex items-center gap-0.5', change > 0 ? 'text-red-600' : change < 0 ? 'text-emerald-600' : '')}>
          {change > 0 ? <ArrowUpRight className="h-3 w-3" /> : change < 0 ? <ArrowDownRight className="h-3 w-3" /> : null}
          {Math.abs(change)}% vs last week
        </span>
      ),
    },
    { label: 'Closed this week', value: trends.issues_closed_this_week, tone: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Overdue', value: counters.overdue, tone: counters.overdue > 0 ? 'text-red-600 dark:text-red-400' : undefined },
    { label: 'Unassigned', value: counters.unassigned },
    {
      label: 'Needs attention',
      value: trends.needs_attention.issues,
      hint: `issues in ${trends.needs_attention.projects} project${trends.needs_attention.projects !== 1 ? 's' : ''}`,
      tone: trends.needs_attention.issues > 0 ? 'text-amber-600 dark:text-amber-400' : undefined,
    },
  ];

  return (
    <Card className="shadow-none">
      <CardContent className="grid grid-cols-2 gap-x-6 gap-y-4 p-4 sm:grid-cols-4 lg:grid-cols-7">
        {items.map((item) => {
          const body = (
            <>
              <div className="text-xs text-muted-foreground">{item.label}</div>
              <div className={cn('text-xl font-bold leading-tight', item.tone)}>{item.value}</div>
              {item.hint && <div className="truncate text-xs text-muted-foreground">{item.hint}</div>}
            </>
          );
          return item.to ? (
            <Link key={item.label} to={item.to} className="-m-1.5 min-w-0 rounded-md p-1.5 transition-colors hover:bg-accent/50">
              {body}
            </Link>
          ) : (
            <div key={item.label} className="min-w-0">{body}</div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/** Completion per project */
function IssueProgressCard({ projects }: { projects: DashboardProject[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Issue Progress</CardTitle>
        <CardDescription>How far along each project&apos;s issues are</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <TooltipProvider delayDuration={100}>
        {projects.map((p) => {
          const color = getAvatarColor(p.id);
          const overdue = isOverdue(p.due_date ?? undefined) && p.closed < p.total;
          return (
            <Tooltip key={p.id}>
            <TooltipTrigger asChild>
            <div className="group -mx-2 cursor-default space-y-1.5 rounded-md px-2 py-1.5 transition-colors hover:bg-accent/50">
              <div className="flex items-center justify-between gap-2 text-sm">
                <Link to={`/projects/${p.id}`} className="flex min-w-0 items-center gap-2 hover:text-primary">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
                  <span className="truncate font-medium">{p.name}</span>
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {p.progress}% · {p.closed}/{p.total} closed
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${p.progress}% done`}>
                <div className="h-full rounded-full transition-all group-hover:brightness-110" style={{ width: `${p.progress}%`, backgroundColor: color }} />
              </div>
            </div>
            </TooltipTrigger>
            <TooltipContent side="top" align="end" className="w-56 p-3">
              <ChartTip
                title={p.name}
                color={color}
                rows={[
                  ['Progress', `${p.progress}%`],
                  ['Open', openCount(p)],
                  ['Closed', p.closed],
                  ['Total issues', p.total],
                  ['Due', p.due_date ? formatDate(p.due_date) : 'No due date', overdue ? 'text-red-600' : undefined],
                ]}
              />
            </TooltipContent>
            </Tooltip>
          );
        })}
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}

function PriorityCard({ data }: { data: DashboardData }) {
  const rows: { key: string; label: string; color: string; count: number }[] = (['critical', 'high', 'medium', 'low'] as const).map((priority) => ({
    key: priority,
    label: ISSUE_PRIORITY_META[priority].label,
    color: ISSUE_PRIORITY_META[priority].color,
    count: data.by_priority.find((p) => p.priority === priority)?.count ?? 0,
  }));
  const none = data.by_priority.find((p) => p.priority === null)?.count ?? 0;
  if (none > 0) rows.push({ key: 'none', label: 'None', color: '#94a3b8', count: none });
  const max = Math.max(...rows.map((r) => r.count), 1);
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Priority Distribution</CardTitle>
        <CardDescription>{data.counters.total} issue{data.counters.total !== 1 ? 's' : ''} in total</CardDescription>
      </CardHeader>
      <CardContent className="flex items-end gap-4">
        <TooltipProvider delayDuration={100}>
        {rows.map((r) => {
          const share = total > 0 ? Math.round((r.count / total) * 100) : 0;
          return (
            <Tooltip key={r.key}>
              <TooltipTrigger asChild>
                <div className="group flex flex-1 cursor-default flex-col items-center gap-2 rounded-md py-1 transition-colors hover:bg-accent/50">
                  <div className="text-sm font-bold">{r.count}</div>
                  <div className="flex h-20 w-full items-end px-1">
                    <div
                      className="w-full rounded-t opacity-90 transition-all duration-500 group-hover:opacity-100 group-hover:brightness-110"
                      style={{ height: `${Math.max((r.count / max) * 100, 4)}%`, backgroundColor: r.color, minHeight: 4 }}
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground">{r.label}</div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="w-48 p-3">
                <ChartTip
                  title={`${r.label} priority`}
                  color={r.color}
                  rows={[
                    ['Issues', r.count],
                    ['Share of all issues', `${share}%`],
                  ]}
                />
              </TooltipContent>
            </Tooltip>
          );
        })}
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}

/** Tooltip body for the dashboard charts: a colored title and label/value rows */
function ChartTip({ title, color, rows }: {
  title: string;
  color: string;
  rows: [label: string, value: React.ReactNode, valueClass?: string][];
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 font-medium">
        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
        <span className="truncate">{title}</span>
      </div>
      <dl className="space-y-1 text-xs">
        {rows.map(([label, value, valueClass]) => (
          <div key={label} className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className={cn('font-medium tabular-nums', valueClass)}>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function RecentActivityCard({ activity }: { activity: DashboardActivity[] }) {
  if (activity.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent Activity</CardTitle>
        <CardDescription>Latest changes across your projects</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-x-8 gap-y-3 md:grid-cols-2">
        {activity.slice(0, ACTIVITY_LIMIT).map((a, i) => {
          const Icon = ACTIVITY_ICONS[a.type] ?? Activity;
          const body = (
            <>
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm">{a.summary}</div>
                <div className="truncate text-xs text-muted-foreground" title={new Date(a.occurred_at).toLocaleString()}>
                  {a.project?.name && `${a.project.name} · `}{formatRelativeTime(a.occurred_at)}
                </div>
              </div>
            </>
          );
          const key = `${a.occurred_at}-${a.type}-${i}`;
          return a.issue ? (
            <Link key={key} to={`/issues/${a.issue.id}`} className="-mx-2 flex items-start gap-3 rounded-md px-2 py-1 transition-colors hover:bg-accent/50">
              {body}
            </Link>
          ) : (
            <div key={key} className="flex items-start gap-3 py-1">{body}</div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/** A project with its open issues: all of them, assigned to me, or reported by me (see IssueFocus) */
function ProjectIssuesCard({ project, myId, focus, scope }: {
  project: DashboardProject;
  myId: number;
  focus: IssueFocus;
  scope: 'admin' | 'my';
}) {
  const navigate = useNavigate();
  const color = getAvatarColor(project.id);
  const { data, isLoading, isError } = useGetIssuesInfiniteQuery({
    scope,
    project_id: project.id,
    ...focusFilter(focus, myId),
    // The card only shows a handful, so fetch just that one page
    per_page: ISSUES_PER_PROJECT,
  });
  // Only the first page is ever loaded; the list has no "open only" filter, so closed ones are dropped here
  const firstPage = data?.pages[0];
  const visible = (firstPage?.items ?? []).filter((i) => !isIssueClosed(i));
  const total = firstPage?.meta.total ?? 0;
  const viewAll = focusIssuesUrl(focus, project.id);
  const overdue = isOverdue(project.due_date ?? undefined);

  return (
    <Card className="overflow-hidden border-l-4" style={{ borderLeftColor: color }}>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white"
              style={{ backgroundColor: color }}
            >
              {getProjectInitials(project)}
            </div>
            <div className="min-w-0">
              <Link to={`/projects/${project.id}`} className="font-semibold hover:text-primary">
                {project.name}
              </Link>
              <p className={cn('truncate text-sm', overdue ? 'text-red-600' : 'text-muted-foreground')}>
                {project.due_date ? `Due ${formatDate(project.due_date)}` : 'No due date'} · {project.progress}% done
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Chip label="Open" count={openCount(project)} className="bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" />
            <Chip label="Closed" count={project.closed} className="bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" />
            <Chip label="Total" count={project.total} className="bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300" />
            <Link to={viewAll} className="ml-1 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              View All <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/50 text-left text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">ID</th>
                <th className="px-4 py-2.5 font-medium">Title</th>
                <th className="px-4 py-2.5 font-medium">Priority</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Updated</th>
                <th className="w-10" aria-label="Open" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>
                ))
              ) : isError ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-destructive">Failed to load issues.</td></tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    {FOCUS_TEXT[focus].empty}
                  </td>
                </tr>
              ) : (
                visible.map((issue) => {
                  const updated = issue.updated_at ?? issue.created_at;
                  return (
                    <tr
                      key={issue.id}
                      onClick={() => navigate(`/issues/${issue.id}`)}
                      className="cursor-pointer transition-colors hover:bg-accent/50"
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">{issue.code}</td>
                      <td className="max-w-[320px] truncate px-4 py-3">
                        <Link to={`/issues/${issue.id}`} onClick={(e) => e.stopPropagation()} className="hover:text-primary">
                          {issue.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3"><IssuePriorityBadge priority={issue.priority} /></td>
                      <td className="px-4 py-3"><IssueStatusBadge issue={issue} /></td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatUpdated(updated)}</td>
                      <td className="px-2 py-3 text-muted-foreground">
                        <ChevronRight className="h-4 w-4" />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {total > ISSUES_PER_PROJECT && (
          <p className="text-xs text-muted-foreground">
            Showing the latest of {FOCUS_TEXT[focus].more} ({total} in total).{' '}
            <Link to={viewAll} className="font-medium text-primary hover:underline">View all</Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Chip({ label, count, className }: { label: string; count: number; className: string }) {
  return (
    <span className={cn('inline-flex items-center gap-3 rounded-full px-3 py-1 text-xs font-medium', className)}>
      {label}
      <span className="font-semibold">{count}</span>
    </span>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[76px] rounded-xl" />)}
      </div>
      <Skeleton className="h-20 rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
