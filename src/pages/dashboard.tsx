import { useMemo } from 'react';
import { Link } from 'react-router';
import {
  FolderKanban, TicketCheck, AlertTriangle, Clock,
  CheckCircle2, TrendingUp, Users, Activity, ArrowRight,
  CircleDot, ListTodo, Pause,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { projectRepo, issueRepo, userRepo, activityRepo, getUserRoles, notificationRepo } from '@/lib/repository';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { UserAvatar } from '@/components/shared/user-avatar';
import {
  ISSUE_STATUS_META, ISSUE_PRIORITY_META, formatDate, formatRelativeTime,
  isOverdue, calculateProjectProgress, ISSUE_STATUS_ORDER,
} from '@/lib/shared-utils';
import type { IssueStatus } from '@/lib/types';

export default function DashboardPage() {
  const { session, hasPermission } = useAuth();

  const data = useMemo(() => {
    if (!session) return null;
    const userId = session.user.id;
    const isSuperAdmin = session.roleNames.includes('Super Admin');

    const allProjects = projectRepo.all();
    const allIssues = issueRepo.all();
    const allUsers = userRepo.all();
    const allActivity = activityRepo.all();
    const myNotifications = notificationRepo.byUser(userId);

    const visibleProjects = isSuperAdmin
      ? allProjects
      : allProjects.filter((p) => p.memberIds.includes(userId));

    const visibleProjectIds = new Set(visibleProjects.map((p) => p.id));
    const visibleIssues = allIssues.filter((i) => visibleProjectIds.has(i.projectId));

    const myAssignedIssues = allIssues.filter((i) => i.assigneeId === userId);
    const myReportedIssues = allIssues.filter((i) => i.reporterId === userId);

    const unresolvedIssues = visibleIssues.filter(
      (i) => i.status !== 'completed' && i.status !== 'approved'
    );
    const overdueIssues = visibleIssues.filter((i) => isOverdue(i.dueDate, i.status));
    const criticalIssues = visibleIssues.filter((i) => i.priority === 'critical' && i.status !== 'approved');
    const unassignedIssues = visibleIssues.filter((i) => !i.assigneeId && i.status !== 'approved');

    const statusCounts: Record<string, number> = {};
    ISSUE_STATUS_ORDER.forEach((s) => { statusCounts[s] = 0; });
    visibleIssues.forEach((i) => { statusCounts[i.status] = (statusCounts[i.status] || 0) + 1; });

    const priorityCounts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    visibleIssues.forEach((i) => { priorityCounts[i.priority]++; });

    const projectProgress = visibleProjects.map((p) => ({
      project: p,
      progress: calculateProjectProgress(p.id, allIssues),
      issueCount: allIssues.filter((i) => i.projectId === p.id).length,
    }));

    const developerWorkload = allUsers
      .filter((u) => {
        const roles = getUserRoles(u.id);
        return roles.some((r) => r.name === 'Developer' || r.name === 'QA Engineer' || r.name === 'Super Admin');
      })
      .map((dev) => {
        const devIssues = allIssues.filter((i) => i.assigneeId === dev.id);
        return {
          user: dev,
          total: devIssues.length,
          unresolved: devIssues.filter((i) => i.status !== 'completed' && i.status !== 'approved').length,
        };
      })
      .filter((d) => d.total > 0)
      .sort((a, b) => b.unresolved - a.unresolved)
      .slice(0, 5);

    const recentActivity = isSuperAdmin
      ? allActivity.slice(0, 8)
      : allActivity.filter((a) => a.projectId && visibleProjectIds.has(a.projectId)).slice(0, 8);

    const upcomingDeadlines = visibleIssues
      .filter((i) => i.dueDate && i.status !== 'completed' && i.status !== 'approved')
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 5);

    const unreadCount = myNotifications.filter((n) => !n.isRead).length;

    return {
      visibleProjects,
      visibleIssues,
      myAssignedIssues,
      myReportedIssues,
      unresolvedIssues,
      overdueIssues,
      criticalIssues,
      unassignedIssues,
      statusCounts,
      priorityCounts,
      projectProgress,
      developerWorkload,
      recentActivity,
      upcomingDeadlines,
      projectCount: visibleProjects.length,
      activeProjects: visibleProjects.filter((p) => p.status === 'active').length,
      completedProjects: visibleProjects.filter((p) => p.status === 'completed').length,
      onHoldProjects: visibleProjects.filter((p) => p.status === 'on_hold').length,
      totalIssues: visibleIssues.length,
      totalUsers: allUsers.length,
      unreadCount,
    };
  }, [session]);

  if (!session || !data) return null;

  const isSuperAdmin = session.roleNames.includes('Super Admin');
  const isDeveloper = session.roleNames.includes('Developer');
  const isAssigner = session.roleNames.includes('Issue Assigner');
  const isQA = session.roleNames.includes('QA Engineer');
  const isCustomer = !isSuperAdmin && !isDeveloper && !isAssigner && !isQA;

  const stats: { label: string; value: string | number; icon: typeof FolderKanban; color: string }[] = [];

  if (hasPermission('projects.view')) {
    stats.push(
      { label: 'Projects', value: data.projectCount, icon: FolderKanban, color: 'text-blue-600 bg-blue-50' },
      { label: 'Active', value: data.activeProjects, icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
    );
  }

  if (hasPermission('issues.view')) {
    stats.push(
      { label: 'Total Issues', value: data.totalIssues, icon: TicketCheck, color: 'text-violet-600 bg-violet-50' },
      { label: 'Unresolved', value: data.unresolvedIssues.length, icon: AlertTriangle, color: 'text-amber-600 bg-amber-50' },
      { label: 'Overdue', value: data.overdueIssues.length, icon: Clock, color: 'text-red-600 bg-red-50' },
      { label: 'Critical', value: data.criticalIssues.length, icon: AlertTriangle, color: 'text-orange-600 bg-orange-50' },
    );
  }

  if (hasPermission('notifications.view') && data.unreadCount > 0) {
    stats.push({ label: 'Unread', value: data.unreadCount, icon: CircleDot, color: 'text-pink-600 bg-pink-50' });
  }

  if (isSuperAdmin && hasPermission('users.view')) {
    stats.push({ label: 'Total Users', value: data.totalUsers, icon: Users, color: 'text-cyan-600 bg-cyan-50' });
  }

  const roleDescription = isSuperAdmin
    ? 'System overview across all projects and teams.'
    : isQA
    ? 'Issues awaiting your approval and testing queue.'
    : isDeveloper
    ? 'Your assigned work and project activity.'
    : isAssigner
    ? 'Issues you have reported and their status.'
    : 'Your customer dashboard.';

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={`Welcome, ${session.user.name.split(' ')[0]}`}
        description={roleDescription}
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 mb-6">
        {stats.length > 0 ? stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="overflow-hidden">
              <CardContent className="p-4">
                <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-lg ${stat.color}`}>
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                <div className="text-2xl font-bold tracking-tight">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          );
        }) : (
          <Card className="col-span-full">
            <CardContent className="p-6 text-center text-muted-foreground">
              No metrics available for your current role.
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-6">
          {/* My assigned issues (developer / QA / super admin) */}
          {(isDeveloper || isQA || isSuperAdmin) && hasPermission('issues.view') && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">My Assigned Issues</CardTitle>
                <CardDescription>
                  {data.myAssignedIssues.length === 0
                    ? 'No issues assigned to you'
                    : `${data.myAssignedIssues.filter((i) => i.status !== 'completed' && i.status !== 'approved').length} unresolved of ${data.myAssignedIssues.length} total`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.myAssignedIssues.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No issues assigned to you yet.</p>
                ) : (
                  data.myAssignedIssues.slice(0, 5).map((issue) => {
                    const project = projectRepo.find(issue.projectId);
                    return (
                      <Link
                        key={issue.id}
                        to={`/issues/${issue.id}`}
                        className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">{issue.key}</span>
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${ISSUE_STATUS_META[issue.status].badgeClass}`}
                            >
                              {ISSUE_STATUS_META[issue.status].label}
                            </span>
                          </div>
                          <div className="mt-1 truncate text-sm font-medium">{issue.title}</div>
                          <div className="text-xs text-muted-foreground">{project?.name}</div>
                        </div>
                        <div className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${ISSUE_PRIORITY_META[issue.priority].badgeClass}`}>
                          {ISSUE_PRIORITY_META[issue.priority].label}
                        </div>
                      </Link>
                    );
                  })
                )}
              </CardContent>
            </Card>
          )}

          {/* Issues I reported (assigner / customer) */}
          {(isAssigner || isCustomer || isDeveloper) && hasPermission('issues.view') && data.myReportedIssues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Issues I Reported</CardTitle>
                <CardDescription>Issues you have submitted</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.myReportedIssues.slice(0, 5).map((issue) => {
                  const project = projectRepo.find(issue.projectId);
                  return (
                    <Link
                      key={issue.id}
                      to={`/issues/${issue.id}`}
                      className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{issue.key}</span>
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${ISSUE_STATUS_META[issue.status].badgeClass}`}
                          >
                            {ISSUE_STATUS_META[issue.status].label}
                          </span>
                        </div>
                        <div className="mt-1 truncate text-sm font-medium">{issue.title}</div>
                        <div className="text-xs text-muted-foreground">{project?.name}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {issue.assigneeId ? 'Assigned' : 'Unassigned'}
                      </div>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Issues awaiting approval (QA) */}
          {isQA && hasPermission('issues.approve') && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Awaiting Approval</CardTitle>
                <CardDescription>Completed issues needing your review</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {(() => {
                  const awaiting = data.visibleIssues.filter((i) => i.status === 'completed');
                  if (awaiting.length === 0) {
                    return <p className="text-sm text-muted-foreground text-center py-4">No issues awaiting approval.</p>;
                  }
                  return awaiting.slice(0, 5).map((issue) => {
                    const project = projectRepo.find(issue.projectId);
                    return (
                      <Link
                        key={issue.id}
                        to={`/issues/${issue.id}`}
                        className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-mono text-xs text-muted-foreground">{issue.key}</span>
                          <div className="mt-0.5 truncate text-sm font-medium">{issue.title}</div>
                          <div className="text-xs text-muted-foreground">{project?.name}</div>
                        </div>
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      </Link>
                    );
                  });
                })()}
              </CardContent>
            </Card>
          )}

          {/* Unassigned issues (super admin) */}
          {isSuperAdmin && data.unassignedIssues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Unassigned Issues</CardTitle>
                <CardDescription>Awaiting assignment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.unassignedIssues.slice(0, 5).map((issue) => {
                  const project = projectRepo.find(issue.projectId);
                  return (
                    <Link
                      key={issue.id}
                      to={`/issues/${issue.id}`}
                      className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-mono text-xs text-muted-foreground">{issue.key}</span>
                        <div className="mt-0.5 truncate text-sm font-medium">{issue.title}</div>
                        <div className="text-xs text-muted-foreground">{project?.name}</div>
                      </div>
                      <div className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${ISSUE_PRIORITY_META[issue.priority].badgeClass}`}>
                        {ISSUE_PRIORITY_META[issue.priority].label}
                      </div>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Upcoming deadlines */}
          {hasPermission('issues.view') && data.upcomingDeadlines.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Upcoming Deadlines</CardTitle>
                <CardDescription>Issues due soon</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.upcomingDeadlines.map((issue) => {
                  const project = projectRepo.find(issue.projectId);
                  const overdue = isOverdue(issue.dueDate, issue.status);
                  return (
                    <Link
                      key={issue.id}
                      to={`/issues/${issue.id}`}
                      className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-mono text-xs text-muted-foreground">{issue.key}</span>
                        <div className="mt-0.5 truncate text-sm font-medium">{issue.title}</div>
                        <div className="text-xs text-muted-foreground">{project?.name}</div>
                      </div>
                      <div className={`shrink-0 text-xs font-medium ${overdue ? 'text-red-600' : 'text-muted-foreground'}`}>
                        {formatDate(issue.dueDate)}
                      </div>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Project progress (for users with project view) */}
          {hasPermission('projects.view') && data.projectProgress.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Project Progress</CardTitle>
                <CardDescription>Completion across your projects</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.projectProgress.slice(0, 5).map(({ project, progress, issueCount }) => (
                  <div key={project.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <Link to={`/projects/${project.id}`} className="flex items-center gap-2 hover:text-primary">
                        <div className="h-5 w-5 rounded text-white text-[9px] font-bold flex items-center justify-center" style={{ backgroundColor: project.color }}>
                          {project.key.slice(0, 3)}
                        </div>
                        <span className="font-medium truncate max-w-[180px]">{project.name}</span>
                      </Link>
                      <span className="text-xs text-muted-foreground">{progress}% · {issueCount} issues</span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Status distribution */}
          {hasPermission('issues.view') && data.totalIssues > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Issue Status Distribution</CardTitle>
                <CardDescription>Across your visible projects</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {ISSUE_STATUS_ORDER.map((status) => {
                  const count = data.statusCounts[status] || 0;
                  const pct = data.totalIssues > 0 ? Math.round((count / data.totalIssues) * 100) : 0;
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
          )}

          {/* Priority distribution */}
          {hasPermission('issues.view') && data.totalIssues > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Priority Distribution</CardTitle>
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
                        <div
                          className="w-full rounded-t transition-all duration-500"
                          style={{ height: `${height}%`, backgroundColor: meta.color, minHeight: '4px' }}
                        />
                      </div>
                      <div className="text-[10px] text-muted-foreground">{meta.label}</div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Developer workload (super admin) */}
          {isSuperAdmin && data.developerWorkload.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Developer Workload</CardTitle>
                <CardDescription>Top 5 by unresolved issues</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.developerWorkload.map((wl) => (
                  <div key={wl.user.id} className="flex items-center gap-3">
                    <UserAvatar name={wl.user.name} color={wl.user.avatarColor} image={wl.user.avatarUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{wl.user.name}</div>
                      <div className="text-xs text-muted-foreground">{wl.total} total, {wl.unresolved} unresolved</div>
                    </div>
                    <div className="text-sm font-bold text-amber-600">{wl.unresolved}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recent activity */}
          {hasPermission('activity.view') && data.recentActivity.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">Recent Activity</CardTitle>
                  <CardDescription>Across your projects</CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/activity">View all</Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.recentActivity.slice(0, 6).map((act) => {
                  const actor = userRepo.find(act.actorId);
                  return (
                    <div key={act.id} className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent">
                        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm">{act.summary}</div>
                        <div className="text-xs text-muted-foreground">
                          {actor?.name} · {formatRelativeTime(act.timestamp)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Empty state for customer / minimal roles */}
          {!hasPermission('projects.view') && !hasPermission('issues.view') && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">Welcome to your dashboard</h3>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Your account has limited access. Contact your administrator if you need access to additional features.
                </p>
                {hasPermission('notifications.view') && data.unreadCount > 0 && (
                  <Button variant="outline" className="mt-4" asChild>
                    <Link to="/notifications">
                      You have {data.unreadCount} unread notification{data.unreadCount !== 1 ? 's' : ''}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}