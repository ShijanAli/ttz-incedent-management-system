import { useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { projectRepo, issueRepo, userRepo } from '@/lib/repository';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/shared/user-avatar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Download, BarChart3, TrendingUp, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  ISSUE_STATUS_META, ISSUE_PRIORITY_META, ISSUE_TYPE_META, ISSUE_STATUS_ORDER,
  PROJECT_STATUS_META, calculateProjectProgress, formatDate, isOverdue,
} from '@/lib/shared-utils';
import type { IssueStatus, IssuePriority, IssueType } from '@/lib/types';

export default function ReportsPage() {
  const { session, hasPermission } = useAuth();
  const [projectFilter, setProjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const data = useMemo(() => {
    if (!session) return null;
    const isSuperAdmin = session.roleNames.includes('Super Admin');
    const userId = session.user.id;

    const allProjects = projectRepo.all();
    const allIssues = issueRepo.all();

    const visibleProjects = isSuperAdmin
      ? allProjects
      : allProjects.filter((p) => p.memberIds.includes(userId));
    const visibleProjectIds = new Set(visibleProjects.map((p) => p.id));
    let visibleIssues = allIssues.filter((i) => visibleProjectIds.has(i.projectId));

    if (projectFilter !== 'all') visibleIssues = visibleIssues.filter((i) => i.projectId === projectFilter);
    if (statusFilter !== 'all') visibleIssues = visibleIssues.filter((i) => i.status === statusFilter);
    if (priorityFilter !== 'all') visibleIssues = visibleIssues.filter((i) => i.priority === priorityFilter);

    const statusCounts: Record<string, number> = {};
    ISSUE_STATUS_ORDER.forEach((s) => { statusCounts[s] = 0; });
    visibleIssues.forEach((i) => { statusCounts[i.status]++; });

    const priorityCounts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    visibleIssues.forEach((i) => { priorityCounts[i.priority]++; });

    const typeCounts: Record<string, number> = { bug: 0, incident: 0, task: 0, improvement: 0, security: 0 };
    visibleIssues.forEach((i) => { typeCounts[i.type]++; });

    const overdueCount = visibleIssues.filter((i) => isOverdue(i.dueDate, i.status)).length;
    const resolvedCount = visibleIssues.filter((i) => i.status === 'completed' || i.status === 'approved').length;
    const unassignedCount = visibleIssues.filter((i) => !i.assigneeId).length;

    const projectStats = visibleProjects.map((p) => {
      const pIssues = allIssues.filter((i) => i.projectId === p.id);
      const done = pIssues.filter((i) => i.status === 'completed' || i.status === 'approved').length;
      return {
        project: p,
        total: pIssues.length,
        done,
        progress: pIssues.length > 0 ? Math.round((done / pIssues.length) * 100) : 0,
        overdue: pIssues.filter((i) => isOverdue(i.dueDate, i.status)).length,
      };
    });

    const assigneeStats = visibleIssues
      .filter((i) => i.assigneeId)
      .reduce((acc, issue) => {
        if (!acc[issue.assigneeId!]) {
          acc[issue.assigneeId!] = { total: 0, resolved: 0, open: 0 };
        }
        acc[issue.assigneeId!].total++;
        if (issue.status === 'completed' || issue.status === 'approved') acc[issue.assigneeId!].resolved++;
        else acc[issue.assigneeId!].open++;
        return acc;
      }, {} as Record<string, { total: number; resolved: number; open: number }>);

    const workload = Object.entries(assigneeStats)
      .map(([uid, stats]) => ({
        user: userRepo.find(uid),
        ...stats,
      }))
      .filter((w) => w.user)
      .sort((a, b) => b.open - a.open);

    return {
      visibleProjects,
      visibleIssues,
      statusCounts,
      priorityCounts,
      typeCounts,
      overdueCount,
      resolvedCount,
      unassignedCount,
      projectStats,
      workload,
      total: visibleIssues.length,
    };
  }, [session, projectFilter, statusFilter, priorityFilter]);

  if (!session || !data) return null;

  if (!hasPermission('reports.view')) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Reports" breadcrumbs={[{ label: 'Reports' }]} />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Access restricted</h3>
            <p className="mt-1 text-sm text-muted-foreground">You don&apos;t have permission to view reports.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canExport = hasPermission('reports.export');

  const exportCSV = () => {
    if (!canExport) {
      toast.error('You do not have permission to export reports');
      return;
    }
    const rows = data.visibleIssues.map((i) => {
      const project = projectRepo.find(i.projectId);
      const reporter = userRepo.find(i.reporterId);
      const assignee = i.assigneeId ? userRepo.find(i.assigneeId) : null;
      return [
        i.key, i.title, project?.name || '', i.type, i.priority, i.status,
        reporter?.name || '', assignee?.name || 'Unassigned',
        i.severity || '', i.reproducibility || '',
        formatDate(i.createdAt), formatDate(i.dueDate), formatDate(i.resolvedAt),
        i.labels.join('; '),
      ];
    });
    const headers = ['Key', 'Title', 'Project', 'Type', 'Priority', 'Status', 'Reporter', 'Assignee', 'Severity', 'Reproducibility', 'Created', 'Due Date', 'Resolved', 'Labels'];
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `techtrioz-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported', { description: `${rows.length} issues exported to CSV.` });
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Reports & Analytics"
        description="Insights across projects and issues"
        breadcrumbs={[{ label: 'Reports' }]}
        actions={
          canExport && (
            <Button onClick={exportCSV}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          )
        }
      />

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Project" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {data.visibleProjects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {ISSUE_STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>{ISSUE_STATUS_META[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {Object.entries(ISSUE_PRIORITY_META).map(([val, meta]) => (
              <SelectItem key={val} value={val}>{meta.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground sm:ml-auto self-center">
          {data.total} issue{data.total !== 1 ? 's' : ''} matched
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
              <BarChart3 className="h-[18px] w-[18px] text-blue-600" />
            </div>
            <div className="text-2xl font-bold">{data.total}</div>
            <div className="text-xs text-muted-foreground">Total Issues</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
              <CheckCircle2 className="h-[18px] w-[18px] text-emerald-600" />
            </div>
            <div className="text-2xl font-bold">{data.resolvedCount}</div>
            <div className="text-xs text-muted-foreground">Resolved</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-red-50">
              <Clock className="h-[18px] w-[18px] text-red-600" />
            </div>
            <div className="text-2xl font-bold">{data.overdueCount}</div>
            <div className="text-xs text-muted-foreground">Overdue</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
              <AlertTriangle className="h-[18px] w-[18px] text-amber-600" />
            </div>
            <div className="text-2xl font-bold">{data.unassignedCount}</div>
            <div className="text-xs text-muted-foreground">Unassigned</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50">
              <TrendingUp className="h-[18px] w-[18px] text-violet-600" />
            </div>
            <div className="text-2xl font-bold">
              {data.total > 0 ? Math.round((data.resolvedCount / data.total) * 100) : 0}%
            </div>
            <div className="text-xs text-muted-foreground">Resolution Rate</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Status distribution chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Distribution</CardTitle>
            <CardDescription>Issues by workflow status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {ISSUE_STATUS_ORDER.map((status) => {
              const count = data.statusCounts[status] || 0;
              const pct = data.total > 0 ? Math.round((count / data.total) * 100) : 0;
              const meta = ISSUE_STATUS_META[status];
              return (
                <div key={status} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
                      {meta.label}
                    </span>
                    <span className="text-muted-foreground">{count} ({pct}%)</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Priority distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Priority Distribution</CardTitle>
            <CardDescription>Issues by priority level</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end gap-4">
            {(['critical', 'high', 'medium', 'low'] as const).map((priority) => {
              const count = data.priorityCounts[priority] || 0;
              const max = Math.max(...Object.values(data.priorityCounts), 1);
              const height = Math.max((count / max) * 100, 4);
              const meta = ISSUE_PRIORITY_META[priority];
              return (
                <div key={priority} className="flex flex-1 flex-col items-center gap-2">
                  <div className="text-sm font-bold">{count}</div>
                  <div className="w-full" style={{ height: '80px', display: 'flex', alignItems: 'flex-end' }}>
                    <div className="w-full rounded-t transition-all duration-500" style={{ height: `${height}%`, backgroundColor: meta.color, minHeight: '4px' }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground">{meta.label}</div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Type distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Issue Types</CardTitle>
            <CardDescription>Breakdown by category</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(ISSUE_TYPE_META).map(([type, meta]) => {
              const count = data.typeCounts[type] || 0;
              const pct = data.total > 0 ? Math.round((count / data.total) * 100) : 0;
              return (
                <div key={type} className="flex items-center justify-between">
                  <Badge variant="outline" className={meta.badgeClass}>{meta.label}</Badge>
                  <span className="text-sm text-muted-foreground">{count} ({pct}%)</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Project progress table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project Progress</CardTitle>
            <CardDescription>Completion rate by project</CardDescription>
          </CardHeader>
          <CardContent>
            {data.projectStats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No projects available.</p>
            ) : (
              <div className="space-y-3">
                {data.projectStats.map(({ project, total, done, progress, overdue }) => (
                  <div key={project.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded text-white text-[9px] font-bold flex items-center justify-center" style={{ backgroundColor: project.color }}>
                          {project.key.slice(0, 3)}
                        </div>
                        <span className="font-medium truncate max-w-[140px]">{project.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {done}/{total} · {progress}%{overdue > 0 && <span className="text-red-600 ml-1">· {overdue} overdue</span>}
                      </span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Assignee workload table */}
      {data.workload.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Assignee Workload</CardTitle>
            <CardDescription>Issue distribution by team member</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team Member</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Resolved</TableHead>
                    <TableHead className="text-right">Open</TableHead>
                    <TableHead className="text-right">Resolution Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.workload.map((w) => (
                    <TableRow key={w.user!.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserAvatar name={w.user!.name} color={w.user!.avatarColor} size="xs" />
                          <span className="text-sm font-medium">{w.user!.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm">{w.total}</TableCell>
                      <TableCell className="text-right text-sm text-emerald-600">{w.resolved}</TableCell>
                      <TableCell className="text-right text-sm text-amber-600">{w.open}</TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {w.total > 0 ? Math.round((w.resolved / w.total) * 100) : 0}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}