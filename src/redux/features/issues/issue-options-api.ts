import { useMemo } from 'react';
import { baseApi } from '@/redux/api/base-api';
import { ENDPOINTS } from '@/redux/api/endpoints';
import type { ApiResponse } from '@/redux/api/types';
import {
  ISSUE_PRIORITY_META,
  ISSUE_SEVERITY_OPTIONS,
  ISSUE_TYPE_OPTIONS,
} from '@/lib/shared-utils';

interface OptionEntry {
  value: string;
  label: string;
}

interface SeverityEntry extends OptionEntry {
  description?: string;
}

/** GET /api/issue-options: the fixed lists behind the issue form and board filters */
export interface IssueOptionsPayload {
  types?: OptionEntry[];
  priorities?: OptionEntry[];
  severities?: SeverityEntry[];
  sources?: OptionEntry[];
}

const issueOptionsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getIssueOptions: build.query<IssueOptionsPayload, void>({
      query: () => ENDPOINTS.ISSUE_OPTIONS,
      transformResponse: (res: ApiResponse<IssueOptionsPayload>) => res.data,
      // The lists are fixed per deployment
      keepUnusedDataFor: 600,
    }),
  }),
});

export const { useGetIssueOptionsQuery } = issueOptionsApi;

/**
 * Dropdown lists for issues. They come from the API; the built-in lists cover the
 * moments before it answers and a deployment that doesn't serve the endpoint.
 */
export function useIssueOptions() {
  const { data } = useGetIssueOptionsQuery();

  return useMemo(() => {
    const localSeverityDescriptions = new Map<string, string>(
      ISSUE_SEVERITY_OPTIONS.map((s) => [s.value, s.description]),
    );
    return {
      types: data?.types?.length
        ? data.types
        : ISSUE_TYPE_OPTIONS.map((t) => ({ value: t.value as string, label: t.label })),
      priorities: data?.priorities?.length
        ? data.priorities
        : Object.entries(ISSUE_PRIORITY_META).map(([value, meta]) => ({ value, label: meta.label })),
      severities: (data?.severities?.length
        ? data.severities
        : ISSUE_SEVERITY_OPTIONS
      ).map((s) => ({
        value: s.value as string,
        label: s.label,
        description: s.description ?? localSeverityDescriptions.get(s.value) ?? '',
      })),
    };
  }, [data]);
}
