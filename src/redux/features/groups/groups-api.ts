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
  AddGroupMemberRequest,
  ApiGroup,
  ChangeGroupMemberRoleRequest,
  CreateGroupRequest,
  GroupDetail,
  GroupListParams,
  GroupMember,
  GroupProject,
  RemoveGroupMemberRequest,
  UpdateGroupRequest,
} from './groups-types';

const GROUP_LIST_TAG = { type: 'Group', id: 'LIST' } as const;

/**
 * Group membership flows into every attached project ("Via group" members), so a
 * member change also refreshes project members and counts.
 */
const memberChangeTags = (groupId: number) => [
  { type: 'GroupMembers' as const, id: groupId },
  { type: 'Group' as const, id: groupId },
  GROUP_LIST_TAG,
  'ProjectMembers' as const,
  'Project' as const,
  'ProjectActivity' as const,
];

export const groupsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // ---- Groups ----

    getGroups: build.infiniteQuery<Paginated<ApiGroup>, GroupListParams, PageParam>({
      infiniteQueryOptions: laravelInfiniteOptions<ApiGroup, GroupListParams>(),
      query: ({ queryArg, pageParam }) => ({
        url: ENDPOINTS.ADMIN.GROUPS,
        params: { ...queryArg, page: pageParam },
      }),
      transformResponse: (res: PaginatedApiResponse<ApiGroup>) => toPaginated(res),
      providesTags: (result) => provideInfiniteListTags('Group', result),
    }),

    getGroup: build.query<GroupDetail, number>({
      query: (id) => ENDPOINTS.ADMIN.GROUP(id),
      transformResponse: (res: ApiResponse<GroupDetail>) => res.data,
      providesTags: (_result, _error, id) => [{ type: 'Group', id }],
    }),

    createGroup: build.mutation<ApiGroup, CreateGroupRequest>({
      query: (body) => ({ url: ENDPOINTS.ADMIN.GROUPS, method: 'POST', body }),
      transformResponse: (res: ApiResponse<ApiGroup>) => res.data,
      // A new group can be attached to projects and bring members into them
      invalidatesTags: [GROUP_LIST_TAG, 'Project', 'ProjectMembers'],
    }),

    updateGroup: build.mutation<ApiGroup, UpdateGroupRequest>({
      query: ({ id, ...body }) => ({ url: ENDPOINTS.ADMIN.GROUP(id), method: 'PATCH', body }),
      transformResponse: (res: ApiResponse<ApiGroup>) => res.data,
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Group', id }, GROUP_LIST_TAG, 'Project'],
    }),

    deleteGroup: build.mutation<ApiResponse<unknown>, number>({
      query: (id) => ({ url: ENDPOINTS.ADMIN.GROUP(id), method: 'DELETE' }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Group', id }, GROUP_LIST_TAG, 'Project', 'ProjectMembers',
      ],
    }),

    // ---- Projects the group is attached to ----

    getGroupProjects: build.query<GroupProject[], number>({
      query: (groupId) => ENDPOINTS.ADMIN.GROUP_PROJECTS(groupId),
      transformResponse: (res: ApiResponse<GroupProject[]>) => res.data,
      providesTags: (_result, _error, groupId) => [{ type: 'GroupProjects', id: groupId }],
    }),

    // ---- Members ----

    getGroupMembers: build.query<GroupMember[], number>({
      query: (groupId) => ENDPOINTS.ADMIN.GROUP_MEMBERS(groupId),
      transformResponse: (res: ApiResponse<GroupMember[]>) => res.data,
      providesTags: (_result, _error, groupId) => [{ type: 'GroupMembers', id: groupId }],
    }),

    addGroupMember: build.mutation<ApiResponse<unknown>, AddGroupMemberRequest>({
      query: ({ groupId, ...body }) => ({ url: ENDPOINTS.ADMIN.GROUP_MEMBERS(groupId), method: 'POST', body }),
      invalidatesTags: (_result, _error, { groupId }) => memberChangeTags(groupId),
    }),

    changeGroupMemberRole: build.mutation<ApiResponse<unknown>, ChangeGroupMemberRoleRequest>({
      query: ({ groupId, userId, role }) => ({
        url: ENDPOINTS.ADMIN.GROUP_MEMBER(groupId, userId),
        method: 'PATCH',
        body: { role },
      }),
      invalidatesTags: (_result, _error, { groupId }) => memberChangeTags(groupId),
    }),

    removeGroupMember: build.mutation<ApiResponse<unknown>, RemoveGroupMemberRequest>({
      query: ({ groupId, userId }) => ({ url: ENDPOINTS.ADMIN.GROUP_MEMBER(groupId, userId), method: 'DELETE' }),
      invalidatesTags: (_result, _error, { groupId }) => memberChangeTags(groupId),
    }),
  }),
});

export const {
  useGetGroupsInfiniteQuery,
  useGetGroupQuery,
  useCreateGroupMutation,
  useUpdateGroupMutation,
  useDeleteGroupMutation,
  useGetGroupProjectsQuery,
  useGetGroupMembersQuery,
  useAddGroupMemberMutation,
  useChangeGroupMemberRoleMutation,
  useRemoveGroupMemberMutation,
} = groupsApi;
