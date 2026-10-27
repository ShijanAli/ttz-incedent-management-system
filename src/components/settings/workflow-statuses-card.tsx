import { useEffect, useState } from 'react';
import { AlertTriangle, ListChecks, Loader2, MoreVertical, Pencil, Plus, Power, PowerOff, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { parseApiError } from '@/lib/api-error';
import { cn } from '@/lib/utils';
import {
  useCreateGlobalStatusMutation, useDeleteGlobalStatusMutation, useGetGlobalStatusesQuery, useUpdateGlobalStatusMutation,
  type GlobalStatus,
} from '@/redux/features/statuses/statuses-api';
import { ColorSwatchPicker, SWATCH_COLORS } from '@/components/shared/color-swatch-picker';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const toSlug = (name: string) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/**
 * Super admin: the default workflow statuses. Every project's workflow is built from these,
 * so this lives in Settings rather than inside a project.
 */
export function WorkflowStatusesCard() {
  const { data: statuses = [], isLoading, isError, error, refetch } = useGetGlobalStatusesQuery();
  const [updateStatus] = useUpdateGlobalStatusMutation();
  const [deleteStatus] = useDeleteGlobalStatusMutation();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<GlobalStatus | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<GlobalStatus | null>(null);

  const openForm = (status: GlobalStatus | null) => {
    setEditing(status);
    setFormOpen(true);
  };

  const toggleActive = async (s: GlobalStatus) => {
    try {
      await updateStatus({ id: s.id, is_active: !s.is_active }).unwrap();
      toast.success(s.is_active ? `${s.name} deactivated` : `${s.name} activated`);
    } catch (err) {
      toast.error('Failed to update status', { description: parseApiError(err).message });
    }
  };

  const handleDelete = async (s: GlobalStatus) => {
    try {
      await deleteStatus(s.id).unwrap();
      toast.success(`${s.name} deleted`);
    } catch (err) {
      // The API only deletes unused statuses; deactivating hides one without breaking issues
      toast.error(`Couldn't delete ${s.name}`, {
        description: `${parseApiError(err).message} Deactivate it instead to stop projects from using it.`,
      });
    }
  };

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Workflow statuses</CardTitle>
          </div>
          <CardDescription>
            The default statuses every project&apos;s workflow is built from. Inactive ones can&apos;t be added to a workflow.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => openForm(null)}>
          <Plus className="mr-1.5 h-4 w-4" /> New status
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-8 text-sm">
            <span className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {parseApiError(error, 'Failed to load statuses.').message}
            </span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : statuses.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No statuses yet. Add the first one.</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {statuses.map((s) => (
              <div key={s.id} className={cn('flex items-center gap-3 px-3 py-2.5', !s.is_active && 'opacity-60')}>
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                <button type="button" onClick={() => openForm(s)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-medium hover:text-primary">{s.name}</span>
                  <span className="block truncate font-mono text-xs text-muted-foreground">{s.slug}</span>
                </button>
                <Badge
                  variant="outline"
                  className={s.is_active
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'text-muted-foreground'}
                >
                  {s.is_active ? 'Active' : 'Inactive'}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${s.name}`}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openForm(s)}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleActive(s)}>
                      {s.is_active ? <PowerOff className="mr-2 h-4 w-4" /> : <Power className="mr-2 h-4 w-4" />}
                      {s.is_active ? 'Deactivate' : 'Activate'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setConfirmDelete(s)} className="text-red-600">
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <StatusFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        status={editing}
        existing={statuses}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title="Delete status"
        description={`Delete "${confirmDelete?.name}"? Only a status no project or issue uses can be deleted. To retire one that is in use, deactivate it instead.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => { if (confirmDelete) await handleDelete(confirmDelete); }}
      />
    </Card>
  );
}

type Fields = { name: string; slug: string; color: string; is_active: boolean };
type FieldErrors = Partial<Record<keyof Fields, string>>;

function StatusFormDialog({ open, onOpenChange, status, existing }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null opens the dialog in create mode */
  status: GlobalStatus | null;
  existing: GlobalStatus[];
}) {
  const isEdit = Boolean(status);
  const [fields, setFields] = useState<Fields>({ name: '', slug: '', color: SWATCH_COLORS[3], is_active: true });
  // On create the slug follows the name until the user edits it
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [createStatus, { isLoading: creating }] = useCreateGlobalStatusMutation();
  const [updateStatus, { isLoading: updating }] = useUpdateGlobalStatusMutation();
  const saving = creating || updating;

  useEffect(() => {
    if (!open) return;
    setFields(status
      ? { name: status.name, slug: status.slug, color: status.color.toUpperCase(), is_active: status.is_active }
      : { name: '', slug: '', color: SWATCH_COLORS[3], is_active: true });
    setSlugTouched(false);
    setErrors({});
  }, [open, status]);

  const set = <K extends keyof Fields>(key: K, value: Fields[K]) => {
    setFields((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = () => {
    const errs: FieldErrors = {};
    const name = fields.name.trim();
    const others = existing.filter((s) => s.id !== status?.id);
    if (!name) errs.name = 'Name is required';
    else if (others.some((s) => s.name.toLowerCase() === name.toLowerCase())) errs.name = 'A status with this name already exists';
    if (!isEdit) {
      if (!fields.slug) errs.slug = 'Slug is required';
      else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fields.slug)) errs.slug = 'Use lowercase letters, numbers and dashes';
      else if (others.some((s) => s.slug === fields.slug)) errs.slug = 'This slug is already used';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const name = fields.name.trim();
    try {
      if (status) {
        // PATCH takes only what changed
        const changed: { name?: string; color?: string; is_active?: boolean } = {};
        if (name !== status.name) changed.name = name;
        if (fields.color.toLowerCase() !== status.color.toLowerCase()) changed.color = fields.color;
        if (fields.is_active !== status.is_active) changed.is_active = fields.is_active;
        if (Object.keys(changed).length > 0) await updateStatus({ id: status.id, ...changed }).unwrap();
        toast.success('Status updated');
      } else {
        await createStatus({ name, slug: fields.slug, color: fields.color, is_active: fields.is_active }).unwrap();
        toast.success('Status added', { description: name });
      }
      onOpenChange(false);
    } catch (err) {
      const apiError = parseApiError(err, isEdit ? 'Failed to update status' : 'Failed to add status');
      const fieldErrors: FieldErrors = {};
      for (const key of ['name', 'slug', 'color', 'is_active'] as const) {
        const message = apiError.fieldErrors[key]?.[0];
        if (message) fieldErrors[key] = message;
      }
      setErrors(fieldErrors);
      toast.error(isEdit ? 'Failed to update status' : 'Failed to add status', { description: apiError.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${status?.name}` : 'New workflow status'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Changes show everywhere this status is used, in every project.'
              : 'Projects can add it to their workflow once it is created.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="statusName">Name <span className="text-destructive">*</span></Label>
            <Input
              id="statusName"
              value={fields.name}
              onChange={(e) => {
                set('name', e.target.value);
                if (!isEdit && !slugTouched) set('slug', toSlug(e.target.value));
              }}
              placeholder="e.g. QA Review"
              autoFocus
              disabled={saving}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="statusSlug">Slug {!isEdit && <span className="text-destructive">*</span>}</Label>
            <Input
              id="statusSlug"
              value={fields.slug}
              onChange={(e) => { setSlugTouched(true); set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-')); }}
              onBlur={() => set('slug', toSlug(fields.slug))}
              placeholder="qa-review"
              className="font-mono"
              disabled={saving || isEdit}
            />
            {errors.slug ? (
              <p className="text-xs text-destructive">{errors.slug}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {isEdit ? "The slug can't be changed after the status is created." : 'A unique key for this status. Filled in from the name.'}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Color</Label>
            <ColorSwatchPicker value={fields.color} onChange={(c) => set('color', c)} disabled={saving} />
            {errors.color && <p className="text-xs text-destructive">{errors.color}</p>}
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="statusActive" className="text-sm">Active</Label>
              <p className="text-xs text-muted-foreground">Inactive statuses can&apos;t be added to a project&apos;s workflow</p>
            </div>
            <Switch id="statusActive" checked={fields.is_active} onCheckedChange={(v) => set('is_active', v)} disabled={saving} />
          </div>

          {/* Preview of how issues will show it */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            Preview:
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium"
              style={{ color: fields.color, borderColor: `${fields.color}55`, backgroundColor: `${fields.color}14` }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: fields.color }} />
              {fields.name.trim() || 'Status name'}
            </span>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Save changes' : 'Add status'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
