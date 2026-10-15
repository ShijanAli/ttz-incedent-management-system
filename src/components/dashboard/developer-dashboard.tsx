import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { format, isToday, isYesterday } from 'date-fns';
import {
  ArrowRight, ChevronRight, CircleUser, Clock, FileText, FolderKanban, Pause, Play,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { projectRepo, issueRepo } from '@/lib/repository';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Issue, IssuePriority, IssueStatus, Project, ProjectPriority } from '@/lib/types';

/**
 * Developer-facing names for the workflow statuses.
 * "Pending" = work finished by the developer and waiting on approval (status `completed`).
 */
const DEV_STATUS: Record<IssueStatus, { label: string; badge: string; bar: string }> = {
  todo: {
    label: 'New',
    badge: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    bar: 'bg-blue-500',
  },
  completed: {
    label: 'Pending',
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    bar: 'bg-amber-500',
  },
  on_hold: {
    label: 'On Hold',
    badge: 'bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
    bar: 'bg-purple-500',
  },
  in_progress: {
    label: 'In Progress',
    badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    bar: 'bg-emerald-500',
  },
  approved: {
    label: 'Approved',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300',
    bar: 'bg-slate-400',
  },
};

/** Statuses shown as counters and chips, in display order */
const ACTIVE_STATUSES: IssueStatus[] = ['todo', 'completed', 'on_hold', 'in_progress'];

const PRIORITY_BADGE: Record<IssuePriority, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
  high: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300',
  medium: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300',
};

const PRIORITY_RANK: Record<IssuePriority | ProjectPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const STAT_CARDS: {
  status: IssueStatus;
  icon: typeof FileText;
  card: string;
  iconWrap: string;
  text: string;
}[] = [
  {
    status: 'todo',
    icon: FileText,
    card: 'border-blue-100 bg-blue-50/40 dark:border-blue-500/20 dark:bg-blue-500/5',
    iconWrap: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300',
    text: 'text-blue-600 dark:text-blue-300',
  },
  {
    status: 'completed',
    icon: Clock,
    card: 'border-amber-100 bg-amber-50/50 dark:border-amber-500/20 dark:bg-amber-500/5',
    iconWrap: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300',
    text: 'text-amber-600 dark:text-amber-300',
  },
  {
    status: 'on_hold',
    icon: Pause,
    card: 'border-purple-100 bg-purple-50/50 dark:border-purple-500/20 dark:bg-purple-500/5',
    iconWrap: 'bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300',
    text: 'text-purple-600 dark:text-purple-300',
  },
  {
    status: 'in_progress',
    icon: Play,
    card: 'border-emerald-100 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/5',
    iconWrap: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300',
    text: 'text-emerald-600 dark:text-emerald-300',
  },
];

type SortKey = 'priority' | 'updated' | 'open' | 'name';

const SORT_LABELS: Record<SortKey, string> = {
  priority: 'Priority',
  updated: 'Recently updated',
  open: 'Most open issues',
  name: 'Name',
};

const ISSUES_PER_PROJECT = 5;

interface ProjectGroup {
  project: Project;
  /** All issues assigned to me in this project */
  issues: Issue[];
  /** Assigned issues that are not yet approved, highest priority first */
  openIssues: Issue[];
  counts: Record<IssueStatus, number>;
  lastUpdated: number;
}

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

function emptyCounts(): Record<IssueStatus, number> {
  return { todo: 0, in_progress: 0, completed: 0, approved: 0, on_hold: 0 };
}

export function DeveloperDashboard() {
  const { session } = useAuth();
  const [sortBy, setSortBy] = useState<SortKey>('priority');

  const userId = session?.user.id;

  const data = useMemo(() => {
    if (!userId) return null;
    const myIssues = issueRepo.all().filter((i) => i.assigneeId === userId);

    const totals = emptyCounts();
    myIssues.forEach((i) => { totals[i.status]++; });

    const myProjectIds = new Set(myIssues.map((i) => i.projectId));
    const projects = projectRepo
      .all()
      .filter((p) => p.status !== 'archived' && (p.memberIds.includes(userId) || myProjectIds.has(p.id)));

    const groups: ProjectGroup[] = projects.map((project) => {
      const issues = myIssues.filter((i) => i.projectId === project.id);
      const counts = emptyCounts();
      issues.forEach((i) => { counts[i.status]++; });
      const openIssues = issues
        .filter((i) => i.status !== 'approved')
        .sort((a, b) =>
          PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      const lastUpdated = Math.max(
        new Date(project.updatedAt).getTime(),
        ...issues.map((i) => new Date(i.updatedAt).getTime()),
      );
      return { project, issues, openIssues, counts, lastUpdated };
    });

    return { myIssues, totals, groups };
  }, [userId]);

  const sortedGroups = useMemo(() => {
    if (!data) return [];
    const list = [...data.groups];
    switch (sortBy) {
      case 'priority':
        return list.sort((a, b) =>
          PRIORITY_RANK[a.project.priority] - PRIORITY_RANK[b.project.priority] ||
          b.openIssues.length - a.openIssues.length);
      case 'updated':
        return list.sort((a, b) => b.lastUpdated - a.lastUpdated);
      case 'open':
        return list.sort((a, b) => b.openIssues.length - a.openIssues.length);
      case 'name':
        return list.sort((a, b) => a.project.name.localeCompare(b.project.name));
    }
  }, [data, sortBy]);

  if (!session || !data) return null;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {greeting()}, {session.user.name} <span aria-hidden>👋</span>
        </h1>
        <p className="mt-1 text-muted-foreground">Here&apos;s your project and incident overview.</p>
      </div>

      {/* Status counters */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {STAT_CARDS.map(({ status, icon: Icon, card, iconWrap, text }) => (
          <Card key={status} className={cn('shadow-none', card)}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', iconWrap)}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className={cn('text-sm font-medium', text)}>{DEV_STATUS[status].label}</div>
                <div className={cn('text-2xl font-bold leading-tight', text)}>{data.totals[status]}</div>
              </div>
            </CardContent>
          </Card>
        ))}
        <Card className="col-span-2 shadow-none sm:col-span-1">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <CircleUser className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-muted-foreground">Total Assigned to Me</div>
              <div className="text-2xl font-bold leading-tight">{data.myIssues.length}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Issue progress */}
      {data.groups.some((g) => g.issues.length > 0) && <IssueProgressCard groups={sortedGroups} />}

      {/* My projects */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">My Projects</h2>
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
        </div>

        {sortedGroups.length === 0 ? (
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
          sortedGroups.map((group) => <ProjectIssuesCard key={group.project.id} group={group} />)
        )}
      </section>
    </div>
  );
}

function StatusChip({ status, count }: { status: IssueStatus; count: number }) {
  return (
    <span className={cn('inline-flex items-center gap-3 rounded-full px-3 py-1 text-xs font-medium', DEV_STATUS[status].badge)}>
      {DEV_STATUS[status].label}
      <span className="font-semibold">{count}</span>
    </span>
  );
}

function ProjectIssuesCard({ group }: { group: ProjectGroup }) {
  const navigate = useNavigate();
  const { project, openIssues, counts } = group;
  const visible = openIssues.slice(0, ISSUES_PER_PROJECT);

  return (
    <Card className="overflow-hidden border-l-4" style={{ borderLeftColor: project.color }}>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white"
              style={{ backgroundColor: project.color }}
            >
              {project.key.slice(0, 3)}
            </div>
            <div className="min-w-0">
              <Link to={`/projects/${project.id}`} className="font-semibold hover:text-primary">
                {project.name}
              </Link>
              <p className="truncate text-sm text-muted-foreground">{project.description}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {ACTIVE_STATUSES.map((s) => <StatusChip key={s} status={s} count={counts[s]} />)}
            <Link
              to={`/projects/${project.id}`}
              className="ml-1 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
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
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    No open issues assigned to you in this project.
                  </td>
                </tr>
              ) : (
                visible.map((issue) => (
                  <tr
                    key={issue.id}
                    onClick={() => navigate(`/issues/${issue.id}`)}
                    className="cursor-pointer transition-colors hover:bg-accent/50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">{issue.key}</td>
                    <td className="max-w-[320px] truncate px-4 py-3">
                      <Link to={`/issues/${issue.id}`} onClick={(e) => e.stopPropagation()} className="hover:text-primary">
                        {issue.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize', PRIORITY_BADGE[issue.priority])}>
                        {issue.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium', DEV_STATUS[issue.status].badge)}>
                        {DEV_STATUS[issue.status].label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatUpdated(issue.updatedAt)}</td>
                    <td className="px-2 py-3 text-muted-foreground">
                      <ChevronRight className="h-4 w-4" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {openIssues.length > ISSUES_PER_PROJECT && (
          <p className="text-xs text-muted-foreground">
            Showing {ISSUES_PER_PROJECT} of {openIssues.length} open issues.{' '}
            <Link to={`/projects/${project.id}`} className="font-medium text-primary hover:underline">View all</Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Per-project breakdown of my assigned issues; replaces the old "Project Progress" card. */
function IssueProgressCard({ groups }: { groups: ProjectGroup[] }) {
  const withIssues = groups.filter((g) => g.issues.length > 0);
  const order: IssueStatus[] = ['approved', 'completed', 'in_progress', 'on_hold', 'todo'];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Issue Progress</CardTitle>
        <CardDescription>How far along your assigned issues are in each project</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {order.map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={cn('h-2.5 w-2.5 rounded-full', DEV_STATUS[s].bar)} />
              {DEV_STATUS[s].label}
            </span>
          ))}
        </div>

        <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
          {withIssues.map(({ project, issues, counts }) => {
            const total = issues.length;
            const resolved = counts.approved;
            const pct = Math.round((resolved / total) * 100);
            return (
              <div key={project.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <Link to={`/projects/${project.id}`} className="flex min-w-0 items-center gap-2 hover:text-primary">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: project.color }} />
                    <span className="truncate font-medium">{project.name}</span>
                  </Link>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {pct}% · {resolved}/{total} resolved
                  </span>
                </div>
                <div
                  className="flex h-2 overflow-hidden rounded-full bg-muted"
                  role="img"
                  aria-label={order.map((s) => `${DEV_STATUS[s].label} ${counts[s]}`).join(', ')}
                >
                  {order.map((s) =>
                    counts[s] > 0 ? (
                      <div
                        key={s}
                        className={cn('h-full', DEV_STATUS[s].bar)}
                        style={{ width: `${(counts[s] / total) * 100}%` }}
                        title={`${DEV_STATUS[s].label}: ${counts[s]}`}
                      />
                    ) : null,
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
