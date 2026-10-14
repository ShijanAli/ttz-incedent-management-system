import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { userRepo, roleRepo, activityRepo, getUserRoles } from '@/lib/repository';
import { PageHeader } from '@/components/shared/page-header';
import { UserAvatar } from '@/components/shared/user-avatar';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { UserFormDialog } from '@/components/users/user-form-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Plus, Search, UserCog, UserX, UserCheck, Pencil, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/shared-utils';
import type { User, UserStatus } from '@/lib/types';

export default function UsersPage() {
  const { session, hasPermission, refreshSession: refreshAuth } = useAuth();
  const [users, setUsers] = useState<User[]>(userRepo.all());
  const [roles] = useState(roleRepo.all());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ user: User; action: 'activate' | 'deactivate' } | null>(null);

  const refresh = () => {
    setUsers(userRepo.all());
    refreshAuth();
  };

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (search) {
        const q = search.toLowerCase();
        if (!u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q) && !(u.title || '').toLowerCase().includes(q)) return false;
      }
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (roleFilter !== 'all') {
        if (!u.roleIds.includes(roleFilter)) return false;
      }
      return true;
    });
  }, [users, search, statusFilter, roleFilter]);

  const handleCreate = () => {
    setEditingUser(null);
    setFormOpen(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormOpen(true);
  };

  const handleToggleStatus = (user: User) => {
    const action = user.status === 'active' ? 'deactivate' : 'activate';
    setConfirmAction({ user, action });
    setConfirmOpen(true);
  };

  const confirmToggle = () => {
    if (!confirmAction) return;
    const { user, action } = confirmAction;
    const newStatus: UserStatus = action === 'activate' ? 'active' : 'inactive';
    userRepo.update(user.id, { status: newStatus });
    activityRepo.create({
      actorId: session!.user.id,
      action: action === 'activate' ? 'user_activated' : 'user_deactivated',
      entityType: 'User',
      entityId: user.id,
      entityName: user.name,
      summary: `${action === 'activate' ? 'Activated' : 'Deactivated'} user "${user.name}"`,
    });
    toast.success(`${action === 'activate' ? 'Activated' : 'Deactivated'} ${user.name}`);
    refresh();
  };

  const getRoleNames = (userId: string) => {
    return getUserRoles(userId).map((r) => r.name);
  };

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
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-sm text-muted-foreground ml-auto">
              {filtered.length} of {users.length} users
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
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
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No users found matching your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <UserAvatar name={user.name} color={user.avatarColor} image={user.avatarUrl} size="sm" />
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-xs text-muted-foreground">{user.title || '—'}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {getRoleNames(user.id).map((name) => (
                            <Badge key={name} variant="secondary" className="text-xs">
                              {name}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                            user.status === 'active' ? 'text-emerald-600' : 'text-slate-500'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              user.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          />
                          {user.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.department || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(user.createdAt)}</TableCell>
                      <TableCell>
                        {(canUpdate || canDeactivate) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canUpdate && (
                                <DropdownMenuItem onClick={() => handleEdit(user)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit user
                                </DropdownMenuItem>
                              )}
                              {canDeactivate && user.id !== session?.user.id && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleToggleStatus(user)}
                                    className={user.status === 'active' ? 'text-destructive' : 'text-emerald-600'}
                                  >
                                    {user.status === 'active' ? (
                                      <>
                                        <UserX className="mr-2 h-4 w-4" />
                                        Deactivate
                                      </>
                                    ) : (
                                      <>
                                        <UserCheck className="mr-2 h-4 w-4" />
                                        Activate
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                </>
                              )}
                              {user.id === session?.user.id && (
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        user={editingUser}
        onSaved={refresh}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={confirmAction?.action === 'activate' ? 'Activate user' : 'Deactivate user'}
        description={
          confirmAction?.action === 'activate'
            ? `Are you sure you want to activate ${confirmAction.user.name}? They will be able to sign in again.`
            : `Are you sure you want to deactivate ${confirmAction?.user.name}? They will not be able to sign in until reactivated. This does not delete their account.`
        }
        confirmLabel={confirmAction?.action === 'activate' ? 'Activate' : 'Deactivate'}
        variant={confirmAction?.action === 'deactivate' ? 'destructive' : 'default'}
        onConfirm={confirmToggle}
      />
    </div>
  );
}
