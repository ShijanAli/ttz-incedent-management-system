import { useAuth } from '@/lib/auth-context';
import type { Permission } from '@/lib/types';
import { ShieldAlert } from 'lucide-react';

interface PermissionGateProps {
  permissions: Permission[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requireAll?: boolean;
}

export function PermissionGate({
  permissions,
  children,
  fallback = null,
  requireAll = false,
}: PermissionGateProps) {
  const { hasAnyPermission, hasAllPermissions } = useAuth();

  const allowed = requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions);

  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}
