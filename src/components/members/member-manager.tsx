import { useMemo, useState } from 'react';
import { Check, Loader2, Pencil, UserMinus, UserPlus, Users as UsersIcon, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { UserAvatar } from '@/components/shared/user-avatar';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { RoleSelect } from '@/components/members/role-select';
import { UserSearchList } from '@/components/members/user-search-list';
import { parseApiError } from '@/lib/api-error';
import { getAvatarColor } from '@/lib/shared-utils';

const ALL = 'all';

export interface ManagedMember {
  user: { id: number; name: string; designation: string | null; status: string };
  role: string;
  /** "direct" (default) members are editable; anything else came in another way, e.g. a group */
  source?: string;
}

export interface MemberManagerProps {
  /** Shown in toasts and the remove confirmation, e.g. the project or group name */
  entityName: string;
  members: ManagedMember[];
  isLoading: boolean;
  error?: unknown;
  onRetry: () => void;
  canManage: boolean;
  onAdd: (userId: number, role?: string) => Promise<unknown>;
  onChangeRole: (userId: number, role: string) => Promise<unknown>;
  onRemove: (userId: number) => Promise<unknown>;
  /** Consequence of removal, appended to the confirmation text */
  removeWarning?: string;
  footnote?: string;
}

/**
 * Lists members with their roles and, for managers, lets them add people
 * (searchable, infinite user list), change roles and remove members. API-agnostic:
 * the project and group pages pass their own mutations in.
 */
export function MemberManager({
  entityName, members, isLoading, error, onRetry, canManage,
  onAdd, onChangeRole, onRemove, removeWarning = 'They will lose access.', footnote,
}: MemberManagerProps) {
  const [roleFilter, setRoleFilter] = useState(ALL);
  const [pending, setPending] = useState<number | null>(null);
  const [addRoleByUser, setAddRoleByUser] = useState<Record<number, string>>({});
  const [editing, setEditing] = useState<{ userId: number; role: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<ManagedMember | null>(null);

  const memberIds = useMemo(() => new Set(members.map((m) => m.user.id)), [members]);
  const roles = useMemo(() => [...new Set(members.map((m) => m.role))].sort(), [members]);
  const filtered = roleFilter === ALL ? members : members.filter((m) => m.role === roleFilter);

  /** Runs a member mutation with a per-row spinner and a toast either way */
  const run = async (userId: number, action: () => Promise<unknown>, success: string, failure: string) => {
    setPending(userId);
    try {
      await action();
      toast.success(success);
      return true;
    } catch (err) {
      toast.error(failure, { description: parseApiError(err).message });
      return false;
    } finally {
      setPending(null);
    }
  };

  const handleAdd = async (userId: number, name: string) => {
    const role = addRoleByUser[userId] ?? '';
    const added = await run(
      userId,
      () => onAdd(userId, role || undefined),
      `${name} added to ${entityName}${role ? ` as ${role}` : ''}`,
      'Failed to add member',
    );
    if (added) setAddRoleByUser(({ [userId]: _, ...rest }) => rest);
  };

  const handleSaveRole = async (member: ManagedMember) => {
    if (!editing || !editing.role || editing.role === member.role) {
      setEditing(null);
      return;
    }
    const saved = await run(
      member.user.id,
      () => onChangeRole(member.user.id, editing.role),
      `${member.user.name} is now ${editing.role}`,
      'Failed to update role',
    );
    if (saved) setEditing(null);
  };

  const handleRemove = (member: ManagedMember) =>
    run(member.user.id, () => onRemove(member.user.id), `${member.user.name} removed from ${entityName}`, 'Failed to remove member');

  return (
    <div className={canManage ? 'grid gap-4 lg:grid-cols-2' : undefined}>
      {/* Current members */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Current Members ({members.length})
            </h3>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-8 w-auto min-w-[140px] text-xs" aria-label="Filter members by role">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All roles</SelectItem>
                {roles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="max-h-[420px] space-y-2 overflow-y-auto">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[72px] w-full rounded-lg" />)
            ) : error ? (
              <div className="py-8 text-center text-sm">
                <p className="text-destructive">{parseApiError(error, 'Failed to load members.').message}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>Retry</Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {members.length === 0 ? 'No members yet.' : 'No members match this role filter.'}
              </div>
            ) : (
              filtered.map((m) => {
                const editable = canManage && (m.source ?? 'direct') === 'direct';
                const isEditing = editing?.userId === m.user.id;
                const busy = pending === m.user.id;
                return (
                  <div key={m.user.id} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={m.user.name} color={getAvatarColor(m.user.id)} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{m.user.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{m.user.designation || '—'}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {m.source && m.source !== 'direct' && (
                          <Badge variant="secondary" className="text-xs font-normal" title="Added through a group">
                            <UsersIcon className="mr-1 h-3 w-3" />
                            Via group
                          </Badge>
                        )}
                        {m.user.status !== 'active' && (
                          <Badge variant="outline" className="text-xs capitalize text-muted-foreground">{m.user.status}</Badge>
                        )}
                        {editable && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => setConfirmRemove(m)}
                            disabled={busy}
                            aria-label={`Remove ${m.user.name}`}
                          >
                            {busy && !isEditing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserMinus className="h-3.5 w-3.5" />}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Role */}
                    <div className="flex items-center gap-2 pl-11">
                      {isEditing ? (
                        <>
                          <RoleSelect
                            value={editing.role}
                            onChange={(role) => setEditing({ userId: m.user.id, role })}
                            allowDefault={false}
                            disabled={busy}
                            className="flex-1"
                          />
                          <Button size="icon" className="h-7 w-7" onClick={() => handleSaveRole(m)} disabled={busy} aria-label="Save role">
                            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(null)} disabled={busy} aria-label="Cancel">
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Badge variant="secondary" className="text-xs font-normal">{m.role}</Badge>
                          {editable && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs text-muted-foreground"
                              onClick={() => setEditing({ userId: m.user.id, role: m.role })}
                            >
                              <Pencil className="mr-1 h-3 w-3" />
                              Edit role
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add members */}
      {canManage && (
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Add Members</h3>
            <UserSearchList
              excludeIds={memberIds}
              emptyMessage="All active users are already members."
              renderAction={(user) => (
                <div className="flex items-center gap-2">
                  <RoleSelect
                    value={addRoleByUser[user.id] ?? ''}
                    onChange={(role) => setAddRoleByUser((prev) => ({ ...prev, [user.id]: role }))}
                    disabled={pending === user.id}
                    className="w-[150px]"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7"
                    onClick={() => handleAdd(user.id, user.name)}
                    disabled={pending === user.id}
                  >
                    {pending === user.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="mr-1 h-3.5 w-3.5" />}
                    Add
                  </Button>
                </div>
              )}
            />
            <Separator className="my-3" />
            <p className="text-xs text-muted-foreground">
              {footnote ?? 'Leave the role on "User\'s default role" to use the role from their account.'}
            </p>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={!!confirmRemove}
        onOpenChange={(open) => { if (!open) setConfirmRemove(null); }}
        title="Remove member"
        description={`Remove ${confirmRemove?.user.name} from ${entityName}? ${removeWarning}`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={async () => { if (confirmRemove) await handleRemove(confirmRemove); }}
      />
    </div>
  );
}
