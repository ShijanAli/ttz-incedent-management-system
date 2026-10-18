import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, rectIntersection, useDraggable, useDroppable,
  useSensor, useSensors, type CollisionDetection, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertCircle, GripVertical, MessageSquare, Paperclip, Plus, Users as UsersIcon } from 'lucide-react';
import { ColoredBadge, IssuePriorityBadge, IssueProgress } from '@/components/issues/issue-badges';
import { AvatarStack } from '@/components/shared/avatar-stack';
import { formatDate, isOverdue } from '@/lib/shared-utils';
import { cn } from '@/lib/utils';
import type { IssueColoredRef, IssueSummary } from '@/redux/features/issues/issues-types';

const NO_STATUS: IssueColoredRef = { id: -1, name: 'No status', color: '#94a3b8' };

/** Issues may come with their project (global lists) or without (a project's own list) */
type BoardIssue = IssueSummary & { project?: { id: number; name: string } };

/** A board column; `is_terminal` marks a final status (moving there completes the work) */
export type BoardStatus = IssueColoredRef & { is_terminal?: boolean };

/**
 * Two things can be dragged on the board: cards (between columns) and the columns
 * themselves (to reorder the workflow). Each kind only collides with its own targets.
 */
type DragKind = 'card' | 'column';
const columnDndId = (statusId: number) => `column-${statusId}`;
const dropDndId = (statusId: number) => `drop-${statusId}`;

const collisionDetection: CollisionDetection = (args) => {
  const kind = args.active.data.current?.kind as DragKind | undefined;
  const target = kind === 'column' ? 'column' : 'drop';
  const droppableContainers = args.droppableContainers.filter((c) => c.data.current?.kind === target);
  return (kind === 'column' ? closestCenter : rectIntersection)({ ...args, droppableContainers });
};

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
  /**
   * Called with the full column order after a column is dragged to a new place.
   * Reject to put the columns back. Omit to keep the column order fixed.
   */
  onReorderColumns?: (ordered: BoardStatus[]) => Promise<unknown>;
  /**
   * Shows a "Create issue" button at the bottom of the first column. New issues start
   * in the project's default status, so it lives where they land. Omit to hide it.
   */
  onCreate?: () => void;
}

/**
 * Board view: one column per status. Cards can be dragged between columns when
 * `onMove` is given; columns can be reordered by their grip when `onReorderColumns` is.
 */
export function IssueBoard({ issues, statuses, onMove, onReorderColumns, onCreate }: IssueBoardProps) {
  // Cards moved but not yet confirmed by fresh data: issueId -> target status
  const [pendingMoves, setPendingMoves] = useState<Map<number, BoardStatus>>(new Map());
  // Column order saved but not yet confirmed by fresh statuses
  const [pendingOrder, setPendingOrder] = useState<number[] | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);

  // Fresh statuses in the saved order end the optimistic reorder
  useEffect(() => {
    setPendingOrder((prev) => (prev && statuses && prev.join() === statuses.map((s) => s.id).join() ? null : prev));
  }, [statuses]);

  const orderedStatuses = useMemo(() => {
    if (!statuses || !pendingOrder) return statuses;
    const rank = new Map(pendingOrder.map((id, i) => [id, i]));
    return [...statuses].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
  }, [statuses, pendingOrder]);

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
    orderedStatuses?.forEach((status) => byStatus.set(status.id, { status, items: [] }));
    for (const issue of issues) {
      const status = pendingMoves.get(issue.id) ?? issue.status ?? NO_STATUS;
      const column: Column = byStatus.get(status.id) ?? { status, items: [] };
      column.items.push(issue);
      byStatus.set(status.id, column);
    }
    return [...byStatus.values()];
  }, [issues, orderedStatuses, pendingMoves]);

  // Only the project's own statuses can be reordered (not "No status" or ones it doesn't list)
  const sortableIds = (orderedStatuses ?? []).map((s) => columnDndId(s.id));
  const canReorder = Boolean(onReorderColumns) && sortableIds.length > 1;

  const activeIssue = activeId === null ? null : issues.find((i) => i.id === activeId) ?? null;

  const handleDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.kind === 'card') setActiveId(Number(event.active.id));
  };

  const handleColumnDrop = async (event: DragEndEvent) => {
    if (!onReorderColumns || !orderedStatuses || !event.over || event.active.id === event.over.id) return;
    const ids = orderedStatuses.map((s) => s.id);
    const from = ids.indexOf(Number(event.active.data.current?.statusId));
    const to = ids.indexOf(Number(event.over.data.current?.statusId));
    if (from < 0 || to < 0) return;

    const next = arrayMove(orderedStatuses, from, to);
    setPendingOrder(next.map((s) => s.id));
    try {
      await onReorderColumns(next);
    } catch {
      // Put the columns back; the caller has already explained why
      setPendingOrder(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    if (event.active.data.current?.kind === 'column') {
      await handleColumnDrop(event);
      return;
    }
    if (!onMove || !event.over) return;
    const issue = issues.find((i) => i.id === Number(event.active.id));
    const target = columns.find((c) => c.status.id === Number(event.over?.data.current?.statusId))?.status;
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
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {columns.map(({ status, items }, index) => {
            const showCreate = Boolean(onCreate) && index === 0;
            return (
              <BoardColumn
                key={status.id}
                status={status}
                count={items.length}
                droppable={Boolean(onMove)}
                sortable={canReorder && sortableIds.includes(columnDndId(status.id))}
              >
                {items.length === 0 && !showCreate && (
                  <p className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">
                    {onMove ? 'Drop issues here' : 'No issues'}
                  </p>
                )}
                {items.map((issue) => (
                  <DraggableCard key={issue.id} issue={issue} draggable={Boolean(onMove)} pending={pendingMoves.has(issue.id)} />
                ))}
                {showCreate && (
                  <button
                    type="button"
                    onClick={onCreate}
                    className="flex w-full items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Plus className="h-4 w-4" /> Create issue
                  </button>
                )}
              </BoardColumn>
            );
          })}
        </div>
      </SortableContext>

      <DragOverlay dropAnimation={null}>
        {activeIssue && <IssueCard issue={activeIssue} className="rotate-2 shadow-xl" />}
      </DragOverlay>
    </DndContext>
  );
}

function BoardColumn({
  status, count, droppable, sortable, children,
}: { status: BoardStatus; count: number; droppable: boolean; sortable: boolean; children: React.ReactNode }) {
  // Target for cards dropped into this column
  const drop = useDroppable({
    id: dropDndId(status.id),
    data: { kind: 'drop', statusId: status.id },
    disabled: !droppable || status.id === NO_STATUS.id,
  });
  // The column itself, dragged by its grip to reorder the workflow
  const sort = useSortable({
    id: columnDndId(status.id),
    data: { kind: 'column', statusId: status.id },
    disabled: !sortable,
  });

  return (
    <section
      ref={(el) => { drop.setNodeRef(el); sort.setNodeRef(el); }}
      aria-label={status.name}
      style={{ transform: CSS.Translate.toString(sort.transform), transition: sort.transition }}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-xl bg-muted/40 p-3 transition-colors',
        drop.isOver && 'bg-primary/10 ring-2 ring-primary/40',
        sort.isDragging && 'z-10 opacity-70 shadow-xl ring-2 ring-primary/40',
      )}
    >
      <header className="mb-3 flex items-center gap-2">
        {sortable && (
          <button
            type="button"
            ref={sort.setActivatorNodeRef}
            {...sort.attributes}
            {...sort.listeners}
            className="-ml-1 cursor-grab rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
            aria-label={`Reorder ${status.name} column`}
            title="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />
        <h3 className="text-sm font-semibold">{status.name}</h3>
        <span className="ml-auto rounded-full bg-background px-2 text-xs tabular-nums text-muted-foreground">{count}</span>
      </header>
      <div className="min-h-[60px] space-y-2">{children}</div>
    </section>
  );
}

function DraggableCard({ issue, draggable, pending }: { issue: BoardIssue; draggable: boolean; pending: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: issue.id,
    data: { kind: 'card' },
    disabled: !draggable,
  });
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
      {issue.category && (
        <div className="mt-1.5">
          <ColoredBadge item={issue.category} />
        </div>
      )}
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
        {issue.assignees?.length ? (
          <AvatarStack people={issue.assignees} size="xs" />
        ) : (
          <span className="flex items-center gap-1" title="Assignees"><UsersIcon className="h-3 w-3" />{issue.assignee_count}</span>
        )}
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
