import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { projectRepo, userRepo } from '@/lib/repository';
import { getVisibleProjects, canUserAssignIssue, issueService } from '@/lib/services';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  ISSUE_PRIORITY_META, ISSUE_SEVERITY_OPTIONS, ISSUE_TYPE_OPTIONS,
} from '@/lib/shared-utils';
import type { Issue, IssuePriority, IssueType, IssueSeverity, UUID, User } from '@/lib/types';

interface IssueFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue?: Issue;
  defaultProjectId?: UUID;
  onSaved: () => void;
}

export function IssueFormDialog({ open, onOpenChange, issue, defaultProjectId, onSaved }: IssueFormDialogProps) {
  const { session } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [type, setType] = useState<IssueType>('bug');
  const [priority, setPriority] = useState<IssuePriority>('medium');
  const [severity, setSeverity] = useState<IssueSeverity | ''>('');
  const [reproducibility, setReproducibility] = useState('');
  const [assigneeId, setAssigneeId] = useState<string>('unassigned');
  const [labels, setLabels] = useState<string[]>([]);
  const [labelInput, setLabelInput] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const isEdit = !!issue;

  const visibleProjects = useMemo(() => {
    if (!session) return [];
    return getVisibleProjects(session.user.id).filter((p) => p.status !== 'archived');
  }, [session]);

  useEffect(() => {
    if (open) {
      if (issue) {
        setTitle(issue.title);
        setDescription(issue.description);
        setProjectId(issue.projectId);
        setType(issue.type);
        setPriority(issue.priority);
        setSeverity(issue.severity || '');
        setReproducibility(issue.reproducibility || '');
        setAssigneeId(issue.assigneeId || 'unassigned');
        setLabels(issue.labels);
        setDueDate(issue.dueDate ? issue.dueDate.split('T')[0] : '');
      } else {
        setTitle('');
        setDescription('');
        setProjectId(defaultProjectId || '');
        setType('bug');
        setPriority('medium');
        setSeverity('');
        setReproducibility('');
        setAssigneeId('unassigned');
        setLabels([]);
        setDueDate('');
      }
      setLabelInput('');
      setErrors({});
    }
  }, [open, issue, defaultProjectId]);

  const project = useMemo(() => projectRepo.find(projectId), [projectId]);

  const eligibleAssignees = useMemo(() => {
    if (!project || !session) return [];
    return project.memberIds
      .map((id) => userRepo.find(id))
      .filter((u): u is User => u !== undefined && u.status === 'active');
  }, [project, session]);

  const canAssign = useMemo(() => {
    if (!session || !project) return false;
    const dummyIssue: Issue = { ...issue!, id: issue?.id || 'temp', key: issue?.key || 'TEMP', projectId, title, type, priority, status: issue?.status || 'todo', reporterId: session.user.id, assigneeId: null, labels: [], startDate: '', createdAt: '', updatedAt: '' };
    return canUserAssignIssue(session.user.id, dummyIssue);
  }, [session, project, projectId, title, type, priority, issue]);

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
    if (!title.trim()) errs.title = 'Title is required';
    else if (title.trim().length < 5) errs.title = 'Title must be at least 5 characters';
    if (!projectId) errs.project = 'Project is required';
    if (!type) errs.type = 'Type is required';
    if (!priority) errs.priority = 'Priority is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !session) return;

    setSaving(true);
    try {
      if (isEdit && issue) {
        const result = issueService.update(issue.id, {
          title: title.trim(),
          description: description.trim(),
          type,
          priority,
          severity: severity || undefined,
          reproducibility: reproducibility.trim() || undefined,
          labels,
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        }, session.user.id);
        if ('error' in result) {
          toast.error(result.error);
        } else {
          toast.success('Issue updated', { description: `${result.key} has been updated.` });
          onSaved();
          onOpenChange(false);
        }
      } else {
        const result = issueService.create({
          title: title.trim(),
          description: description.trim(),
          projectId,
          type,
          priority,
          severity: severity || undefined,
          reproducibility: reproducibility.trim() || undefined,
          assigneeId: canAssign && assigneeId !== 'unassigned' ? assigneeId : null,
          labels,
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        }, session.user.id);
        if ('error' in result) {
          toast.error(result.error);
        } else {
          toast.success('Issue created', { description: `${result.key} has been created.` });
          onSaved();
          onOpenChange(false);
        }
      }
    } catch {
      toast.error('Failed to save issue');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${issue?.key}` : 'Create New Issue'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update issue details and attributes.' : 'Create a new issue in a project you have access to.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="issueTitle">Title <span className="text-destructive">*</span></Label>
            <Input
              id="issueTitle"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setErrors({ ...errors, title: '' }); }}
              placeholder="Brief summary of the issue..."
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="issueDesc">Description</Label>
            <Textarea
              id="issueDesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description including steps to reproduce, expected vs actual behavior..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Project <span className="text-destructive">*</span></Label>
              <Select
                value={projectId}
                onValueChange={setProjectId}
                disabled={isEdit}
              >
                <SelectTrigger><SelectValue placeholder="Select project..." /></SelectTrigger>
                <SelectContent>
                  {visibleProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.project && <p className="text-xs text-destructive">{errors.project}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Type <span className="text-destructive">*</span></Label>
              <Select value={type} onValueChange={(v) => setType(v as IssueType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ISSUE_TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Priority <span className="text-destructive">*</span></Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as IssuePriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(ISSUE_PRIORITY_META)).map(([val, meta]) => (
                    <SelectItem key={val} value={val}>{meta.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Severity</Label>
              <Select value={severity || 'none'} onValueChange={(v) => setSeverity(v === 'none' ? '' : v as IssueSeverity)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {ISSUE_SEVERITY_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label} — {s.description}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {(type === 'bug' || type === 'incident' || type === 'security') && (
            <div className="space-y-1.5">
              <Label htmlFor="reproducibility">Reproducibility</Label>
              <Input
                id="reproducibility"
                value={reproducibility}
                onChange={(e) => setReproducibility(e.target.value)}
                placeholder="e.g. Always, Intermittent, Sometimes..."
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Assignee</Label>
              {canAssign ? (
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {eligibleAssignees.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm text-muted-foreground">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {isEdit ? 'Assignment handled separately' : 'You can create issues but cannot assign them'}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Labels</Label>
            <div className="flex gap-2">
              <Input
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLabel(); } }}
                placeholder="Type a label and press Enter..."
              />
              <Button type="button" variant="outline" onClick={addLabel} disabled={!labelInput.trim()}>
                Add
              </Button>
            </div>
            {labels.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {labels.map((label) => (
                  <Badge key={label} variant="secondary" className="gap-1">
                    {label}
                    <button type="button" onClick={() => removeLabel(label)} className="ml-0.5 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Save changes' : 'Create issue'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
