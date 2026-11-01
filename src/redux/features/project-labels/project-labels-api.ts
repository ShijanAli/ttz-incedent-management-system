import { baseApi } from '@/redux/api/base-api';
import { ENDPOINTS } from '@/redux/api/endpoints';
import type { ApiResponse } from '@/redux/api/types';
import type { ProjectLabel } from '@/redux/features/projects/projects-types';

/**
 * Job-title labels a project member can carry. Renaming or deleting one changes
 * what the project member lists show, so those refresh too.
 */
const projectLabelsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getProjectLabels: build.query<ProjectLabel[], void>({
      query: () => ENDPOINTS.ADMIN.PROJECT_LABELS,
      transformResponse: (res: ApiResponse<ProjectLabel[]>) => res.data,
      providesTags: ['ProjectLabel'],
    }),

    createProjectLabel: build.mutation<ProjectLabel, { name: string }>({
      query: (body) => ({ url: ENDPOINTS.ADMIN.PROJECT_LABELS, method: 'POST', body }),
      transformResponse: (res: ApiResponse<ProjectLabel>) => res.data,
      invalidatesTags: ['ProjectLabel'],
    }),

    renameProjectLabel: build.mutation<ProjectLabel, { id: number; name: string }>({
      query: ({ id, name }) => ({ url: ENDPOINTS.ADMIN.PROJECT_LABEL(id), method: 'PATCH', body: { name } }),
      transformResponse: (res: ApiResponse<ProjectLabel>) => res.data,
      invalidatesTags: ['ProjectLabel', 'ProjectMembers', 'Project'],
    }),

    deleteProjectLabel: build.mutation<ApiResponse<unknown>, number>({
      query: (id) => ({ url: ENDPOINTS.ADMIN.PROJECT_LABEL(id), method: 'DELETE' }),
      invalidatesTags: ['ProjectLabel', 'ProjectMembers'],
    }),
  }),
});

export const {
  useGetProjectLabelsQuery,
  useCreateProjectLabelMutation,
  useRenameProjectLabelMutation,
  useDeleteProjectLabelMutation,
} = projectLabelsApi;
