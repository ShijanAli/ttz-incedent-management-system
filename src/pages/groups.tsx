import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/lib/auth-context';
import { projectRepo, userRepo, groupRepo, messageRepo } from '@/lib/repository';
import { getVisibleGroups, getGroupUnreadCount, groupService } from '@/lib/services';
import { PageHeader } from '@/components/shared/page-header';
import { GroupFormDialog } from '@/components/groups/group-form-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/shared/user-avatar';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  Plus, Search, MoreVertical, Trash2, MessageSquare, Lock, EyeOff, Users as UsersIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatRelativeTime, GROUP_TYPE_META } from '@/lib/shared-utils';
import type { Group } from '@/lib/types';

export default function GroupsPage() {
  const navigate = useNavigate();
  const { session, hasPermission } = useAuth();
  const [groups, setGroups] = useState<Group[]>(() =>
    session ? getVisibleGroups(session.user.id) : []
  );
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Group | null>(null);

  const allProjects = useMemo(() => projectRepo.all(), []);
  const allUsers = useMemo(() => userRepo.all(), []);

  const refresh = () => {
    if (session) setGroups(getVisibleGroups(session.user.id));
  };

  const filtered = useMemo(() => {
    return groups.filter((g) => {
      if (search) {
        const q = search.toLowerCase();
        const project = allProjects.find((p) => p.id === g.projectId);
        if (!g.name.toLowerCase().includes(q) && !(project?.name.toLowerCase().includes(q))) return false;
      }
      if (typeFilter !== 'all' && g.type !== typeFilter) return false;
      if (projectFilter !== 'all' && g.projectId !== projectFilter) return false;
      return true;
    });
  }, [groups, search, typeFilter, projectFilter, allProjects]);

  const handleDelete = (group: Group) => {
    if (group.type === 'default') {
      toast.error('Cannot delete default group', { description: 'Default groups are managed by project membership.' });
      return;
    }
    setConfirmDelete(group);
  };

  const doDelete = () => {
    if (!confirmDelete || !session) return;
    groupService.delete(confirmDelete.id, session.user.id);
    toast.success('Group deleted');
    refresh();
  };

  const canCreate = hasPermission('groups.create');
  const canDelete = hasPermission('groups.delete');

  const getProjectName = (projectId: string) => allProjects.find((p) => p.id === projectId)?.name || 'Unknown';
  const getMemberCount = (group: Group) => group.memberIds.length;
  const getLastMessage = (groupId: string) => {
    const msgs = messageRepo.byGroup(groupId);
    if (msgs.length === 0) return null;
    return msgs[msgs.length - 1];
  };

  const groupIcon = (type: string) => {
    if (type === 'default') return <MessageSquare className="h-5 w-5 text-primary" />;
    if (type === 'private') return <Lock className="h-5 w-5 text-amber-600" />;
    return <EyeOff className="h-5 w-5 text-rose-600" />;
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Groups"
        description="Team discussions and collaboration spaces within projects."
        breadcrumbs={[{ label: 'Groups' }]}
        actions={
          canCreate && (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Group
            </Button>
          )
        }
      />

      <Card>
        <CardContent className="p-4">
          {/* Filters */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search groups..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="secret">Secret</SelectItem>
              </SelectContent>
            </Select>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {allProjects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-sm text-muted-foreground ml-auto">
              {filtered.length} group{filtered.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Group cards */}
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No groups found. {canCreate && 'Create one to start a discussion.'}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((group) => {
                const typeMeta = GROUP_TYPE_META[group.type];
                const lastMsg = getLastMessage(group.id);
                const lastSender = lastMsg ? allUsers.find((u) => u.id === lastMsg.senderId) : null;
                const unread = session ? getGroupUnreadCount(group.id, session.user.id) : 0;
                return (
                  <div
                    key={group.id}
                    className="group relative rounded-xl border p-4 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => navigate(`/groups/${group.id}`)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
                        {groupIcon(group.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-sm truncate">{group.name}</h3>
                          {unread > 0 && (
                            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                              {unread}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground truncate">{getProjectName(group.projectId)}</div>
                      </div>
                      {canDelete && group.type !== 'default' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => handleDelete(group)} className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete group
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <StatusBadge label={typeMeta.label} className={typeMeta.badgeClass} />
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <UsersIcon className="h-3.5 w-3.5" />
                        {getMemberCount(group)}
                      </div>
                    </div>

                    {lastMsg && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center gap-2">
                          {lastSender && <UserAvatar name={lastSender.name} color={lastSender.avatarColor} image={lastSender.avatarUrl} size="xs" />}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs truncate">
                              <span className="font-medium">{lastSender?.name.split(' ')[0] || 'Unknown'}: </span>
                              <span className="text-muted-foreground">{lastMsg.body}</span>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">{formatRelativeTime(lastMsg.createdAt)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <GroupFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={refresh}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title="Delete group"
        description={`Delete "${confirmDelete?.name}"? All messages in this group will be permanently removed.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={doDelete}
      />
    </div>
  );
}
