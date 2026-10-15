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
  AddProjectMemberRequest,
  ApiProject,
  ChangeMemberRoleRequest,
  CreateProjectRequest,
  ProjectListParams,
  ProjectMember,
  ProjectStatus,
  RemoveProjectMemberRequest,
  ReplaceProjectStatusesRequest,
  UpdateProjectRequest,
} from './projects-types';

const PROJECT_LIST_TAG = { type: 'Project', id: 'LIST' } as const;

/** Everything that shows a project's members or member count */
const memberTags = (projectId: number) => [
  { type: 'ProjectMembers' as const, id: projectId },
  { type: 'Project' as const, id: projectId },
  PROJECT_LIST_TAG,
];

export const projectsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // ---- Projects ----

    getProjects: build.infiniteQuery<Paginated<ApiProject>, ProjectListParams, PageParam>({
      infiniteQueryOptions: laravelInfiniteOptions<ApiProject, ProjectListParams>(),
      query: ({ queryArg, pageParam }) => ({
        url: ENDPOINTS.PROJECTS.LIST,
        params: { ...queryArg, page: pageParam },
      }),
      transformResponse: (res: PaginatedApiResponse<ApiProject>) => toPaginated(res),
      providesTags: (result) => provideInfiniteListTags('Project', result),
    }),

    getProject: build.query<ApiProject, number>({
      query: (id) => ENDPOINTS.PROJECTS.ONE(id),
      transformResponse: (res: ApiResponse<ApiProject>) => res.data,
      providesTags: (_result, _error, id) => [{ type: 'Project', id }],
    }),

    createProject: build.mutation<ApiProject, CreateProjectRequest>({
      query: (body) => ({ url: ENDPOINTS.PROJECTS.LIST, method: 'POST', body }),
      transformResponse: (res: ApiResponse<ApiProject>) => res.data,
      invalidatesTags: [PROJECT_LIST_TAG],
    }),

    updateProject: build.mutation<ApiProject, UpdateProjectRequest>({
      query: ({ id, ...body }) => ({ url: ENDPOINTS.PROJECTS.ONE(id), method: 'PATCH', body }),
      transformResponse: (res: ApiResponse<ApiProject>) => res.data,
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Project', id }, PROJECT_LIST_TAG],
    }),

    deleteProject: build.mutation<ApiResponse<unknown>, number>({
      query: (id) => ({ url: ENDPOINTS.PROJECTS.ONE(id), method: 'DELETE' }),
      invalidatesTags: (_result, _error, id) => [{ type: 'Project', id }, PROJECT_LIST_TAG],
    }),

    // ---- Members ----

    getProjectMembers: build.query<ProjectMember[], number>({
      query: (projectId) => ENDPOINTS.PROJECTS.MEMBERS(projectId),
      transformResponse: (res: ApiResponse<ProjectMember[]>) => res.data,
      providesTags: (_result, _error, projectId) => [{ type: 'ProjectMembers', id: projectId }],
    }),

    addProjectMember: build.mutation<ApiResponse<unknown>, AddProjectMemberRequest>({
      query: ({ projectId, ...body }) => ({ url: ENDPOINTS.PROJECTS.MEMBERS(projectId), method: 'POST', body }),
      invalidatesTags: (_result, _error, { projectId }) => memberTags(projectId),
    }),

    changeProjectMemberRole: build.mutation<ApiResponse<unknown>, ChangeMemberRoleRequest>({
      query: ({ projectId, userId, role }) => ({
        url: ENDPOINTS.PROJECTS.MEMBER(projectId, userId),
        method: 'PATCH',
        body: { role },
      }),
      invalidatesTags: (_result, _error, { projectId }) => memberTags(projectId),
    }),

    removeProjectMember: build.mutation<ApiResponse<unknown>, RemoveProjectMemberRequest>({
      query: ({ projectId, userId }) => ({ url: ENDPOINTS.PROJECTS.MEMBER(projectId, userId), method: 'DELETE' }),
      invalidatesTags: (_result, _error, { projectId }) => memberTags(projectId),
    }),

    // ---- Workflow statuses ----

    getProjectStatuses: build.query<ProjectStatus[], number>({
      query: (projectId) => ENDPOINTS.PROJECTS.STATUSES(projectId),
      transformResponse: (res: ApiResponse<ProjectStatus[]>) => res.data,
      providesTags: (_result, _error, projectId) => [{ type: 'ProjectStatuses', id: projectId }],
    }),

    /** Replaces the whole workflow: order, initial and terminal flags */
    replaceProjectStatuses: build.mutation<ApiResponse<unknown>, ReplaceProjectStatusesRequest>({
      query: ({ projectId, statuses }) => ({
        url: ENDPOINTS.PROJECTS.STATUSES(projectId),
        method: 'PUT',
        body: { statuses },
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: 'ProjectStatuses', id: projectId },
        { type: 'Project', id: projectId },
        PROJECT_LIST_TAG,
      ],
    }),
  }),
});

export const {
  useGetProjectsInfiniteQuery,
  useGetProjectQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
  useGetProjectMembersQuery,
  useAddProjectMemberMutation,
  useChangeProjectMemberRoleMutation,
  useRemoveProjectMemberMutation,
  useGetProjectStatusesQuery,
  useReplaceProjectStatusesMutation,
} = projectsApi;
