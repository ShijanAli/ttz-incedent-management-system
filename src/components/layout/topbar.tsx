import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { Bell, Search, LogOut, User as UserIcon, Settings as SettingsIcon, ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { notificationRepo, userRepo, projectRepo, issueRepo } from '@/lib/repository';
import { formatRelativeTime } from '@/lib/shared-utils';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/shared/user-avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

export function Topbar() {
  const navigate = useNavigate();
  const { session, logout, hasPermission } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session) return;
    const notifs = notificationRepo.byUser(session.user.id);
    setUnreadCount(notifs.filter((n) => !n.isRead).length);
  }, [session]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!session) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const searchResults = (() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return { projects: [], issues: [] };
    const q = searchQuery.toLowerCase();

    const visibleProjects = projectRepo.all().filter((p) => {
      if (p.status === 'archived') return false;
      if (session.roleNames.includes('Super Admin')) return true;
      return p.memberIds.includes(session.user.id);
    });

    const visibleIssues = issueRepo.all().filter((i) => {
      const proj = projectRepo.find(i.projectId);
      if (!proj) return false;
      if (proj.status === 'archived') return false;
      if (!session.roleNames.includes('Super Admin') && !proj.memberIds.includes(session.user.id)) return false;
      return true;
    });

    return {
      projects: visibleProjects
        .filter((p) => p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q))
        .slice(0, 5),
      issues: visibleIssues
        .filter((i) => i.title.toLowerCase().includes(q) || i.key.toLowerCase().includes(q))
        .slice(0, 5),
    };
  })();

  const notifications = notificationRepo.byUser(session.user.id).slice(0, 10);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur lg:px-6">
      {/* Spacer for mobile menu button */}
      <div className="w-10 lg:hidden" />

      {/* Search */}
      <div ref={searchRef} className="relative flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search projects, issues..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            className="h-9 w-full rounded-lg border bg-muted/40 pl-9 pr-4 text-sm outline-none transition-colors focus:border-primary focus:bg-background"
          />
        </div>
        {searchOpen && searchQuery.length >= 2 && (
          <div className="absolute left-0 right-0 top-full mt-2 rounded-lg border bg-popover shadow-lg z-50">
            <ScrollArea className="max-h-[400px]">
              <div className="p-2">
                {searchResults.projects.length === 0 && searchResults.issues.length === 0 ? (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No results found for &quot;{searchQuery}&quot;
                  </div>
                ) : (
                  <>
                    {searchResults.projects.length > 0 && (
                      <div className="mb-2">
                        <div className="px-3 py-1 text-xs font-semibold text-muted-foreground">Projects</div>
                        {searchResults.projects.map((p) => (
                          <Link
                            key={p.id}
                            to={`/projects/${p.id}`}
                            onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
                          >
                            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                            <span className="font-medium">{p.name}</span>
                            <span className="text-muted-foreground">{p.key}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                    {searchResults.issues.length > 0 && (
                      <div>
                        <div className="px-3 py-1 text-xs font-semibold text-muted-foreground">Issues</div>
                        {searchResults.issues.map((i) => (
                          <Link
                            key={i.id}
                            to={`/issues/${i.id}`}
                            onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
                          >
                            <span className="font-mono text-xs text-muted-foreground">{i.key}</span>
                            <span className="truncate">{i.title}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      <div className="flex-1" />

      {/* Notifications */}
      {hasPermission('notifications.view') && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
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
                <button
                  onClick={() => {
                    notificationRepo.markAllRead(session.user.id);
                    setUnreadCount(0);
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
            <ScrollArea className="h-[320px]">
              <div className="divide-y">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No notifications yet
                  </div>
                ) : (
                  notifications.map((n) => (
                    <Link
                      key={n.id}
                      to={n.link || '#'}
                      onClick={() => {
                        notificationRepo.markRead(n.id);
                        setUnreadCount(notificationRepo.byUser(session.user.id).filter((x) => !x.isRead).length);
                      }}
                      className={cn(
                        'block px-4 py-3 transition-colors hover:bg-accent',
                        !n.isRead && 'bg-primary/5'
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {!n.isRead && <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium">{n.title}</div>
                          <div className="truncate text-xs text-muted-foreground">{n.body}</div>
                          <div className="mt-1 text-[10px] text-muted-foreground">{formatRelativeTime(n.createdAt)}</div>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </ScrollArea>
            <div className="border-t p-2">
              <Link to="/notifications" className="block rounded-md px-3 py-2 text-center text-sm font-medium text-primary hover:bg-accent">
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
