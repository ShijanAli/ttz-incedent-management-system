import { baseApi } from '@/redux/api/base-api';
import { ENDPOINTS } from '@/redux/api/endpoints';
import { laravelInfiniteOptions, provideInfiniteListTags, type PageParam } from '@/redux/api/infinite';
import {
  toPaginated,
  type ApiResponse,
  type Paginated,
  type PaginatedApiResponse,
} from '@/redux/api/types';
import type {
  ApiIssue,
  CreateIssueRequest,
  IssueListArgs,
  IssueListItem,
  IssueListScope,
  IssueSummary,
  ProjectIssuesArgs,
} from './issues-types';

const ISSUE_LIST_URL: Record<IssueListScope, string> = {
  admin: ENDPOINTS.ADMIN.ISSUES,
  my: ENDPOINTS.MY.ISSUES,
};

export const issuesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getIssues: build.infiniteQuery<Paginated<IssueListItem>, IssueListArgs, PageParam>({
      infiniteQueryOptions: laravelInfiniteOptions<IssueListItem, IssueListArgs>(),
      query: ({ queryArg: { scope, ...filters }, pageParam }) => ({
        url: ISSUE_LIST_URL[scope],
        params: { ...filters, page: pageParam },
      }),
      transformResponse: (res: PaginatedApiResponse<IssueListItem>) => toPaginated(res),
      providesTags: (result) => provideInfiniteListTags('Issue', result),
    }),

    /** Issues of one project (GET /projects/{id}/issues); same filters as the global lists */
    getProjectIssues: build.infiniteQuery<Paginated<IssueSummary>, ProjectIssuesArgs, PageParam>({
      infiniteQueryOptions: laravelInfiniteOptions<IssueSummary, ProjectIssuesArgs>(),
      query: ({ queryArg: { projectId, ...filters }, pageParam }) => ({
        url: ENDPOINTS.PROJECTS.ISSUES(projectId),
        params: { ...filters, page: pageParam },
      }),
      transformResponse: (res: PaginatedApiResponse<IssueSummary>) => toPaginated(res),
      providesTags: (result) => provideInfiniteListTags('Issue', result),
    }),

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

export const {
  useGetIssuesInfiniteQuery,
  useGetProjectIssuesInfiniteQuery,
  useCreateIssueMutation,
} = issuesApi;
