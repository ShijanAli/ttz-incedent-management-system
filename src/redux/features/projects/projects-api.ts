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
  CatalogStatus,
  ChangeMemberRoleRequest,
  CreateProjectRequest,
  CreateProjectStatusRequest,
  DeleteProjectStatusRequest,
  ProjectFilterOptions,
  ProjectListParams,
  ProjectMember,
  ProjectStatus,
  RemoveProjectMemberRequest,
  StatusCatalogArgs,
  ReplaceProjectStatusesRequest,
  UpdateProjectLogoRequest,
  UpdateProjectRequest,
  UpdateProjectStatusRequest,
} from './projects-types';
import type { ActivityEntry } from '@/redux/features/activity/activity-types';

const PROJECT_LIST_TAG = { type: 'Project', id: 'LIST' } as const;
const STATUS_CATALOG_TAG = 'StatusCatalog' as const;

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

    /** Status and priority options for the list filters */
    getProjectFilters: build.query<ProjectFilterOptions, void>({
      query: () => ENDPOINTS.PROJECTS.FILTERS,
      transformResponse: (res: ApiResponse<ProjectFilterOptions>) => res.data,
      // The lists are fixed per deployment
      keepUnusedDataFor: 600,
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

    /**
     * Sent as POST with form-data because a file can't ride on a real PATCH (PHP leaves a
     * multipart PATCH body empty). Pass `logo` to replace it, or `remove` to delete it.
     */
    updateProjectLogo: build.mutation<ApiProject, UpdateProjectLogoRequest>({
      query: ({ id, logo, remove }) => {
        const form = new FormData();
        if (logo) form.append('logo', logo);
        else if (remove) form.append('remove_logo', '1');
        return { url: ENDPOINTS.PROJECTS.ONE(id), method: 'POST', body: form };
      },
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

    /** Statuses a project's workflow picks from (inactive ones are left out) */
    getStatusCatalog: build.query<ProjectStatus[], StatusCatalogArgs>({
      query: ({ admin, projectId }) =>
        admin
          ? ENDPOINTS.ADMIN.STATUSES
          : { url: ENDPOINTS.STATUSES, params: projectId ? { project_id: projectId } : undefined },
      transformResponse: (res: ApiResponse<CatalogStatus[]>) =>
        res.data
          .filter((s) => s.is_active !== false)
          // The catalog has no flags; a project's workflow sets those when the status is added
          .map(({ id, name, slug, color, sort_order }) => ({ id, name, slug, color, sort_order, is_initial: false, is_terminal: false }))
          .sort((a, b) => a.sort_order - b.sort_order),
      providesTags: [STATUS_CATALOG_TAG],
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
        STATUS_CATALOG_TAG,
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
        STATUS_CATALOG_TAG,
        'Issue',
      ],
    }),

    /** Only a status this project created, and only while no issue uses it */
    deleteProjectStatus: build.mutation<ApiResponse<unknown>, DeleteProjectStatusRequest>({
      query: ({ projectId, statusId }) => ({
        url: ENDPOINTS.PROJECTS.STATUS(projectId, statusId),
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: 'ProjectStatuses', id: projectId },
        { type: 'Project', id: projectId },
        { type: 'ProjectActivity', id: projectId },
        PROJECT_LIST_TAG,
        STATUS_CATALOG_TAG,
      ],
    }),
  }),
});

// Projects, their members and activity change under the user, so every mount loads fresh data
export const { useGetStatusCatalogQuery, useGetProjectFiltersQuery } = projectsApi;
export const useGetProjectsInfiniteQuery = alwaysFresh(projectsApi.useGetProjectsInfiniteQuery);
export const useGetProjectQuery = alwaysFresh(projectsApi.useGetProjectQuery);
export const useGetProjectMembersQuery = alwaysFresh(projectsApi.useGetProjectMembersQuery);
export const useGetProjectActivityInfiniteQuery = alwaysFresh(projectsApi.useGetProjectActivityInfiniteQuery);
export const useGetProjectGroupsQuery = alwaysFresh(projectsApi.useGetProjectGroupsQuery);
export const useGetProjectStatusesQuery = alwaysFresh(projectsApi.useGetProjectStatusesQuery);

export const {
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useUpdateProjectLogoMutation,
  useDeleteProjectMutation,
  useAddProjectMemberMutation,
  useChangeProjectMemberRoleMutation,
  useRemoveProjectMemberMutation,
  useAttachProjectGroupMutation,
  useDetachProjectGroupMutation,
  useReplaceProjectStatusesMutation,
  useCreateProjectStatusMutation,
  useUpdateProjectStatusMutation,
  useDeleteProjectStatusMutation,
} = projectsApi;
