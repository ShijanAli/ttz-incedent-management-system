import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';
import { NAV_ITEMS } from '@/lib/nav-config';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/layout/sidebar-context';

export function Sidebar() {
  const { pathname } = useLocation();
  const { session, hasPermission } = useAuth();
  const { collapsed, toggleCollapsed } = useSidebar();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const visibleItems = NAV_ITEMS.filter((item) => hasPermission(item.permission));

  if (!session) return null;

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-screen flex-col bg-sidebar text-sidebar-foreground transition-all duration-300',
          // Full width on mobile (drawer); collapsible only on desktop
          'w-[240px] lg:w-[var(--sidebar-width)]',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b border-white/10 px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          {/* Collapsing is desktop-only; the mobile drawer always shows labels */}
          <div className={cn('overflow-hidden', collapsed && 'lg:hidden')}>
            <div className="truncate text-sm font-bold tracking-tight">Techtrioz IMS</div>
            <div className="truncate text-[10px] text-sidebar-foreground/60">Incident Management</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-thin px-2 py-4">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-active text-white shadow-sm'
                    : 'text-sidebar-foreground/80 hover:bg-white/5 hover:text-white'
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className={cn('truncate', collapsed && 'lg:hidden')}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="hidden border-t border-white/10 p-2 lg:block">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="w-full justify-center text-sidebar-foreground/70 hover:bg-white/5 hover:text-white"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {!collapsed && <span className="ml-2">Collapse</span>}
          </Button>
        </div>
      </aside>

      {/* Mobile menu button - rendered in topbar */}
      <MobileMenuButton onClick={() => setMobileOpen(true)} />
    </>
  );
}

function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed left-4 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-lg border bg-background lg:hidden"
      aria-label="Open menu"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>
  );
}
