import { useMemo } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { UserAvatar } from '@/components/shared/user-avatar';
import { RoleSelect } from '@/components/members/role-select';
import { UserSearchList } from '@/components/members/user-search-list';
import { applyFieldErrors, parseApiError } from '@/lib/api-error';
import { getAvatarColor } from '@/lib/shared-utils';
import {
  PROJECT_COLORS, PROJECT_PRIORITY_OPTIONS, PROJECT_STATE_OPTIONS, getProjectStateMeta, sortStatuses, toStatusInputs,
} from '@/lib/project-utils';
import {
  createProjectSchema, editProjectSchema, type ProjectFormValues, type ProjectMemberValue,
} from '@/lib/validations/project';
import {
  useAddProjectMemberMutation,
  useChangeProjectMemberRoleMutation,
  useCreateProjectMutation,
  useGetProjectQuery,
  useRemoveProjectMemberMutation,
  useReplaceProjectStatusesMutation,
  useUpdateProjectMutation,
} from '@/redux/features/projects/projects-api';
import { useStatusCatalog } from '@/redux/features/projects/use-status-catalog';
import type { ApiProject, ProjectFields, ProjectStatus } from '@/redux/features/projects/projects-types';

const FIELDS = [
  'name', 'description', 'objective', 'status', 'priority', 'color',
  'start_date', 'due_date', 'status_ids', 'members',
] as const;

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null opens the dialog in create mode */
  project: ApiProject | null;
}

export function ProjectFormDialog({ open, onOpenChange, project }: ProjectFormDialogProps) {
  // Fetch the latest copy so the form never edits stale list data
  const { data: freshProject, isLoading } = useGetProjectQuery(project?.id ?? 0, { skip: !open || !project });
  const catalog = useStatusCatalog({ skip: !open });

  const loading = catalog.isLoading || (Boolean(project) && isLoading);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{project ? `Edit Project: ${project.name}` : 'Create New Project'}</DialogTitle>
          <DialogDescription>
            {project
              ? 'Update project details, membership, and workflow.'
              : 'Create a new project, pick its workflow statuses, and add the team.'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading...
          </div>
        ) : (
          <ProjectForm
            key={project?.id ?? 'new'}
            project={freshProject ?? project}
            catalog={catalog.statuses}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ProjectFormProps {
  project: ApiProject | null;
  catalog: ProjectStatus[];
  onDone: () => void;
}

function toDefaults(project: ApiProject | null, catalog: ProjectStatus[]): ProjectFormValues {
  // Only direct members are editable here; group members are managed through groups
  const directMembers = project?.members.filter((m) => m.source === 'direct') ?? [];
  return {
    name: project?.name ?? '',
    description: project?.description ?? '',
    objective: project?.objective ?? '',
    status: project?.status ?? 'active',
    priority: project?.priority ?? 'medium',
    color: project?.color ?? PROJECT_COLORS[0],
    start_date: project?.start_date ?? '',
    due_date: project?.due_date ?? '',
    status_ids: project ? sortStatuses(project.statuses ?? []).map((s) => s.id) : catalog.map((s) => s.id),
    members: directMembers.map((m) => ({
      user_id: m.user.id,
      name: m.user.name,
      designation: m.user.designation,
      role: m.role,
    })),
  };
}

/** Fields both create and update send */
function toProjectFields(values: ProjectFormValues): ProjectFields {
  return {
    name: values.name,
    description: values.description,
    due_date: values.due_date || null,
    status: values.status,
    objective: values.objective || null,
    priority: values.priority,
    color: values.color,
    start_date: values.start_date || null,
  };
}

const toMemberInput = (m: ProjectMemberValue) => ({ user_id: m.user_id, ...(m.role && { role: m.role }) });

function ProjectForm({ project, catalog, onDone }: ProjectFormProps) {
  const [createProject, { isLoading: creating }] = useCreateProjectMutation();
  const [updateProject, { isLoading: updating }] = useUpdateProjectMutation();
  const [addMember] = useAddProjectMemberMutation();
  const [changeRole] = useChangeProjectMemberRoleMutation();
  const [removeMember] = useRemoveProjectMemberMutation();
  const [replaceStatuses] = useReplaceProjectStatusesMutation();

  const isEdit = Boolean(project);
  const defaults = useMemo(() => toDefaults(project, catalog), [project, catalog]);

  const {
    register, control, handleSubmit, setError, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(isEdit ? editProjectSchema : createProjectSchema),
    defaultValues: defaults,
  });
  const { fields: memberFields, append, remove, update } = useFieldArray({ control, name: 'members', keyName: 'fieldKey' });

  const saving = creating || updating || isSubmitting;
  const members = watch('members');
  const memberIds = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);

  // Statuses the project already uses stay listed even if no loaded project shares them
  const statusOptions = useMemo(() => {
    const byId = new Map(catalog.map((s) => [s.id, s]));
    project?.statuses?.forEach((s) => { if (!byId.has(s.id)) byId.set(s.id, s); });
    return sortStatuses([...byId.values()]);
  }, [catalog, project]);

  const syncMembers = async (projectId: number, next: ProjectMemberValue[]) => {
    const before = new Map(defaults.members.map((m) => [m.user_id, m]));
    const after = new Map(next.map((m) => [m.user_id, m]));
    const calls: Promise<unknown>[] = [];
    for (const [userId] of before) {
      if (!after.has(userId)) calls.push(removeMember({ projectId, userId }).unwrap());
    }
    for (const [userId, member] of after) {
      const previous = before.get(userId);
      if (!previous) calls.push(addMember({ projectId, ...toMemberInput(member) }).unwrap());
      // "Default role" has no PATCH equivalent, so only concrete role changes are sent
      else if (member.role && member.role !== previous.role) {
        calls.push(changeRole({ projectId, userId, role: member.role }).unwrap());
      }
    }
    await Promise.all(calls);
  };

  const syncStatuses = async (current: ApiProject, nextIds: number[]) => {
    // Without the project's statuses (list data) we can't tell what changed, so don't overwrite the workflow
    if (!current.statuses) return;
    const currentIds = sortStatuses(current.statuses).map((s) => s.id);
    if (currentIds.length === nextIds.length && currentIds.every((id, i) => id === nextIds[i])) return;
    // Keep the existing flags for statuses that stay; new ones go in catalog order
    const byId = new Map([...statusOptions, ...current.statuses].map((s) => [s.id, s]));
    const ordered = nextIds.map((id) => byId.get(id)).filter((s): s is ProjectStatus => Boolean(s));
    await replaceStatuses({ projectId: current.id, statuses: toStatusInputs(ordered) }).unwrap();
  };

  const onSubmit = async (values: ProjectFormValues) => {
    const fields = toProjectFields(values);
    try {
      if (project) {
        await updateProject({ id: project.id, ...fields }).unwrap();
        await syncMembers(project.id, values.members);
        await syncStatuses(project, values.status_ids);
        toast.success('Project updated', { description: `${values.name} has been saved.` });
      } else {
        await createProject({
          ...fields,
          status_ids: values.status_ids,
          members: values.members.map(toMemberInput),
        }).unwrap();
        toast.success('Project created', { description: `${values.name} has been created.` });
      }
      onDone();
    } catch (err) {
      const apiError = parseApiError(err, 'Failed to save project.');
      if (!applyFieldErrors(apiError, setError, FIELDS)) {
        setError('root', { message: apiError.message });
      }
    }
  };

  const toggleStatus = (id: number, checked: boolean) => {
    const current = watch('status_ids');
    // Preserve the catalog order so the workflow reads naturally
    const next = checked ? statusOptions.map((s) => s.id).filter((sid) => sid === id || current.includes(sid)) : current.filter((sid) => sid !== id);
    setValue('status_ids', next, { shouldValidate: true, shouldDirty: true });
  };

  const selectedStatusIds = watch('status_ids');
  const color = watch('color');

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {errors.root?.message && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {errors.root.message}
        </div>
      )}

      {/* Basic info */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="projName" label="Project name" required error={errors.name?.message} className="sm:col-span-2">
          <Input id="projName" placeholder="e.g. Atlas Platform" disabled={saving} {...register('name')} />
        </Field>

        <Field id="projColor" label="Project color" className="sm:col-span-2">
          <div className="flex flex-wrap gap-2">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setValue('color', c, { shouldDirty: true })}
                className={`h-8 w-8 rounded-lg transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-foreground scale-110' : ''}`}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
                aria-pressed={color === c}
              />
            ))}
          </div>
        </Field>
      </div>

      <Field id="projDesc" label="Description" required error={errors.description?.message}>
        <Textarea id="projDesc" placeholder="Brief description of the project..." rows={2} disabled={saving} {...register('description')} />
      </Field>

      <Field id="projObj" label="Objective" error={errors.objective?.message}>
        <Textarea id="projObj" placeholder="What this project aims to achieve..." rows={2} disabled={saving} {...register('objective')} />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="projStatus" label="Status" error={errors.status?.message}>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={saving}>
                <SelectTrigger id="projStatus"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {/* Keep a status outside the list (e.g. archived) selectable */}
                  {[...new Set([...PROJECT_STATE_OPTIONS, field.value])].map((s) => (
                    <SelectItem key={s} value={s}>{getProjectStateMeta(s).label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field id="projPriority" label="Priority">
          <Controller
            control={control}
            name="priority"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={saving}>
                <SelectTrigger id="projPriority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROJECT_PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p}>{titleCase(p)}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="projStart" label="Start date" error={errors.start_date?.message}>
          <Input id="projStart" type="date" disabled={saving} {...register('start_date')} />
        </Field>
        <Field id="projDue" label="Due date" error={errors.due_date?.message}>
          <Input id="projDue" type="date" disabled={saving} {...register('due_date')} />
        </Field>
      </div>

      <Separator />

      {/* Workflow statuses */}
      <div className="space-y-3">
        <SectionTitle title="Workflow Statuses" error={errors.status_ids?.message} />
        <p className="text-xs text-muted-foreground">
          The statuses issues move through in this project. Fine-tune the order and initial/final statuses on the project's Workflow tab.
        </p>
        {statusOptions.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            No statuses available yet.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((status) => {
              const checked = selectedStatusIds.includes(status.id);
              return (
                <label
                  key={status.id}
                  className="flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => toggleStatus(status.id, v === true)}
                    disabled={saving}
                  />
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />
                  {status.name}
                </label>
              );
            })}
          </div>
        )}
      </div>

      <Separator />

      {/* Members */}
      <div className="space-y-3">
        <SectionTitle title={`Project Members (${memberFields.length})`} error={errors.members?.message} />
        <p className="text-xs text-muted-foreground">
          Add people and pick their role in this project. Leave it on "User's default role" to use the role from their account.
        </p>

        {memberFields.length > 0 && (
          <div className="divide-y rounded-lg border">
            {memberFields.map((member, index) => (
              <div key={member.fieldKey} className="flex items-center gap-3 px-3 py-2.5">
                <UserAvatar name={member.name} color={getAvatarColor(member.user_id)} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{member.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{member.designation || '—'}</div>
                </div>
                <RoleSelect
                  value={members[index]?.role ?? ''}
                  onChange={(role) => update(index, { ...members[index], role })}
                  disabled={saving}
                  className="w-[170px]"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => remove(index)}
                  disabled={saving}
                  aria-label={`Remove ${member.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <UserSearchList
          excludeIds={memberIds}
          emptyMessage="No more active users to add."
          renderAction={(user) => (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7"
              disabled={saving}
              onClick={() => append({ user_id: user.id, name: user.name, designation: user.designation, role: '' })}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add
            </Button>
          )}
        />
      </div>

      <Separator />

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? 'Save changes' : 'Create project'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function Field({
  id, label, required, error, hint, className, children,
}: {
  id: string; label: string; required?: boolean; error?: string; hint?: string; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label htmlFor={id}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
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
