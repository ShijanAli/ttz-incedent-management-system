import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { parseApiError } from '@/lib/api-error';
import { ProjectSelect } from '@/components/projects/project-select';
import { MemberMultiSelect } from '@/components/members/member-multi-select';
import { useGetProjectMembersQuery, useGetProjectQuery } from '@/redux/features/projects/projects-api';
import { useCreateIssueMutation } from '@/redux/features/issues/issues-api';
import {
  useTriageIssueMutation, useUpdateIssueMutation,
} from '@/redux/features/issues/issue-detail-api';
import { formatFileSize } from '@/lib/download';
import { ISSUE_SOURCE_OPTIONS, type IssueDetail, type IssueSource } from '@/redux/features/issues/issues-types';
import { CustomerSelect } from '@/components/customers/customer-select';
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
import { Loader2, X, AlertCircle, FolderKanban, Paperclip, UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getSeverityKey, isMyReport } from '@/lib/shared-utils';
import { useIssueOptions } from '@/redux/features/issues/issue-options-api';
import type { IssuePriority, IssueSeverity } from '@/lib/types';
import { IssueCategorySelect } from '@/components/issues/issue-category-select';


/** API field name -> form error key */
const API_FIELD_TO_ERROR: Record<string, string> = {
  title: 'title',
  description: 'description',
  issue_category_id: 'category',
  priority: 'priority',
  severity: 'severity',
  assignee_ids: 'assignee',
  labels: 'labels',
  due_date: 'dueDate',
  source: 'source',
  customer_id: 'customer',
  // attachments.0, attachments.1 ... all land under the file picker
  attachments: 'attachments',
};

interface IssueFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present in edit mode */
  issue?: IssueDetail;
  defaultProjectId?: string;
  onSaved: () => void;
}

/** Per-file limit from the API spec; bigger files are rejected before upload */
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const sameList = <T,>(a: T[], b: T[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

export function IssueFormDialog({ open, onOpenChange, issue, defaultProjectId, onSaved }: IssueFormDialogProps) {
  const { session } = useAuth();
  const issueOptions = useIssueOptions();
  const [createIssue, { isLoading: creating }] = useCreateIssueMutation();
  const [updateIssue, { isLoading: updating }] = useUpdateIssueMutation();
  const [triageIssue, { isLoading: triaging }] = useTriageIssueMutation();
  // Files picked in the create form; sent with the create request
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  // Existing issues may have no category or priority yet, so both allow "not set"
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState<IssuePriority | ''>('medium');
  const [severity, setSeverity] = useState<IssueSeverity | ''>('');
  const [assigneeIds, setAssigneeIds] = useState<number[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [labelInput, setLabelInput] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [source, setSource] = useState<IssueSource>('internal');
  // Only used (and sent) when the source is a customer complaint
  const [customerId, setCustomerId] = useState('');
  const isComplaint = source === 'customer_complaint';
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEdit = !!issue;
  const saving = creating || updating || triaging;
  // Edits manage files from the issue's Files tab, so only the create form attaches them
  const canAttach = !isEdit;
  // In edit mode each part of the form follows what the API says this user may change.
  // The reporter may change everything they filled in when creating it.
  const reportedByMe = !!issue && isMyReport(issue, session ? Number(session.user.id) : undefined);
  const canEditText = !issue || issue.abilities.can_edit || reportedByMe;
  const canTriage = !issue || issue.abilities.can_triage || reportedByMe;

  useEffect(() => {
    if (open) {
      if (issue) {
        setTitle(issue.title);
        setDescription(issue.description ?? '');
        setProjectId(String(issue.project.id));
        setCategoryId(issue.category ? String(issue.category.id) : '');
        setPriority(issue.priority ?? '');
        setSeverity(getSeverityKey(issue.severity) ?? '');
        setAssigneeIds(issue.assignees.map((a) => a.user.id));
        setLabels(issue.labels);
        setDueDate(issue.due_date ?? '');
      } else {
        setTitle('');
        setDescription('');
        setProjectId(defaultProjectId || '');
        setCategoryId('');
        setPriority('medium');
        setSeverity('');
        setAssigneeIds([]);
        setLabels([]);
        setDueDate('');
        setSource('internal');
        setCustomerId('');
      }
      setLabelInput('');
      setFiles([]);
      setDragging(false);
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

  const eligibleAssignees = useMemo(() => {
    const options = new Map(members.filter((m) => m.user.status === 'active').map((m) => [m.user.id, m.user]));
    // Keep current assignees selectable even if they're no longer active members
    issue?.assignees.forEach((a) => { if (!options.has(a.user.id)) options.set(a.user.id, a.user); });
    return [...options.values()];
  }, [members, issue]);

  // Edit: the issue's own abilities. Create: anyone may assign.
  const canAssign = issue ? issue.abilities.can_assign && canTriage : true;
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

  const addFiles = (picked: FileList | null) => {
    if (!picked?.length) return;
    const list = Array.from(picked);
    const tooBig = list.filter((f) => f.size > MAX_FILE_BYTES);
    if (tooBig.length) {
      toast.error(`${tooBig.length} file${tooBig.length !== 1 ? 's are' : ' is'} over 10 MB`, {
        description: tooBig.map((f) => f.name).join(', '),
      });
    }
    // Skip files already in the list (same name and size)
    setFiles((prev) => [
      ...prev,
      ...list.filter((f) => f.size <= MAX_FILE_BYTES && !prev.some((p) => p.name === f.name && p.size === f.size)),
    ]);
    if (fileInput.current) fileInput.current.value = '';
    clearError('attachments');
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    clearError('attachments');
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!projectId) errs.project = 'Project is required';
    if (!title.trim()) errs.title = 'Title is required';
    else if (title.trim().length < 5) errs.title = 'Title must be at least 5 characters';
    // Older issues may have no category/priority; only new issues must set them
    if (!isEdit && !categoryId) errs.category = 'Category is required';
    if (!isEdit && !priority) errs.priority = 'Priority is required';
    if (!isEdit && isComplaint && !customerId) errs.customer = 'Pick the customer who raised the complaint';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const close = () => {
    onSaved();
    onOpenChange(false);
  };

  /** Shows API validation errors under the matching fields */
  const showApiErrors = (err: unknown, fallback: string) => {
    const apiError = parseApiError(err, fallback);
    const fieldErrors: Record<string, string> = {};
    for (const [field, messages] of Object.entries(apiError.fieldErrors)) {
      const key = API_FIELD_TO_ERROR[field.split('.')[0]];
      if (key && messages[0]) fieldErrors[key] = messages[0];
    }
    setErrors(fieldErrors);
    toast.error(fallback, { description: apiError.message });
  };

  const handleCreate = async () => {
    try {
      // The project goes in the URL (POST /projects/{id}/issues), not the body
      // Files go in the same request (attachments[]), so the issue and its files save together
      await createIssue({
        projectId: apiProjectId,
        title: title.trim(),
        description: description.trim() || null,
        issue_category_id: Number(categoryId),
        priority: priority as IssuePriority,
        severity: severity || null,
        assignee_ids: canAssign ? assigneeIds : [],
        labels,
        due_date: dueDate || null,
        source,
        ...(isComplaint && { customer_id: Number(customerId) }),
        ...(canAttach && files.length > 0 && { attachments: files }),
      }).unwrap();
      toast.success('Issue created', { description: `"${title.trim()}" was added to ${project?.name ?? 'the project'}.` });
      close();
    } catch (err) {
      showApiErrors(err, 'Failed to create issue');
    }
  };

  /**
   * Edit is two APIs: title/description go through the update endpoint, everything
   * else through triage. Each sends only what changed and what this user may change.
   */
  const handleEdit = async (current: IssueDetail) => {
    const textChanged = title.trim() !== current.title || description.trim() !== (current.description ?? '');
    const triage = {
      ...(categoryId !== (current.category ? String(current.category.id) : '') && {
        issue_category_id: categoryId ? Number(categoryId) : null,
      }),
      ...(priority !== (current.priority ?? '') && { priority: priority || null }),
      ...(severity !== (getSeverityKey(current.severity) ?? '') && { severity: severity || null }),
      ...(dueDate !== (current.due_date ?? '') && { due_date: dueDate || null }),
      ...(!sameList(labels, current.labels) && { labels }),
      ...(canAssign && !sameList(assigneeIds, current.assignees.map((a) => a.user.id)) && { assignee_ids: assigneeIds }),
    };
    const triageChanged = Object.keys(triage).length > 0;

    if (!textChanged && !triageChanged) {
      onOpenChange(false);
      return;
    }
    try {
      if (textChanged && canEditText) {
        await updateIssue({ issueId: current.id, title: title.trim(), description: description.trim() || null }).unwrap();
      }
      if (triageChanged && canTriage) {
        await triageIssue({ issueId: current.id, ...triage }).unwrap();
      }
      toast.success('Issue updated', { description: `${current.code} has been updated.` });
      close();
    } catch (err) {
      showApiErrors(err, 'Failed to update issue');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !session) return;
    if (issue) void handleEdit(issue);
    else void handleCreate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${issue?.code}` : 'Create New Issue'}</DialogTitle>
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
                  disabled={saving || !canEditText}
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
                  disabled={saving || !canEditText}
                />
                {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
              </div>

              {/* Category gets a full row: its inline "add custom category" form needs the width */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="issueCategory">Category <span className="text-destructive">*</span></Label>
                  <IssueCategorySelect
                    id="issueCategory"
                    value={categoryId}
                    onChange={(id) => { setCategoryId(id); clearError('category'); }}
                    disabled={saving || !canTriage}
                  />
                  {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}
                </div>

                {/* Set once when the issue is reported, so only the create form asks for it */}
                {!isEdit && (
                  <div className="space-y-1.5">
                    <Label htmlFor="issueSource">Source</Label>
                    <Select
                      value={source}
                      onValueChange={(v) => {
                        setSource(v as IssueSource);
                        clearError('source');
                        // A customer only belongs to complaints
                        if (v !== 'customer_complaint') { setCustomerId(''); clearError('customer'); }
                      }}
                      disabled={saving}
                    >
                      <SelectTrigger id="issueSource"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ISSUE_SOURCE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label} — {o.description}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.source && <p className="text-xs text-destructive">{errors.source}</p>}
                  </div>
                )}

                {!isEdit && isComplaint && (
                  <div className="space-y-1.5">
                    <Label htmlFor="issueCustomer">Customer <span className="text-destructive">*</span></Label>
                    <CustomerSelect
                      id="issueCustomer"
                      value={customerId}
                      onChange={(id) => { setCustomerId(id); clearError('customer'); }}
                      disabled={saving}
                    />
                    {errors.customer && <p className="text-xs text-destructive">{errors.customer}</p>}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="issuePriority">Priority <span className="text-destructive">*</span></Label>
                  <Select value={priority} onValueChange={(v) => { setPriority(v as IssuePriority); clearError('priority'); }} disabled={saving || !canTriage}>
                    <SelectTrigger id="issuePriority"><SelectValue placeholder="Not set" /></SelectTrigger>
                    <SelectContent>
                      {issueOptions.priorities.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
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
                    disabled={saving || !canTriage}
                  >
                    <SelectTrigger id="issueSeverity"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {issueOptions.severities.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.description ? `${s.label} — ${s.description}` : s.label}
                        </SelectItem>
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
                    disabled={saving || !canTriage}
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
                    disabled={saving || !canTriage}
                  />
                  <Button type="button" variant="outline" onClick={addLabel} disabled={!labelInput.trim() || saving || !canTriage}>
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

              {canAttach && (
                <div className="space-y-1.5">
                  <Label htmlFor="issueAttachments">Attachments</Label>
                  <input
                    ref={fileInput}
                    id="issueAttachments"
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => addFiles(e.target.files)}
                  />
                  <div
                    role="button"
                    tabIndex={saving ? -1 : 0}
                    aria-disabled={saving}
                    aria-label="Add attachments: drop files here or press Enter to browse"
                    onClick={() => !saving && fileInput.current?.click()}
                    onKeyDown={(e) => {
                      if (!saving && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fileInput.current?.click(); }
                    }}
                    onDragEnter={(e) => { e.preventDefault(); if (!saving) setDragging(true); }}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = saving ? 'none' : 'copy'; }}
                    onDragLeave={(e) => {
                      // Ignore leaving into a child element
                      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragging(false);
                      if (!saving) addFiles(e.dataTransfer.files);
                    }}
                    className={cn(
                      'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-all',
                      'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      dragging
                        ? 'scale-[1.01] border-primary bg-primary/5'
                        : 'border-muted-foreground/25 bg-muted/20 hover:border-primary/50 hover:bg-muted/40',
                      saving && 'pointer-events-none opacity-60',
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-11 w-11 items-center justify-center rounded-full transition-colors',
                        dragging ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary',
                      )}
                    >
                      <UploadCloud className="h-5 w-5" />
                    </div>
                    <div className="text-sm">
                      {dragging ? (
                        <span className="font-medium text-primary">Drop files to attach</span>
                      ) : (
                        <>
                          <span className="font-medium">Drag &amp; drop files here</span>
                          <span className="text-muted-foreground"> or </span>
                          <span className="font-medium text-primary underline-offset-4 hover:underline">browse</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Up to 10 MB per file
                    </p>
                  </div>

                  {files.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {files.length} file{files.length !== 1 ? 's' : ''} ready ·{' '}
                        {formatFileSize(files.reduce((sum, f) => sum + f.size, 0))}
                      </p>
                      {files.map((file, i) => (
                        <div
                          key={`${file.name}-${file.size}`}
                          className="group flex items-center gap-3 rounded-lg border bg-background p-2 pr-1 shadow-sm transition-colors hover:bg-muted/40 animate-fade-in"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <Paperclip className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium" title={file.name}>{file.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatFileSize(file.size)}
                              {file.name.includes('.') && ` · ${file.name.split('.').pop()!.toUpperCase()}`}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => removeFile(i)}
                            disabled={saving}
                            aria-label={`Remove ${file.name}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {errors.attachments && <p className="text-xs text-destructive">{errors.attachments}</p>}
                </div>
              )}
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
