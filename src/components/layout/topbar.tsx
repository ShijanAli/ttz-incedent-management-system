import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Bell, LogOut, User as UserIcon, ChevronDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { parseApiError } from '@/lib/api-error';
import { formatRelativeTime } from '@/lib/shared-utils';
import { cn } from '@/lib/utils';
import { flattenPages } from '@/redux/api/infinite';
import {
  useGetNotificationsInfiniteQuery,
  useGetUnreadNotificationCountQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from '@/redux/features/notifications/notifications-api';
import { getNotificationMeta } from '@/components/notifications/notification-meta';
import { UserAvatar } from '@/components/shared/user-avatar';
import { GlobalSearch } from '@/components/layout/global-search';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

/** How often the bell's unread badge refreshes */
const UNREAD_POLL_MS = 60_000;

export function Topbar() {
  const navigate = useNavigate();
  const { session, logout, hasPermission } = useAuth();

  const canViewNotifications = hasPermission('notifications.view');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  // The badge polls; the list shares the notifications page's cache and refreshes when the popover opens
  const { data: unreadCount = 0 } = useGetUnreadNotificationCountQuery(undefined, {
    skip: !session || !canViewNotifications,
    pollingInterval: UNREAD_POLL_MS,
    skipPollingIfUnfocused: true,
  });
  const notificationList = useGetNotificationsInfiniteQuery(undefined, { skip: !session || !canViewNotifications });
  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead] = useMarkAllNotificationsReadMutation();
  const notifications = flattenPages(notificationList.data).slice(0, 10);

  const handleNotificationsOpen = (open: boolean) => {
    setNotificationsOpen(open);
    if (open && !notificationList.isUninitialized) void notificationList.refetch();
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead().unwrap();
    } catch (err) {
      toast.error('Failed to mark all as read', { description: parseApiError(err).message });
    }
  };

  if (!session) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur lg:px-6">
      {/* Spacer for mobile menu button */}
      <div className="w-10 lg:hidden" />

      {/* Search: suggestions come from the projects and issues APIs */}
      <GlobalSearch />

      <div className="flex-1" />

      {/* Notifications */}
      {canViewNotifications && (
        <Popover open={notificationsOpen} onOpenChange={handleNotificationsOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}>
              <Bell className="h-[18px] w-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="text-sm font-semibold">Notifications</span>
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="text-xs text-primary hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            <ScrollArea className="h-[320px]">
              <div className="divide-y">
                {notificationList.isLoading ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : notificationList.isError ? (
                  <div className="px-4 py-8 text-center text-sm text-destructive">
                    {parseApiError(notificationList.error, 'Failed to load notifications.').message}
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No notifications yet
                  </div>
                ) : (
                  notifications.map((n) => {
                    const unread = !n.read_at;
                    const meta = getNotificationMeta(n.data.event);
                    const content = (
                      <div className="flex items-start gap-2">
                        {unread && <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {meta.label}
                            {n.data.issue_code && (
                              <span className="ml-1.5 font-mono text-xs font-normal text-muted-foreground">{n.data.issue_code}</span>
                            )}
                          </div>
                          <div className="line-clamp-2 text-xs text-muted-foreground">{n.data.message}</div>
                          <div className="mt-1 text-[10px] text-muted-foreground">{formatRelativeTime(n.created_at)}</div>
                        </div>
                      </div>
                    );
                    const className = cn('block px-4 py-3 transition-colors hover:bg-accent', unread && 'bg-primary/5');
                    const onClick = () => {
                      if (unread) markRead(n.id);
                      if (n.data.path) setNotificationsOpen(false);
                    };
                    // A deleted issue has no path, so the row only marks it read
                    return n.data.path ? (
                      <Link key={n.id} to={n.data.path} onClick={onClick} className={className}>{content}</Link>
                    ) : (
                      <button key={n.id} type="button" onClick={onClick} className={cn(className, 'w-full text-left')}>
                        {content}
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
            <div className="border-t p-2">
              <Link
                to="/notifications"
                onClick={() => setNotificationsOpen(false)}
                className="block rounded-md px-3 py-2 text-center text-sm font-medium text-primary hover:bg-accent"
              >
                View all notifications
              </Link>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent">
            <UserAvatar name={session.user.name} color={session.user.avatarColor} image={session.user.avatarUrl} size="sm" />
            <div className="hidden text-left sm:block">
              <div className="text-sm font-medium leading-tight">{session.user.name}</div>
              <div className="text-xs text-muted-foreground leading-tight">{session.roleNames.join(', ')}</div>
            </div>
            <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-2 py-1.5">
            <div className="text-sm font-medium">{session.user.name}</div>
            <div className="truncate text-xs text-muted-foreground">{session.user.email}</div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate('/settings')}>
            <UserIcon className="mr-2 h-4 w-4" />
            Profile & Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
