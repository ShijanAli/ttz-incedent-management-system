import { useMemo } from 'react';
import { useGetAssignableRolesQuery } from './roles-api';

/**
 * Role names to offer in role pickers. Comes from GET /api/roles (open to every
 * signed-in user, so a project manager gets custom roles too); empty while it
 * loads or if it fails.
 */
export function useRoleNames(): { roleNames: string[]; isLoading: boolean } {
  const { data, isLoading } = useGetAssignableRolesQuery();
  const roleNames = useMemo(() => data ?? [], [data]);
  return { roleNames, isLoading };
}
