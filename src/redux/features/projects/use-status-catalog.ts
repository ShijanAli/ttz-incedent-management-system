import { useAuth } from '@/lib/auth-context';
import { useGetStatusCatalogQuery } from './projects-api';

const NONE: never[] = [];

/**
 * Statuses a project can use. Super admins get the admin catalog (GET /api/admin/statuses);
 * other roles get GET /api/statuses, plus `projectId`'s own statuses when one is given.
 */
export function useStatusCatalog(options?: { skip?: boolean; projectId?: number }) {
  const { isSuperAdmin } = useAuth();
  // The admin catalog doesn't depend on a project, so leave it out of the cache key
  const args = isSuperAdmin ? { admin: true } : { admin: false, projectId: options?.projectId };
  const { data, isLoading } = useGetStatusCatalogQuery(args, { skip: options?.skip });
  return { statuses: data ?? NONE, isLoading };
}
