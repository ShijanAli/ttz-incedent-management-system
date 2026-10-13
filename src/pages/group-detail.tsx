import { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '@/lib/auth-context';
import { projectRepo, userRepo, groupRepo, messageRepo } from '@/lib/repository';
import { canUserViewGroup, groupService, getEligibleMembersForGroup } from '@/lib/services';
import { PageHeader } from '@/components/shared/page-header';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserAvatar } from '@/components/shared/user-avatar';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  Send, UserPlus, UserMinus, AlertCircle,
  Lock, EyeOff, MessageSquare, Users as UsersIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatRelativeTime, GROUP_TYPE_META } from '@/lib/shared-utils';
import type { GroupMessage, UUID } from '@/lib/types';

export default function GroupDetailPage() {
  const id = useParams().id as string;
  const { session, hasPermission } = useAuth();
  const group = useMemo(() => groupRepo.find(id), [id]);
  const [messages, setMessages] = useState<GroupMessage[]>(() => messageRepo.byGroup(id));
  const [input, setInput] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<UUID | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const project = useMemo(() => (group ? projectRepo.find(group.projectId) : undefined), [group]);
  const allUsers = useMemo(() => userRepo.all(), []);
  const canManage = hasPermission('groups.manage_members');
  const canSend = hasPermission('groups.send_message');

  const eligibleToAdd = useMemo(() => {
    if (!group) return [];
    const eligible = getEligibleMembersForGroup(group);
    return eligible.filter((u) => !group.memberIds.includes(u.id));
  }, [group]);

  // Mark messages as read on load
  useEffect(() => {
    if (session && group && group.memberIds.includes(session.user.id)) {
      groupService.markRead(group.id, session.user.id);
    }
  }, [session, group, id]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!group) {
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="Group not found"
          breadcrumbs={[{ label: 'Groups', href: '/groups' }, { label: 'Not Found' }]}
        />
        <Card className="p-8 text-center text-muted-foreground">
          The group you are looking for does not exist.
          <div className="mt-4">
            <Button variant="outline" onClick={() => window.history.back()}>
              Go Back
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (session && !canUserViewGroup(session.user.id, group)) {
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="Access restricted"
          breadcrumbs={[{ label: 'Groups', href: '/groups' }, { label: 'Group' }]}
        />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">You don&apos;t have access to this group</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {group.type === 'secret'
                ? 'This is a secret group. Only members can see it.'
                : 'You must be a member of this group to view it.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If user can view but is not a member (private group, project member but not group member)
  const isMember = session ? group.memberIds.includes(session.user.id) : false;
  const canViewContent = isMember;

  const refresh = () => setMessages(messageRepo.byGroup(id));

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !session || !isMember) return;
    groupService.sendMessage(group.id, session.user.id, input.trim());
    setInput('');
    refresh();
  };

  const getSender = (senderId: string) => allUsers.find((u) => u.id === senderId);
  const typeMeta = GROUP_TYPE_META[group.type];

  const handleAddMember = (userId: UUID) => {
    if (!session) return;
    groupService.addMember(group.id, userId, session.user.id);
    toast.success('Member added');
    refresh();
  };

  const handleRemoveMember = (userId: UUID) => {
    setConfirmRemove(userId);
  };

  const doRemoveMember = () => {
    if (!confirmRemove || !session) return;
    groupService.removeMember(group.id, confirmRemove, session.user.id);
    toast.success('Member removed');
    setConfirmRemove(null);
    refresh();
  };

  const groupMembers = group.memberIds
    .map((mid) => allUsers.find((u) => u.id === mid))
    .filter((u): u is NonNullable<typeof u> => u !== undefined);

  const groupIcon = group.type === 'default' ? <MessageSquare className="h-5 w-5 text-primary" /> :
    group.type === 'private' ? <Lock className="h-5 w-5 text-amber-600" /> :
    <EyeOff className="h-5 w-5 text-rose-600" />;

  const removingUser = confirmRemove ? allUsers.find((u) => u.id === confirmRemove) : null;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={group.name}
        description={typeMeta.description}
        breadcrumbs={[
          { label: 'Groups', href: '/groups' },
          { label: group.name },
        ]}
        actions={
          canManage && group.type !== 'default' && (
            <Button variant="outline" onClick={() => setShowAddMember(!showAddMember)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Member
            </Button>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        {/* Chat area */}
        <Card className="flex flex-col h-[calc(100vh-280px)] min-h-[400px]">
          {/* Chat header */}
          <div className="flex items-center gap-3 border-b p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              {groupIcon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-sm truncate">{group.name}</h2>
                <StatusBadge label={typeMeta.label} className={typeMeta.badgeClass} />
              </div>
              {project && (
                <Link to={`/projects/${project.id}`} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                  {project.name}
                </Link>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <UsersIcon className="h-3.5 w-3.5" />
              {group.memberIds.length}
            </div>
          </div>

          {/* Messages or access-denied */}
          {!canViewContent ? (
            <div className="flex flex-1 flex-col items-center justify-center">
              <Lock className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Join this group to see the conversation.</p>
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                    <MessageSquare className="mb-3 h-10 w-10" />
                    <p className="text-sm">No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const sender = getSender(msg.senderId);
                    const isOwn = session?.user.id === msg.senderId;
                    return (
                      <div key={msg.id} className={`flex gap-2.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
                        {sender ? (
                          <UserAvatar name={sender.name} color={sender.avatarColor} size="sm" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-muted" />
                        )}
                        <div className={`max-w-[70%] ${isOwn ? 'items-end' : ''} flex flex-col`}>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-medium">{isOwn ? 'You' : sender?.name || 'Unknown'}</span>
                            <span className="text-xs text-muted-foreground">{formatRelativeTime(msg.createdAt)}</span>
                          </div>
                          <div
                            className={`rounded-2xl px-3.5 py-2 text-sm ${
                              isOwn
                                ? 'bg-primary text-primary-foreground rounded-br-md'
                                : 'bg-muted rounded-bl-md'
                            }`}
                          >
                            {msg.body}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Input */}
              {isMember && canSend ? (
                <form onSubmit={handleSend} className="border-t p-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1"
                    />
                    <Button type="submit" size="icon" disabled={!input.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="border-t p-3 text-center text-xs text-muted-foreground">
                  {!isMember ? 'You are not a member of this group.' : 'You do not have permission to send messages.'}
                </div>
              )}
            </>
          )}
        </Card>

        {/* Sidebar: members + add member panel */}
        <div className="space-y-4">
          {showAddMember && canManage && group.type !== 'default' && (
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-3 text-sm font-semibold">Add Members</h3>
                {eligibleToAdd.length === 0 ? (
                  <p className="text-sm text-muted-foreground">All project members are already in this group.</p>
                ) : (
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-1">
                      {eligibleToAdd.map((u) => (
                        <div key={u.id} className="flex items-center gap-2 rounded-lg border p-2">
                          <UserAvatar name={u.name} color={u.avatarColor} size="xs" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">{u.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{u.title || '—'}</div>
                          </div>
                          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => handleAddMember(u.id)}>
                            <UserPlus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Members ({groupMembers.length})
              </h3>
              <div className="space-y-2">
                {groupMembers.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 group">
                    <UserAvatar name={m.name} color={m.avatarColor} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{m.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{m.title || '—'}</div>
                    </div>
                    {canManage && group.type !== 'default' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveMember(m.id)}
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {project && (
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Project</h3>
                <Link to={`/projects/${project.id}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg text-white text-xs font-bold" style={{ backgroundColor: project.color }}>
                    {project.key.slice(0, 3)}
                  </div>
                  <div className="text-sm font-medium">{project.name}</div>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmRemove}
        onOpenChange={(open) => { if (!open) setConfirmRemove(null); }}
        title="Remove member"
        description={`Remove ${removingUser?.name || 'this user'} from "${group.name}"? They will lose access to the conversation.`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={doRemoveMember}
      />
    </div>
  );
}
