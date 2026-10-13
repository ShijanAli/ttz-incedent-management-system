import { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '@/lib/auth-context';
import {
  projectRepo, issueRepo, userRepo, activityRepo, groupRepo,
} from '@/lib/repository';
import {
  projectService, canUserViewProject, getProjectMembers, getProjectDevelopers, getProjectAssigners,
  getProjectMemberRole,
} from '@/lib/services';
import { PageHeader } from '@/components/shared/page-header';
import { ProjectFormDialog } from '@/components/projects/project-form-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { MemberManager } from '@/components/projects/member-manager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { UserAvatar } from '@/components/shared/user-avatar';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  Pencil, Archive, RotateCcw, Calendar, Users as UsersIcon, Target, Tag,
  MessageSquare, Activity as ActivityIcon, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  PROJECT_STATUS_META, PROJECT_PRIORITY_META, formatDate, formatRelativeTime,
  calculateProjectProgress, ISSUE_STATUS_META, ISSUE_PRIORITY_META,
} from '@/lib/shared-utils';
import type { Project } from '@/lib/types';

export default function ProjectDetailPage() {
  const id = useParams().id as string;
  const { session, hasPermission } = useAuth();
  const [project, setProject] = useState<Project | null>(() => projectRepo.find(id) || null);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const allIssues = useMemo(() => issueRepo.byProject(id), [id]);
  const allUsers = useMemo(() => userRepo.all(), []);
  const groups = useMemo(() => groupRepo.byProject(id), [id]);
  const activities = useMemo(() => activityRepo.byProject(id), [id]);

  if (!project) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Project not found" breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: 'Not Found' }]} />
        <Card className="p-8 text-center text-muted-foreground">
          The project you are looking for does not exist.
          <div className="mt-4">
            <Button variant="outline" onClick={() => window.history.back()}>
              Go Back
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Permission check
  if (session && !canUserViewProject(session.user.id, project)) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Access restricted" breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: project.name }]} />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">You don&apos;t have access to this project</h3>
            <p className="mt-1 text-sm text-muted-foreground">Contact a project owner or administrator to be added.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const refresh = () => setProject(projectRepo.find(id) || null);
  const canUpdate = hasPermission('projects.update');
  const canDelete = hasPermission('projects.delete');
  const canManageMembers = hasPermission('projects.assign_members');

  const owner = allUsers.find((u) => u.id === project.ownerId);
  const members = getProjectMembers(project);
  const developers = getProjectDevelopers(project);
  const assigners = getProjectAssigners(project);
  const progress = calculateProjectProgress(project.id, allIssues);
  const statusMeta = PROJECT_STATUS_META[project.status];
  const priorityMeta = PROJECT_PRIORITY_META[project.priority];

  const handleArchive = () => {
    if (!session) return;
    projectService.archive(project.id, session.user.id);
    toast.success('Project archived');
    refresh();
  };

  const handleRestore = () => {
    if (!session) return;
    projectService.restore(project.id, session.user.id);
    toast.success('Project restored');
    refresh();
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={project.name}
        description={project.description}
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: project.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {canUpdate && project.status !== 'archived' && (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
            {canDelete && project.status === 'archived' && (
              <Button variant="outline" onClick={handleRestore} className="text-emerald-600">
                <RotateCcw className="mr-2 h-4 w-4" />
                Restore
              </Button>
            )}
            {canDelete && project.status !== 'archived' && (
              <Button variant="outline" onClick={() => setConfirmArchive(true)} className="text-amber-600">
                <Archive className="mr-2 h-4 w-4" />
                Archive
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
              <div className="flex h-14 w-14 items-center justify-center rounded-xl text-white text-lg font-bold" style={{ backgroundColor: project.color }}>
                {project.key.slice(0, 3)}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">{project.key}</Badge>
                  <StatusBadge label={statusMeta.label} className={statusMeta.badgeClass} />
                  <StatusBadge label={priorityMeta.label} className={priorityMeta.badgeClass} />
                </div>
                <p className="text-sm text-muted-foreground max-w-2xl">{project.description}</p>
                {project.objectives && (
                  <div className="flex items-start gap-2 pt-2">
                    <Target className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <p className="text-sm text-muted-foreground">{project.objectives}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {formatDate(project.startDate)} → {formatDate(project.dueDate)}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <UsersIcon className="h-4 w-4" />
                {members.length} member{members.length !== 1 ? 's' : ''}
              </div>
              {project.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 sm:justify-end">
                  {project.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      <Tag className="mr-1 h-2.5 w-2.5" />{tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress ({allIssues.length} issues)</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
          <TabsTrigger value="issues">Issues ({allIssues.length})</TabsTrigger>
          <TabsTrigger value="groups">Groups ({groups.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Issues</div>
                <div className="mt-1 text-2xl font-bold">{allIssues.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Developers</div>
                <div className="mt-1 text-2xl font-bold">{developers.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Issue Assigners</div>
                <div className="mt-1 text-2xl font-bold">{assigners.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Groups</div>
                <div className="mt-1 text-2xl font-bold">{groups.length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Issue status breakdown */}
          <Card className="mt-4">
            <CardHeader><CardTitle className="text-base">Issue Status Breakdown</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(ISSUE_STATUS_META).map(([status, meta]) => {
                const count = allIssues.filter((i) => i.status === status).length;
                const pct = allIssues.length > 0 ? (count / allIssues.length) * 100 : 0;
                return (
                  <div key={status} className="flex items-center gap-3">
                    <div className="w-24 text-sm">{meta.label}</div>
                    <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: meta.color }} />
                    </div>
                    <div className="w-8 text-right text-sm font-medium">{count}</div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Members */}
        <TabsContent value="members">
          {canManageMembers ? (
            <MemberManager project={project} onUpdated={refresh} />
          ) : (
            <Card>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center gap-3">
                      <UserAvatar name={m.name} color={m.avatarColor} size="sm" />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{m.name}</div>
                        <div className="text-xs text-muted-foreground">{m.title || '—'}</div>
                      </div>
                      <Badge variant="secondary" className="text-xs font-normal">
                        {getProjectMemberRole(project.id, m.id)}
                      </Badge>
                      {project.developerIds.includes(m.id) && <Badge variant="secondary" className="text-xs">Developer</Badge>}
                      {project.assignerIds.includes(m.id) && <Badge variant="secondary" className="text-xs">Assigner</Badge>}
                      {project.ownerId === m.id && <Badge variant="outline" className="text-xs">Owner</Badge>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Issues */}
        <TabsContent value="issues">
          <Card>
            <CardContent className="p-4">
              {allIssues.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No issues in this project yet.</div>
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
                      const assignee = allUsers.find((u) => u.id === issue.assigneeId);
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
                                <UserAvatar name={assignee.name} color={assignee.avatarColor} size="xs" />
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
          <Card>
            <CardContent className="p-4">
              {groups.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No groups in this project.</div>
              ) : (
                <div className="space-y-3">
                  {groups.map((g) => (
                    <Link key={g.id} to={`/groups/${g.id}`} className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <MessageSquare className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{g.name}</div>
                        <div className="text-xs text-muted-foreground">{g.memberIds.length} members</div>
                      </div>
                      <Badge variant="outline" className="text-xs capitalize">{g.type}</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity */}
        <TabsContent value="activity">
          <Card>
            <CardContent className="p-4">
              {activities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No activity recorded.</div>
              ) : (
                <div className="space-y-3">
                  {activities.slice().reverse().map((a) => {
                    const actor = allUsers.find((u) => u.id === a.actorId);
                    return (
                      <div key={a.id} className="flex items-start gap-3 text-sm">
                        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                          <ActivityIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <span className="font-medium">{actor?.name || 'Unknown'}</span>{' '}
                          <span className="text-muted-foreground">{a.summary}</span>
                          <div className="text-xs text-muted-foreground">{formatRelativeTime(a.timestamp)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ProjectFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
        onSaved={refresh}
      />

      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title="Archive project"
        description={`Archive "${project.name}"? You can restore it later.`}
        confirmLabel="Archive"
        variant="destructive"
        onConfirm={handleArchive}
      />
    </div>
  );
}
