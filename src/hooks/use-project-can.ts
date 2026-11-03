import { useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { projectCan } from '@/lib/project-utils';
import type { ApiProject } from '@/redux/features/projects/projects-types';

/** Project permissions that account.projects.edit_all grants on every project */
const EDIT_ALL_PERMISSIONS = new Set(['projects.view', 'projects.edit', 'users.edit']);

/**
 * projectCan with super admins allowed everything, whatever their role in the project,
 * and account.projects.edit_all allowed to edit any project and its members.
 * The returned function is stable, so it is safe as a list filter or effect dependency.
 */
export function useProjectCan() {
  const { isSuperAdmin, hasAccountPermission } = useAuth();
  const canEditAll = hasAccountPermission('account.projects.edit_all');
  return useCallback(
    (project: Pick<ApiProject, 'my_permissions' | 'my_role'> | undefined, permission: string) =>
      Boolean(project) &&
      (isSuperAdmin || (canEditAll && EDIT_ALL_PERMISSIONS.has(permission)) || projectCan(project, permission)),
    [isSuperAdmin, canEditAll],
  );
}
