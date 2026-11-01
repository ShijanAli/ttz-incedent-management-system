import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, MoreVertical, Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { parseApiError } from '@/lib/api-error';
import {
  useCreateProjectLabelMutation, useDeleteProjectLabelMutation, useGetProjectLabelsQuery, useRenameProjectLabelMutation,
} from '@/redux/features/project-labels/project-labels-api';
import type { ProjectLabel } from '@/redux/features/projects/projects-types';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Super admin: the job-title labels (Backend Developer, Frontend Developer ...) a project
 * member can be given. Assigning one happens on the project's Members tab.
 */
export function ProjectLabelsCard() {
  const { data: labels = [], isLoading, isError, error, refetch } = useGetProjectLabelsQuery();
  const [deleteLabel] = useDeleteProjectLabelMutation();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectLabel | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProjectLabel | null>(null);

  const openForm = (label: ProjectLabel | null) => {
    setEditing(label);
    setFormOpen(true);
  };

  const handleDelete = async (label: ProjectLabel) => {
    try {
      await deleteLabel(label.id).unwrap();
      toast.success(`${label.name} deleted`);
    } catch (err) {
      toast.error(`Couldn't delete ${label.name}`, { description: parseApiError(err).message });
    }
  };

  const requestDelete = (label: ProjectLabel) => {
    if (label.member_count > 0) {
      toast.error('Cannot delete label', {
        description: `${label.member_count} member(s) carry this label. Give them another label first.`,
      });
      return;
    }
    setConfirmDelete(label);
  };

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Project labels</CardTitle>
          </div>
          <CardDescription>
            Job titles such as Backend Developer that project members can carry. Assign them from a project&apos;s Members tab.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => openForm(null)}>
          <Plus className="mr-1.5 h-4 w-4" /> New label
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-8 text-sm">
            <span className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {parseApiError(error, 'Failed to load labels.').message}
            </span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : labels.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No labels yet. Add the first one.</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {labels.map((l) => (
              <div key={l.id} className="flex items-center gap-3 px-3 py-2.5">
                <button type="button" onClick={() => openForm(l)} className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:text-primary">
                  {l.name}
                </button>
                <Badge variant="secondary" className="text-xs font-normal">
                  {l.member_count} member{l.member_count !== 1 ? 's' : ''}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${l.name}`}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openForm(l)}>
                      <Pencil className="mr-2 h-4 w-4" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => requestDelete(l)} className="text-red-600">
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <LabelFormDialog open={formOpen} onOpenChange={setFormOpen} label={editing} existing={labels} />

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title="Delete label"
        description={`Delete "${confirmDelete?.name}"? This can't be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => { if (confirmDelete) await handleDelete(confirmDelete); }}
      />
    </Card>
  );
}

function LabelFormDialog({ open, onOpenChange, label, existing }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null opens the dialog in create mode */
  label: ProjectLabel | null;
  existing: ProjectLabel[];
}) {
  const isEdit = Boolean(label);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [createLabel, { isLoading: creating }] = useCreateProjectLabelMutation();
  const [renameLabel, { isLoading: renaming }] = useRenameProjectLabelMutation();
  const saving = creating || renaming;

  useEffect(() => {
    if (!open) return;
    setName(label?.name ?? '');
    setNameError('');
  }, [open, label]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setNameError('Name is required');
    if (existing.some((l) => l.id !== label?.id && l.name.toLowerCase() === trimmed.toLowerCase())) {
      return setNameError('A label with this name already exists');
    }
    try {
      if (label) {
        if (trimmed !== label.name) await renameLabel({ id: label.id, name: trimmed }).unwrap();
        toast.success('Label renamed');
      } else {
        await createLabel({ name: trimmed }).unwrap();
        toast.success('Label added', { description: trimmed });
      }
      onOpenChange(false);
    } catch (err) {
      const apiError = parseApiError(err, isEdit ? 'Failed to rename label' : 'Failed to add label');
      setNameError(apiError.fieldErrors.name?.[0] ?? '');
      toast.error(isEdit ? 'Failed to rename label' : 'Failed to add label', { description: apiError.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Rename ${label?.name}` : 'New project label'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'The new name shows on every member who carries this label.'
              : "Members can be given it from a project's Members tab."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="labelName">Name <span className="text-destructive">*</span></Label>
            <Input
              id="labelName"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(''); }}
              placeholder="e.g. Backend Developer"
              autoFocus
              disabled={saving}
            />
            {nameError && <p className="text-xs text-destructive">{nameError}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Save changes' : 'Add label'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
