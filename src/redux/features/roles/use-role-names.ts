import { useMemo } from 'react';
import { DEFAULT_ROLE_PERMISSIONS } from '@/lib/permissions';
import { useGetRolesQuery } from './roles-api';

/**
 * Role names to offer in role pickers. Comes from the roles API; falls back to
 * the system roles for users who can't read /admin/roles.
 */
export function useRoleNames(): { roleNames: string[]; isLoading: boolean } {
  const { data, isLoading } = useGetRolesQuery();
  const roleNames = useMemo(
    () => data?.map((r) => r.name) ?? Object.keys(DEFAULT_ROLE_PERMISSIONS),
    [data],
  );
  return { roleNames, isLoading };
}
