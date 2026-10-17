import { Navigate } from 'react-router';
import { useAuth } from '@/lib/auth-context';
import type { Permission } from '@/lib/types';

/** Route guard: renders the page only when the user holds the module's permission */
export function RequirePermission({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) return <Navigate to="/unauthorized" replace />;
  return <>{children}</>;
}
