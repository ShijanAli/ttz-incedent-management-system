import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  AlertTriangle, Archive, FolderKanban, Loader2, MoreVertical, Pencil, Plus, RotateCcw, RotateCw,
  Search, Trash2, Users as UsersIcon, X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { useProjectCan } from '@/hooks/use-project-can';
import { parseApiError } from '@/lib/api-error';
import { formatDate, isOverdue } from '@/lib/shared-utils';
import {
  PROJECT_PRIORITY_OPTIONS, PROJECT_STATUS_FILTER_OPTIONS, getProjectPriorityMeta,
  getProjectProgress, getProjectStateMeta,
} from '@/lib/project-utils';
import { useGetProjectFiltersQuery, useGetProjectsInfiniteQuery } from '@/redux/features/projects/projects-api';
import type { ApiProject, ProjectPriority } from '@/redux/features/projects/projects-types';
import { PageHeader } from '@/components/shared/page-header';
import { ProjectFormDialog } from '@/components/projects/project-form-dialog';
import { ARCHIVED_STATE, type ProjectActionType } from '@/components/projects/project-actions';
import { useProjectActions } from '@/components/projects/use-project-actions';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { InfiniteScrollTrigger } from '@/components/shared/infinite-scroll-trigger';
import { TableSkeletonRows } from '@/components/shared/table-skeleton-rows';
import { ROW_INDEX_ATTR, ScrollPositionIndicator } from '@/components/shared/scroll-position-indicator';
import { StatusBadge } from '@/components/shared/status-badge';
import { AvatarStack } from '@/components/shared/avatar-stack';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ProjectLogo } from '@/components/projects/project-logo';

const COLUMN_COUNT = 8;
const ALL = 'all';

export default function ProjectsPage() {
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [priorityFilter, setPriorityFilter] = useState<string>(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ApiProject | null>(null);
  const actions = useProjectActions();
  const tableRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebouncedValue(search.trim());
  const isSearchPending = search.trim() !== debouncedSearch;

  // All filters run on the API (?search, ?status, ?priority); "All" leaves the param out
  const list = useInfiniteList(
    useGetProjectsInfiniteQuery({
      search: debouncedSearch || undefined,
      status: statusFilter === ALL ? undefined : statusFilter,
      priority: priorityFilter === ALL ? undefined : (priorityFilter as ProjectPriority),
    }),
  );

  // Dropdown lists come from the API; the built-in ones cover the moments before it answers
  const { data: filterOptions } = useGetProjectFiltersQuery();
  const statusOptions = useMemo(
    () =>
      filterOptions?.statuses?.length
        ? filterOptions.statuses
        : PROJECT_STATUS_FILTER_OPTIONS.map((s) => ({ value: s as string, label: getProjectStateMeta(s).label })),
    [filterOptions],
  );
  const priorityOptions = useMemo(
    () =>
      filterOptions?.priorities?.length
        ? filterOptions.priorities
        : PROJECT_PRIORITY_OPTIONS.map((p) => ({ value: p as string, label: getProjectPriorityMeta(p)?.label ?? p })),
    [filterOptions],
  );

  // The "View Archived" button is a shortcut for the archived status filter
  const showArchived = statusFilter === ARCHIVED_STATE;
  const projects = list.items;
  const hasFilters = search !== '' || statusFilter !== ALL || priorityFilter !== ALL;

  const clearFilters = () => {
    setSearch('');
    setStatusFilter(ALL);
    setPriorityFilter(ALL);
  };

  const toggleArchived = (archived: boolean) => setStatusFilter(archived ? ARCHIVED_STATE : ALL);

  const handleCreate = () => {
    setEditingProject(null);
    setFormOpen(true);
  };

  const handleEdit = (project: ApiProject) => {
    setEditingProject(project);
    setFormOpen(true);
  };

  const canCreate = hasPermission('projects.create');

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Projects"
        description="Manage projects, track progress, and coordinate team members."
        breadcrumbs={[{ label: 'Projects' }]}
        actions={
          <div className="flex items-center gap-2">
            {showArchived ? (
              <Button variant="outline" onClick={() => toggleArchived(false)}>
                <FolderKanban className="mr-2 h-4 w-4" />
                Active Projects
              </Button>
            ) : (
              <Button variant="outline" onClick={() => toggleArchived(true)}>
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
              {isSearchPending || (list.isFetching && !list.showSkeleton && debouncedSearch) ? (
                <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              ) : (
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              )}
              <Input
                type="search"
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                aria-label="Search projects"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]" aria-label="Filter by status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {statusOptions.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[150px]" aria-label="Filter by priority">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All priorities</SelectItem>
                {priorityOptions.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                <X className="mr-1.5 h-4 w-4" />
                Clear filters
              </Button>
            )}
            <div className="flex items-center gap-3 sm:ml-auto">
              <span className="text-sm text-muted-foreground">
                {projects.length} of {list.total} project{list.total !== 1 ? 's' : ''}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={list.refresh}
                disabled={list.isFetching}
                aria-label="Refresh projects"
                title="Refresh"
              >
                <RotateCw className={cn('h-4 w-4', list.isRefreshing && 'animate-spin')} />
              </Button>
            </div>
          </div>

          {/* Table */}
          <div ref={tableRef} className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">SL</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.showSkeleton ? (
                  <TableSkeletonRows columns={COLUMN_COUNT} />
                ) : list.isError ? (
                  <TableRow>
                    <TableCell colSpan={COLUMN_COUNT} className="py-8 text-center">
                      <div className="flex flex-col items-center gap-3 text-sm">
                        <span className="flex items-center gap-2 text-destructive">
                          <AlertTriangle className="h-4 w-4" />
                          {parseApiError(list.error, 'Failed to load projects.').message}
                        </span>
                        <Button variant="outline" size="sm" onClick={list.refresh} disabled={list.isFetching}>
                          <RotateCw className="mr-2 h-3.5 w-3.5" />
                          Retry
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : projects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={COLUMN_COUNT} className="py-12 text-center text-muted-foreground">
                      {showArchived && !debouncedSearch && priorityFilter === ALL
                        ? 'No archived projects found.'
                        : hasFilters
                          ? 'No projects match your filters.'
                          : 'No projects found. Create one to get started.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  projects.map((project, index) => (
                    <ProjectRow
                      key={project.id}
                      index={index}
                      project={project}
                      onEdit={handleEdit}
                      onAction={(action) => actions.request(project, action)}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <InfiniteScrollTrigger
            {...list.trigger}
            disabled={list.trigger.disabled || list.showSkeleton}
            endMessage={projects.length > 0 ? 'No more projects' : undefined}
          />
        </CardContent>
      </Card>

      <ScrollPositionIndicator containerRef={tableRef} total={list.total} />

      <ProjectFormDialog open={formOpen} onOpenChange={setFormOpen} project={editingProject} />

      <ConfirmDialog {...actions.dialogProps} />
    </div>
  );
}

interface ProjectRowProps {
  index: number;
  project: ApiProject;
  onEdit: (project: ApiProject) => void;
  onAction: (action: ProjectActionType) => void;
}

function ProjectRow({ index, project, onEdit, onAction }: ProjectRowProps) {
  const archived = project.status === ARCHIVED_STATE;
  const progress = getProjectProgress(project);
  const overdue = isOverdue(project.due_date ?? undefined, archived ? 'approved' : (project.status ?? undefined));
  const stateMeta = getProjectStateMeta(project.status);
  const priorityMeta = getProjectPriorityMeta(project.priority);

  // Actions follow the signed-in user's permissions in this project (super admins can do everything)
  const projectCan = useProjectCan();
  const canEdit = projectCan(project, 'projects.edit');
  const canDelete = projectCan(project, 'projects.delete');

  return (
    <TableRow className="hover:bg-muted/50" {...{ [ROW_INDEX_ATTR]: index }}>
      <TableCell className="text-sm tabular-nums text-muted-foreground">{index + 1}</TableCell>
      <TableCell>
        <Link to={`/projects/${project.id}`} className="flex items-center gap-3">
          <ProjectLogo project={project} className="h-9 w-9 rounded-lg text-xs" />
          <div>
            <div className="font-medium transition-colors hover:text-primary">{project.name}</div>
            <div className="max-w-[250px] truncate text-xs text-muted-foreground">{project.description || '—'}</div>
          </div>
        </Link>
      </TableCell>
      <TableCell>
        <StatusBadge label={stateMeta.label} className={stateMeta.badgeClass} />
      </TableCell>
      <TableCell>
        {priorityMeta ? (
          <StatusBadge label={priorityMeta.label} className={priorityMeta.badgeClass} />
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        {project.members.length > 0 ? (
          <AvatarStack people={project.members.map((m) => m.user)} />
        ) : (
          <div className="flex items-center gap-1 text-sm">
            <UsersIcon className="h-3.5 w-3.5 text-muted-foreground" />
            {project.member_count}
          </div>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2" title={`${project.issue_counts.closed} of ${project.issue_counts.total} issues closed`}>
          <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs text-muted-foreground">{progress}%</span>
        </div>
      </TableCell>
      <TableCell>
        <span className={cn('text-sm', overdue ? 'font-medium text-red-600' : 'text-muted-foreground')}>
          {formatDate(project.due_date ?? undefined)}
        </span>
      </TableCell>
      <TableCell>
        {(canEdit || canDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${project.name}`}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && !archived && (
                <DropdownMenuItem onClick={() => onEdit(project)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit project
                </DropdownMenuItem>
              )}
              {canEdit && !archived && (
                <DropdownMenuItem onClick={() => onAction('archive')} className="text-amber-600">
                  <Archive className="mr-2 h-4 w-4" />
                  Archive project
                </DropdownMenuItem>
              )}
              {canEdit && archived && (
                <DropdownMenuItem onClick={() => onAction('restore')} className="text-emerald-600">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Restore project
                </DropdownMenuItem>
              )}
              {canDelete && (
                <>
                  {canEdit && <DropdownMenuSeparator />}
                  <DropdownMenuItem onClick={() => onAction('delete')} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete project
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
  );
}
