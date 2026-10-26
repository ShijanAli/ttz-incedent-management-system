import { useCallback, useMemo } from 'react';
import { useGetIssueAssigneesQuery } from '@/redux/features/issues/issue-detail-api';
import { useGetProjectMembersQuery } from '@/redux/features/projects/projects-api';
import type { HoverCardUser } from '@/components/shared/user-hover-card';

/**
 * The issue payload only embeds photos for assignees; the reporter and comment authors
 * come as bare name + email. This fills them in from the assignees and the project's
 * members (both cached and shared with the rest of the page).
 */
export function useIssuePeople(issueId: number, projectId: number) {
  const { data: assignees } = useGetIssueAssigneesQuery(issueId);
  const { data: members } = useGetProjectMembersQuery(projectId);

  const byId = useMemo(() => {
    const map = new Map<number, HoverCardUser>();
    for (const m of members ?? []) map.set(m.user.id, m.user);
    for (const a of assignees ?? []) map.set(a.user.id, { ...map.get(a.user.id), ...a.user });
    return map;
  }, [assignees, members]);

  /** The same person with whatever extra details (photo, phone, department) we know about */
  const enrich = useCallback(
    <U extends HoverCardUser>(user: U): U => {
      const known = byId.get(user.id);
      if (!known) return user;
      // Keep the payload's own non-empty values; fill the gaps from what we know
      const merged = { ...known } as Record<string, unknown>;
      for (const [k, v] of Object.entries(user)) if (v !== null && v !== undefined) merged[k] = v;
      return merged as U;
    },
    [byId],
  );

  return { byId, enrich };
}
