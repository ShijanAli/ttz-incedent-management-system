import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/lib/auth-context';
import { parseApiError } from '@/lib/api-error';
import {
  useDeleteRoleMutation,
  useGetPermissionCatalogQuery,
  useGetRolesQuery,
} from '@/redux/features/roles/roles-api';
import type { ApiRole } from '@/redux/features/roles/roles-types';
import { PageHeader } from '@/components/shared/page-header';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Search, MoreVertical, Pencil, Trash2, ShieldCheck, Lock, AlertTriangle, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/shared-utils';

const COLUMN_COUNT = 7;

export default function RolesPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { data: roles = [], isLoading, isError, error, refetch, isFetching } = useGetRolesQuery();
  const { data: modules = [] } = useGetPermissionCatalogQuery();
  const [deleteRole] = useDeleteRoleMutation();
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<ApiRole | null>(null);

  const totalPermissions = useMemo(
    () => modules.reduce((sum, m) => sum + m.permissions.length, 0),
    [modules]
  );

  const filtered = useMemo(() => {
    if (!search) return roles;
    const q = search.toLowerCase();
    return roles.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q)
    );
  }, [roles, search]);

  const handleCreate = () => navigate('/roles/new');

  const handleEdit = (role: ApiRole) => navigate(`/roles/${role.id}`);

  const handleDelete = (role: ApiRole) => {
    if (role.member_count > 0) {
      toast.error('Cannot delete role', {
        description: `${role.member_count} user(s) are assigned to this role. Reassign them first.`,
      });
      return;
    }
    setConfirmDelete(role);
  };

  const confirmDeleteRole = async () => {
    if (!confirmDelete) return;
    try {
      await deleteRole(confirmDelete.id).unwrap();
      toast.success('Role deleted', { description: `${confirmDelete.name} has been removed.` });
    } catch (err) {
      toast.error('Failed to delete role', { description: parseApiError(err).message });
    }
  };

  const canCreate = hasPermission('roles.create');
  const canUpdate = hasPermission('roles.update');
  const canDelete = hasPermission('roles.delete');

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Roles & Permissions"
        description="Manage roles, configure permissions, and control what users can access across the system."
        breadcrumbs={[{ label: 'Roles & Permissions' }]}
        actions={
          canCreate && (
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              New Role
            </Button>
          )
        }
      />

      <Card>
        <CardContent className="p-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search roles..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="ml-auto text-sm text-muted-foreground">
              {filtered.length} role{filtered.length !== 1 ? 's' : ''}
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: COLUMN_COUNT }).map((__, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={COLUMN_COUNT} className="py-8 text-center">
                      <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-2 text-destructive">
                          <AlertTriangle className="h-4 w-4" />
                          {parseApiError(error, 'Failed to load roles.').message}
                        </span>
                        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                          <RotateCw className="mr-2 h-3.5 w-3.5" />
                          Retry
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={COLUMN_COUNT} className="text-center py-8 text-muted-foreground">
                      No roles found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((role) => {
                    const userCount = role.member_count;
                    const permCount = role.permissions.length;
                    return (
                      <TableRow
                        key={role.id}
                        onClick={canUpdate ? () => handleEdit(role) : undefined}
                        className={canUpdate ? 'cursor-pointer' : undefined}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${role.is_system ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                              {role.is_system ? <ShieldCheck className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                            </div>
                            <span className="font-medium">{role.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                          <div className="truncate text-sm text-muted-foreground">{role.description || '—'}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {permCount} of {totalPermissions || '—'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{userCount} user{userCount !== 1 ? 's' : ''}</span>
                        </TableCell>
                        <TableCell>
                          {role.is_system ? (
                            <Badge variant="outline" className="text-xs">System</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Custom</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {role.updated_at ? formatDate(role.updated_at) : '—'}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {(canUpdate || (canDelete && !role.is_system)) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {canUpdate && (
                                  <DropdownMenuItem onClick={() => handleEdit(role)}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit role & permissions
                                  </DropdownMenuItem>
                                )}
                                {canDelete && !role.is_system && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleDelete(role)}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete role
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {role.is_system && canDelete && (
                                  <DropdownMenuItem disabled>
                                    <Lock className="mr-2 h-4 w-4" />
                                    System roles cannot be deleted
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

          {/* Permission module summary */}
          {modules.length > 0 && (
            <div className="mt-6 border-t pt-4">
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Permission Modules ({modules.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {modules.map((mod) => (
                  <Badge key={mod.module} variant="outline" className="text-xs">
                    {mod.label} ({mod.permissions.length})
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title="Delete role"
        description={`Are you sure you want to delete "${confirmDelete?.name}"? This action cannot be undone. Users previously assigned to this role will lose its permissions.`}
        confirmLabel="Delete role"
        variant="destructive"
        onConfirm={confirmDeleteRole}
      />
    </div>
  );
}
