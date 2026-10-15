import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { issueService } from '@/lib/services';
import { parseApiError } from '@/lib/api-error';
import { projectCan } from '@/lib/project-utils';
import { ProjectSelect } from '@/components/projects/project-select';
import { MemberMultiSelect } from '@/components/members/member-multi-select';
import { useGetProjectMembersQuery, useGetProjectQuery } from '@/redux/features/projects/projects-api';
import type { ApiProject } from '@/redux/features/projects/projects-types';
import { useCreateIssueMutation } from '@/redux/features/issues/issues-api';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, X, AlertCircle, FolderKanban } from 'lucide-react';
import { toast } from 'sonner';
import {
  ISSUE_PRIORITY_META, ISSUE_SEVERITY_OPTIONS, ISSUE_TYPE_OPTIONS,
} from '@/lib/shared-utils';
import type { Issue, IssuePriority, IssueType, IssueSeverity, UUID } from '@/lib/types';

/** Only projects where the signed-in user may create issues */
const canCreateIssueIn = (project: ApiProject) => projectCan(project, 'issues.create');

/** API field name -> form error key */
const API_FIELD_TO_ERROR: Record<string, string> = {
  title: 'title',
  description: 'description',
  type: 'type',
  priority: 'priority',
  severity: 'severity',
  assignee_ids: 'assignee',
  labels: 'labels',
  due_date: 'dueDate',
};

interface IssueFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue?: Issue;
  defaultProjectId?: UUID;
  onSaved: () => void;
}

export function IssueFormDialog({ open, onOpenChange, issue, defaultProjectId, onSaved }: IssueFormDialogProps) {
  const { session } = useAuth();
  const [createIssue, { isLoading: creating }] = useCreateIssueMutation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [type, setType] = useState<IssueType>('bug');
  const [priority, setPriority] = useState<IssuePriority>('medium');
  const [severity, setSeverity] = useState<IssueSeverity | ''>('');
  const [assigneeIds, setAssigneeIds] = useState<number[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [labelInput, setLabelInput] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);

  const isEdit = !!issue;
  const saving = creating || savingEdit;

  useEffect(() => {
    if (open) {
      if (issue) {
        setTitle(issue.title);
        setDescription(issue.description);
        setProjectId(issue.projectId);
        setType(issue.type);
        setPriority(issue.priority);
        setSeverity(issue.severity || '');
        // Mock issues reference mock users, which aren't API members; start empty
        setAssigneeIds([]);
        setLabels(issue.labels);
        setDueDate(issue.dueDate ? issue.dueDate.split('T')[0] : '');
      } else {
        setTitle('');
        setDescription('');
        setProjectId(defaultProjectId || '');
        setType('bug');
        setPriority('medium');
        setSeverity('');
        setAssigneeIds([]);
        setLabels([]);
        setDueDate('');
      }
      setLabelInput('');
      setErrors({});
    }
  }, [open, issue, defaultProjectId]);

  // Project, its permissions and its members all come from the projects API
  const apiProjectId = Number(projectId);
  const hasApiProject = Boolean(projectId) && Number.isFinite(apiProjectId);
  const { data: project } = useGetProjectQuery(apiProjectId, { skip: !open || !hasApiProject });
  const { data: members = [], isFetching: loadingMembers } = useGetProjectMembersQuery(apiProjectId, {
    skip: !open || !hasApiProject,
  });

  const eligibleAssignees = useMemo(
    () => members.filter((m) => m.user.status === 'active').map((m) => m.user),
    [members],
  );

  // Uses the signed-in user's permissions in the selected project
  const canAssign = projectCan(project, 'issues.assign');
  // The rest of the form depends on the project (assignees, permissions), so it waits for one
  const showDetails = isEdit || Boolean(projectId);

  const clearError = (key: string) => setErrors((e) => ({ ...e, [key]: '' }));

  const handleProjectChange = (id: string) => {
    setProjectId(id);
    // Assignees belong to a project, so a new project starts unassigned
    setAssigneeIds([]);
    clearError('project');
  };

  const addLabel = () => {
    const val = labelInput.trim().toLowerCase();
    if (val && !labels.includes(val)) {
      setLabels([...labels, val]);
    }
    setLabelInput('');
  };

  const removeLabel = (label: string) => {
    setLabels(labels.filter((l) => l !== label));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!projectId) errs.project = 'Project is required';
    if (!title.trim()) errs.title = 'Title is required';
    else if (title.trim().length < 5) errs.title = 'Title must be at least 5 characters';
    if (!type) errs.type = 'Type is required';
    if (!priority) errs.priority = 'Priority is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const close = () => {
    onSaved();
    onOpenChange(false);
  };

  const handleCreate = async () => {
    try {
      // The project goes in the URL (POST /projects/{id}/issues), not the body
      await createIssue({
        projectId: apiProjectId,
        title: title.trim(),
        description: description.trim() || null,
        type,
        priority,
        severity: severity || null,
        assignee_ids: canAssign ? assigneeIds : [],
        labels,
        due_date: dueDate || null,
      }).unwrap();
      toast.success('Issue created', { description: `"${title.trim()}" was added to ${project?.name ?? 'the project'}.` });
      close();
    } catch (err) {
      const apiError = parseApiError(err, 'Failed to create issue.');
      const fieldErrors: Record<string, string> = {};
      for (const [field, messages] of Object.entries(apiError.fieldErrors)) {
        const key = API_FIELD_TO_ERROR[field.split('.')[0]];
        if (key && messages[0]) fieldErrors[key] = messages[0];
      }
      setErrors(fieldErrors);
      toast.error('Failed to create issue', { description: apiError.message });
    }
  };

  // Editing still runs on mock data until the issue update API is connected
  const handleEdit = (current: Issue, userId: string) => {
    setSavingEdit(true);
    try {
      const result = issueService.update(current.id, {
        title: title.trim(),
        description: description.trim(),
        type,
        priority,
        severity: severity || undefined,
        labels,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      }, userId);
      if ('error' in result) {
        toast.error(result.error);
      } else {
        toast.success('Issue updated', { description: `${result.key} has been updated.` });
        close();
      }
    } catch {
      toast.error('Failed to save issue');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !session) return;
    if (isEdit && issue) handleEdit(issue, session.user.id);
    else void handleCreate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${issue?.key}` : 'Create New Issue'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update issue details and attributes.' : 'Pick the project first, then describe the issue.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Step 1: project */}
          <div className="space-y-1.5">
            <Label htmlFor="issueProject">Project <span className="text-destructive">*</span></Label>
            <ProjectSelect
              id="issueProject"
              value={projectId}
              onChange={handleProjectChange}
              filter={canCreateIssueIn}
              disabled={isEdit || saving}
            />
            {errors.project && <p className="text-xs text-destructive">{errors.project}</p>}
          </div>

          {!showDetails ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
              <FolderKanban className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Select a project to continue</p>
              <p className="mt-1 text-xs text-muted-foreground">Assignees and permissions depend on the project.</p>
            </div>
          ) : (
            <>
              <Separator />

              {/* Step 2: details */}
              <div className="space-y-1.5">
                <Label htmlFor="issueTitle">Title <span className="text-destructive">*</span></Label>
                <Input
                  id="issueTitle"
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); clearError('title'); }}
                  placeholder="Brief summary of the issue..."
                  disabled={saving}
                  autoFocus={!isEdit}
                />
                {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="issueDesc">Description</Label>
                <Textarea
                  id="issueDesc"
                  value={description}
                  onChange={(e) => { setDescription(e.target.value); clearError('description'); }}
                  placeholder="Detailed description including steps to reproduce, expected vs actual behavior..."
                  rows={4}
                  disabled={saving}
                />
                {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="issueType">Type <span className="text-destructive">*</span></Label>
                  <Select value={type} onValueChange={(v) => { setType(v as IssueType); clearError('type'); }} disabled={saving}>
                    <SelectTrigger id="issueType"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ISSUE_TYPE_OPTIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.type && <p className="text-xs text-destructive">{errors.type}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="issuePriority">Priority <span className="text-destructive">*</span></Label>
                  <Select value={priority} onValueChange={(v) => { setPriority(v as IssuePriority); clearError('priority'); }} disabled={saving}>
                    <SelectTrigger id="issuePriority"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.entries(ISSUE_PRIORITY_META)).map(([val, meta]) => (
                        <SelectItem key={val} value={val}>{meta.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.priority && <p className="text-xs text-destructive">{errors.priority}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="issueSeverity">Severity</Label>
                  <Select
                    value={severity || 'none'}
                    onValueChange={(v) => { setSeverity(v === 'none' ? '' : v as IssueSeverity); clearError('severity'); }}
                    disabled={saving}
                  >
                    <SelectTrigger id="issueSeverity"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {ISSUE_SEVERITY_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label} — {s.description}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.severity && <p className="text-xs text-destructive">{errors.severity}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="issueAssignee">Assignees</Label>
                  {canAssign ? (
                    <MemberMultiSelect
                      id="issueAssignee"
                      options={eligibleAssignees}
                      value={assigneeIds}
                      onChange={(ids) => { setAssigneeIds(ids); clearError('assignee'); }}
                      loading={loadingMembers}
                      disabled={saving}
                      placeholder="Unassigned"
                    />
                  ) : (
                    <div className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm text-muted-foreground">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {isEdit ? 'Assignment handled separately' : 'You can create issues but cannot assign them'}
                    </div>
                  )}
                  {errors.assignee && <p className="text-xs text-destructive">{errors.assignee}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => { setDueDate(e.target.value); clearError('dueDate'); }}
                    disabled={saving}
                  />
                  {errors.dueDate && <p className="text-xs text-destructive">{errors.dueDate}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="issueLabels">Labels</Label>
                <div className="flex gap-2">
                  <Input
                    id="issueLabels"
                    value={labelInput}
                    onChange={(e) => setLabelInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLabel(); } }}
                    placeholder="Type a label and press Enter..."
                    disabled={saving}
                  />
                  <Button type="button" variant="outline" onClick={addLabel} disabled={!labelInput.trim() || saving}>
                    Add
                  </Button>
                </div>
                {labels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {labels.map((label) => (
                      <Badge key={label} variant="secondary" className="gap-1">
                        {label}
                        <button
                          type="button"
                          onClick={() => removeLabel(label)}
                          className="ml-0.5 hover:text-destructive"
                          aria-label={`Remove label ${label}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                {errors.labels && <p className="text-xs text-destructive">{errors.labels}</p>}
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !showDetails}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Save changes' : 'Create issue'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
