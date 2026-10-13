import { useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router';
import { useAuth } from '@/lib/auth-context';
import { notificationRepo } from '@/lib/repository';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, CheckCheck, BellOff, MessageSquare, UserPlus, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatRelativeTime } from '@/lib/shared-utils';
import type { NotificationType } from '@/lib/types';

const NOTIF_ICONS: Record<string, { icon: typeof Bell; color: string }> = {
  issue_assigned: { icon: UserPlus, color: 'text-blue-600 bg-blue-50' },
  issue_status_changed: { icon: RefreshCw, color: 'text-amber-600 bg-amber-50' },
  issue_commented: { icon: MessageSquare, color: 'text-violet-600 bg-violet-50' },
  project_membership: { icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
  group_message: { icon: MessageSquare, color: 'text-cyan-600 bg-cyan-50' },
  issue_deadline: { icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
  role_changed: { icon: Bell, color: 'text-orange-600 bg-orange-50' },
};

export default function NotificationsPage() {
  const { session, hasPermission } = useAuth();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const [notifications, setNotifications] = useState(() =>
    session ? notificationRepo.byUser(session.user.id) : []
  );

  const refresh = useCallback(() => {
    if (session) setNotifications(notificationRepo.byUser(session.user.id));
  }, [session]);

  if (!session) return null;

  if (!hasPermission('notifications.view')) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Notifications" breadcrumbs={[{ label: 'Notifications' }]} />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bell className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Access restricted</h3>
            <p className="mt-1 text-sm text-muted-foreground">You don&apos;t have permission to view notifications.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const filtered = filter === 'unread' ? notifications.filter((n) => !n.isRead) : notifications;
  const sorted = [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const markRead = (id: string) => {
    notificationRepo.markRead(id);
    refresh();
  };

  const markAllRead = () => {
    notificationRepo.markAllRead(session.user.id);
    refresh();
    toast.success('All notifications marked as read');
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Notifications"
        description="Stay up to date on issues, assignments, and activity"
        breadcrumbs={[{ label: 'Notifications' }]}
        actions={
          unreadCount > 0 && (
            <Button variant="outline" onClick={markAllRead}>
              <CheckCheck className="mr-2 h-4 w-4" /> Mark all read
            </Button>
          )
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          All ({notifications.length})
        </Button>
        <Button
          variant={filter === 'unread' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('unread')}
        >
          Unread ({unreadCount})
        </Button>
      </div>

      <div className="space-y-2">
        {sorted.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <BellOff className="mb-4 h-10 w-10 text-muted-foreground" />
              <h3 className="text-lg font-semibold">
                {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {filter === 'unread'
                  ? 'You are all caught up. New notifications will appear here.'
                  : 'You will be notified when issues are assigned, commented on, or updated.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          sorted.map((n) => {
            const iconMeta = NOTIF_ICONS[n.type] || { icon: Bell, color: 'text-muted-foreground bg-muted' };
            const Icon = iconMeta.icon;
            return (
              <Card key={n.id} className={`transition-colors ${!n.isRead ? 'border-primary/30 bg-primary/[0.02]' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconMeta.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{n.title}</span>
                        {!n.isRead && <Badge className="h-1.5 w-1.5 rounded-full bg-primary p-0" />}
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                      <div className="mt-1.5 flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{formatRelativeTime(n.createdAt)}</span>
                        {n.link && (
                          <Link to={n.link} className="text-xs text-primary hover:underline">
                            View details
                          </Link>
                        )}
                        {!n.isRead && (
                          <button
                            onClick={() => markRead(n.id)}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            Mark as read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}