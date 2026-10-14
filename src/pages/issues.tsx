import { useState, useMemo } from 'react';
import { Link } from 'react-router';
import { useAuth } from '@/lib/auth-context';
import { projectRepo, userRepo } from '@/lib/repository';
import { getVisibleIssues, issueService, canUserViewIssue } from '@/lib/services';
import { PageHeader } from '@/components/shared/page-header';
import { IssueFormDialog } from '@/components/issues/issue-form-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { KanbanBoard } from '@/components/issues/kanban-board';
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
  Plus, Search, MoreVertical, Pencil, Trash2, KanbanSquare, ListFilter,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ISSUE_STATUS_META, ISSUE_PRIORITY_META, ISSUE_TYPE_META,
  formatDate, isOverdue, formatRelativeTime,
} from '@/lib/shared-utils';
import type { Issue } from '@/lib/types';

export default function IssuesPage() {
  const { session, hasPermission } = useAuth();
  const [issues, setIssues] = useState<Issue[]>(() =>
    session ? getVisibleIssues(session.user.id) : []
  );
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('updated');
  const [showKanban, setShowKanban] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Issue | null>(null);

  const refresh = () => {
    if (session) setIssues(getVisibleIssues(session.user.id));
  };

  const allUsers = useMemo(() => userRepo.all(), []);
  const allProjects = useMemo(() => projectRepo.all(), []);

  const getUser = (id: string | null | undefined) => allUsers.find((u) => u.id === id);
  const getProject = (id: string) => allProjects.find((p) => p.id === id);

  const visibleProjects = useMemo(() => {
    if (!session) return [];
    return allProjects.filter((p) => {
      const dummy: Issue = {
        id: 'x', key: 'X', title: '', description: '', projectId: p.id,
        type: 'bug', priority: 'medium', status: 'todo', reporterId: session.user.id,
        assigneeId: null, labels: [], startDate: '', createdAt: '', updatedAt: '',
      };
      return canUserViewIssue(session.user.id, dummy);
    });
  }, [session, allProjects]);

  const filtered = useMemo(() => {
    let result = issues;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((i) =>
        i.title.toLowerCase().includes(q) ||
        i.key.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.labels.some((l) => l.includes(q))
      );
    }
    if (statusFilter !== 'all') result = result.filter((i) => i.status === statusFilter);
    if (priorityFilter !== 'all') result = result.filter((i) => i.priority === priorityFilter);
    if (typeFilter !== 'all') result = result.filter((i) => i.type === typeFilter);
    if (projectFilter !== 'all') result = result.filter((i) => i.projectId === projectFilter);
    if (assigneeFilter === 'unassigned') result = result.filter((i) => !i.assigneeId);
    else if (assigneeFilter === 'me' && session) result = result.filter((i) => i.assigneeId === session.user.id);
    else if (assigneeFilter !== 'all') result = result.filter((i) => i.assigneeId === assigneeFilter);

    const sorted = [...result];
    switch (sortBy) {
      case 'updated': sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()); break;
      case 'created': sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
      case 'due':
        sorted.sort((a, b) => {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        });
        break;
      case 'priority': {
        const order = ['critical', 'high', 'medium', 'low'];
        sorted.sort((a, b) => order.indexOf(a.priority) - order.indexOf(b.priority));
        break;
      }
      case 'key': sorted.sort((a, b) => a.key.localeCompare(b.key)); break;
    }
    return sorted;
  }, [issues, search, statusFilter, priorityFilter, typeFilter, projectFilter, assigneeFilter, sortBy, session]);

  const handleCreate = () => { setEditingIssue(null); setFormOpen(true); };
  const handleEdit = (issue: Issue) => { setEditingIssue(issue); setFormOpen(true); };

  const doDelete = () => {
    if (!confirmDelete || !session) return;
    const result = issueService.delete(confirmDelete.id, session.user.id);
    if (typeof result === 'object' && 'error' in result) {
      toast.error(result.error);
    } else {
      toast.success('Issue deleted', { description: `${confirmDelete.key} has been deleted.` });
      refresh();
    }
  };

  const canCreate = hasPermission('issues.create');
  const canUpdate = hasPermission('issues.update');
  const canDelete = hasPermission('issues.delete');
  const hasActiveFilters = search || statusFilter !== 'all' || priorityFilter !== 'all' || typeFilter !== 'all' || projectFilter !== 'all' || assigneeFilter !== 'all';

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Issues"
        description="Track and manage issues across all your projects."
        breadcrumbs={[{ label: 'Issues' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowKanban(!showKanban)}>
              {showKanban ? <ListFilter className="mr-2 h-4 w-4" /> : <KanbanSquare className="mr-2 h-4 w-4" />}
              {showKanban ? 'List View' : 'Kanban Board'}
            </Button>
            {canCreate && (
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" /> New Issue
              </Button>
            )}
          </div>
        }
      />

      {showKanban ? (
        <KanbanBoard issues={filtered} onRefresh={refresh} />
      ) : (
        <Card>
          <CardContent className="p-4">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:flex-wrap">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search issues..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  {visibleProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {Object.entries(ISSUE_STATUS_META).map(([val, meta]) => (
                    <SelectItem key={val} value={val}>{meta.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[130px]"><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  {Object.entries(ISSUE_PRIORITY_META).map(([val, meta]) => (
                    <SelectItem key={val} value={val}>{meta.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[130px]"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {Object.entries(ISSUE_TYPE_META).map(([val, meta]) => (
                    <SelectItem key={val} value={val}>{meta.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Assignee" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All assignees</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {session && <SelectItem value="me">Assigned to me</SelectItem>}
                  {allUsers.filter((u) => u.status === 'active').map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[130px]"><SelectValue placeholder="Sort" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="updated">Recently updated</SelectItem>
                  <SelectItem value="created">Recently created</SelectItem>
                  <SelectItem value="due">Due date</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="key">Issue key</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-sm text-muted-foreground lg:ml-auto">
                {filtered.length} issue{filtered.length !== 1 ? 's' : ''}
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[90px]">Key</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                        {hasActiveFilters ? 'No issues match your filters.' : 'No issues found. Create one to get started.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((issue) => {
                      const assignee = getUser(issue.assigneeId);
                      const project = getProject(issue.projectId);
                      const overdue = isOverdue(issue.dueDate, issue.status);
                      const statusMeta = ISSUE_STATUS_META[issue.status];
                      const priorityMeta = ISSUE_PRIORITY_META[issue.priority];
                      const typeMeta = ISSUE_TYPE_META[issue.type];
                      return (
                        <TableRow key={issue.id} className="cursor-pointer hover:bg-muted/50">
                          <TableCell>
                            <Link to={`/issues/${issue.id}`} className="font-mono text-xs text-primary hover:underline">
                              {issue.key}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link to={`/issues/${issue.id}`} className="block">
                              <div className="font-medium hover:text-primary transition-colors truncate max-w-[300px]">{issue.title}</div>
                              {project && <div className="text-xs text-muted-foreground">{project.name}</div>}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={typeMeta.badgeClass}>{typeMeta.label}</Badge>
                          </TableCell>
                          <TableCell className='w-[120px]'>
                            <StatusBadge label={statusMeta.label} className={statusMeta.badgeClass} />
                          </TableCell>
                          <TableCell>
                            <StatusBadge label={priorityMeta.label} className={priorityMeta.badgeClass} />
                          </TableCell>
                          <TableCell>
                            {assignee ? (
                              <div className="flex items-center gap-2">
                                <UserAvatar name={assignee.name} color={assignee.avatarColor} image={assignee.avatarUrl} size="xs" />
                                <span className="text-sm truncate max-w-[120px]">{assignee.name}</span>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell className='w-[160px]'>
                            {issue.dueDate ? (
                              <span className={`text-sm flex items-center gap-1 ${overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                                {overdue && <AlertCircle className="h-3 w-3" />}
                                {formatDate(issue.dueDate)}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">{formatRelativeTime(issue.updatedAt)}</span>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {(canUpdate || canDelete) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {canUpdate && (
                                    <DropdownMenuItem onClick={() => handleEdit(issue)}>
                                      <Pencil className="mr-2 h-4 w-4" /> Edit issue
                                    </DropdownMenuItem>
                                  )}
                                  {canDelete && (
                                    <>
                                      {canUpdate && <DropdownMenuSeparator />}
                                      <DropdownMenuItem onClick={() => setConfirmDelete(issue)} className="text-red-600">
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete issue
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
      )}

      <IssueFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        issue={editingIssue || undefined}
        onSaved={refresh}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title="Delete issue"
        description={`Are you sure you want to delete "${confirmDelete?.key}"? This will also remove all comments, history, and attachments. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={doDelete}
      />
    </div>
  );
}
