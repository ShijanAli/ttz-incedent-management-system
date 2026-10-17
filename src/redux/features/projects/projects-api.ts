import { baseApi } from '@/redux/api/base-api';
import { alwaysFresh } from '@/redux/api/fresh';
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
  AttachProjectGroupRequest,
  DetachProjectGroupRequest,
  ProjectGroupSummary,
  ApiProject,
  ChangeMemberRoleRequest,
  CreateProjectRequest,
  CreateProjectStatusRequest,
  ProjectListParams,
  ProjectMember,
  ProjectStatus,
  RemoveProjectMemberRequest,
  ReplaceProjectStatusesRequest,
  UpdateProjectRequest,
  UpdateProjectStatusRequest,
} from './projects-types';
import type { ActivityEntry } from '@/redux/features/activity/activity-types';

const PROJECT_LIST_TAG = { type: 'Project', id: 'LIST' } as const;

/** Everything that shows a project's members or member count */
const memberTags = (projectId: number) => [
  { type: 'ProjectMembers' as const, id: projectId },
  { type: 'Project' as const, id: projectId },
  { type: 'ProjectActivity' as const, id: projectId },
  PROJECT_LIST_TAG,
];

/**
 * Attaching or detaching a group changes the project's groups, its members (group
 * members join as "Via group") and counts, and the group's own project list.
 */
const groupLinkTags = (projectId: number, groupId: number) => [
  { type: 'ProjectGroups' as const, id: projectId },
  ...memberTags(projectId),
  { type: 'GroupProjects' as const, id: groupId },
  { type: 'Group' as const, id: groupId },
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
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Project', id }, { type: 'ProjectActivity', id }, PROJECT_LIST_TAG],
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

    // ---- Groups attached to the project ----

    getProjectGroups: build.query<ProjectGroupSummary[], number>({
      query: (projectId) => ENDPOINTS.PROJECTS.GROUPS(projectId),
      transformResponse: (res: ApiResponse<ProjectGroupSummary[]>) => res.data,
      providesTags: (_result, _error, projectId) => [{ type: 'ProjectGroups', id: projectId }],
    }),

    attachProjectGroup: build.mutation<ApiResponse<unknown>, AttachProjectGroupRequest>({
      query: ({ projectId, group_id }) => ({ url: ENDPOINTS.PROJECTS.GROUPS(projectId), method: 'POST', body: { group_id } }),
      invalidatesTags: (_result, _error, { projectId, group_id }) => groupLinkTags(projectId, group_id),
    }),

    detachProjectGroup: build.mutation<ApiResponse<unknown>, DetachProjectGroupRequest>({
      query: ({ projectId, groupId }) => ({ url: ENDPOINTS.PROJECTS.GROUP(projectId, groupId), method: 'DELETE' }),
      invalidatesTags: (_result, _error, { projectId, groupId }) => groupLinkTags(projectId, groupId),
    }),

    // ---- Activity log ----

    getProjectActivity: build.infiniteQuery<Paginated<ActivityEntry>, number, PageParam>({
      infiniteQueryOptions: laravelInfiniteOptions<ActivityEntry, number>(),
      query: ({ queryArg: projectId, pageParam }) => ({
        url: ENDPOINTS.PROJECTS.ACTIVITY(projectId),
        params: { page: pageParam },
      }),
      transformResponse: (res: PaginatedApiResponse<ActivityEntry>) => toPaginated(res),
      providesTags: (_result, _error, projectId) => [{ type: 'ProjectActivity', id: projectId }],
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
        { type: 'ProjectActivity', id: projectId },
        PROJECT_LIST_TAG,
      ],
    }),

    createProjectStatus: build.mutation<ApiResponse<ProjectStatus>, CreateProjectStatusRequest>({
      query: ({ projectId, ...body }) => ({ url: ENDPOINTS.PROJECTS.STATUSES(projectId), method: 'POST', body }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: 'ProjectStatuses', id: projectId },
        { type: 'Project', id: projectId },
        { type: 'ProjectActivity', id: projectId },
        PROJECT_LIST_TAG,
      ],
    }),

    /** Rename or recolor a status; issues show its name and color, so they refresh too */
    updateProjectStatus: build.mutation<ApiResponse<ProjectStatus>, UpdateProjectStatusRequest>({
      query: ({ projectId, statusId, ...body }) => ({
        url: ENDPOINTS.PROJECTS.STATUS(projectId, statusId),
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: 'ProjectStatuses', id: projectId },
        { type: 'Project', id: projectId },
        { type: 'ProjectActivity', id: projectId },
        PROJECT_LIST_TAG,
        'Issue',
      ],
    }),
  }),
});

// Projects, their members and activity change under the user, so every mount loads fresh data
export const useGetProjectsInfiniteQuery = alwaysFresh(projectsApi.useGetProjectsInfiniteQuery);
export const useGetProjectQuery = alwaysFresh(projectsApi.useGetProjectQuery);
export const useGetProjectMembersQuery = alwaysFresh(projectsApi.useGetProjectMembersQuery);
export const useGetProjectActivityInfiniteQuery = alwaysFresh(projectsApi.useGetProjectActivityInfiniteQuery);
export const useGetProjectGroupsQuery = alwaysFresh(projectsApi.useGetProjectGroupsQuery);
export const useGetProjectStatusesQuery = alwaysFresh(projectsApi.useGetProjectStatusesQuery);

export const {
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
  useAddProjectMemberMutation,
  useChangeProjectMemberRoleMutation,
  useRemoveProjectMemberMutation,
  useAttachProjectGroupMutation,
  useDetachProjectGroupMutation,
  useReplaceProjectStatusesMutation,
  useCreateProjectStatusMutation,
  useUpdateProjectStatusMutation,
} = projectsApi;
