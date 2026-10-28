import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { AlertTriangle, Bell, BellOff, CheckCheck, Loader2, RotateCw, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { parseApiError } from '@/lib/api-error';
import { formatRelativeTime } from '@/lib/shared-utils';
import { cn } from '@/lib/utils';
import {
  useGetNotificationsInfiniteQuery,
  useGetUnreadNotificationCountQuery,
  useDeleteNotificationMutation,
  useDeleteSelectedNotificationsMutation,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useMarkSelectedNotificationsReadMutation,
} from '@/redux/features/notifications/notifications-api';
import { getNotificationMeta } from '@/components/notifications/notification-meta';
import { PageHeader } from '@/components/shared/page-header';
import { InfiniteScrollTrigger } from '@/components/shared/infinite-scroll-trigger';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function NotificationsPage() {
  const { session, hasPermission } = useAuth();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const canView = hasPermission('notifications.view');

  const list = useInfiniteList(
    useGetNotificationsInfiniteQuery(undefined, { skip: !canView }),
  );
  const { data: unreadCount = 0 } = useGetUnreadNotificationCountQuery(undefined, { skip: !canView });
  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead, { isLoading: markingAll }] = useMarkAllNotificationsReadMutation();
  const [markSelectedRead, { isLoading: markingSelected }] = useMarkSelectedNotificationsReadMutation();
  const [deleteOne] = useDeleteNotificationMutation();
  const [deleteSelected] = useDeleteSelectedNotificationsMutation();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Ids waiting for the delete confirmation (one row, or the whole selection)
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);

  if (!session) return null;

  if (!canView) {
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

  // The API has no unread filter, so "Unread" narrows the pages loaded so far (scrolling loads more)
  const visible = filter === 'unread' ? list.items.filter((n) => !n.read_at) : list.items;

  const handleMarkRead = async (id: string) => {
    try {
      await markRead(id).unwrap();
    } catch (err) {
      toast.error('Failed to mark as read', { description: parseApiError(err).message });
    }
  };

  // The API accepts 100 ids at a time
  const MAX_BULK = 100;
  const selectedIds = visible.filter((n) => selected.has(n.id)).map((n) => n.id).slice(0, MAX_BULK);
  const allVisibleSelected = visible.length > 0 && visible.every((n) => selected.has(n.id));

  const toggleSelected = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });

  const toggleAllVisible = (on: boolean) => setSelected(on ? new Set(visible.map((n) => n.id)) : new Set());

  const handleMarkSelectedRead = async () => {
    try {
      await markSelectedRead(selectedIds).unwrap();
      setSelected(new Set());
      toast.success('Marked as read');
    } catch (err) {
      toast.error('Failed to mark as read', { description: parseApiError(err).message });
    }
  };

  const handleConfirmDelete = async () => {
    const ids = pendingDelete ?? [];
    try {
      if (ids.length === 1) await deleteOne(ids[0]).unwrap();
      else await deleteSelected(ids).unwrap();
      setSelected((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      toast.success(ids.length === 1 ? 'Notification deleted' : `${ids.length} notifications deleted`);
    } catch (err) {
      toast.error('Failed to delete', { description: parseApiError(err).message });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead().unwrap();
      toast.success('All notifications marked as read');
    } catch (err) {
      toast.error('Failed to mark all as read', { description: parseApiError(err).message });
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Notifications"
        description="Stay up to date on issues, assignments, and activity"
        breadcrumbs={[{ label: 'Notifications' }]}
        actions={
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" onClick={handleMarkAllRead} disabled={markingAll}>
                {markingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCheck className="mr-2 h-4 w-4" />}
                Mark all read
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={list.refresh}
              disabled={list.isFetching}
              aria-label="Refresh notifications"
              title="Refresh"
            >
              <RotateCw className={cn('h-4 w-4', list.isRefreshing && 'animate-spin')} />
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>
          All ({list.total})
        </Button>
        <Button variant={filter === 'unread' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('unread')}>
          Unread ({unreadCount})
        </Button>
      </div>

      {visible.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
          <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
            <Checkbox
              checked={allVisibleSelected}
              onCheckedChange={(v) => toggleAllVisible(v === true)}
              aria-label="Select all notifications"
            />
            {selectedIds.length > 0 ? `${selectedIds.length} selected` : 'Select all'}
          </label>
          {selectedIds.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={handleMarkSelectedRead} disabled={markingSelected}>
                {markingSelected ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="mr-2 h-3.5 w-3.5" />}
                Mark read
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setPendingDelete(selectedIds)}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
            </>
          )}
        </div>
      )}

      <div className="space-y-2">
        {list.showSkeleton ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-start gap-3 p-4">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : list.isError ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-sm">
              <span className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {parseApiError(list.error, 'Failed to load notifications.').message}
              </span>
              <Button variant="outline" size="sm" onClick={list.refresh} disabled={list.isFetching}>
                <RotateCw className="mr-2 h-3.5 w-3.5" /> Retry
              </Button>
            </CardContent>
          </Card>
        ) : visible.length === 0 && !list.trigger.hasMore ? (
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
          visible.map((n) => {
            const meta = getNotificationMeta(n.data.event);
            const Icon = meta.icon;
            const unread = !n.read_at;
            return (
              <Card key={n.id} className={cn('transition-colors', unread && 'border-primary/30 bg-primary/[0.02]')}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      className="mt-2.5"
                      checked={selected.has(n.id)}
                      onCheckedChange={(v) => toggleSelected(n.id, v === true)}
                      aria-label="Select notification"
                    />
                    <div className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', meta.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{meta.label}</span>
                        {n.data.issue_code && (
                          <span className="font-mono text-xs text-muted-foreground">{n.data.issue_code}</span>
                        )}
                        {unread && <Badge className="h-1.5 w-1.5 rounded-full bg-primary p-0" />}
                      </div>
                      {n.data.issue_title && <p className="mt-0.5 truncate text-sm">{n.data.issue_title}</p>}
                      <p className="mt-0.5 text-sm text-muted-foreground">{n.data.message}</p>
                      <div className="mt-1.5 flex items-center gap-3">
                        <span className="text-xs text-muted-foreground" title={new Date(n.created_at).toLocaleString()}>
                          {formatRelativeTime(n.created_at)}
                        </span>
                        {n.data.path && (
                          <Link
                            to={n.data.path}
                            onClick={() => { if (unread) void handleMarkRead(n.id); }}
                            className="text-xs text-primary hover:underline"
                          >
                            View details
                          </Link>
                        )}
                        {unread && (
                          <button
                            onClick={() => handleMarkRead(n.id)}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            Mark as read
                          </button>
                        )}
                        <button
                          onClick={() => setPendingDelete([n.id])}
                          className="text-xs text-muted-foreground hover:text-destructive"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <InfiniteScrollTrigger
        {...list.trigger}
        disabled={list.trigger.disabled || list.showSkeleton}
        endMessage={list.items.length > 0 ? 'No more notifications' : undefined}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
        title={pendingDelete?.length === 1 ? 'Delete this notification?' : `Delete ${pendingDelete?.length ?? 0} notifications?`}
        description="This can't be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
