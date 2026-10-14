import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '@/lib/auth-context';
import { roleRepo, userRepo, activityRepo } from '@/lib/repository';
import { PERMISSION_MODULES, ALL_PERMISSIONS, PERMISSION_LABELS, MODULE_LABELS, getPermissionModule } from '@/lib/permissions';
import { NAV_ITEMS } from '@/lib/nav-config';
import { PageHeader } from '@/components/shared/page-header';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft, Loader2, AlertTriangle, Sparkles, Eye, ShieldAlert, Users as UsersIcon,
  Plus, Minus, Check, Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Permission, PermissionModule } from '@/lib/types';

type AccessLevel = 'none' | 'view' | 'custom' | 'full';

// Permissions that can cause damage or escalate privileges.
const SENSITIVE_PERMS = new Set<Permission>([
  'projects.delete', 'issues.delete', 'groups.delete',
  'users.create', 'users.update', 'users.deactivate',
  'roles.create', 'roles.update', 'roles.delete', 'roles.assign_permissions',
  'settings.update',
]);

const MODULE_ICONS = Object.fromEntries(
  NAV_ITEMS.map((item) => [getPermissionModule(item.permission), item.icon])
) as Partial<Record<PermissionModule, (typeof NAV_ITEMS)[number]['icon']>>;

// Keyed by id so form state resets when moving between roles
export default function RoleEditorRoute() {
  const { id } = useParams();
  return <RoleEditorPage key={id ?? 'new'} id={id} />;
}

function RoleEditorPage({ id }: { id?: string }) {
  const navigate = useNavigate();
  const { session, hasPermission } = useAuth();

  const isNew = !id || id === 'new';
  const role = useMemo(() => (isNew ? undefined : roleRepo.find(id!)), [id, isNew]);
  const allRoles = useMemo(() => roleRepo.all(), []);
  const assignedUsers = useMemo(
    () => (role ? userRepo.all().filter((u) => u.roleIds.includes(role.id)).length : 0),
    [role]
  );

  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [isActive, setIsActive] = useState(role?.isActive ?? true);
  const [selectedPerms, setSelectedPerms] = useState<Set<Permission>>(new Set(role?.permissions ?? []));
  const [template, setTemplate] = useState('blank');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const originalPerms = useMemo(() => new Set<Permission>(role?.permissions ?? []), [role]);
  const canEdit = isNew ? hasPermission('roles.create') : hasPermission('roles.update');

  const hasChanges = useMemo(() => {
    if (name !== (role?.name ?? '')) return true;
    if (description !== (role?.description ?? '')) return true;
    if (isActive !== (role?.isActive ?? true)) return true;
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
  const getLevel = (moduleKey: PermissionModule): AccessLevel => {
    const mod = PERMISSION_MODULES.find((m) => m.module === moduleKey)!;
    const picked = mod.permissions.filter((p) => selectedPerms.has(p.value));
    if (picked.length === 0) return 'none';
    if (picked.length === mod.permissions.length) return 'full';
    if (picked.length === 1 && picked[0].value.endsWith('.view')) return 'view';
    return 'custom';
  };

  const setLevel = (moduleKey: PermissionModule, level: Exclude<AccessLevel, 'custom'>) => {
    const mod = PERMISSION_MODULES.find((m) => m.module === moduleKey)!;
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      mod.permissions.forEach((p) => next.delete(p.value));
      if (level === 'full') mod.permissions.forEach((p) => next.add(p.value));
      if (level === 'view') mod.permissions.filter((p) => p.value.endsWith('.view')).forEach((p) => next.add(p.value));
      return next;
    });
    setErrors((e) => ({ ...e, permissions: '' }));
  };

  const togglePerm = (perm: Permission) => {
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
    const source = allRoles.find((r) => r.id === value);
    setSelectedPerms(new Set(source?.permissions ?? []));
  };

  // ─── Derived preview data ───
  const coverage = Math.round((selectedPerms.size / ALL_PERMISSIONS.length) * 100);
  const sensitiveCount = [...selectedPerms].filter((p) => SENSITIVE_PERMS.has(p)).length;
  const risk =
    sensitiveCount === 0 ? { label: 'Low', tone: 'text-emerald-600 bg-emerald-500/10' }
    : sensitiveCount <= 3 ? { label: 'Medium', tone: 'text-amber-600 bg-amber-500/10' }
    : { label: 'High', tone: 'text-destructive bg-destructive/10' };

  const visibleNav = NAV_ITEMS.filter((item) => selectedPerms.has(item.permission));

  const summary = PERMISSION_MODULES.flatMap((mod) => {
    const level = getLevel(mod.module);
    if (level === 'none') return [];
    if (level === 'full') return [`Full access to ${mod.label}`];
    if (level === 'view') return [`View ${mod.label}`];
    const labels = mod.permissions.filter((p) => selectedPerms.has(p.value)).map((p) => p.label);
    return [`${mod.label}: ${labels.join(', ')}`];
  });

  const added = [...selectedPerms].filter((p) => !originalPerms.has(p));
  const removed = [...originalPerms].filter((p) => !selectedPerms.has(p));

  // ─── Save ───
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Role name is required';
    else if (name.trim().length < 2) errs.name = 'Name must be at least 2 characters';
    else if (allRoles.some((r) => r.name.toLowerCase() === name.trim().toLowerCase() && r.id !== role?.id)) {
      errs.name = 'A role with this name already exists';
    }
    if (!description.trim()) errs.description = 'Description is required';
    if (selectedPerms.size === 0) errs.permissions = 'At least one permission must be assigned';
    if (role?.name === 'Super Admin' && role.isSystem && !ALL_PERMISSIONS.every((p) => selectedPerms.has(p))) {
      errs.permissions = 'The Super Admin system role must retain all permissions';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (!validate() || !session) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setSaving(true);
    try {
      const permArray = Array.from(selectedPerms);
      if (role) {
        roleRepo.update(role.id, {
          name: name.trim(),
          description: description.trim(),
          isActive,
          permissions: permArray,
        });
        activityRepo.create({
          actorId: session.user.id,
          action: 'role_updated',
          entityType: 'Role',
          entityId: role.id,
          entityName: name.trim(),
          summary: `Updated role "${name.trim()}" (${permArray.length} permissions)`,
        });
        toast.success('Role updated', { description: `${name.trim()} has been saved with ${permArray.length} permissions.` });
      } else {
        const newRole = roleRepo.create({
          name: name.trim(),
          description: description.trim(),
          permissions: permArray,
          isSystem: false,
          isActive,
        });
        activityRepo.create({
          actorId: session.user.id,
          action: 'role_created',
          entityType: 'Role',
          entityId: newRole.id,
          entityName: newRole.name,
          summary: `Created role "${newRole.name}" with ${permArray.length} permissions`,
        });
        toast.success('Role created', { description: `${name.trim()} has been created with ${permArray.length} permissions.` });
      }
      navigate('/roles');
    } catch {
      toast.error('Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) setConfirmLeave(true);
    else navigate('/roles');
  };

  // ─── Guards ───
  if (!canEdit) {
    return (
      <EmptyState
        icon={<Lock className="h-6 w-6" />}
        title="You don't have access"
        description={`You need the "${isNew ? 'roles.create' : 'roles.update'}" permission to use the role editor.`}
      />
    );
  }

  if (!isNew && !role) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-6 w-6" />}
        title="Role not found"
        description="This role may have been deleted."
      />
    );
  }

  return (
    <div className="animate-fade-in pb-24">
      <PageHeader
        title={isNew ? 'Create New Role' : `Edit Role: ${role!.name}`}
        description={
          isNew
            ? 'Pick an access level for each module, and watch the preview on the right update as you go.'
            : 'Changes take effect immediately for every user assigned to this role.'
        }
        breadcrumbs={[
          { label: 'Roles & Permissions', href: '/roles' },
          { label: isNew ? 'New Role' : role!.name },
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
                    disabled={role?.isSystem}
                  />
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                  {role?.isSystem && <p className="text-xs text-muted-foreground">System role names cannot be changed.</p>}
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
                          <SelectItem key={r.id} value={r.id}>
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
                <Label htmlFor="roleDesc">Description <span className="text-destructive">*</span></Label>
                <Textarea
                  id="roleDesc"
                  value={description}
                  onChange={(e) => { setDescription(e.target.value); setErrors({ ...errors, description: '' }); }}
                  placeholder="Describe what this role can do..."
                  rows={2}
                  disabled={role?.isSystem}
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
                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedPerms(new Set(ALL_PERMISSIONS))}>
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

              {PERMISSION_MODULES.map((mod) => {
                const level = getLevel(mod.module);
                const Icon = MODULE_ICONS[mod.module];
                const pickedCount = mod.permissions.filter((p) => selectedPerms.has(p.value)).length;
                const levels: { key: Exclude<AccessLevel, 'custom'>; label: string }[] =
                  mod.permissions.length > 1
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
                            onClick={() => setLevel(mod.module, l.key)}
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
                          const checked = selectedPerms.has(perm.value);
                          const sensitive = SENSITIVE_PERMS.has(perm.value);
                          return (
                            <button
                              key={perm.value}
                              type="button"
                              onClick={() => togglePerm(perm.value)}
                              title={perm.description}
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
                  {selectedPerms.size} of {ALL_PERMISSIONS.length} permissions
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
                      <div key={item.href} className="flex items-center gap-2.5 rounded-md px-3 py-1.5 text-xs text-sidebar-foreground/80">
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
                    {MODULE_LABELS[getPermissionModule(p)]} · {PERMISSION_LABELS[p]}
                  </div>
                ))}
                {removed.map((p) => (
                  <div key={p} className="flex items-center gap-2 text-xs text-destructive">
                    <Minus className="h-3 w-3" />
                    {MODULE_LABELS[getPermissionModule(p)]} · {PERMISSION_LABELS[p]}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </aside>
      </div>

      {/* ─── Sticky action bar ─── */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur lg:left-[240px]">
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

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      <Button asChild variant="outline" className="mt-6">
        <Link to="/roles">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to roles
        </Link>
      </Button>
    </div>
  );
}
