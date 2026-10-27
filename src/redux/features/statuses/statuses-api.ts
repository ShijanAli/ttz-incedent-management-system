import { baseApi } from '@/redux/api/base-api';
import { ENDPOINTS } from '@/redux/api/endpoints';
import type { ApiResponse } from '@/redux/api/types';
import type { CatalogStatus } from '@/redux/features/projects/projects-types';

/** A global (default) workflow status, as GET /api/admin/statuses returns it */
export type GlobalStatus = CatalogStatus & { is_active: boolean };

export interface CreateGlobalStatusBody {
  name: string;
  slug: string;
  color: string;
  is_active: boolean;
}

export type UpdateGlobalStatusBody = { id: number } & Partial<Omit<CreateGlobalStatusBody, 'slug'>>;

/**
 * Super admin: the default statuses every project's workflow picks from.
 * Changing one also changes how issues and project workflows show it, so those refresh.
 */
const statusesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getGlobalStatuses: build.query<GlobalStatus[], void>({
      query: () => ENDPOINTS.ADMIN.STATUSES,
      transformResponse: (res: ApiResponse<CatalogStatus[]>) =>
        res.data
          .map((s) => ({ ...s, is_active: s.is_active !== false }))
          .sort((a, b) => a.sort_order - b.sort_order),
      providesTags: ['StatusCatalog'],
    }),

    createGlobalStatus: build.mutation<ApiResponse<GlobalStatus>, CreateGlobalStatusBody>({
      query: (body) => ({ url: ENDPOINTS.ADMIN.STATUSES, method: 'POST', body }),
      invalidatesTags: ['StatusCatalog'],
    }),

    updateGlobalStatus: build.mutation<ApiResponse<GlobalStatus>, UpdateGlobalStatusBody>({
      query: ({ id, ...body }) => ({ url: ENDPOINTS.ADMIN.STATUS(id), method: 'PATCH', body }),
      invalidatesTags: ['StatusCatalog', 'ProjectStatuses', 'Issue'],
    }),

    deleteGlobalStatus: build.mutation<ApiResponse<unknown>, number>({
      query: (id) => ({ url: ENDPOINTS.ADMIN.STATUS(id), method: 'DELETE' }),
      invalidatesTags: ['StatusCatalog', 'ProjectStatuses'],
    }),
  }),
});

export const {
  useGetGlobalStatusesQuery,
  useCreateGlobalStatusMutation,
  useUpdateGlobalStatusMutation,
  useDeleteGlobalStatusMutation,
} = statusesApi;
