import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Link2, Loader2, Unlink, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { GroupSearchList } from '@/components/groups/group-search-list';
import { parseApiError } from '@/lib/api-error';
import {
  useAttachProjectGroupMutation,
  useDetachProjectGroupMutation,
  useGetProjectGroupsQuery,
} from '@/redux/features/projects/projects-api';
import type { ApiProject, ProjectGroupSummary } from '@/redux/features/projects/projects-types';

interface ProjectGroupManagerProps {
  project: ApiProject;
  /** Attaching a group adds people to the project, so it needs member-management rights */
  canManage: boolean;
}

/** Groups tab: groups attached to the project, plus attach / detach for managers */
export function ProjectGroupManager({ project, canManage }: ProjectGroupManagerProps) {
  const { data: groups = [], isLoading, error, refetch } = useGetProjectGroupsQuery(project.id);
  const [attachGroup] = useAttachProjectGroupMutation();
  const [detachGroup] = useDetachProjectGroupMutation();
  const [pending, setPending] = useState<number | null>(null);
  const [confirmDetach, setConfirmDetach] = useState<ProjectGroupSummary | null>(null);

  const attachedIds = useMemo(() => new Set(groups.map((g) => g.id)), [groups]);

  const handleAttach = async (groupId: number, name: string) => {
    setPending(groupId);
    try {
      await attachGroup({ projectId: project.id, group_id: groupId }).unwrap();
      toast.success(`${name} attached`, { description: `Its members now have access to ${project.name}.` });
    } catch (err) {
      toast.error('Failed to attach group', { description: parseApiError(err).message });
    } finally {
      setPending(null);
    }
  };

  const handleDetach = async (group: ProjectGroupSummary) => {
    setPending(group.id);
    try {
      await detachGroup({ projectId: project.id, groupId: group.id }).unwrap();
      toast.success(`${group.name} detached from ${project.name}`);
    } catch (err) {
      toast.error('Failed to detach group', { description: parseApiError(err).message });
    } finally {
      setPending(null);
    }
  };

  return (
    <div className={canManage ? 'grid gap-4 lg:grid-cols-2' : undefined}>
      {/* Attached groups */}
      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Attached Groups ({groups.length})
          </h3>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm">
              <p className="text-destructive">{parseApiError(error, 'Failed to load groups.').message}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Retry</Button>
            </div>
          ) : groups.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No groups attached.{canManage && ' Attach one to give all its members access at once.'}
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((g) => (
                <div key={g.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <Link to={`/groups/${g.id}`} className="flex min-w-0 flex-1 items-center gap-3 hover:text-primary">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <UsersRound className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{g.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {g.member_count} member{g.member_count !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </Link>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirmDetach(g)}
                      disabled={pending === g.id}
                      aria-label={`Detach ${g.name}`}
                    >
                      {pending === g.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="mr-1.5 h-3.5 w-3.5" />}
                      Detach
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attach a group */}
      {canManage && (
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Attach a Group</h3>
            <GroupSearchList
              excludeIds={attachedIds}
              emptyMessage="No more active groups to attach."
              renderAction={(group) => (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7"
                  onClick={() => handleAttach(group.id, group.name)}
                  disabled={pending === group.id}
                >
                  {pending === group.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="mr-1 h-3.5 w-3.5" />}
                  Attach
                </Button>
              )}
            />
            <Separator className="my-3" />
            <p className="text-xs text-muted-foreground">
              Every member of an attached group gets access to this project with their group role. Only active groups can be attached.
            </p>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={!!confirmDetach}
        onOpenChange={(open) => { if (!open) setConfirmDetach(null); }}
        title="Detach group"
        description={`Detach "${confirmDetach?.name}" from ${project.name}? Members who only had access through this group will lose it.`}
        confirmLabel="Detach"
        variant="destructive"
        onConfirm={async () => { if (confirmDetach) await handleDetach(confirmDetach); }}
      />
    </div>
  );
}
