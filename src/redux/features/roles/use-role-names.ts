import { useMemo } from 'react';
import { DEFAULT_ROLE_PERMISSIONS } from '@/lib/permissions';
import { useGetAssignableRolesQuery } from './roles-api';

/**
 * Role names to offer in role pickers. Comes from GET /api/roles (open to every
 * signed-in user, so a project manager gets custom roles too); falls back to the
 * system roles while it loads or if it fails.
 */
export function useRoleNames(): { roleNames: string[]; isLoading: boolean } {
  const { data, isLoading } = useGetAssignableRolesQuery();
  const roleNames = useMemo(
    () => (data && data.length > 0 ? data : Object.keys(DEFAULT_ROLE_PERMISSIONS)),
    [data],
  );
  return { roleNames, isLoading };
}
