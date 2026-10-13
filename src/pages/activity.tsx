import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '@/lib/auth-context';
import { activityRepo, userRepo, projectRepo } from '@/lib/repository';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/shared/user-avatar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  History as HistoryIcon, Download, Activity as ActivityIcon,
  FolderKanban, TicketCheck, Users, Shield, MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatRelativeTime, formatDate } from '@/lib/shared-utils';
import type { ActivityLog } from '@/lib/types';

const ACTION_ICONS: Record<string, { icon: typeof ActivityIcon; color: string }> = {
  project_created: { icon: FolderKanban, color: 'text-blue-600 bg-blue-50' },
  project_updated: { icon: FolderKanban, color: 'text-blue-600 bg-blue-50' },
  project_archived: { icon: FolderKanban, color: 'text-slate-600 bg-slate-50' },
  project_restored: { icon: FolderKanban, color: 'text-emerald-600 bg-emerald-50' },
  issue_created: { icon: TicketCheck, color: 'text-violet-600 bg-violet-50' },
  issue_updated: { icon: TicketCheck, color: 'text-violet-600 bg-violet-50' },
  issue_assigned: { icon: TicketCheck, color: 'text-amber-600 bg-amber-50' },
  issue_unassigned: { icon: TicketCheck, color: 'text-slate-600 bg-slate-50' },
  issue_deleted: { icon: TicketCheck, color: 'text-red-600 bg-red-50' },
  issue_approved: { icon: TicketCheck, color: 'text-emerald-600 bg-emerald-50' },
  issue_commented: { icon: MessageSquare, color: 'text-cyan-600 bg-cyan-50' },
  status_changed: { icon: ActivityIcon, color: 'text-amber-600 bg-amber-50' },
  attachment_added: { icon: TicketCheck, color: 'text-slate-600 bg-slate-50' },
  member_added: { icon: Users, color: 'text-emerald-600 bg-emerald-50' },
  member_removed: { icon: Users, color: 'text-red-600 bg-red-50' },
  member_assigned: { icon: Users, color: 'text-amber-600 bg-amber-50' },
  role_created: { icon: Shield, color: 'text-purple-600 bg-purple-50' },
  user_created: { icon: Users, color: 'text-cyan-600 bg-cyan-50' },
  group_created: { icon: MessageSquare, color: 'text-cyan-600 bg-cyan-50' },
};

export default function ActivityPage() {
  const { session, hasPermission } = useAuth();
  const [entityFilter, setEntityFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [search, setSearch] = useState('');

  const data = useMemo(() => {
    if (!session) return { activities: [], visibleProjectIds: new Set<string>(), visibleProjects: [] as import('@/lib/types').Project[] };
    const isSuperAdmin = session.roleNames.includes('Super Admin');
    const allActivity = activityRepo.all();
    const allProjects = projectRepo.all();

    const visibleProjects = isSuperAdmin
      ? allProjects
      : allProjects.filter((p) => p.memberIds.includes(session.user.id));
    const visibleProjectIds = new Set(visibleProjects.map((p) => p.id));

    let activities = isSuperAdmin
      ? allActivity
      : allActivity.filter((a) => !a.projectId || visibleProjectIds.has(a.projectId));

    if (entityFilter !== 'all') activities = activities.filter((a) => a.entityType === entityFilter);
    if (projectFilter !== 'all') activities = activities.filter((a) => a.projectId === projectFilter);
    if (search) {
      const q = search.toLowerCase();
      activities = activities.filter((a) =>
        a.summary.toLowerCase().includes(q) ||
        a.entityName.toLowerCase().includes(q) ||
        a.action.toLowerCase().includes(q)
      );
    }

    activities = [...activities].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return { activities, visibleProjectIds, visibleProjects };
  }, [session, entityFilter, projectFilter, search]);

  if (!session) return null;

  if (!hasPermission('activity.view')) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Activity Log" breadcrumbs={[{ label: 'Activity Log' }]} />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <HistoryIcon className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Access restricted</h3>
            <p className="mt-1 text-sm text-muted-foreground">You don&apos;t have permission to view the activity log.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canExport = hasPermission('activity.export');

  const exportCSV = () => {
    if (!canExport) {
      toast.error('You do not have permission to export the activity log');
      return;
    }
    const rows = data.activities.map((a) => {
      const actor = userRepo.find(a.actorId);
      return [
        formatDate(a.timestamp),
        actor?.name || 'Unknown',
        a.action,
        a.entityType,
        a.entityName,
        a.summary,
        a.projectId || '',
      ];
    });
    const headers = ['Timestamp', 'Actor', 'Action', 'Entity Type', 'Entity Name', 'Summary', 'Project ID'];
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `techtrioz-activity-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Activity log exported', { description: `${rows.length} entries exported.` });
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Activity Log"
        description="Audit trail of all actions across the system"
        breadcrumbs={[{ label: 'Activity Log' }]}
        actions={
          canExport && (
            <Button variant="outline" onClick={exportCSV}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          )
        }
      />

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Entity type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entities</SelectItem>
            <SelectItem value="Project">Projects</SelectItem>
            <SelectItem value="Issue">Issues</SelectItem>
            <SelectItem value="Group">Groups</SelectItem>
            <SelectItem value="User">Users</SelectItem>
            <SelectItem value="Role">Roles</SelectItem>
          </SelectContent>
        </Select>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Project" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {data.visibleProjects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input
          type="text"
          placeholder="Search activity..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="text-sm text-muted-foreground sm:ml-auto self-center">
          {data.activities.length} entr{data.activities.length !== 1 ? 'ies' : 'y'}
        </div>
      </div>

      {/* Timeline */}
      <Card>
        <CardContent className="p-4">
          {data.activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <HistoryIcon className="mb-4 h-10 w-10 text-muted-foreground" />
              <h3 className="text-lg font-semibold">No activity found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {search || entityFilter !== 'all' || projectFilter !== 'all'
                  ? 'No entries match your filters.'
                  : 'Activity will appear here as actions are taken in the system.'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {data.activities.map((act, idx) => {
                const actor = userRepo.find(act.actorId);
                const iconMeta = ACTION_ICONS[act.action] || { icon: ActivityIcon, color: 'text-muted-foreground bg-muted' };
                const Icon = iconMeta.icon;
                const project = act.projectId ? projectRepo.find(act.projectId) : null;
                return (
                  <div key={act.id}>
                    <div className="flex items-start gap-3 py-3">
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconMeta.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {actor && <UserAvatar name={actor.name} color={actor.avatarColor} size="xs" />}
                          <span className="text-sm font-medium">{actor?.name || 'Unknown'}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{act.action.replace(/_/g, ' ')}</Badge>
                        </div>
                        <p className="mt-0.5 text-sm text-muted-foreground">{act.summary}</p>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{formatRelativeTime(act.timestamp)}</span>
                          {project && (
                            <Link to={`/projects/${project.id}`} className="text-xs text-primary hover:underline">
                              {project.name}
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                    {idx < data.activities.length - 1 && <div className="ml-4 border-l border-border h-0" />}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}