import { useState } from 'react';
import { Link } from 'react-router';
import {
  DndContext, DragEndEvent, DragStartEvent, DragOverlay,
  PointerSensor, useSensor, useSensors,
  useDroppable, useDraggable,
} from '@dnd-kit/core';
import { useAuth } from '@/lib/auth-context';
import { issueService } from '@/lib/services';
import { userRepo, projectRepo } from '@/lib/repository';
import { UserAvatar } from '@/components/shared/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  ISSUE_STATUS_META, ISSUE_PRIORITY_META, ISSUE_TYPE_META, ISSUE_SEVERITY_META,
  ISSUE_STATUS_ORDER, formatDate, isOverdue,
} from '@/lib/shared-utils';
import { AlertCircle, GripVertical } from 'lucide-react';
import type { Issue, IssueStatus } from '@/lib/types';

interface KanbanBoardProps {
  issues: Issue[];
  onRefresh: () => void;
}

export function KanbanBoard({ issues, onRefresh }: KanbanBoardProps) {
  const { session, hasPermission } = useAuth();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const canChangeStatus = hasPermission('issues.change_status');
  const activeIssue = activeId ? issues.find((i) => i.id === activeId) : null;

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(e.active.id as string);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (!session) return;
    const issueId = e.active.id as string;
    const newStatus = e.over?.id as IssueStatus | undefined;
    if (!newStatus) return;

    const issue = issues.find((i) => i.id === issueId);
    if (!issue || issue.status === newStatus) return;

    const result = issueService.changeStatus(issue.id, newStatus, session.user.id);
    if (typeof result === 'object' && 'error' in result) {
      toast.error('Invalid transition', { description: result.error });
    } else {
      toast.success('Status updated', { description: `${issue.key} moved to ${ISSUE_STATUS_META[newStatus].label}` });
      onRefresh();
    }
  };

  if (issues.length === 0) {
    return (
      <Card className="p-12 text-center text-muted-foreground">
        No issues to display on the board.
      </Card>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {ISSUE_STATUS_ORDER.map((status) => {
          const columnIssues = issues.filter((i) => i.status === status);
          const meta = ISSUE_STATUS_META[status];
          return (
            <KanbanColumn
              key={status}
              status={status}
              label={meta.label}
              color={meta.color}
              badgeClass={meta.badgeClass}
              issues={columnIssues}
              canDrag={canChangeStatus}
            />
          );
        })}
      </div>
      <DragOverlay>
        {activeIssue ? <KanbanCard issue={activeIssue} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

interface KanbanColumnProps {
  status: IssueStatus;
  label: string;
  color: string;
  badgeClass: string;
  issues: Issue[];
  canDrag: boolean;
}

function KanbanColumn({ status, label, color, issues, canDrag }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex-shrink-0 w-72">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
          <h3 className="text-sm font-semibold">{label}</h3>
        </div>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{issues.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`min-h-[200px] rounded-lg border border-border p-2 space-y-2 transition-colors ${isOver ? 'bg-primary/5 border-primary/30' : 'bg-muted/30'}`}
      >
        {issues.length === 0 && (
          <div className="text-center py-8 text-xs text-muted-foreground">Drop issues here</div>
        )}
        {issues.map((issue) => (
          <KanbanCard key={issue.id} issue={issue} canDrag={canDrag} />
        ))}
      </div>
    </div>
  );
}

interface KanbanCardProps {
  issue: Issue;
  canDrag?: boolean;
  dragging?: boolean;
}

function KanbanCard({ issue, canDrag, dragging }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: issue.id,
    disabled: !canDrag,
  });

  const assignee = issue.assigneeId ? userRepo.find(issue.assigneeId) : null;
  const project = projectRepo.find(issue.projectId);
  const priorityMeta = ISSUE_PRIORITY_META[issue.priority];
  const typeMeta = ISSUE_TYPE_META[issue.type];
  const overdue = isOverdue(issue.dueDate, issue.status);
  const severityMeta = issue.severity ? ISSUE_SEVERITY_META[issue.severity] : null;

  return (
    <div
      ref={setNodeRef}
      {...(canDrag ? listeners : {})}
      {...(canDrag ? attributes : {})}
      className={`group rounded-md border border-border bg-card p-3 shadow-sm transition-all ${dragging ? 'opacity-80 shadow-md rotate-1' : isDragging ? 'opacity-30' : 'hover:border-primary/40 hover:shadow-md'} ${!canDrag ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
    >
      <div className="flex items-start justify-between gap-1 mb-1">
        <Link
          to={`/issues/${issue.id}`}
          className="text-xs font-mono text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {issue.key}
        </Link>
        {canDrag && (
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        )}
      </div>

      <Link
        to={`/issues/${issue.id}`}
        className="block text-sm font-medium leading-snug hover:text-primary transition-colors mb-2"
        onClick={(e) => e.stopPropagation()}
      >
        {issue.title}
      </Link>

      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${typeMeta.badgeClass}`}>
          {typeMeta.label}
        </Badge>
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${priorityMeta.badgeClass}`}>
          {priorityMeta.label}
        </Badge>
        {severityMeta && (
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${severityMeta.badgeClass}`}>
            {severityMeta.label}
          </Badge>
        )}
      </div>

      {project && (
        <div className="text-[10px] text-muted-foreground mb-2 truncate">{project.name}</div>
      )}

      <div className="flex items-center justify-between">
        {assignee ? (
          <div className="flex items-center gap-1.5">
            <UserAvatar name={assignee.name} color={assignee.avatarColor} image={assignee.avatarUrl} size="xs" />
            <span className="text-xs text-muted-foreground truncate max-w-[80px]">{assignee.name}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Unassigned</span>
        )}
        {issue.dueDate && (
          <span className={`text-[10px] flex items-center gap-0.5 ${overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
            {overdue && <AlertCircle className="h-3 w-3" />}
            {formatDate(issue.dueDate)}
          </span>
        )}
      </div>
    </div>
  );
}
