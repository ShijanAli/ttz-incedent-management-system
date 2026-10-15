import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { AlertCircle, GripVertical, MessageSquare, Paperclip, Users as UsersIcon } from 'lucide-react';
import { IssuePriorityBadge, IssueProgress } from '@/components/issues/issue-badges';
import { formatDate, isOverdue } from '@/lib/shared-utils';
import { cn } from '@/lib/utils';
import type { IssueColoredRef, IssueSummary } from '@/redux/features/issues/issues-types';

const NO_STATUS: IssueColoredRef = { id: -1, name: 'No status', color: '#94a3b8' };

/** Issues may come with their project (global lists) or without (a project's own list) */
type BoardIssue = IssueSummary & { project?: { id: number; name: string } };

/** A board column; `is_terminal` marks a final status (moving there completes the work) */
export type BoardStatus = IssueColoredRef & { is_terminal?: boolean };

interface IssueBoardProps {
  issues: BoardIssue[];
  /**
   * The project's workflow, in order. Every status gets a column, even when empty.
   * Without it, columns are built from the issues' statuses in first-seen order.
   */
  statuses?: BoardStatus[];
  /**
   * Called when a card is dropped on another column. Reject to snap the card back.
   * Omit to make the board read-only.
   */
  onMove?: (issue: BoardIssue, to: BoardStatus) => Promise<unknown>;
}

/** Board view: one column per status; cards can be dragged between columns when `onMove` is given */
export function IssueBoard({ issues, statuses, onMove }: IssueBoardProps) {
  // Cards moved but not yet confirmed by fresh data: issueId -> target status
  const [pendingMoves, setPendingMoves] = useState<Map<number, BoardStatus>>(new Map());
  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(
    // A short distance keeps plain clicks working (opening the issue)
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  // Drop an optimistic move once the server data shows the card in its new column
  useEffect(() => {
    setPendingMoves((prev) => {
      if (prev.size === 0) return prev;
      const next = new Map(prev);
      for (const issue of issues) {
        if (next.get(issue.id)?.id === issue.status?.id) next.delete(issue.id);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [issues]);

  const columns = useMemo(() => {
    type Column = { status: BoardStatus; items: BoardIssue[] };
    const byStatus = new Map<number, Column>();
    statuses?.forEach((status) => byStatus.set(status.id, { status, items: [] }));
    for (const issue of issues) {
      const status = pendingMoves.get(issue.id) ?? issue.status ?? NO_STATUS;
      const column: Column = byStatus.get(status.id) ?? { status, items: [] };
      column.items.push(issue);
      byStatus.set(status.id, column);
    }
    return [...byStatus.values()];
  }, [issues, statuses, pendingMoves]);

  const activeIssue = activeId === null ? null : issues.find((i) => i.id === activeId) ?? null;

  const handleDragStart = (event: DragStartEvent) => setActiveId(Number(event.active.id));

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    if (!onMove || !event.over) return;
    const issue = issues.find((i) => i.id === Number(event.active.id));
    const target = columns.find((c) => c.status.id === Number(event.over?.id))?.status;
    const current = issue && (pendingMoves.get(issue.id) ?? issue.status ?? NO_STATUS);
    if (!issue || !target || target.id === NO_STATUS.id || target.id === current?.id) return;

    setPendingMoves((prev) => new Map(prev).set(issue.id, target));
    try {
      await onMove(issue, target);
    } catch {
      // Snap back; the caller has already explained why
      setPendingMoves((prev) => {
        const next = new Map(prev);
        next.delete(issue.id);
        return next;
      });
    }
  };

  if (columns.length === 0) {
    return <div className="py-12 text-center text-muted-foreground">No issues to show.</div>;
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex gap-4 overflow-x-auto pb-2">
        {columns.map(({ status, items }) => (
          <BoardColumn key={status.id} status={status} count={items.length} droppable={Boolean(onMove)}>
            {items.length === 0 && (
              <p className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">
                {onMove ? 'Drop issues here' : 'No issues'}
              </p>
            )}
            {items.map((issue) => (
              <DraggableCard key={issue.id} issue={issue} draggable={Boolean(onMove)} pending={pendingMoves.has(issue.id)} />
            ))}
          </BoardColumn>
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeIssue && <IssueCard issue={activeIssue} className="rotate-2 shadow-xl" />}
      </DragOverlay>
    </DndContext>
  );
}

function BoardColumn({
  status, count, droppable, children,
}: { status: BoardStatus; count: number; droppable: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id, disabled: !droppable || status.id === NO_STATUS.id });
  return (
    <section
      ref={setNodeRef}
      aria-label={status.name}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-xl bg-muted/40 p-3 transition-colors',
        isOver && 'bg-primary/10 ring-2 ring-primary/40',
      )}
    >
      <header className="mb-3 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />
        <h3 className="text-sm font-semibold">{status.name}</h3>
        <span className="ml-auto rounded-full bg-background px-2 text-xs tabular-nums text-muted-foreground">{count}</span>
      </header>
      <div className="min-h-[60px] space-y-2">{children}</div>
    </section>
  );
}

function DraggableCard({ issue, draggable, pending }: { issue: BoardIssue; draggable: boolean; pending: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: issue.id, disabled: !draggable });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-roledescription={draggable ? 'Draggable issue' : undefined}
      className={cn(draggable && 'cursor-grab active:cursor-grabbing', isDragging && 'opacity-40')}
    >
      <IssueCard issue={issue} showGrip={draggable} className={cn(pending && 'animate-pulse')} />
    </div>
  );
}

function IssueCard({ issue, showGrip, className }: { issue: BoardIssue; showGrip?: boolean; className?: string }) {
  const overdue = issue.progress < 100 && isOverdue(issue.due_date ?? undefined);
  return (
    <Link
      to={`/issues/${issue.id}`}
      // dnd-kit's activation distance means a real click still navigates
      draggable={false}
      className={cn('block rounded-lg border bg-background p-3 shadow-sm transition-shadow hover:shadow-md', className)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
          {showGrip && <GripVertical className="h-3 w-3 opacity-50" aria-hidden />}
          {issue.code}
        </span>
        <IssuePriorityBadge priority={issue.priority} />
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm font-medium">{issue.title}</p>
      {issue.project && <p className="mt-0.5 truncate text-xs text-muted-foreground">{issue.project.name}</p>}
      {issue.labels.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {issue.labels.slice(0, 3).map((l) => (
            <span key={l} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{l}</span>
          ))}
        </div>
      )}
      <div className="mt-2.5">
        <IssueProgress issue={issue} />
      </div>
      <div className="mt-2.5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1" title="Assignees"><UsersIcon className="h-3 w-3" />{issue.assignee_count}</span>
        <span className="flex items-center gap-1" title="Comments"><MessageSquare className="h-3 w-3" />{issue.comment_count}</span>
        <span className="flex items-center gap-1" title="Attachments"><Paperclip className="h-3 w-3" />{issue.attachment_count}</span>
        {issue.due_date && (
          <span className={cn('ml-auto flex items-center gap-1', overdue && 'font-medium text-red-600')}>
            {overdue && <AlertCircle className="h-3 w-3" />}
            {formatDate(issue.due_date)}
          </span>
        )}
      </div>
    </Link>
  );
}
