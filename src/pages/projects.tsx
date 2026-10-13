import { useState, useMemo } from 'react';
import { Link } from 'react-router';
import { useAuth } from '@/lib/auth-context';
import { projectRepo, issueRepo, userRepo } from '@/lib/repository';
import { getVisibleProjects, projectService } from '@/lib/services';
import { PageHeader } from '@/components/shared/page-header';
import { ProjectFormDialog } from '@/components/projects/project-form-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/shared/user-avatar';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  Plus, Search, MoreVertical, Pencil, Archive, RotateCcw, FolderKanban, Users as UsersIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  PROJECT_STATUS_META, PROJECT_PRIORITY_META, formatDate, isOverdue, calculateProjectProgress,
} from '@/lib/shared-utils';
import type { Project, ProjectStatus } from '@/lib/types';

export default function ProjectsPage() {
  const { session, hasPermission } = useAuth();
  const [projects, setProjects] = useState<Project[]>(() =>
    session ? getVisibleProjects(session.user.id) : []
  );
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<Project | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<Project | null>(null);

  const refresh = () => {
    if (session) setProjects(getVisibleProjects(session.user.id));
  };

  const allIssues = useMemo(() => issueRepo.all(), []);
  const allUsers = useMemo(() => userRepo.all(), []);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (!showArchived && p.status === 'archived') return false;
      if (showArchived && p.status !== 'archived') return false;
      if (search) {
        const q = search.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.key.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) return false;
      }
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      return true;
    });
  }, [projects, search, statusFilter, showArchived]);

  const handleCreate = () => {
    setEditingProject(null);
    setFormOpen(true);
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setFormOpen(true);
  };

  const handleArchive = (project: Project) => setConfirmArchive(project);
  const handleRestore = (project: Project) => setConfirmRestore(project);

  const doArchive = () => {
    if (!confirmArchive || !session) return;
    projectService.archive(confirmArchive.id, session.user.id);
    toast.success('Project archived', { description: `${confirmArchive.name} has been archived.` });
    refresh();
  };

  const doRestore = () => {
    if (!confirmRestore || !session) return;
    projectService.restore(confirmRestore.id, session.user.id);
    toast.success('Project restored', { description: `${confirmRestore.name} is now active.` });
    refresh();
  };

  const canCreate = hasPermission('projects.create');
  const canUpdate = hasPermission('projects.update');
  const canDelete = hasPermission('projects.delete');

  const getOwner = (ownerId: string) => allUsers.find((u) => u.id === ownerId);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Projects"
        description="Manage projects, track progress, and coordinate team members."
        breadcrumbs={[{ label: 'Projects' }]}
        actions={
          <div className="flex items-center gap-2">
            {showArchived ? (
              <Button variant="outline" onClick={() => setShowArchived(false)}>
                <FolderKanban className="mr-2 h-4 w-4" />
                Active Projects
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setShowArchived(true)}>
                <Archive className="mr-2 h-4 w-4" />
                View Archived
              </Button>
            )}
            {canCreate && (
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <CardContent className="p-4">
          {/* Filters */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="planning">Planning</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                {showArchived && <SelectItem value="archived">Archived</SelectItem>}
              </SelectContent>
            </Select>
            <div className="text-sm text-muted-foreground ml-auto">
              {filtered.length} project{filtered.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      {showArchived ? 'No archived projects found.' : 'No projects found. Create one to get started.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((project) => {
                    const owner = getOwner(project.ownerId);
                    const progress = calculateProjectProgress(project.id, allIssues);
                    const overdue = isOverdue(project.dueDate, project.status);
                    const statusMeta = PROJECT_STATUS_META[project.status];
                    const priorityMeta = PROJECT_PRIORITY_META[project.priority];
                    return (
                      <TableRow key={project.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <Link to={`/projects/${project.id}`} className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg text-white text-xs font-bold" style={{ backgroundColor: project.color }}>
                              {project.key.slice(0, 3)}
                            </div>
                            <div>
                              <div className="font-medium hover:text-primary transition-colors">{project.name}</div>
                              <div className="text-xs text-muted-foreground max-w-[250px] truncate">{project.description}</div>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">{project.key}</Badge>
                        </TableCell>
                        <TableCell>
                          <StatusBadge label={statusMeta.label} className={statusMeta.badgeClass} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge label={priorityMeta.label} className={priorityMeta.badgeClass} />
                        </TableCell>
                        <TableCell>
                          {owner && (
                            <div className="flex items-center gap-2">
                              <UserAvatar name={owner.name} color={owner.avatarColor} size="xs" />
                              <span className="text-sm">{owner.name}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <UsersIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            {project.memberIds.length}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground">{progress}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`text-sm ${overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                            {formatDate(project.dueDate)}
                          </span>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {(canUpdate || (canDelete && showArchived)) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {canUpdate && project.status !== 'archived' && (
                                  <DropdownMenuItem onClick={() => handleEdit(project)}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit project
                                  </DropdownMenuItem>
                                )}
                                {canDelete && project.status !== 'archived' && (
                                  <>
                                    {canUpdate && <DropdownMenuSeparator />}
                                    <DropdownMenuItem onClick={() => handleArchive(project)} className="text-amber-600">
                                      <Archive className="mr-2 h-4 w-4" />
                                      Archive project
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {canDelete && project.status === 'archived' && (
                                  <>
                                    <DropdownMenuItem onClick={() => handleRestore(project)} className="text-emerald-600">
                                      <RotateCcw className="mr-2 h-4 w-4" />
                                      Restore project
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ProjectFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        project={editingProject}
        onSaved={refresh}
      />

      <ConfirmDialog
        open={!!confirmArchive}
        onOpenChange={(open) => { if (!open) setConfirmArchive(null); }}
        title="Archive project"
        description={`Are you sure you want to archive "${confirmArchive?.name}"? You can restore it later from the archived view.`}
        confirmLabel="Archive"
        variant="destructive"
        onConfirm={doArchive}
      />

      <ConfirmDialog
        open={!!confirmRestore}
        onOpenChange={(open) => { if (!open) setConfirmRestore(null); }}
        title="Restore project"
        description={`Restore "${confirmRestore?.name}" to active status?`}
        confirmLabel="Restore"
        onConfirm={doRestore}
      />
    </div>
  );
}
