import { Suspense, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { SidebarProvider, useSidebar } from '@/components/layout/sidebar-context';
import { Loader2 } from 'lucide-react';

export default function AppLayout() {
  const navigate = useNavigate();
  const { session, loading, mustChangePassword } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate('/login', { replace: true });
    } else if (mustChangePassword) {
      navigate('/change-password', { replace: true });
    }
  }, [session, loading, mustChangePassword, navigate]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session || mustChangePassword) {
    return null;
  }

  return (
    <SidebarProvider>
      <LayoutShell />
    </SidebarProvider>
  );
}

function LayoutShell() {
  const { width } = useSidebar();

  return (
    // --sidebar-width lets the content and any fixed bars follow the sidebar's width
    <div className="min-h-screen bg-background" style={{ '--sidebar-width': `${width}px` } as React.CSSProperties}>
      <Sidebar />
      <div className="transition-[padding] duration-300 lg:pl-[var(--sidebar-width)]">
        <Topbar />
        <main className="p-4 lg:p-6">
          <Suspense
            fallback={
              <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
