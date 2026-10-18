import { useState } from 'react';
import { Loader2, MoreVertical, RefreshCw, UserMinus, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/shared/user-avatar';
import { UserHoverCard } from '@/components/shared/user-hover-card';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ColoredBadge } from '@/components/issues/issue-badges';
import { StatusUpdateDialog } from '@/components/issues/status-update-dialog';
import { parseApiError } from '@/lib/api-error';
import { getAvatarColor } from '@/lib/shared-utils';
import {
  useAssignIssueMutation,
  useOverrideAssigneeStatusMutation,
  useUnassignIssueMutation,
} from '@/redux/features/issues/issue-detail-api';
import type { IssueAssignee, IssueColoredRef } from '@/redux/features/issues/issues-types';
import type { ProjectMember } from '@/redux/features/projects/projects-types';

interface IssueAssigneesProps {
  issueId: number;
  assignees: IssueAssignee[];
  canAssign: boolean;
  /** The project's members, offered when assigning */
  members: ProjectMember[];
  statuses: IssueColoredRef[];
}

/** Assignee list for the Details card, each with their own status and progress */
export function IssueAssignees({ issueId, assignees, canAssign, members, statuses }: IssueAssigneesProps) {
  const [assignIssue, { isLoading: assigning }] = useAssignIssueMutation();
  const [unassignIssue] = useUnassignIssueMutation();
  const [overrideStatus] = useOverrideAssigneeStatusMutation();
  const [assigneeSelect, setAssigneeSelect] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<IssueAssignee | null>(null);
  const [overriding, setOverriding] = useState<IssueAssignee | null>(null);

  const assignedIds = new Set(assignees.map((a) => a.user.id));
  const assignable = members.filter((m) => m.user.status === 'active' && !assignedIds.has(m.user.id));

  const handleAssign = async () => {
    if (!assigneeSelect) return;
    try {
      const res = await assignIssue({ issueId, user_id: Number(assigneeSelect) }).unwrap();
      setAssigneeSelect('');
      toast.success(res.message || 'Issue assigned');
    } catch (err) {
      toast.error('Failed to assign', { description: parseApiError(err).message });
    }
  };

  const handleUnassign = async (a: IssueAssignee) => {
    try {
      await unassignIssue({ issueId, userId: a.user.id }).unwrap();
      toast.success(`${a.user.name} unassigned`);
    } catch (err) {
      toast.error('Failed to unassign', { description: parseApiError(err).message });
    }
  };

  return (
    <>
      {assignees.length === 0 ? (
        <span className="text-sm text-muted-foreground">Unassigned</span>
      ) : (
        <div className="space-y-2">
          {assignees.map((a) => (
            <div key={a.user.id} className="flex items-center gap-2">
              <UserHoverCard user={a.user}>
                <UserAvatar name={a.user.name} color={getAvatarColor(a.user.id)} image={a.user.photo_url ?? undefined} size="xs" />
              </UserHoverCard>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm">{a.user.name}</span>
                  {a.self_picked && <span className="text-[10px] text-muted-foreground">(picked)</span>}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {a.status && <ColoredBadge item={a.status} className="px-1.5 py-0 text-[10px]" />}
                  <span className="tabular-nums">{a.progress}%</span>
                </div>
              </div>
              {canAssign && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" aria-label={`Actions for ${a.user.name}`}>
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setOverriding(a)}>
                      <RefreshCw className="mr-2 h-4 w-4" /> Set their status
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setConfirmRemove(a)} className="text-destructive">
                      <UserMinus className="mr-2 h-4 w-4" /> Unassign
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
        </div>
      )}

      {canAssign && (
        <div className="mt-2 flex gap-2">
          <Select value={assigneeSelect} onValueChange={setAssigneeSelect} disabled={assigning}>
            <SelectTrigger className="h-8 text-xs" aria-label="Choose someone to assign">
              <SelectValue placeholder={assignable.length ? 'Assign to...' : 'Everyone is assigned'} />
            </SelectTrigger>
            <SelectContent>
              {assignable.map((m) => (
                <SelectItem key={m.user.id} value={String(m.user.id)}>{m.user.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleAssign} disabled={!assigneeSelect || assigning} aria-label="Assign">
            {assigning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmRemove}
        onOpenChange={(open) => { if (!open) setConfirmRemove(null); }}
        title="Unassign"
        description={`Remove ${confirmRemove?.user.name} from this issue? Their progress on it will be dropped.`}
        confirmLabel="Unassign"
        variant="destructive"
        onConfirm={async () => { if (confirmRemove) await handleUnassign(confirmRemove); }}
      />

      <StatusUpdateDialog
        open={!!overriding}
        onOpenChange={(open) => { if (!open) setOverriding(null); }}
        title={`Set ${overriding?.user.name ?? ''}'s status`}
        description="Overrides this assignee's own status and progress. They'll see the change in the history."
        statuses={statuses}
        initial={{ status_id: overriding?.status?.id, progress: overriding?.progress ?? 0 }}
        onSubmit={async (body) => {
          if (!overriding) return;
          try {
            await overrideStatus({ issueId, userId: overriding.user.id, ...body }).unwrap();
            toast.success('Status updated', { description: overriding.user.name });
          } catch (err) {
            toast.error('Failed to update status', { description: parseApiError(err).message });
            throw err;
          }
        }}
      />
    </>
  );
}
