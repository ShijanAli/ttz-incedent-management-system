import { useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { projectCan } from '@/lib/project-utils';
import type { ApiProject } from '@/redux/features/projects/projects-types';

/**
 * projectCan with super admins allowed everything, whatever their role in the project.
 * The returned function is stable, so it is safe as a list filter or effect dependency.
 */
export function useProjectCan() {
  const { isSuperAdmin } = useAuth();
  return useCallback(
    (project: Pick<ApiProject, 'my_permissions' | 'my_role'> | undefined, permission: string) =>
      Boolean(project) && (isSuperAdmin || projectCan(project, permission)),
    [isSuperAdmin],
  );
}
