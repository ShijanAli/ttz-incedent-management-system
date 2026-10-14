import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { userRepo, roleRepo } from '@/lib/repository';
import { projectService, getProjectMemberRole, normalizeProjectRole } from '@/lib/services';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { UserAvatar } from '@/components/shared/user-avatar';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Search, UserPlus, UserMinus, Loader2, Pencil, Check, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { DEFAULT_PROJECT_ROLES, DEFAULT_PROJECT_ROLE } from '@/lib/types';
import type { Project, UUID } from '@/lib/types';

interface MemberManagerProps {
  project: Project;
  onUpdated: () => void;
}

export function MemberManager({ project, onUpdated }: MemberManagerProps) {
  const { session } = useAuth();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [pending, setPending] = useState<UUID | null>(null);
  const [addRoleByUser, setAddRoleByUser] = useState<Record<UUID, string>>({});
  const [editingRoleFor, setEditingRoleFor] = useState<UUID | null>(null);
  const [editRoleValue, setEditRoleValue] = useState('');
  const [editRoleCustom, setEditRoleCustom] = useState(false);

  const allUsers = useMemo(() => userRepo.all().filter((u) => u.status === 'active'), []);
  const roles = useMemo(() => roleRepo.all(), []);

  const nonMembers = useMemo(() => {
    return allUsers.filter((u) => !project.memberIds.includes(u.id));
  }, [allUsers, project.memberIds]);

  const filteredNonMembers = useMemo(() => {
    if (!search) return nonMembers;
    const q = search.toLowerCase();
    return nonMembers.filter((u) =>
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) ||
      (u.title || '').toLowerCase().includes(q)
    );
  }, [nonMembers, search]);

  const members = useMemo(() => {
    return project.memberIds
      .map((id) => userRepo.find(id))
      .filter((u): u is NonNullable<typeof u> => u !== undefined);
  }, [project.memberIds]);

  const memberRoles = useMemo(() => {
    const map: Record<UUID, string> = {};
    for (const m of members) {
      map[m.id] = getProjectMemberRole(project.id, m.id);
    }
    return map;
  }, [project.id, members]);

  const uniqueProjectRoles = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => set.add(memberRoles[m.id] || DEFAULT_PROJECT_ROLE));
    return Array.from(set).sort();
  }, [members, memberRoles]);

  const filteredMembers = useMemo(() => {
    if (roleFilter === 'all') return members;
    return members.filter((m) => (memberRoles[m.id] || DEFAULT_PROJECT_ROLE) === roleFilter);
  }, [members, memberRoles, roleFilter]);

  const handleAdd = (userId: UUID) => {
    if (!session) return;
    setPending(userId);
    const role = addRoleByUser[userId] || DEFAULT_PROJECT_ROLE;
    projectService.addMember(project.id, userId, session.user.id, role);
    const user = userRepo.find(userId);
    toast.success(`${user?.name || 'User'} added to ${project.name} as ${normalizeProjectRole(role)}`);
    setAddRoleByUser((prev) => { const next = { ...prev }; delete next[userId]; return next; });
    onUpdated();
    setPending(null);
  };

  const handleRemove = (userId: UUID) => {
    if (!session) return;
    if (userId === project.ownerId) {
      toast.error('Cannot remove the project owner');
      return;
    }
    setPending(userId);
    projectService.removeMember(project.id, userId, session.user.id);
    const user = userRepo.find(userId);
    toast.success(`${user?.name || 'User'} removed from ${project.name}`);
    onUpdated();
    setPending(null);
  };

  const toggleDeveloper = (userId: UUID) => {
    if (!session) return;
    const isDev = project.developerIds.includes(userId);
    projectService.setDeveloper(project.id, userId, !isDev);
    onUpdated();
  };

  const toggleAssigner = (userId: UUID) => {
    if (!session) return;
    const isAssigner = project.assignerIds.includes(userId);
    projectService.setAssigner(project.id, userId, !isAssigner);
    onUpdated();
  };

  const handleStartEdit = (userId: UUID) => {
    const currentRole = memberRoles[userId] || DEFAULT_PROJECT_ROLE;
    setEditRoleValue(currentRole);
    setEditRoleCustom(!DEFAULT_PROJECT_ROLES.some((r) => r.toLowerCase() === currentRole.toLowerCase()));
    setEditingRoleFor(userId);
  };

  const handleCancelEdit = () => {
    setEditingRoleFor(null);
    setEditRoleValue('');
    setEditRoleCustom(false);
  };

  const handleSaveRole = (userId: UUID) => {
    if (!session) return;
    const role = editRoleCustom ? editRoleValue : editRoleValue;
    if (!role.trim()) {
      toast.error('Project role cannot be empty');
      return;
    }
    const normalized = normalizeProjectRole(role);
    projectService.updateMemberRole(project.id, userId, normalized, session.user.id);
    toast.success('Project role updated');
    handleCancelEdit();
    onUpdated();
  };

  const getUserRoles = (userId: UUID) => {
    const u = userRepo.find(userId);
    if (!u) return [];
    return u.roleIds.map((rid) => roles.find((r) => r.id === rid)).filter(Boolean);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Current members */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Current Members ({members.length})
            </h3>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-8 w-auto min-w-[140px] text-xs">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {uniqueProjectRoles.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {filteredMembers.length === 0 && members.length > 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No members match this role filter.
                </div>
              )}
              {filteredMembers.map((m) => {
                const userRoles = getUserRoles(m.id);
                const isDev = project.developerIds.includes(m.id);
                const isAssigner = project.assignerIds.includes(m.id);
                const isOwner = project.ownerId === m.id;
                const projectRole = memberRoles[m.id] || DEFAULT_PROJECT_ROLE;
                const isEditing = editingRoleFor === m.id;
                return (
                  <div key={m.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={m.name} color={m.avatarColor} image={m.avatarUrl} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{m.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {userRoles.map((r) => r?.name).filter(Boolean).join(', ') || '—'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isOwner && <Badge variant="outline" className="text-xs">Owner</Badge>}
                        {userRoles.some((r) => r?.name === 'Developer') && (
                          <label className="flex items-center gap-1 text-xs cursor-pointer" title="Developer role">
                            <Checkbox checked={isDev} onCheckedChange={() => toggleDeveloper(m.id)} />
                            Dev
                          </label>
                        )}
                        {userRoles.some((r) => r?.name === 'Issue Assigner') && (
                          <label className="flex items-center gap-1 text-xs cursor-pointer" title="Issue Assigner role">
                            <Checkbox checked={isAssigner} onCheckedChange={() => toggleAssigner(m.id)} />
                            Assigner
                          </label>
                        )}
                        {!isOwner && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemove(m.id)}
                            disabled={pending === m.id}
                          >
                            {pending === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserMinus className="h-3.5 w-3.5" />}
                          </Button>
                        )}
                      </div>
                    </div>
                    {/* Project-specific role display/edit */}
                    <div className="flex items-center gap-2 pl-11">
                      {isEditing ? (
                        <div className="flex items-center gap-2 w-full">
                          {editRoleCustom ? (
                            <Input
                              value={editRoleValue}
                              onChange={(e) => setEditRoleValue(e.target.value)}
                              placeholder="Enter custom role..."
                              className="h-7 text-xs flex-1"
                              autoFocus
                            />
                          ) : (
                            <Select
                              value={editRoleValue}
                              onValueChange={(v) => {
                                if (v === '__custom__') {
                                  setEditRoleCustom(true);
                                  setEditRoleValue('');
                                } else {
                                  setEditRoleValue(v);
                                }
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs flex-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DEFAULT_PROJECT_ROLES.map((r) => (
                                  <SelectItem key={r} value={r}>{r}</SelectItem>
                                ))}
                                <Separator className="my-1" />
                                <SelectItem value="__custom__">Custom...</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          <Button
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleSaveRole(m.id)}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={handleCancelEdit}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 w-full">
                          <Badge variant="secondary" className="text-xs font-normal">
                            {projectRole}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-muted-foreground"
                            onClick={() => handleStartEdit(m.id)}
                          >
                            <Pencil className="mr-1 h-3 w-3" />
                            Edit role
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Add members */}
      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Add Members
          </h3>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search users to add..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <ScrollArea className="h-[350px]">
            {filteredNonMembers.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {nonMembers.length === 0 ? 'All active users are already members.' : 'No users match your search.'}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredNonMembers.map((u) => (
                  <div key={u.id} className="rounded-lg border p-2.5 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={u.name} color={u.avatarColor} image={u.avatarUrl} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{u.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{u.title || '—'}</div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2 pl-11">
                      {addRoleByUser[u.id] === '' ? (
                        <Input
                          placeholder="Enter custom role..."
                          value={addRoleByUser[u.id]}
                          onChange={(e) => setAddRoleByUser((prev) => ({ ...prev, [u.id]: e.target.value }))}
                          className="h-7 text-xs flex-1"
                          autoFocus
                        />
                      ) : (
                        <Select
                          value={addRoleByUser[u.id] || DEFAULT_PROJECT_ROLE}
                          onValueChange={(v) => {
                            if (v === '__custom__') {
                              setAddRoleByUser((prev) => ({ ...prev, [u.id]: '' }));
                            } else {
                              setAddRoleByUser((prev) => ({ ...prev, [u.id]: v }));
                            }
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DEFAULT_PROJECT_ROLES.map((r) => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                            <Separator className="my-1" />
                            <SelectItem value="__custom__">Custom...</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7"
                        onClick={() => handleAdd(u.id)}
                        disabled={pending === u.id || addRoleByUser[u.id] === ''}
                      >
                        {pending === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="mr-1 h-3.5 w-3.5" />}
                        Add
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <Separator className="my-3" />
          <p className="text-xs text-muted-foreground">
            Adding a member also adds them to the project&apos;s default group. Removing a member syncs the default group automatically.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
