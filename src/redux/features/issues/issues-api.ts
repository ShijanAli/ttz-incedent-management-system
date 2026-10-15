import { baseApi } from '@/redux/api/base-api';
import { ENDPOINTS } from '@/redux/api/endpoints';
import type { ApiResponse } from '@/redux/api/types';
import type { ApiIssue, CreateIssueRequest } from './issues-types';

export const issuesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    createIssue: build.mutation<ApiIssue, CreateIssueRequest>({
      query: ({ projectId, ...body }) => ({ url: ENDPOINTS.PROJECTS.ISSUES(projectId), method: 'POST', body }),
      transformResponse: (res: ApiResponse<ApiIssue>) => res.data,
      // A new issue changes the project's issue counts and status breakdown
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: 'Issue', id: 'LIST' },
        { type: 'Project', id: projectId },
        { type: 'Project', id: 'LIST' },
        { type: 'ProjectActivity', id: projectId },
      ],
    }),
  }),
});

export const { useCreateIssueMutation } = issuesApi;
