import { useGetStatusCatalogQuery } from './projects-api';

const NONE: never[] = [];

/** Statuses a project can use, from the global status catalog (GET /api/admin/statuses) */
export function useStatusCatalog(options?: { skip?: boolean }) {
  const { data, isLoading } = useGetStatusCatalogQuery(undefined, { skip: options?.skip });
  return { statuses: data ?? NONE, isLoading };
}
