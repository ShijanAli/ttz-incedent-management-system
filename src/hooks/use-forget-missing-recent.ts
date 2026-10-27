import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { parseApiError } from '@/lib/api-error';
import { forgetRecent, type RecentItem } from '@/lib/recent-search';

/**
 * Drops a project or issue from the search history once its page says it is gone
 * (404) or no longer allowed (403), so the history doesn't keep offering it.
 */
export function useForgetMissingRecent(kind: RecentItem['kind'], id: number, error: unknown) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const status = error ? parseApiError(error).status : undefined;

  useEffect(() => {
    if (userId && Number.isFinite(id) && (status === 404 || status === 403)) forgetRecent(userId, kind, id);
  }, [userId, kind, id, status]);
}
