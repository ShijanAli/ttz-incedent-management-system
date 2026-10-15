import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  AlertCircle, Calendar, FolderKanban, Loader2, Pencil, Power, PowerOff, Trash2, Users as UsersIcon, UsersRound,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useTabParam } from '@/hooks/use-tab-param';
import { parseApiError } from '@/lib/api-error';
import { formatDate, isOverdue } from '@/lib/shared-utils';
import {
  getProjectColor, getProjectInitials, getProjectPriorityMeta, getProjectStateMeta,
} from '@/lib/project-utils';
import {
  useAddGroupMemberMutation,
  useChangeGroupMemberRoleMutation,
  useGetGroupMembersQuery,
  useGetGroupProjectsQuery,
  useGetGroupQuery,
  useRemoveGroupMemberMutation,
} from '@/redux/features/groups/groups-api';
import type { GroupDetail } from '@/redux/features/groups/groups-types';
import { PageHeader } from '@/components/shared/page-header';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { StatusBadge } from '@/components/shared/status-badge';
import { MemberManager } from '@/components/members/member-manager';
import { GroupFormDialog } from '@/components/groups/group-form-dialog';
import { GroupStatusBadge } from '@/components/groups/group-status-badge';
import { useGroupActions } from '@/components/groups/use-group-actions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const GROUP_TABS = ['members', 'projects'] as const;

export default function GroupDetailPage() {
  const id = Number(useParams().id);
  const { data: group, isLoading, isError, error, refetch } = useGetGroupQuery(id, { skip: !Number.isFinite(id) });

  if (isLoading) return <GroupDetailSkeleton />;

  if (isError || !group) {
    const apiError = parseApiError(error, 'Failed to load the group.');
    const forbidden = apiError.status === 403;
    const notFound = apiError.status === 404 || !Number.isFinite(id);
    return (
      <div className="animate-fade-in">
        <PageHeader
          title={forbidden ? 'Access restricted' : notFound ? 'Group not found' : 'Something went wrong'}
          breadcrumbs={[{ label: 'Groups', href: '/groups' }, { label: forbidden ? 'Restricted' : 'Not Found' }]}
        />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">
              {forbidden
                ? "You don't have access to this group"
                : notFound ? 'The group you are looking for does not exist.' : apiError.message}
            </h3>
            <div className="mt-4 flex gap-2">
              {!forbidden && !notFound && <Button variant="outline" onClick={() => refetch()}>Retry</Button>}
              <Button variant="outline" asChild>
                <Link to="/groups">Back to groups</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <GroupDetailView group={group} />;
}

function GroupDetailView({ group }: { group: GroupDetail }) {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const actions = useGroupActions({ onDeleted: () => navigate('/groups', { replace: true }) });
  const [tab, setTab] = useTabParam(GROUP_TABS, 'members');

  const members = useGetGroupMembersQuery(group.id);
  const [addMember] = useAddGroupMemberMutation();
  const [changeRole] = useChangeGroupMemberRoleMutation();
  const [removeMember] = useRemoveGroupMemberMutation();
  const groupId = group.id;

  const canUpdate = hasPermission('groups.update');
  const canDelete = hasPermission('groups.delete');
  const canManageMembers = hasPermission('groups.manage_members');

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={group.name}
        description={group.description ?? undefined}
        breadcrumbs={[
          { label: 'Groups', href: '/groups' },
          { label: group.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {canUpdate && (
              <>
                <Button variant="outline" onClick={() => setEditOpen(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                {group.is_active ? (
                  <Button variant="outline" onClick={() => actions.request(group, 'deactivate')} className="text-amber-600">
                    <PowerOff className="mr-2 h-4 w-4" />
                    Deactivate
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => actions.request(group, 'activate')} className="text-emerald-600">
                    <Power className="mr-2 h-4 w-4" />
                    Activate
                  </Button>
                )}
              </>
            )}
            {canDelete && (
              <Button variant="outline" onClick={() => actions.request(group, 'delete')} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        }
      />

      {/* Group header card */}
      <Card className="mb-6">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl',
                group.is_active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
              )}
            >
              <UsersRound className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <GroupStatusBadge active={group.is_active} />
              <p className="max-w-2xl text-sm text-muted-foreground">{group.description || 'No description.'}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:items-end">
            <span className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4" />
              {group.member_count} member{group.member_count !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4" />
              {group.projects.length} project{group.projects.length !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Created {formatDate(group.created_at)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2 sm:w-[360px]">
          <TabsTrigger value="members">Members ({group.member_count})</TabsTrigger>
          <TabsTrigger value="projects">Projects ({group.projects.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <MemberManager
            entityName={group.name}
            members={members.data ?? []}
            isLoading={members.isLoading}
            error={members.error}
            onRetry={members.refetch}
            canManage={canManageMembers}
            onAdd={(userId, role) => addMember({ groupId, user_id: userId, ...(role && { role }) }).unwrap()}
            onChangeRole={(userId, role) => changeRole({ groupId, userId, role }).unwrap()}
            onRemove={(userId) => removeMember({ groupId, userId }).unwrap()}
            removeWarning="They will lose any project access they had only through this group."
            footnote={'Leave the role on "User\'s default role" to use the role from their account. Members get this role in every project the group is attached to.'}
          />
        </TabsContent>

        <TabsContent value="projects">
          <GroupProjects groupId={group.id} />
        </TabsContent>
      </Tabs>

      <GroupFormDialog open={editOpen} onOpenChange={setEditOpen} group={group} />
      <ConfirmDialog {...actions.dialogProps} />
    </div>
  );
}

/** Projects this group is attached to, from GET /admin/groups/{id}/projects */
function GroupProjects({ groupId }: { groupId: number }) {
  const { data: projects = [], isLoading, error, refetch } = useGetGroupProjectsQuery(groupId);

  return (
    <Card>
      <CardContent className="p-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          </div>
        ) : error ? (
          <div className="py-8 text-center text-sm">
            <p className="text-destructive">{parseApiError(error, 'Failed to load projects.').message}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : projects.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">This group isn't attached to any project.</div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => {
              const stateMeta = getProjectStateMeta(project.status);
              const priorityMeta = getProjectPriorityMeta(project.priority);
              const overdue = isOverdue(project.due_date ?? undefined, project.status ?? undefined);
              return (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className="flex flex-wrap items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                    style={{ backgroundColor: getProjectColor(project) }}
                  >
                    {getProjectInitials(project)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{project.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{project.description || '—'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge label={stateMeta.label} className={stateMeta.badgeClass} />
                    {priorityMeta && <StatusBadge label={priorityMeta.label} className={priorityMeta.badgeClass} />}
                  </div>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <UsersIcon className="h-3.5 w-3.5" />
                    {project.member_count}
                  </span>
                  <span className={cn('text-xs', overdue ? 'font-medium text-red-600' : 'text-muted-foreground')}>
                    Due {formatDate(project.due_date ?? undefined)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GroupDetailSkeleton() {
  return (
    <div className="animate-fade-in space-y-6" aria-busy="true">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading group...
      </div>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-10 w-[360px]" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
