import { useState, useEffect, useMemo } from 'react';
import { userRepo, roleRepo, projectRepo } from '@/lib/repository';
import { projectService } from '@/lib/services';
import { useAuth } from '@/lib/auth-context';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { UserAvatar } from '@/components/shared/user-avatar';
import { Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { Project, ProjectStatus, ProjectPriority, UUID } from '@/lib/types';

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
  onSaved: () => void;
}

const PROJECT_COLORS = ['#2563eb', '#dc2626', '#059669', '#7c3aed', '#d97706', '#0891b2', '#db2777', '#64748b'];
const PROJECT_STATUSES: ProjectStatus[] = ['planning', 'active', 'on_hold', 'completed'];
const PROJECT_PRIORITIES: ProjectPriority[] = ['low', 'medium', 'high', 'critical'];

export function ProjectFormDialog({ open, onOpenChange, project, onSaved }: ProjectFormDialogProps) {
  const { session } = useAuth();
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [objectives, setObjectives] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('planning');
  const [priority, setPriority] = useState<ProjectPriority>('medium');
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [tags, setTags] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [memberIds, setMemberIds] = useState<UUID[]>([]);
  const [developerIds, setDeveloperIds] = useState<UUID[]>([]);
  const [assignerIds, setAssignerIds] = useState<UUID[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const allUsers = useMemo(() => userRepo.all().filter((u) => u.status === 'active'), []);
  const roles = useMemo(() => roleRepo.all(), []);

  useEffect(() => {
    if (open) {
      if (project) {
        setName(project.name);
        setKey(project.key);
        setDescription(project.description);
        setObjectives(project.objectives || '');
        setStatus(project.status);
        setPriority(project.priority);
        setColor(project.color);
        setStartDate(project.startDate.split('T')[0]);
        setDueDate(project.dueDate ? project.dueDate.split('T')[0] : '');
        setTags(project.tags.join(', '));
        setOwnerId(project.ownerId);
        setMemberIds([...project.memberIds]);
        setDeveloperIds([...project.developerIds]);
        setAssignerIds([...project.assignerIds]);
      } else {
        setName('');
        setKey('');
        setDescription('');
        setObjectives('');
        setStatus('planning');
        setPriority('medium');
        setColor(PROJECT_COLORS[0]);
        const today = new Date().toISOString().split('T')[0];
        setStartDate(today);
        setDueDate('');
        setTags('');
        setOwnerId(session?.user.id || '');
        setMemberIds(session?.user.id ? [session.user.id] : []);
        setDeveloperIds([]);
        setAssignerIds([]);
      }
      setErrors({});
    }
  }, [open, project, session]);

  const generateKey = (name: string) => {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '';
    if (words.length === 1) return words[0].slice(0, 4).toUpperCase();
    return (words[0][0] + words[1].slice(0, 3)).toUpperCase();
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (!project && !key) {
      setKey(generateKey(val));
    }
  };

  const toggleMember = (userId: UUID) => {
    setMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
    setDeveloperIds((prev) => prev.filter((id) => id !== userId));
    setAssignerIds((prev) => prev.filter((id) => id !== userId));
  };

  const toggleDeveloper = (userId: UUID) => {
    if (!memberIds.includes(userId)) return;
    setDeveloperIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleAssigner = (userId: UUID) => {
    if (!memberIds.includes(userId)) return;
    setAssignerIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Project name is required';
    if (!key.trim()) errs.key = 'Project key is required';
    else if (key.length < 2 || key.length > 6) errs.key = 'Key must be 2-6 characters';
    else {
      const upperKey = key.trim().toUpperCase();
      const existing = projectRepo.findByKey(upperKey);
      if (existing && existing.id !== project?.id) errs.key = 'A project with this key already exists';
    }
    if (!description.trim()) errs.description = 'Description is required';
    if (!ownerId) errs.owner = 'Project owner is required';
    if (!startDate) errs.startDate = 'Start date is required';
    if (memberIds.length === 0) errs.members = 'At least one member is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !session) return;

    setSaving(true);
    try {
      const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
      const data = {
        name: name.trim(),
        key: key.trim().toUpperCase(),
        description: description.trim(),
        objectives: objectives.trim(),
        status,
        priority,
        ownerId,
        memberIds,
        developerIds,
        assignerIds,
        tags: tagList,
        color,
        startDate: new Date(startDate).toISOString(),
        dueDate: dueDate ? new Date(dueDate).toISOString() : new Date().toISOString(),
      };

      if (project) {
        projectService.update(project.id, data, session.user.id);
        toast.success('Project updated', { description: `${name.trim()} has been saved.` });
      } else {
        projectService.create(data, session.user.id);
        toast.success('Project created', { description: `${name.trim()} has been created with a default group.` });
      }
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error('Failed to save project');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{project ? `Edit Project: ${project.name}` : 'Create New Project'}</DialogTitle>
          <DialogDescription>
            {project
              ? 'Update project details, membership, and settings.'
              : 'Create a new project. A default group will be automatically created for team discussions.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Basic info */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="projName">Project name <span className="text-destructive">*</span></Label>
              <Input
                id="projName"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Atlas Platform"
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="projKey">Project key <span className="text-destructive">*</span></Label>
              <Input
                id="projKey"
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="e.g. ATL"
              />
              {errors.key && <p className="text-xs text-destructive">{errors.key}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Project color</Label>
              <div className="flex flex-wrap gap-2">
                {PROJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-8 w-8 rounded-lg transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-foreground scale-110' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="projDesc">Description <span className="text-destructive">*</span></Label>
            <Textarea
              id="projDesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the project..."
              rows={2}
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="projObj">Objectives</Label>
            <Textarea
              id="projObj"
              value={objectives}
              onChange={(e) => setObjectives(e.target.value)}
              placeholder="Project goals and objectives..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as ProjectPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROJECT_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="projTags">Tags</Label>
              <Input
                id="projTags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="platform, data"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="projStart">Start date <span className="text-destructive">*</span></Label>
              <Input id="projStart" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              {errors.startDate && <p className="text-xs text-destructive">{errors.startDate}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="projDue">Due date</Label>
              <Input id="projDue" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Project owner <span className="text-destructive">*</span></Label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger><SelectValue placeholder="Select owner..." /></SelectTrigger>
              <SelectContent>
                {allUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name} ({u.title || 'User'})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.owner && <p className="text-xs text-destructive">{errors.owner}</p>}
          </div>

          <Separator />

          {/* Members */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Project Members
              </h3>
              {errors.members && (
                <span className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />{errors.members}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Check users to add them as project members. Members with Developer or Issue Assigner roles can be assigned specialized functions below.
            </p>
            <ScrollArea className="h-[200px] rounded-lg border">
              <div className="divide-y">
                {allUsers.map((u) => {
                  const userRoles = u.roleIds.map((rid) => roles.find((r) => r.id === rid)).filter(Boolean);
                  const isDev = userRoles.some((r) => r?.name === 'Developer');
                  const isAssigner = userRoles.some((r) => r?.name === 'Issue Assigner');
                  const isMember = memberIds.includes(u.id);
                  return (
                    <div key={u.id} className="flex items-center gap-3 px-3 py-2.5">
                      <Checkbox checked={isMember} onCheckedChange={() => toggleMember(u.id)} />
                      <UserAvatar name={u.name} color={u.avatarColor} image={u.avatarUrl} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{u.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{u.title || '—'}</div>
                      </div>
                      {isMember && isDev && (
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <Checkbox checked={developerIds.includes(u.id)} onCheckedChange={() => toggleDeveloper(u.id)} />
                          Dev
                        </label>
                      )}
                      {isMember && isAssigner && (
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <Checkbox checked={assignerIds.includes(u.id)} onCheckedChange={() => toggleAssigner(u.id)} />
                          Assigner
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          <Separator />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {project ? 'Save changes' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
