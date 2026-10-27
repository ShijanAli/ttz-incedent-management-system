import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import {
  AlertCircle, AlertTriangle, Eye, FolderKanban, KanbanSquare, ListFilter, Loader2, MoreVertical, Pencil, Plus, RotateCw,
  Building2, Search, SlidersHorizontal, Trash2, Users as UsersIcon, X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useTabParam } from '@/hooks/use-tab-param';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { parseApiError } from '@/lib/api-error';
import { rememberIssuesSearch } from '@/lib/last-issues-url';
import { lastBoardProject, rememberBoardProject } from '@/lib/last-board-project';
import {
  ISSUE_PRIORITY_META, ISSUE_SEVERITY_OPTIONS, ISSUE_TYPE_OPTIONS, formatDate, formatRelativeTime, isIssueClosed, isMyReport,
  isOverdue,
} from '@/lib/shared-utils';
import { sortStatuses, toStatusInputs } from '@/lib/project-utils';
import { useProjectCan } from '@/hooks/use-project-can';
import { useGetIssuesInfiniteQuery, useGetProjectIssuesInfiniteQuery } from '@/redux/features/issues/issues-api';
import type { IssueListFilters, IssueListItem } from '@/redux/features/issues/issues-types';
import {
  useGetProjectQuery, useGetProjectsInfiniteQuery, useGetProjectStatusesQuery, useReplaceProjectStatusesMutation,
} from '@/redux/features/projects/projects-api';
import { useStatusCatalog } from '@/redux/features/projects/use-status-catalog';
import type { IssuePriority, IssueSeverity, IssueType } from '@/lib/types';
import { PageHeader } from '@/components/shared/page-header';
import { IssueFormDialog } from '@/components/issues/issue-form-dialog';
import { IssueBoard } from '@/components/issues/issue-board';
import { EditIssueDialog } from '@/components/issues/edit-issue-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { useChangeMyIssueStatusMutation, useDeleteIssueMutation } from '@/redux/features/issues/issue-detail-api';
import { toast } from 'sonner';
import {
  IssueCategoryBadge, IssuePriorityBadge, IssueStatusBadge,
} from '@/components/issues/issue-badges';
import { ProjectSelect } from '@/components/projects/project-select';
import { AvatarStack } from '@/components/shared/avatar-stack';
import { InfiniteScrollTrigger } from '@/components/shared/infinite-scroll-trigger';
import { TableSkeletonRows } from '@/components/shared/table-skeleton-rows';
import { ROW_INDEX_ATTR, ScrollPositionIndicator } from '@/components/shared/scroll-position-indicator';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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

const COLUMN_COUNT = 12;
const ISSUE_VIEWS = ['list', 'board'] as const;
const ALL = 'all';

/** Raw filter state as the controls hold it; converted to API params below */
interface FilterState {
  search: string;
  projectId: string;
  statusId: string;
  priority: string;
  issueType: string;
  severity: string;
  label: string;
  /** all | me | unassigned */
  assignee: string;
  /** all | me */
  reporter: string;
  dueAfter: string;
  dueBefore: string;
}

const EMPTY_FILTERS: FilterState = {
  search: '', projectId: '', statusId: ALL, priority: ALL, issueType: ALL, severity: ALL,
  label: '', assignee: ALL, reporter: ALL, dueAfter: '', dueBefore: '',
};

/** Filters that live behind "More filters" */
const ADVANCED_KEYS: (keyof FilterState)[] = ['issueType', 'severity', 'label', 'reporter', 'dueAfter', 'dueBefore'];

/** URL query key per filter, e.g. ?project=13&status=4&priority=high */
const FILTER_PARAMS: Record<keyof FilterState, string> = {
  search: 'q', projectId: 'project', statusId: 'status', priority: 'priority', issueType: 'type', severity: 'severity',
  label: 'label', assignee: 'assignee', reporter: 'reporter', dueAfter: 'due_after', dueBefore: 'due_before',
};
const FILTER_KEYS = Object.keys(FILTER_PARAMS) as (keyof FilterState)[];

const readFilters = (params: URLSearchParams): FilterState =>
  Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(FILTER_PARAMS[k]) ?? EMPTY_FILTERS[k]])) as unknown as FilterState;

/**
 * Filters live in the URL so a reload or a shared link keeps them. Defaults are left
 * out of the URL, and changes replace the history entry instead of adding one per keystroke.
 */
function useUrlFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);

  const setFilters = useCallback(
    (next: FilterState | ((prev: FilterState) => FilterState)) => {
      setSearchParams(
        (prev) => {
          const resolved = typeof next === 'function' ? next(readFilters(prev)) : next;
          // Copy so params the filters don't own (e.g. ?view=board) survive
          const params = new URLSearchParams(prev);
          for (const k of FILTER_KEYS) {
            if (resolved[k] === EMPTY_FILTERS[k]) params.delete(FILTER_PARAMS[k]);
            else params.set(FILTER_PARAMS[k], resolved[k]);
          }
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return [filters, setFilters] as const;
}

const isSet = (key: keyof FilterState, value: string) => value !== EMPTY_FILTERS[key];
const pick = <T extends string>(value: string): T | undefined => (value === ALL ? undefined : (value as T));

export default function IssuesPage() {
  const { session, hasPermission, isSuperAdmin } = useAuth();
  const [filters, setFilters] = useUrlFilters();
  // Lets an issue's breadcrumb come back to this exact view and filters
  const { search: locationSearch } = useLocation();
  useEffect(() => rememberIssuesSearch(locationSearch), [locationSearch]);
  // Open "More filters" on load when the URL already sets one of them
  const [showAdvanced, setShowAdvanced] = useState(() => ADVANCED_KEYS.some((k) => isSet(k, filters[k])));
  // Kept in the URL (?view=board) so a reload or shared link opens the same view
  const [view, setView] = useTabParam(ISSUE_VIEWS, 'list', 'view');
  const showBoard = view === 'board';
  const setShowBoard = (board: boolean) => setView(board ? 'board' : 'list');
  const [formOpen, setFormOpen] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  const update = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      // Statuses belong to projects, so a new project resets the status filter
      ...(key === 'projectId' && { statusId: ALL }),
    }));

  // Typing fields only reach the API once the user pauses
  const search = useDebouncedValue(filters.search.trim());
  const label = useDebouncedValue(filters.label.trim());
  const isTyping = filters.search.trim() !== search || filters.label.trim() !== label;

  const myId = session ? Number(session.user.id) : undefined;

  // Whichever project the user picks becomes "the one they're working on"
  useEffect(() => {
    if (session && filters.projectId) rememberBoardProject(session.user.id, filters.projectId);
  }, [session, filters.projectId]);

  // The board needs a project: open the last one worked on, or the first project for a new account.
  // Same args as ProjectSelect, so this shares its cached list instead of fetching again.
  const projectList = useInfiniteList(useGetProjectsInfiniteQuery({ status: 'active' }, { skip: !showBoard }));
  useEffect(() => {
    if (!showBoard || filters.projectId || !session || projectList.showSkeleton) return;
    const projects = projectList.items;
    if (projects.length === 0) return;
    const last = lastBoardProject(session.user.id);
    // A remembered project that was archived or left falls back to the first one
    const pick = projects.find((p) => String(p.id) === last) ?? projects[0];
    setFilters((prev) => ({ ...prev, projectId: String(pick.id), statusId: ALL }));
  }, [showBoard, filters.projectId, session, projectList.showSkeleton, projectList.items, setFilters]);

  const params = useMemo<IssueListFilters>(() => ({
    search: search || undefined,
    label: label || undefined,
    project_id: filters.projectId ? Number(filters.projectId) : undefined,
    status_id: filters.statusId === ALL ? undefined : Number(filters.statusId),
    priority: pick<IssuePriority>(filters.priority),
    issue_type: pick<IssueType>(filters.issueType),
    severity: pick<IssueSeverity>(filters.severity),
    assignee_id: filters.assignee === 'me' ? myId : undefined,
    unassigned: filters.assignee === 'unassigned' ? 1 : undefined,
    reported_by: filters.reporter === 'me' ? myId : undefined,
    due_after: filters.dueAfter || undefined,
    due_before: filters.dueBefore || undefined,
  }), [filters, search, label, myId]);

  // Boards follow one project's workflow, so the board uses that project's own issues API
  const boardProjectId = Number(filters.projectId);
  const boardActive = showBoard && Boolean(filters.projectId);
  const { project_id: _projectId, ...boardFilters } = params;

  // Super admins see every issue; everyone else sees the issues of their projects
  const tableList = useInfiniteList(
    useGetIssuesInfiniteQuery({ scope: isSuperAdmin ? 'admin' : 'my', ...params }, { skip: boardActive }),
  );
  const boardList = useInfiniteList(
    useGetProjectIssuesInfiniteQuery({ projectId: boardProjectId, ...boardFilters }, { skip: !boardActive }),
  );
  const { data: boardStatuses = [] } = useGetProjectStatusesQuery(boardProjectId, { skip: !boardActive });
  const orderedBoardStatuses = useMemo(() => sortStatuses(boardStatuses), [boardStatuses]);
  // Reordering columns rewrites the project's workflow, so it needs the same right as the workflow editor
  const projectCan = useProjectCan();
  const { data: boardProject } = useGetProjectQuery(boardProjectId, { skip: !boardActive });
  const canReorderColumns = projectCan(boardProject, 'projects.edit');
  const [replaceStatuses] = useReplaceProjectStatusesMutation();
  const canCreate = hasPermission('issues.create');
  const canCreateOnBoard = canCreate && projectCan(boardProject, 'issues.create');

  // Whichever list is on screen drives the count, refresh, errors and paging
  const list = boardActive ? boardList : tableList;
  const issues = tableList.items;

  const activeCount = (Object.keys(filters) as (keyof FilterState)[]).filter((k) => isSet(k, filters[k])).length;
  const advancedCount = ADVANCED_KEYS.filter((k) => isSet(k, filters[k])).length;

  // The API still checks each issue's own abilities; these only decide what the menu offers
  const canUpdate = hasPermission('issues.update');
  const canDelete = hasPermission('issues.delete');
  const canChangeStatus = hasPermission('issues.change_status');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<IssueListItem | null>(null);
  const [deleteIssue] = useDeleteIssueMutation();
  const [changeMyStatus] = useChangeMyIssueStatusMutation();

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Issues"
        description={isSuperAdmin ? 'Every issue across all projects.' : 'Issues in the projects you belong to.'}
        breadcrumbs={[{ label: 'Issues' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowBoard(!showBoard)}>
              {showBoard ? <ListFilter className="mr-2 h-4 w-4" /> : <KanbanSquare className="mr-2 h-4 w-4" />}
              {showBoard ? 'List View' : 'Board View'}
            </Button>
            {canCreate && (
              <Button onClick={() => setFormOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> New Issue
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <CardContent className="p-4">
          {/* Filters */}
          <div className="mb-4 space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
              <div className="relative flex-1 lg:max-w-xs">
                {isTyping || (list.isFetching && !list.showSkeleton && search) ? (
                  <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                ) : (
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                )}
                <Input
                  type="search"
                  placeholder="Search title or code..."
                  value={filters.search}
                  onChange={(e) => update('search', e.target.value)}
                  className="pl-9"
                  aria-label="Search issues"
                />
              </div>
              <ProjectSelect
                value={filters.projectId}
                onChange={(id) => update('projectId', id)}
                // The board always shows one project, so "All projects" is list-only
                allLabel={showBoard ? undefined : 'All projects'}
                className="lg:w-[180px]"
              />
              <StatusFilter
                projectId={filters.projectId}
                value={filters.statusId}
                onChange={(v) => update('statusId', v)}
              />
              <FilterSelect
                label="Priority"
                value={filters.priority}
                onChange={(v) => update('priority', v)}
                allLabel="All priorities"
                options={Object.entries(ISSUE_PRIORITY_META).map(([value, meta]) => ({ value, label: meta.label }))}
              />
              <FilterSelect
                label="Assignee"
                value={filters.assignee}
                onChange={(v) => update('assignee', v)}
                allLabel="All assignees"
                options={[{ value: 'me', label: 'Assigned to me' }, { value: 'unassigned', label: 'Unassigned' }]}
              />
              <Button
                variant={showAdvanced ? 'secondary' : 'outline'}
                onClick={() => setShowAdvanced(!showAdvanced)}
                aria-expanded={showAdvanced}
                aria-controls="issue-advanced-filters"
              >
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                More filters
                {advancedCount > 0 && <Badge className="ml-2 h-5 px-1.5 text-[10px]">{advancedCount}</Badge>}
              </Button>
              {activeCount > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)} className="text-muted-foreground">
                  <X className="mr-1.5 h-4 w-4" />
                  Clear filters
                </Button>
              )}
              <div className="flex items-center gap-3 lg:ml-auto">
                <span className="text-sm text-muted-foreground">
                  {list.items.length} of {list.total} issue{list.total !== 1 ? 's' : ''}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={list.refresh}
                  disabled={list.isFetching}
                  aria-label="Refresh issues"
                  title="Refresh"
                >
                  <RotateCw className={cn('h-4 w-4', list.isRefreshing && 'animate-spin')} />
                </Button>
              </div>
            </div>

            {showAdvanced && (
              <div id="issue-advanced-filters" className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-6">
                <FilterField label="Type">
                  <FilterSelect
                    label="Type"
                    value={filters.issueType}
                    onChange={(v) => update('issueType', v)}
                    allLabel="All types"
                    options={ISSUE_TYPE_OPTIONS}
                    className="w-full"
                  />
                </FilterField>
                <FilterField label="Severity">
                  <FilterSelect
                    label="Severity"
                    value={filters.severity}
                    onChange={(v) => update('severity', v)}
                    allLabel="All severities"
                    options={ISSUE_SEVERITY_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
                    className="w-full"
                  />
                </FilterField>
                <FilterField label="Reported by">
                  <FilterSelect
                    label="Reported by"
                    value={filters.reporter}
                    onChange={(v) => update('reporter', v)}
                    allLabel="Anyone"
                    options={[{ value: 'me', label: 'Me' }]}
                    className="w-full"
                  />
                </FilterField>
                <FilterField label="Label" htmlFor="issueLabelFilter">
                  <Input
                    id="issueLabelFilter"
                    placeholder="Exact label, e.g. android"
                    value={filters.label}
                    onChange={(e) => update('label', e.target.value)}
                  />
                </FilterField>
                <FilterField label="Due after" htmlFor="issueDueAfter">
                  <Input
                    id="issueDueAfter"
                    type="date"
                    value={filters.dueAfter}
                    max={filters.dueBefore || undefined}
                    onChange={(e) => update('dueAfter', e.target.value)}
                  />
                </FilterField>
                <FilterField label="Due before" htmlFor="issueDueBefore">
                  <Input
                    id="issueDueBefore"
                    type="date"
                    value={filters.dueBefore}
                    min={filters.dueAfter || undefined}
                    onChange={(e) => update('dueBefore', e.target.value)}
                  />
                </FilterField>
              </div>
            )}
          </div>

          {list.isError ? (
            <div className="flex flex-col items-center gap-3 py-12 text-sm">
              <span className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {parseApiError(list.error, 'Failed to load issues.').message}
              </span>
              <Button variant="outline" size="sm" onClick={list.refresh} disabled={list.isFetching}>
                <RotateCw className="mr-2 h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          ) : showBoard ? (
            !boardActive ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
                <FolderKanban className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">Select a project to see its board</p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  Each project has its own workflow, so the board shows one project at a time. Pick one from the project filter above.
                </p>
              </div>
            ) : list.showSkeleton ? (
              <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading board...
              </div>
            ) : (
              <IssueBoard
                issues={boardList.items}
                statuses={orderedBoardStatuses}
                onCreate={canCreateOnBoard ? () => setFormOpen(true) : undefined}
                onReorderColumns={!canReorderColumns ? undefined : async (ordered) => {
                  // The board hands back its own column objects; send the full statuses so flags are kept
                  const byId = new Map(orderedBoardStatuses.map((s) => [s.id, s]));
                  const statuses = ordered.map((s) => byId.get(s.id)).filter((s) => s !== undefined);
                  try {
                    await replaceStatuses({ projectId: boardProjectId, statuses: toStatusInputs(statuses) }).unwrap();
                    toast.success('Column order saved');
                  } catch (err) {
                    toast.error("Couldn't reorder columns", { description: parseApiError(err).message });
                    throw err;
                  }
                }}
                // Without issues.status the board is read-only (no dragging)
                onMove={!canChangeStatus ? undefined : async (issue, to) => {
                  try {
                    // The backend works out progress from the new status
                    await changeMyStatus({ issueId: issue.id, status_id: to.id }).unwrap();
                    toast.success(`${issue.code} moved to ${to.name}`);
                  } catch (err) {
                    toast.error(`Couldn't move ${issue.code}`, { description: parseApiError(err).message });
                    throw err;
                  }
                }}
              />
            )
          ) : (
            <div ref={tableRef} className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">SL</TableHead>
                    <TableHead className="w-[90px]">Key</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Reporter</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.showSkeleton ? (
                    <TableSkeletonRows columns={COLUMN_COUNT} />
                  ) : issues.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={COLUMN_COUNT} className="py-12 text-center text-muted-foreground">
                        {activeCount > 0 ? 'No issues match your filters.' : 'No issues found. Create one to get started.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    issues.map((issue, index) => (
                      <IssueRow
                        key={issue.id}
                        index={index}
                        issue={issue}
                        // Reporters may edit and delete their own issues whatever their role
                        canUpdate={canUpdate || isMyReport(issue, myId)}
                        canDelete={canDelete || isMyReport(issue, myId)}
                        onEdit={(i) => setEditingId(i.id)}
                        onDelete={setConfirmDelete}
                      />
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          <InfiniteScrollTrigger
            {...list.trigger}
            disabled={list.trigger.disabled || list.showSkeleton || (showBoard && !boardActive)}
            endMessage={list.items.length > 0 ? 'No more issues' : undefined}
          />
        </CardContent>
      </Card>

      {!showBoard && <ScrollPositionIndicator containerRef={tableRef} total={list.total} />}

      {/* The list refreshes itself after a create, edit or delete (cache invalidation) */}
      {/* With a project filter set (e.g. the board), new issues start in that project */}
      <IssueFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        defaultProjectId={filters.projectId || undefined}
        onSaved={() => undefined}
      />
      <EditIssueDialog issueId={editingId} onClose={() => setEditingId(null)} />

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title="Delete issue"
        description={`Are you sure you want to delete "${confirmDelete?.code}"? This will also remove all comments, history, and attachments. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (!confirmDelete) return;
          try {
            await deleteIssue(confirmDelete.id).unwrap();
            toast.success('Issue deleted', { description: `${confirmDelete.code} has been deleted.` });
          } catch (err) {
            toast.error('Failed to delete issue', { description: parseApiError(err).message });
          }
        }}
      />
    </div>
  );
}

interface IssueRowProps {
  index: number;
  issue: IssueListItem;
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: (issue: IssueListItem) => void;
  onDelete: (issue: IssueListItem) => void;
}

function IssueRow({ index, issue, canUpdate, canDelete, onEdit, onDelete }: IssueRowProps) {
  const overdue = issue.progress < 100 && isOverdue(issue.due_date ?? undefined);
  // The list has no updated_at yet, so fall back to when the issue was created
  const updatedAt = issue.updated_at ?? issue.created_at;
  // Closed issues are read-only
  const closed = isIssueClosed(issue);
  return (
    <TableRow className="cursor-pointer hover:bg-muted/50" {...{ [ROW_INDEX_ATTR]: index }}>
      <TableCell className="text-sm tabular-nums text-muted-foreground">{index + 1}</TableCell>
      <TableCell>
        <Link to={`/issues/${issue.id}`} className="font-mono text-xs text-primary hover:underline">
          {issue.code}
        </Link>
      </TableCell>
      <TableCell>
        <Link to={`/issues/${issue.id}`} className="block">
          <div className="max-w-[300px] truncate font-medium transition-colors hover:text-primary">{issue.title}</div>
          {issue.project && <div className="text-xs text-muted-foreground">{issue.project.name}</div>}
        </Link>
      </TableCell>
      <TableCell><IssueCategoryBadge issue={issue} /></TableCell>
      <TableCell className="w-[120px]"><IssueStatusBadge issue={issue} /></TableCell>
      <TableCell><IssuePriorityBadge priority={issue.priority} /></TableCell>
      <TableCell>
        {issue.assignees?.length ? (
          <AvatarStack people={issue.assignees} />
        ) : issue.assignee_count > 0 ? (
          <span className="flex items-center gap-1.5 text-sm">
            <UsersIcon className="h-3.5 w-3.5 text-muted-foreground" />
            {issue.assignee_count} assignee{issue.assignee_count !== 1 ? 's' : ''}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Unassigned</span>
        )}
      </TableCell>
      <TableCell>
        {issue.reporter ? (
          <AvatarStack people={[issue.reporter]} />
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell><IssueSourceCell issue={issue} /></TableCell>
      <TableCell className="w-[160px]">
        {issue.due_date ? (
          <span className={cn('flex items-center gap-1 text-sm', overdue ? 'font-medium text-red-600' : 'text-muted-foreground')}>
            {overdue && <AlertCircle className="h-3 w-3" />}
            {formatDate(issue.due_date)}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground" title={new Date(updatedAt).toLocaleString()}>
          {formatRelativeTime(updatedAt)}
        </span>
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${issue.code}`}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to={`/issues/${issue.id}`}>
                <Eye className="mr-2 h-4 w-4" /> View issue
              </Link>
            </DropdownMenuItem>
            {canUpdate && !closed && (
              <DropdownMenuItem onClick={() => onEdit(issue)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit issue
              </DropdownMenuItem>
            )}
            {canDelete && !closed && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDelete(issue)} className="text-red-600">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete issue
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

/** Internal issues get a quiet label; complaints are highlighted with the customer's name */
function IssueSourceCell({ issue }: { issue: IssueListItem }) {
  if (!issue.source) return <span className="text-sm text-muted-foreground">—</span>;
  if (issue.source.value !== 'customer_complaint') {
    return <span className="text-sm text-muted-foreground">{issue.source.label}</span>;
  }
  return (
    <div className="min-w-0" title={issue.customer ? `${issue.source.label} from ${issue.customer.name}` : issue.source.label}>
      <span className="inline-flex whitespace-nowrap rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300">
        Complaint
      </span>
      {issue.customer && (
        <div className="mt-0.5 flex max-w-[160px] items-center gap-1 text-xs text-muted-foreground">
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{issue.customer.name}</span>
        </div>
      )}
    </div>
  );
}

/** Status filter: the selected project's workflow, or every known status when "All projects" */
function StatusFilter({ projectId, value, onChange }: { projectId: string; value: string; onChange: (v: string) => void }) {
  const id = Number(projectId);
  const { data: projectStatuses = [] } = useGetProjectStatusesQuery(id, { skip: !projectId });
  const catalog = useStatusCatalog({ skip: Boolean(projectId) });
  const statuses = projectId ? sortStatuses(projectStatuses) : catalog.statuses;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="lg:w-[150px]" aria-label="Filter by status">
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All statuses</SelectItem>
        {statuses.map((s) => (
          <SelectItem key={s.id} value={String(s.id)}>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: { value: string; label: string }[];
  className?: string;
}

function FilterSelect({ label, value, onChange, allLabel, options, className = 'lg:w-[150px]' }: FilterSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className} aria-label={`Filter by ${label.toLowerCase()}`}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
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
