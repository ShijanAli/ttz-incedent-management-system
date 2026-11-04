import { Navigate } from 'react-router';
import { useAuth } from '@/lib/auth-context';
import type { PermissionCode } from '@/lib/permissions';

/** Renders its children only when the user holds the permission (or any of several); otherwise redirects. */
export function RequirePermission({ permission, children }: { permission: PermissionCode | readonly PermissionCode[]; children: React.ReactNode }) {
  const { hasAnyPermission } = useAuth();
  const codes = typeof permission === 'string' ? [permission] : permission;
  if (!hasAnyPermission(codes)) return <Navigate to="/unauthorized" replace />;
  return <>{children}</>;
}
