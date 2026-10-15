import { useState, useMemo, useRef } from 'react';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { useAuth } from '@/lib/auth-context';
import { parseApiError } from '@/lib/api-error';
import { formatDate, getAvatarColor, USER_STATUS_META } from '@/lib/shared-utils';
import { useGetRolesQuery } from '@/redux/features/roles/roles-api';
import {
  useDisableUserMutation,
  useGetUsersInfiniteQuery,
  useResendInviteMutation,
  useUpdateUserMutation,
} from '@/redux/features/users/users-api';
import { isUserDisabled, type AdminUser } from '@/redux/features/users/users-types';
import { PageHeader } from '@/components/shared/page-header';
import { UserAvatar } from '@/components/shared/user-avatar';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { InfiniteScrollTrigger } from '@/components/shared/infinite-scroll-trigger';
import { TableSkeletonRows } from '@/components/shared/table-skeleton-rows';
import { ROW_INDEX_ATTR, ScrollPositionIndicator } from '@/components/shared/scroll-position-indicator';
import { UserFormDialog } from '@/components/users/user-form-dialog';
import { UserStatusIndicator } from '@/components/users/user-status-indicator';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreVertical, Plus, Search, Pencil, Mail, Send, Lock, AlertTriangle, RotateCw, ShieldCheck, X, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const COLUMN_COUNT = 8;
const ALL = 'all';

type UserActionType = 'activate' | 'deactivate' | 'resend';
type PendingAction = { user: AdminUser; action: UserActionType };

/** Confirm-dialog copy for every row action, so each one is confirmed the same way */
const ACTION_CONFIG: Record<UserActionType, {
  title: string;
  confirmLabel: string;
  variant: 'default' | 'destructive';
  describe: (user: AdminUser) => string;
}> = {
  activate: {
    title: 'Activate user',
    confirmLabel: 'Activate',
    variant: 'default',
    describe: (u) => `Are you sure you want to activate ${u.name}? They will be able to sign in again.`,
  },
  deactivate: {
    title: 'Disable user',
    confirmLabel: 'Disable',
    variant: 'destructive',
    describe: (u) => `Are you sure you want to disable ${u.name}? They will not be able to sign in until reactivated. This does not delete their account.`,
  },
  resend: {
    title: 'Resend invitation',
    confirmLabel: 'Resend',
    variant: 'default',
    describe: (u) => `Send a new invitation email to ${u.email}? Any previous invitation link will no longer be valid.`,
  },
};

export default function UsersPage() {
  const { session, hasPermission } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [roleFilter, setRoleFilter] = useState<string>(ALL);

  // The input updates instantly; the API only sees the value once typing pauses
  const debouncedSearch = useDebouncedValue(search.trim());
  const isSearchPending = search.trim() !== debouncedSearch;

  // Search and status are filtered by the API (undefined params are dropped from the query
  // string). Each combination is its own cache entry, so changing one starts again from page 1.
  const list = useInfiniteList(
    useGetUsersInfiniteQuery({
      search: debouncedSearch || undefined,
      status: statusFilter === ALL ? undefined : statusFilter,
    }),
  );
  const { data: roles = [] } = useGetRolesQuery();
  const [disableUser] = useDisableUserMutation();
  const [updateUser] = useUpdateUserMutation();
  const [resendInvite] = useResendInviteMutation();

  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Role still applies to the loaded rows until the backend supports it as a param
  const filtered = useMemo(
    () => (roleFilter === ALL ? list.items : list.items.filter((u) => u.default_role === roleFilter)),
    [list.items, roleFilter],
  );

  const hasFilters = search !== '' || statusFilter !== ALL || roleFilter !== ALL;

  const clearFilters = () => {
    setSearch('');
    setStatusFilter(ALL);
    setRoleFilter(ALL);
  };

  const isSelf = (user: AdminUser) => String(user.id) === session?.user.id;

  const handleCreate = () => {
    setEditingUser(null);
    setFormOpen(true);
  };

  const handleEdit = (user: AdminUser) => {
    setEditingUser(user);
    setFormOpen(true);
  };

  const runAction = async ({ user, action }: PendingAction) => {
    try {
      if (action === 'activate') {
        await updateUser({ id: user.id, status: 'active' }).unwrap();
        toast.success(`Activated ${user.name}`);
      } else if (action === 'deactivate') {
        await disableUser(user.id).unwrap();
        toast.success(`Disabled ${user.name}`);
      } else {
        const res = await resendInvite(user.id).unwrap();
        toast.success('Invitation sent', { description: res.message || `A new invitation was sent to ${user.email}.` });
      }
    } catch (err) {
      toast.error(`Failed to ${ACTION_CONFIG[action].confirmLabel.toLowerCase()}`, {
        description: parseApiError(err).message,
      });
    }
  };

  const confirmFor = (user: AdminUser, action: UserActionType) => setPendingAction({ user, action });

  const pendingConfig = pendingAction ? ACTION_CONFIG[pendingAction.action] : null;

  const canCreate = hasPermission('users.create');
  const canUpdate = hasPermission('users.update');
  const canDeactivate = hasPermission('users.deactivate');

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="User Management"
        description="Create and manage user accounts, assign roles, and control access."
        breadcrumbs={[{ label: 'Users' }]}
        actions={
          canCreate && (
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              New User
            </Button>
          )
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
                placeholder="Search by name, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                aria-label="Search users"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {Object.entries(USER_STATUS_META).map(([value, meta]) => (
                  <SelectItem key={value} value={value}>{meta.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All roles</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
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
                {filtered.length} of {list.total} users
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={list.refresh}
                disabled={list.isFetching}
                aria-label="Refresh users"
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
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Created</TableHead>
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
                          {parseApiError(list.error, 'Failed to load users.').message}
                        </span>
                        <Button variant="outline" size="sm" onClick={list.refresh} disabled={list.isFetching}>
                          <RotateCw className="mr-2 h-3.5 w-3.5" />
                          Retry
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={COLUMN_COUNT} className="text-center py-8 text-muted-foreground">
                      No users found matching your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((user, index) => {
                    const self = isSelf(user);
                    // Super admin accounts are protected from every action
                    const locked = user.is_super_admin;
                    const canEdit = canUpdate && !locked;
                    const canToggle = canDeactivate && !self && !locked;
                    // Backend rejects re-inviting active accounts (USER_ALREADY_ACTIVE)
                    const canResend = canEdit && user.status === 'invited';
                    return (
                      <TableRow key={user.id} {...{ [ROW_INDEX_ATTR]: index }}>
                        <TableCell className="text-sm tabular-nums text-muted-foreground">{index + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <UserAvatar name={user.name} color={getAvatarColor(user.id)} size="sm" />
                            <div>
                              <div className="font-medium">{user.name}</div>
                              <div className="text-xs text-muted-foreground">{user.designation || '—'}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.is_super_admin && (
                              <Badge className="text-xs">
                                <ShieldCheck className="mr-1 h-3 w-3" />
                                Super Admin
                              </Badge>
                            )}
                            {user.default_role && (
                              <Badge variant="secondary" className="text-xs">{user.default_role}</Badge>
                            )}
                            {!user.is_super_admin && !user.default_role && (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            {canToggle && (
                              <Switch
                                checked={!isUserDisabled(user.status)}
                                onCheckedChange={(enabled) => confirmFor(user, enabled ? 'activate' : 'deactivate')}
                                aria-label={`${isUserDisabled(user.status) ? 'Activate' : 'Deactivate'} ${user.name}`}
                                className="scale-90"
                              />
                            )}
                            <UserStatusIndicator status={user.status} />
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{user.department || '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(user.created_at)}</TableCell>
                        <TableCell>
                          {locked ? (
                            <div
                              className="flex h-8 w-8 items-center justify-center text-muted-foreground/60"
                              title="Super admin accounts are protected"
                              aria-label="Super admin accounts are protected"
                            >
                              <Lock className="h-4 w-4" />
                            </div>
                          ) : (canEdit || self) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {canEdit && (
                                  <DropdownMenuItem onClick={() => handleEdit(user)}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit user
                                  </DropdownMenuItem>
                                )}
                                {canResend && (
                                  <DropdownMenuItem onClick={() => confirmFor(user, 'resend')}>
                                    <Send className="mr-2 h-4 w-4" />
                                    Resend invitation
                                  </DropdownMenuItem>
                                )}
                                {self && (
                                  <DropdownMenuItem disabled>
                                    <Mail className="mr-2 h-4 w-4" />
                                    This is you
                                  </DropdownMenuItem>
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

          <InfiniteScrollTrigger
            {...list.trigger}
            disabled={list.trigger.disabled || list.showSkeleton}
            endMessage={list.items.length > 0 ? 'No more users' : undefined}
          />
        </CardContent>
      </Card>

      {/* The role filter is client-side, so the server total doesn't apply while it's set */}
      <ScrollPositionIndicator
        containerRef={tableRef}
        total={roleFilter === ALL ? list.total : filtered.length}
      />

      <UserFormDialog open={formOpen} onOpenChange={setFormOpen} user={editingUser} />

      <ConfirmDialog
        open={!!pendingAction}
        onOpenChange={(open) => { if (!open) setPendingAction(null); }}
        title={pendingConfig?.title ?? ''}
        description={pendingAction && pendingConfig ? pendingConfig.describe(pendingAction.user) : ''}
        confirmLabel={pendingConfig?.confirmLabel}
        variant={pendingConfig?.variant}
        onConfirm={async () => { if (pendingAction) await runAction(pendingAction); }}
      />
    </div>
  );
}
