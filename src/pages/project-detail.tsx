import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  AlertCircle, Archive, Calendar, Loader2, Pencil, RotateCcw,
  Target, Trash2, Users as UsersIcon,
} from 'lucide-react';
import { issueRepo, userRepo } from '@/lib/repository';
import { useTabParam } from '@/hooks/use-tab-param';
import { parseApiError } from '@/lib/api-error';
import {
  ISSUE_PRIORITY_META, ISSUE_STATUS_META, formatDate,
} from '@/lib/shared-utils';
import {
  getProjectColor, getProjectInitials, getProjectPriorityMeta, getProjectProgress, getProjectStateMeta,
  memberRoleHas, projectCan, sortStatuses,
} from '@/lib/project-utils';
import { useGetProjectQuery } from '@/redux/features/projects/projects-api';
import type { ApiProject } from '@/redux/features/projects/projects-types';
import { PageHeader } from '@/components/shared/page-header';
import { ProjectFormDialog } from '@/components/projects/project-form-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ProjectMemberManager } from '@/components/projects/project-member-manager';
import { ProjectGroupManager } from '@/components/projects/project-group-manager';
import { ProjectActivity } from '@/components/projects/project-activity';
import { StatusWorkflowEditor } from '@/components/projects/status-workflow-editor';
import { ARCHIVED_STATE } from '@/components/projects/project-actions';
import { useProjectActions } from '@/components/projects/use-project-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { UserAvatar } from '@/components/shared/user-avatar';
import { StatusBadge } from '@/components/shared/status-badge';

const PROJECT_TABS = ['overview', 'members', 'workflow', 'issues', 'groups', 'activity'] as const;

export default function ProjectDetailPage() {
  const id = Number(useParams().id);
  const { data: project, isLoading, isError, error, refetch } = useGetProjectQuery(id, { skip: !Number.isFinite(id) });

  if (isLoading) return <ProjectDetailSkeleton />;

  if (isError || !project) {
    const apiError = parseApiError(error, 'Failed to load the project.');
    const forbidden = apiError.status === 403;
    const notFound = apiError.status === 404 || !Number.isFinite(id);
    return (
      <div className="animate-fade-in">
        <PageHeader
          title={forbidden ? 'Access restricted' : notFound ? 'Project not found' : 'Something went wrong'}
          breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: forbidden ? 'Restricted' : 'Not Found' }]}
        />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">
              {forbidden
                ? "You don't have access to this project"
                : notFound ? 'The project you are looking for does not exist.' : apiError.message}
            </h3>
            {forbidden && (
              <p className="mt-1 text-sm text-muted-foreground">Contact a project manager or administrator to be added.</p>
            )}
            <div className="mt-4 flex gap-2">
              {!forbidden && !notFound && <Button variant="outline" onClick={() => refetch()}>Retry</Button>}
              <Button variant="outline" asChild>
                <Link to="/projects">Back to projects</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <ProjectDetail project={project} />;
}

function ProjectDetail({ project }: { project: ApiProject }) {
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const actions = useProjectActions({ onDeleted: () => navigate('/projects', { replace: true }) });

  const [tab, setTab] = useTabParam(PROJECT_TABS, 'overview');

  // Issues and users are still mock data until the issues module moves to the API
  const projectKey = String(project.id);
  const allIssues = useMemo(() => issueRepo.byProject(projectKey), [projectKey]);
  const mockUsers = useMemo(() => userRepo.all(), []);

  const archived = project.status === ARCHIVED_STATE;
  const canEdit = projectCan(project, 'projects.edit');
  const canDelete = projectCan(project, 'projects.delete');
  const canManageMembers = projectCan(project, 'users.edit');

  const initials = getProjectInitials(project);
  const stateMeta = getProjectStateMeta(project.status);
  const priorityMeta = getProjectPriorityMeta(project.priority);
  const progress = getProjectProgress(project);
  const statuses = sortStatuses(project.statuses);
  const developers = project.members.filter((m) => m.role === 'Developer').length;
  const assigners = project.members.filter((m) => memberRoleHas(m, 'issues.assign')).length;
  const counts = project.issue_counts;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={project.name}
        description={project.description ?? undefined}
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: project.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {canEdit && !archived && (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
            {canEdit && archived && (
              <Button variant="outline" onClick={() => actions.request(project, 'restore')} className="text-emerald-600">
                <RotateCcw className="mr-2 h-4 w-4" />
                Restore
              </Button>
            )}
            {canEdit && !archived && (
              <Button variant="outline" onClick={() => actions.request(project, 'archive')} className="text-amber-600">
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </Button>
            )}
            {canDelete && (
              <Button variant="outline" onClick={() => actions.request(project, 'delete')} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        }
      />

      {/* Project header card */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white"
                style={{ backgroundColor: getProjectColor(project) }}
              >
                {initials}
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge label={stateMeta.label} className={stateMeta.badgeClass} />
                  {priorityMeta && <StatusBadge label={priorityMeta.label} className={priorityMeta.badgeClass} />}
                  <Badge variant="secondary" className="text-xs font-normal">Your role: {project.my_role}</Badge>
                </div>
                <p className="max-w-2xl text-sm text-muted-foreground">{project.description || 'No description.'}</p>
                {project.objective && (
                  <div className="flex items-start gap-2 pt-2">
                    <Target className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{project.objective}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {formatDate(project.start_date ?? undefined)} → {formatDate(project.due_date ?? undefined)}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <UsersIcon className="h-4 w-4" />
                {project.member_count} member{project.member_count !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Progress ({counts.closed} of {counts.total} issues closed)
              </span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members ({project.member_count})</TabsTrigger>
          <TabsTrigger value="workflow">Workflow ({statuses.length})</TabsTrigger>
          <TabsTrigger value="issues">Issues ({counts.total})</TabsTrigger>
          <TabsTrigger value="groups">Groups ({project.groups.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Issues" value={counts.total} hint={`${counts.open} open · ${counts.closed} closed`} />
            <StatCard label="Overdue Issues" value={counts.overdue} danger={counts.overdue > 0} />
            <StatCard label="Developers" value={developers} />
            <StatCard label="Issue Assigners" value={assigners} />
          </div>

          {/* Issue status breakdown */}
          <Card className="mt-4">
            <CardHeader><CardTitle className="text-base">Issue Status Breakdown</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {statuses.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No workflow statuses set up.</p>
              ) : (
                statuses.map((status) => {
                  const count = status.count ?? 0;
                  const pct = counts.total > 0 ? (count / counts.total) * 100 : 0;
                  return (
                    <div key={status.id} className="flex items-center gap-3">
                      <div className="w-28 truncate text-sm">{status.name}</div>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: status.color }} />
                      </div>
                      <div className="w-8 text-right text-sm font-medium">{count}</div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Members */}
        <TabsContent value="members">
          <ProjectMemberManager project={project} canManage={canManageMembers} />
        </TabsContent>

        {/* Workflow */}
        <TabsContent value="workflow">
          <StatusWorkflowEditor projectId={project.id} canEdit={canEdit && !archived} />
        </TabsContent>

        {/* Issues */}
        <TabsContent value="issues">
          <Card>
            <CardContent className="p-4">
              {allIssues.length === 0 ? (
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
                    {allIssues.map((issue) => {
                      const assignee = mockUsers.find((u) => u.id === issue.assigneeId);
                      const iStatusMeta = ISSUE_STATUS_META[issue.status];
                      const iPriorityMeta = ISSUE_PRIORITY_META[issue.priority];
                      return (
                        <TableRow key={issue.id} className="cursor-pointer hover:bg-muted/50">
                          <TableCell>
                            <Link to={`/issues/${issue.id}`} className="font-mono text-xs text-primary hover:underline">
                              {issue.key}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link to={`/issues/${issue.id}`} className="text-sm hover:text-primary">
                              {issue.title}
                            </Link>
                          </TableCell>
                          <TableCell><StatusBadge label={iStatusMeta.label} className={iStatusMeta.badgeClass} /></TableCell>
                          <TableCell><StatusBadge label={iPriorityMeta.label} className={iPriorityMeta.badgeClass} /></TableCell>
                          <TableCell>
                            {assignee ? (
                              <div className="flex items-center gap-2">
                                <UserAvatar name={assignee.name} color={assignee.avatarColor} image={assignee.avatarUrl} size="xs" />
                                <span className="text-xs">{assignee.name}</span>
                              </div>
                            ) : <span className="text-xs text-muted-foreground">Unassigned</span>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDate(issue.dueDate)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Groups */}
        <TabsContent value="groups">
          <ProjectGroupManager project={project} canManage={canManageMembers && !archived} />
        </TabsContent>

        {/* Activity */}
        <TabsContent value="activity">
          <ProjectActivity project={project} />
        </TabsContent>
      </Tabs>

      <ProjectFormDialog open={editOpen} onOpenChange={setEditOpen} project={project} />
      <ConfirmDialog {...actions.dialogProps} />
    </div>
  );
}

function StatCard({ label, value, hint, danger }: { label: string; value: number; hint?: string; danger?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`mt-1 text-2xl font-bold ${danger ? 'text-red-600' : ''}`}>{value}</div>
        {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function ProjectDetailSkeleton() {
  return (
    <div className="animate-fade-in space-y-6" aria-busy="true">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading project...
      </div>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-10 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    </div>
  );
}
