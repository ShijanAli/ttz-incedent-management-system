import { useMemo } from 'react';
import { collectStatusCatalog } from '@/lib/project-utils';
import { flattenPages } from '@/redux/api/infinite';
import { useGetProjectsInfiniteQuery } from './projects-api';

/**
 * Statuses a project can use. Built from the loaded projects (shares the
 * unfiltered list's cache) until the backend exposes a status catalog endpoint.
 */
export function useStatusCatalog(options?: { skip?: boolean }) {
  const { data, isLoading } = useGetProjectsInfiniteQuery({}, { skip: options?.skip });
  const statuses = useMemo(() => collectStatusCatalog(flattenPages(data)), [data]);
  return { statuses, isLoading };
}
