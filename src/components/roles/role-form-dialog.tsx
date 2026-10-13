import { useState, useEffect, useMemo } from 'react';
import { roleRepo, userRepo, activityRepo } from '@/lib/repository';
import { useAuth } from '@/lib/auth-context';
import { PERMISSION_MODULES, ALL_PERMISSIONS, getModulePermissions } from '@/lib/permissions';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Role, Permission, PermissionModule } from '@/lib/types';

interface RoleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role | null;
  onSaved: () => void;
}

export function RoleFormDialog({ open, onOpenChange, role, onSaved }: RoleFormDialogProps) {
  const { session } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [selectedPerms, setSelectedPerms] = useState<Set<Permission>>(new Set());
  const [originalPerms, setOriginalPerms] = useState<Set<Permission>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (role) {
        setName(role.name);
        setDescription(role.description);
        setIsActive(role.isActive);
        const permSet = new Set<Permission>(role.permissions);
        setSelectedPerms(permSet);
        setOriginalPerms(permSet);
      } else {
        setName('');
        setDescription('');
        setIsActive(true);
        setSelectedPerms(new Set());
        setOriginalPerms(new Set());
      }
      setErrors({});
    }
  }, [open, role]);

  const hasChanges = useMemo(() => {
    if (name !== (role?.name || '')) return true;
    if (description !== (role?.description || '')) return true;
    if (isActive !== (role?.isActive ?? true)) return true;
    if (selectedPerms.size !== originalPerms.size) return true;
    for (const p of selectedPerms) {
      if (!originalPerms.has(p)) return true;
    }
    return false;
  }, [name, description, isActive, selectedPerms, originalPerms, role]);

  const togglePerm = (perm: Permission) => {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return next;
    });
  };

  const toggleModule = (module: PermissionModule) => {
    const modulePerms = getModulePermissions(module);
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      const allSelected = modulePerms.every((p) => next.has(p));
      if (allSelected) {
        modulePerms.forEach((p) => next.delete(p));
      } else {
        modulePerms.forEach((p) => next.add(p));
      }
      return next;
    });
  };

  const selectAll = () => setSelectedPerms(new Set(ALL_PERMISSIONS));
  const clearAll = () => setSelectedPerms(new Set());

  const isModuleFullyChecked = (module: PermissionModule) => {
    return getModulePermissions(module).every((p) => selectedPerms.has(p));
  };

  const isModulePartiallyChecked = (module: PermissionModule) => {
    const mods = getModulePermissions(module);
    return mods.some((p) => selectedPerms.has(p)) && !mods.every((p) => selectedPerms.has(p));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Role name is required';
    else if (name.trim().length < 2) errs.name = 'Name must be at least 2 characters';

    const existing = roleRepo.all().find((r) => r.name.toLowerCase() === name.trim().toLowerCase() && r.id !== role?.id);
    if (existing) errs.name = 'A role with this name already exists';

    if (!description.trim()) errs.description = 'Description is required';

    if (selectedPerms.size === 0) errs.permissions = 'At least one permission must be assigned';

    // Prevent removing all permissions from Super Admin system role
    if (role?.name === 'Super Admin' && role.isSystem) {
      const hasAllAdminPerms = ALL_PERMISSIONS.every((p) => selectedPerms.has(p));
      if (!hasAllAdminPerms) {
        errs.permissions = 'The Super Admin system role must retain all permissions';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !session) return;

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
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error('Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  const moduleSummary = useMemo(() => {
    return PERMISSION_MODULES.map((mod) => {
      const total = mod.permissions.length;
      const selected = mod.permissions.filter((p) => selectedPerms.has(p.value)).length;
      return { module: mod.module, label: mod.label, selected, total };
    });
  }, [selectedPerms]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{role ? `Edit Role: ${role.name}` : 'Create New Role'}</DialogTitle>
          <DialogDescription>
            {role
              ? 'Configure role details and permissions. Changes take effect immediately for all assigned users.'
              : 'Create a custom role with specific permissions. Users can be assigned this role after creation.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Basic info */}
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
              {role?.isSystem && (
                <p className="text-xs text-muted-foreground">System role names cannot be changed.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="roleStatus">Active</Label>
              <div className="flex h-10 items-center gap-3">
                <Switch
                  id="roleStatus"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <span className="text-sm text-muted-foreground">
                  {isActive ? 'Users with this role can sign in' : 'Role is disabled'}
                </span>
              </div>
            </div>
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

          {/* Permission matrix */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Permission Matrix
              </h3>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={clearAll}>
                  Clear All
                </Button>
              </div>
            </div>

            {errors.permissions && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {errors.permissions}
              </div>
            )}

            <div className="rounded-lg border">
              {/* Header row */}
              <div className="grid grid-cols-[200px_1fr_40px] items-center border-b bg-muted/30 px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <span>Module</span>
                <span>Permissions</span>
                <span className="text-center">All</span>
              </div>

              {/* Module rows */}
              <div className="divide-y">
                {PERMISSION_MODULES.map((mod) => {
                  const fullyChecked = isModuleFullyChecked(mod.module);
                  const partiallyChecked = isModulePartiallyChecked(mod.module);
                  return (
                    <div key={mod.module} className="grid grid-cols-[200px_1fr_40px] items-start px-4 py-3">
                      {/* Module name + select-all checkbox */}
                      <div className="flex items-start gap-2 py-0.5">
                        <Checkbox
                          checked={fullyChecked ? true : partiallyChecked ? 'indeterminate' : false}
                          onCheckedChange={() => toggleModule(mod.module)}
                          className="mt-0.5"
                        />
                        <div>
                          <div className="text-sm font-medium">{mod.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {mod.permissions.filter((p) => selectedPerms.has(p.value)).length} / {mod.permissions.length} selected
                          </div>
                        </div>
                      </div>

                      {/* Individual permissions */}
                      <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {mod.permissions.map((perm) => {
                          const checked = selectedPerms.has(perm.value);
                          return (
                            <label
                              key={perm.value}
                              className="flex cursor-pointer items-center gap-2"
                              title={perm.description}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => togglePerm(perm.value)}
                              />
                              <span className="text-sm">{perm.label}</span>
                            </label>
                          );
                        })}
                      </div>

                      {/* All checkbox (same as module-level) */}
                      <div className="flex justify-center py-0.5">
                        <Checkbox
                          checked={fullyChecked ? true : partiallyChecked ? 'indeterminate' : false}
                          onCheckedChange={() => toggleModule(mod.module)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Permission summary */}
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Permission Summary</span>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {selectedPerms.size} of {ALL_PERMISSIONS.length} total
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {moduleSummary.map((ms) => (
                  <Badge
                    key={ms.module}
                    variant={ms.selected === ms.total ? 'default' : ms.selected > 0 ? 'secondary' : 'outline'}
                    className="text-xs"
                  >
                    {ms.label}: {ms.selected}/{ms.total}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Unsaved changes warning */}
          {hasChanges && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              You have unsaved changes. Click Save to apply them.
            </div>
          )}

          <Separator />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || (!hasChanges && !!role)}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {role ? 'Save changes' : 'Create role'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
