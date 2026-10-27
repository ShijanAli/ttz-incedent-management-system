import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '@/lib/auth-context';
import { parseApiError } from '@/lib/api-error';
import { BASELINE_PERMISSIONS, getPermissionModule, toAppPermissions } from '@/lib/permissions';
import { NAV_ITEMS } from '@/lib/nav-config';
import {
  useCreateRoleMutation,
  useGetPermissionCatalogQuery,
  useGetRolesQuery,
  useUpdateRoleMutation,
} from '@/redux/features/roles/roles-api';
import type { ApiPermissionModule, ApiRole } from '@/redux/features/roles/roles-types';
import { PageHeader } from '@/components/shared/page-header';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft, Loader2, AlertTriangle, Sparkles, Eye, ShieldAlert, Users as UsersIcon,
  Plus, Minus, Check, Lock, MessageCircle, Paperclip, RotateCw, LayoutGrid, type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type AccessLevel = 'none' | 'view' | 'custom' | 'full';
type FormErrors = Partial<Record<'name' | 'description' | 'permissions', string>>;

// Backend permissions that can cause damage or escalate privileges.
const SENSITIVE_PERMS = new Set<string>([
  'projects.delete', 'issues.delete', 'comments.delete', 'attachments.delete',
  'issues.assign', 'users.edit',
]);

const MODULE_ICONS: Record<string, LucideIcon> = {
  ...Object.fromEntries(NAV_ITEMS.map((item) => [getPermissionModule(item.permission), item.icon])),
  comments: MessageCircle,
  attachments: Paperclip,
};

const isViewPerm = (perm: { action: string }) => perm.action === 'view';

/** Modules that already have a sidebar page */
const NAV_MODULES = new Set<string>(NAV_ITEMS.map((item) => getPermissionModule(item.permission)));
/** Modules used inside other pages (the issue detail), never as a sidebar link */
const IN_PAGE_MODULES = new Set(['comments', 'attachments']);

type PreviewItem = { key: string; label: string; icon: LucideIcon };

/** Loads the role + permission catalog, then mounts the form with real data. */
export default function RoleEditorRoute() {
  const { id } = useParams();
  const { hasPermission } = useAuth();

  const isNew = !id || id === 'new';
  const canEdit = isNew ? hasPermission('roles.create') : hasPermission('roles.update');

  const rolesQuery = useGetRolesQuery(undefined, { skip: !canEdit });
  const catalogQuery = useGetPermissionCatalogQuery(undefined, { skip: !canEdit });

  if (!canEdit) {
    return (
      <EmptyState
        icon={<Lock className="h-6 w-6" />}
        title="You don't have access"
        description={`You need the "${isNew ? 'roles.create' : 'roles.update'}" permission to use the role editor.`}
      />
    );
  }

  if (rolesQuery.isLoading || catalogQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading role editor...
      </div>
    );
  }

  if (rolesQuery.isError || catalogQuery.isError) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-6 w-6" />}
        title="Could not load the role editor"
        description={parseApiError(rolesQuery.error ?? catalogQuery.error).message}
        onRetry={() => {
          if (rolesQuery.isError) rolesQuery.refetch();
          if (catalogQuery.isError) catalogQuery.refetch();
        }}
      />
    );
  }

  const allRoles = rolesQuery.data ?? [];
  const role = isNew ? undefined : allRoles.find((r) => String(r.id) === id);

  if (!isNew && !role) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-6 w-6" />}
        title="Role not found"
        description="This role may have been deleted."
      />
    );
  }

  // Keyed by id so form state resets when moving between roles
  return (
    <RoleEditorForm
      key={id ?? 'new'}
      role={role}
      allRoles={allRoles}
      modules={catalogQuery.data ?? []}
    />
  );
}

interface RoleEditorFormProps {
  role?: ApiRole;
  allRoles: ApiRole[];
  modules: ApiPermissionModule[];
}

function RoleEditorForm({ role, allRoles, modules }: RoleEditorFormProps) {
  const navigate = useNavigate();
  const [createRole, { isLoading: creating }] = useCreateRoleMutation();
  const [updateRole, { isLoading: updating }] = useUpdateRoleMutation();

  const isNew = !role;
  const saving = creating || updating;
  const assignedUsers = role?.member_count ?? 0;

  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  // Not stored by the backend yet; kept so the UI is ready when it is
  const [isActive, setIsActive] = useState(role?.is_active ?? true);
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set(role?.permissions ?? []));
  const [template, setTemplate] = useState('blank');
  const [errors, setErrors] = useState<FormErrors>({});
  const [confirmLeave, setConfirmLeave] = useState(false);

  const originalPerms = useMemo(() => new Set<string>(role?.permissions ?? []), [role]);

  const allPermissions = useMemo(
    () => modules.flatMap((m) => m.permissions.map((p) => p.name)),
    [modules]
  );
  const permIndex = useMemo(
    () => new Map(modules.flatMap((m) => m.permissions.map((p) => [p.name, `${m.label} · ${p.label}`] as const))),
    [modules]
  );

  const hasChanges = useMemo(() => {
    if (name !== (role?.name ?? '')) return true;
    if (description !== (role?.description ?? '')) return true;
    if (isActive !== (role?.is_active ?? true)) return true;
    if (selectedPerms.size !== originalPerms.size) return true;
    for (const p of selectedPerms) if (!originalPerms.has(p)) return true;
    return false;
  }, [name, description, isActive, selectedPerms, originalPerms, role]);

  // Warn before closing the tab with unsaved work
  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasChanges]);

  // ─── Permission helpers ───
  const getLevel = (mod: ApiPermissionModule): AccessLevel => {
    const picked = mod.permissions.filter((p) => selectedPerms.has(p.name));
    if (picked.length === 0) return 'none';
    if (picked.length === mod.permissions.length) return 'full';
    if (picked.length === 1 && isViewPerm(picked[0])) return 'view';
    return 'custom';
  };

  const setLevel = (mod: ApiPermissionModule, level: Exclude<AccessLevel, 'custom'>) => {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      mod.permissions.forEach((p) => next.delete(p.name));
      if (level === 'full') mod.permissions.forEach((p) => next.add(p.name));
      if (level === 'view') mod.permissions.filter(isViewPerm).forEach((p) => next.add(p.name));
      return next;
    });
    setErrors((e) => ({ ...e, permissions: '' }));
  };

  const togglePerm = (perm: string) => {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return next;
    });
    setErrors((e) => ({ ...e, permissions: '' }));
  };

  const applyTemplate = (value: string) => {
    setTemplate(value);
    const source = allRoles.find((r) => String(r.id) === value);
    setSelectedPerms(new Set(source?.permissions ?? []));
  };

  // ─── Derived preview data ───
  const coverage = allPermissions.length ? Math.round((selectedPerms.size / allPermissions.length) * 100) : 0;
  const sensitiveCount = [...selectedPerms].filter((p) => SENSITIVE_PERMS.has(p)).length;
  const risk =
    sensitiveCount === 0 ? { label: 'Low', tone: 'text-emerald-600 bg-emerald-500/10' }
    : sensitiveCount <= 3 ? { label: 'Medium', tone: 'text-amber-600 bg-amber-500/10' }
    : { label: 'High', tone: 'text-destructive bg-destructive/10' };

  const visibleNav = useMemo(() => {
    // The pages the sidebar would show, worked out the same way it does
    const appPerms = toAppPermissions(selectedPerms);
    BASELINE_PERMISSIONS.forEach((p) => appPerms.add(p));
    const pages: PreviewItem[] = NAV_ITEMS
      .filter((item) => appPerms.has(item.permission))
      .map((item) => ({ key: item.href, label: item.label, icon: item.icon }));

    // Catalog modules the app has no page mapping for yet still show, so new modules appear
    for (const mod of modules) {
      if (NAV_MODULES.has(mod.module) || IN_PAGE_MODULES.has(mod.module)) continue;
      const picked = mod.permissions.filter((p) => selectedPerms.has(p.name));
      if (picked.length === 0) continue;
      // A module with a view action opens only when that action is granted
      if (mod.permissions.some(isViewPerm) && !picked.some(isViewPerm)) continue;
      pages.push({ key: mod.module, label: mod.label, icon: MODULE_ICONS[mod.module] ?? LayoutGrid });
    }
    return pages;
  }, [selectedPerms, modules]);

  const summary = modules.flatMap((mod) => {
    const level = getLevel(mod);
    if (level === 'none') return [];
    if (level === 'full') return [`Full access to ${mod.label}`];
    if (level === 'view') return [`View ${mod.label}`];
    const labels = mod.permissions.filter((p) => selectedPerms.has(p.name)).map((p) => p.label);
    return [`${mod.label}: ${labels.join(', ')}`];
  });

  const added = [...selectedPerms].filter((p) => !originalPerms.has(p));
  const removed = [...originalPerms].filter((p) => !selectedPerms.has(p));

  // ─── Save ───
  const validate = (): boolean => {
    const errs: FormErrors = {};
    const trimmed = name.trim();
    if (!trimmed) errs.name = 'Role name is required';
    else if (trimmed.length < 2) errs.name = 'Name must be at least 2 characters';
    else if (allRoles.some((r) => r.name.toLowerCase() === trimmed.toLowerCase() && r.id !== role?.id)) {
      errs.name = 'A role with this name already exists';
    }
    if (selectedPerms.size === 0) errs.permissions = 'At least one permission must be assigned';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const body = {
      name: name.trim(),
      description: description.trim(),
      permissions: Array.from(selectedPerms),
    };
    try {
      if (role) {
        await updateRole({ id: role.id, ...body }).unwrap();
        toast.success('Role updated', { description: `${body.name} has been saved with ${body.permissions.length} permissions.` });
      } else {
        await createRole(body).unwrap();
        toast.success('Role created', { description: `${body.name} has been created with ${body.permissions.length} permissions.` });
      }
      navigate('/roles');
    } catch (err) {
      const apiError = parseApiError(err, 'Failed to save role');
      // Laravel keys array errors as `permissions.0`, so match by prefix
      const fieldError = (field: string) =>
        Object.entries(apiError.fieldErrors).find(([key]) => key === field || key.startsWith(`${field}.`))?.[1][0];
      const serverErrors: FormErrors = {
        name: fieldError('name'),
        description: fieldError('description'),
        permissions: fieldError('permissions'),
      };
      if (Object.values(serverErrors).some(Boolean)) {
        setErrors(serverErrors);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      toast.error('Failed to save role', { description: apiError.message });
    }
  };

  const handleCancel = () => {
    if (hasChanges) setConfirmLeave(true);
    else navigate('/roles');
  };

  return (
    <div className="animate-fade-in pb-24">
      <PageHeader
        title={isNew ? 'Create New Role' : `Edit Role: ${role.name}`}
        description={
          isNew
            ? 'Pick an access level for each module, and watch the preview on the right update as you go.'
            : 'Changes take effect immediately for every user assigned to this role.'
        }
        breadcrumbs={[
          { label: 'Roles & Permissions', href: '/roles' },
          { label: isNew ? 'New Role' : role.name },
        ]}
        actions={
          <Button variant="outline" onClick={handleCancel}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to roles
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* ─── Editor ─── */}
        <div className="space-y-6 lg:col-span-8">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Role identity</CardTitle>
              <CardDescription>Who is this role for, and what is it meant to do?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="roleName">Role name <span className="text-destructive">*</span></Label>
                  <Input
                    id="roleName"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setErrors({ ...errors, name: '' }); }}
                    placeholder="e.g. Project Manager"
                    disabled={role?.is_system}
                  />
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                  {role?.is_system && <p className="text-xs text-muted-foreground">System role names cannot be changed.</p>}
                </div>

                {isNew ? (
                  <div className="space-y-1.5">
                    <Label>Start from</Label>
                    <Select value={template} onValueChange={applyTemplate}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="blank">Blank role</SelectItem>
                        {allRoles.map((r) => (
                          <SelectItem key={r.id} value={String(r.id)}>
                            Copy of {r.name} ({r.permissions.length})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Copies that role's permissions as a starting point.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="roleStatus">Active</Label>
                    <div className="flex h-10 items-center gap-3">
                      <Switch id="roleStatus" checked={isActive} onCheckedChange={setIsActive} />
                      <span className="text-sm text-muted-foreground">
                        {isActive ? 'Users with this role can sign in' : 'Role is disabled'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="roleDesc">Description</Label>
                <Textarea
                  id="roleDesc"
                  value={description}
                  onChange={(e) => { setDescription(e.target.value); setErrors({ ...errors, description: '' }); }}
                  placeholder="Describe what this role can do..."
                  rows={2}
                  disabled={role?.is_system}
                />
                {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
              </div>

              {isNew && (
                <div className="flex items-center gap-3">
                  <Switch id="roleStatus" checked={isActive} onCheckedChange={setIsActive} />
                  <Label htmlFor="roleStatus" className="font-normal text-muted-foreground">
                    {isActive ? 'Active: users with this role can sign in' : 'Inactive: role is disabled'}
                  </Label>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-4">
              <div className="space-y-1.5">
                <CardTitle className="text-base">Access levels</CardTitle>
                <CardDescription>
                  Set a level per module, or click individual permissions to fine-tune.
                  <span className="ml-1 inline-flex items-center gap-1 text-amber-600">
                    <ShieldAlert className="h-3 w-3" /> marks sensitive actions.
                  </span>
                </CardDescription>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedPerms(new Set(allPermissions))}>
                  All
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedPerms(new Set())}>
                  None
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {errors.permissions && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  {errors.permissions}
                </div>
              )}

              {modules.map((mod) => {
                const level = getLevel(mod);
                const Icon = MODULE_ICONS[mod.module];
                const pickedCount = mod.permissions.filter((p) => selectedPerms.has(p.name)).length;
                const levels: { key: Exclude<AccessLevel, 'custom'>; label: string }[] =
                  mod.permissions.length > 1 && mod.permissions.some(isViewPerm)
                    ? [{ key: 'none', label: 'None' }, { key: 'view', label: 'View' }, { key: 'full', label: 'Full' }]
                    : [{ key: 'none', label: 'None' }, { key: 'full', label: 'Full' }];

                return (
                  <div
                    key={mod.module}
                    className={cn(
                      'rounded-xl border p-4 transition-colors',
                      level === 'none' ? 'bg-muted/20' : 'border-primary/30 bg-primary/[0.03]'
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <div
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                          level === 'none' ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
                        )}
                      >
                        {Icon && <Icon className="h-[18px] w-[18px]" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{mod.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {pickedCount} / {mod.permissions.length} permissions
                          {level === 'custom' && <span className="ml-1.5 text-primary">· Custom</span>}
                        </div>
                      </div>

                      {/* Level switcher */}
                      <div className="inline-flex rounded-lg border bg-background p-0.5">
                        {levels.map((l) => (
                          <button
                            key={l.key}
                            type="button"
                            onClick={() => setLevel(mod, l.key)}
                            className={cn(
                              'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                              level === l.key
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                          >
                            {l.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Individual permission chips */}
                    {mod.permissions.length > 1 && (
                      <div className="mt-3 flex flex-wrap gap-2 pl-12">
                        {mod.permissions.map((perm) => {
                          const checked = selectedPerms.has(perm.name);
                          const sensitive = SENSITIVE_PERMS.has(perm.name);
                          return (
                            <button
                              key={perm.name}
                              type="button"
                              onClick={() => togglePerm(perm.name)}
                              title={perm.name}
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
                                checked
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-dashed text-muted-foreground hover:border-solid hover:text-foreground'
                              )}
                            >
                              {checked ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                              {perm.label}
                              {sensitive && <ShieldAlert className="h-3 w-3 text-amber-600" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* ─── Live preview ─── */}
        <aside className="space-y-4 lg:col-span-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <CoverageRing value={coverage} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="text-sm font-semibold">
                  {selectedPerms.size} of {allPermissions.length} permissions
                </div>
                <div className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', risk.tone)}>
                  <ShieldAlert className="h-3 w-3" />
                  {risk.label} risk · {sensitiveCount} sensitive
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Eye className="h-4 w-4 text-muted-foreground" />
                What they'll see
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-sidebar p-2 text-sidebar-foreground">
                {visibleNav.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-sidebar-foreground/60">
                    Empty sidebar. This role can't open any page.
                  </div>
                ) : (
                  visibleNav.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.key} className="flex items-center gap-2.5 rounded-md px-3 py-1.5 text-xs text-sidebar-foreground/80">
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        {item.label}
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                In plain words
              </CardTitle>
            </CardHeader>
            <CardContent>
              {summary.length === 0 ? (
                <p className="text-xs text-muted-foreground">No access yet. Pick a level for at least one module.</p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {summary.map((line) => (
                    <li key={line} className="flex gap-2">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {!isNew && (added.length > 0 || removed.length > 0) && (
            <Card className="border-amber-300/60">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <UsersIcon className="h-4 w-4 text-muted-foreground" />
                  Impact of your changes
                </CardTitle>
                <CardDescription className="text-xs">
                  Applies to {assignedUsers} user{assignedUsers !== 1 ? 's' : ''} on save.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                {added.map((p) => (
                  <div key={p} className="flex items-center gap-2 text-xs text-emerald-600">
                    <Plus className="h-3 w-3" />
                    {permIndex.get(p) ?? p}
                  </div>
                ))}
                {removed.map((p) => (
                  <div key={p} className="flex items-center gap-2 text-xs text-destructive">
                    <Minus className="h-3 w-3" />
                    {permIndex.get(p) ?? p}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </aside>
      </div>

      {/* ─── Sticky action bar ─── */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur lg:left-[var(--sidebar-width)] transition-[left] duration-300">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1 text-sm">
            {hasChanges ? (
              <span className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="truncate">Unsaved changes</span>
              </span>
            ) : (
              <span className="text-muted-foreground">No changes yet</span>
            )}
          </div>
          <Button variant="outline" onClick={handleCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || (!hasChanges && !isNew)}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isNew ? 'Create role' : 'Save changes'}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title="Discard changes?"
        description="You have unsaved changes to this role. If you leave now, they will be lost."
        confirmLabel="Discard"
        variant="destructive"
        onConfirm={() => navigate('/roles')}
      />
    </div>
  );
}

function CoverageRing({ value }: { value: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-muted" />
        <circle
          cx="32" cy="32" r={r} fill="none" strokeWidth="6" strokeLinecap="round"
          className="stroke-primary transition-[stroke-dashoffset] duration-500"
          strokeDasharray={c}
          strokeDashoffset={c - (value / 100) * c}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold">{value}%</div>
    </div>
  );
}

function EmptyState({
  icon, title, description, onRetry,
}: { icon: React.ReactNode; title: string; description: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      <div className="mt-6 flex gap-2">
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            <RotateCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        )}
        <Button asChild variant="outline">
          <Link to="/roles">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to roles
          </Link>
        </Button>
      </div>
    </div>
  );
}
