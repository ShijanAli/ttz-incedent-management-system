import { useAuth } from '@/lib/auth-context';
import { useGetStatusCatalogQuery } from './projects-api';

const NONE: never[] = [];

/**
 * Statuses a project can use. Users with account.statuses.view (and super admins) get the
 * admin catalog (GET /api/admin/statuses); others get GET /api/statuses, plus `projectId`'s
 * own statuses when one is given.
 */
export function useStatusCatalog(options?: { skip?: boolean; projectId?: number }) {
  const { hasAccountPermission } = useAuth();
  // The admin catalog doesn't depend on a project, so leave it out of the cache key
  const args = hasAccountPermission('account.statuses.view')
    ? { admin: true }
    : { admin: false, projectId: options?.projectId };
  const { data, isLoading } = useGetStatusCatalogQuery(args, { skip: options?.skip });
  return { statuses: data ?? NONE, isLoading };
}
