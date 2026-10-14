import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { projectRepo, userRepo } from '@/lib/repository';
import { groupService, getVisibleProjects } from '@/lib/services';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { UserAvatar } from '@/components/shared/user-avatar';
import { Loader2, Lock, EyeOff, Search, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { UUID } from '@/lib/types';

interface GroupFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function GroupFormDialog({ open, onOpenChange, onSaved }: GroupFormDialogProps) {
  const { session } = useAuth();
  const [name, setName] = useState('');
  const [groupType, setGroupType] = useState<'private' | 'secret'>('private');
  const [projectId, setProjectId] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<UUID[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const visibleProjects = useMemo(() => {
    if (!session) return [];
    return getVisibleProjects(session.user.id).filter((p) => p.status !== 'archived');
  }, [session]);

  useEffect(() => {
    if (open) {
      setName('');
      setGroupType('private');
      setProjectId('');
      setSelectedMembers(session ? [session.user.id] : []);
      setMemberSearch('');
      setErrors({});
    }
  }, [open, session]);

  const projectMembers = useMemo(() => {
    if (!projectId) return [];
    const project = projectRepo.find(projectId);
    if (!project) return [];
    return project.memberIds
      .map((id) => userRepo.find(id))
      .filter((u): u is NonNullable<typeof u> => u !== undefined);
  }, [projectId]);

  const filteredMembers = useMemo(() => {
    if (!memberSearch) return projectMembers;
    const q = memberSearch.toLowerCase();
    return projectMembers.filter((u) =>
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) ||
      (u.title || '').toLowerCase().includes(q)
    );
  }, [projectMembers, memberSearch]);

  const toggleMember = (userId: UUID) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Group name is required';
    if (!projectId) errs.project = 'Project is required';
    if (selectedMembers.length === 0) errs.members = 'At least one member is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !session) return;

    setSaving(true);
    try {
      const group = groupService.create(
        { name: name.trim(), projectId, type: groupType, memberIds: selectedMembers },
        session.user.id
      );
      if (group) {
        toast.success('Group created', { description: `${name.trim()} has been created.` });
        onSaved();
        onOpenChange(false);
      } else {
        toast.error('Failed to create group');
      }
    } catch {
      toast.error('Failed to create group');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Group</DialogTitle>
          <DialogDescription>
            Create a private or secret group within a project for focused discussions.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="groupName">Group name <span className="text-destructive">*</span></Label>
            <Input
              id="groupName"
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors({ ...errors, name: '' }); }}
              placeholder="e.g. Security Review Team"
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Project <span className="text-destructive">*</span></Label>
            <Select
              value={projectId}
              onValueChange={(v) => { setProjectId(v); setSelectedMembers(session ? [session.user.id] : []); }}
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
            <Label>Group type</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGroupType('private')}
                className={`flex items-start gap-2 rounded-lg border p-3 text-left transition-all ${groupType === 'private' ? 'border-primary ring-1 ring-primary bg-primary/5' : 'hover:bg-muted/50'}`}
              >
                <Lock className="h-4 w-4 mt-0.5 text-amber-600" />
                <div>
                  <div className="text-sm font-medium">Private</div>
                  <div className="text-xs text-muted-foreground">Visible to project members, content for group members only</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setGroupType('secret')}
                className={`flex items-start gap-2 rounded-lg border p-3 text-left transition-all ${groupType === 'secret' ? 'border-primary ring-1 ring-primary bg-primary/5' : 'hover:bg-muted/50'}`}
              >
                <EyeOff className="h-4 w-4 mt-0.5 text-rose-600" />
                <div>
                  <div className="text-sm font-medium">Secret</div>
                  <div className="text-xs text-muted-foreground">Invisible to anyone who is not a member</div>
                </div>
              </button>
            </div>
          </div>

          {/* Member selection */}
          {projectId && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Members <span className="text-destructive">*</span></Label>
                <span className="text-xs text-muted-foreground">{selectedMembers.length} selected</span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search project members..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <ScrollArea className="h-[200px] rounded-lg border">
                {filteredMembers.length === 0 ? (
                  <div className="text-center py-6 text-sm text-muted-foreground">No eligible members found.</div>
                ) : (
                  <div className="divide-y">
                    {filteredMembers.map((u) => (
                      <div key={u.id} className="flex items-center gap-3 px-3 py-2.5">
                        <Checkbox
                          checked={selectedMembers.includes(u.id)}
                          onCheckedChange={() => toggleMember(u.id)}
                        />
                        <UserAvatar name={u.name} color={u.avatarColor} image={u.avatarUrl} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{u.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{u.title || '—'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              {errors.members && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />{errors.members}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create group
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
