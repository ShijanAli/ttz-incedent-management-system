import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { UserAvatar } from '@/components/shared/user-avatar';
import { UserSearchList } from '@/components/members/user-search-list';
import { ProjectSearchList } from '@/components/projects/project-search-list';
import { applyFieldErrors, parseApiError } from '@/lib/api-error';
import { getAvatarColor } from '@/lib/shared-utils';
import { groupFormSchema, type GroupFormValues } from '@/lib/validations/group';
import {
  useCreateGroupMutation,
  useGetGroupQuery,
  useUpdateGroupMutation,
} from '@/redux/features/groups/groups-api';
import type { ApiGroup } from '@/redux/features/groups/groups-types';

const FIELDS = ['name', 'description', 'is_active', 'users', 'projects'] as const;

interface GroupFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null opens the dialog in create mode */
  group: ApiGroup | null;
  onCreated?: (group: ApiGroup) => void;
}

export function GroupFormDialog({ open, onOpenChange, group, onCreated }: GroupFormDialogProps) {
  // Fetch the latest copy so the form never edits stale list data
  const { data: freshGroup, isLoading } = useGetGroupQuery(group?.id ?? 0, { skip: !open || !group });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{group ? `Edit Group: ${group.name}` : 'Create New Group'}</DialogTitle>
          <DialogDescription>
            {group
              ? 'Update the group details. Manage members from the group page.'
              : 'Create a group of people, then attach it to projects to give all of them access at once.'}
          </DialogDescription>
        </DialogHeader>

        {group && isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading...
          </div>
        ) : (
          <GroupForm
            key={group?.id ?? 'new'}
            group={freshGroup ?? group}
            onDone={() => onOpenChange(false)}
            onCreated={onCreated}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface GroupFormProps {
  group: ApiGroup | null;
  onDone: () => void;
  onCreated?: (group: ApiGroup) => void;
}

function GroupForm({ group, onDone, onCreated }: GroupFormProps) {
  const [createGroup, { isLoading: creating }] = useCreateGroupMutation();
  const [updateGroup, { isLoading: updating }] = useUpdateGroupMutation();
  const isEdit = Boolean(group);

  const {
    register, control, handleSubmit, setError, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: {
      name: group?.name ?? '',
      description: group?.description ?? '',
      is_active: group?.is_active ?? true,
      users: [],
      projects: [],
    },
  });

  const saving = creating || updating || isSubmitting;
  const users = watch('users');
  const projects = watch('projects');
  const isActive = watch('is_active');
  const userIds = new Set(users.map((u) => u.id));
  const projectIds = new Set(projects.map((p) => p.id));

  const toggleProject = (project: { id: number; name: string }, checked: boolean) => {
    const next = checked ? [...projects, { id: project.id, name: project.name }] : projects.filter((p) => p.id !== project.id);
    setValue('projects', next, { shouldValidate: true });
  };

  const onSubmit = async (values: GroupFormValues) => {
    const fields = {
      name: values.name,
      description: values.description || null,
      is_active: values.is_active,
    };
    try {
      if (group) {
        await updateGroup({ id: group.id, ...fields }).unwrap();
        toast.success('Group updated', { description: `${values.name} has been saved.` });
      } else {
        const created = await createGroup({
          ...fields,
          user_ids: values.users.map((u) => u.id),
          project_ids: values.projects.map((p) => p.id),
        }).unwrap();
        toast.success('Group created', { description: `${values.name} has been created.` });
        onCreated?.(created);
      }
      onDone();
    } catch (err) {
      const apiError = parseApiError(err, 'Failed to save group.');
      // The API names the arrays user_ids / project_ids
      const remapped = {
        ...apiError,
        fieldErrors: Object.fromEntries(
          Object.entries(apiError.fieldErrors).map(([key, msgs]) => [
            key.replace(/^user_ids/, 'users').replace(/^project_ids/, 'projects'),
            msgs,
          ]),
        ),
      };
      if (!applyFieldErrors(remapped, setError, FIELDS)) {
        setError('root', { message: apiError.message });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {errors.root?.message && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {errors.root.message}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="groupName">Group name <span className="text-destructive">*</span></Label>
        <Input id="groupName" placeholder="e.g. Core Team" disabled={saving} {...register('name')} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="groupDesc">Description</Label>
        <Textarea id="groupDesc" placeholder="Who is in this group and what is it for..." rows={2} disabled={saving} {...register('description')} />
        {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
      </div>

      <div className="flex items-center gap-3">
        <Controller
          control={control}
          name="is_active"
          render={({ field }) => (
            <Switch id="groupActive" checked={field.value} onCheckedChange={field.onChange} disabled={saving} />
          )}
        />
        <Label htmlFor="groupActive" className="font-normal text-muted-foreground">
          {isActive ? 'Active: can be attached to projects' : 'Inactive: cannot be attached to projects'}
        </Label>
      </div>

      {!isEdit && (
        <>
          <Separator />

          {/* Members */}
          <div className="space-y-3">
            <SectionTitle title={`Members (${users.length})`} error={errors.users?.message} />
            <p className="text-xs text-muted-foreground">Each member joins with the default role from their account. You can change roles later.</p>
            {users.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {users.map((u) => (
                  <Badge key={u.id} variant="secondary" className="gap-1.5 py-1 pl-1 pr-2 font-normal">
                    <UserAvatar name={u.name} color={getAvatarColor(u.id)} size="xs" />
                    {u.name}
                    <button
                      type="button"
                      onClick={() => setValue('users', users.filter((x) => x.id !== u.id))}
                      className="ml-0.5 rounded-full text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${u.name}`}
                      disabled={saving}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <UserSearchList
              excludeIds={userIds}
              emptyMessage="No more active users to add."
              renderAction={(user) => (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7"
                  disabled={saving}
                  onClick={() => setValue('users', [...users, { id: user.id, name: user.name, designation: user.designation }])}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add
                </Button>
              )}
            />
          </div>

          <Separator />

          {/* Projects */}
          <div className="space-y-3">
            <SectionTitle title={`Projects (${projects.length})`} error={errors.projects?.message} />
            <p className="text-xs text-muted-foreground">Every member of this group gets access to the selected projects.</p>
            <ProjectSearchList
              emptyMessage="No active projects found."
              renderAction={(project) => (
                <Checkbox
                  checked={projectIds.has(project.id)}
                  onCheckedChange={(v) => toggleProject(project, v === true)}
                  disabled={saving || !isActive}
                  aria-label={`Attach to ${project.name}`}
                />
              )}
            />
          </div>
        </>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? 'Save changes' : 'Create group'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function SectionTitle({ title, error }: { title: string; error?: string }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {error && (
        <span className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          {error}
        </span>
      )}
    </div>
  );
}
