import { baseApi } from '@/redux/api/base-api';
import { ENDPOINTS } from '@/redux/api/endpoints';
import type { ApiResponse } from '@/redux/api/types';
import type {
  ApiPermissionModule,
  ApiRole,
  RoleRequest,
  UpdateRoleRequest,
} from './roles-types';

const ROLE_LIST_TAG = { type: 'Role', id: 'LIST' } as const;

export const rolesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getPermissionCatalog: build.query<ApiPermissionModule[], void>({
      query: () => ENDPOINTS.ADMIN.PERMISSIONS,
      transformResponse: (res: ApiResponse<ApiPermissionModule[]>) => res.data,
      providesTags: ['PermissionCatalog'],
      // The catalog is static per deployment
      keepUnusedDataFor: 600,
    }),

    getRoles: build.query<ApiRole[], void>({
      query: () => ENDPOINTS.ADMIN.ROLES,
      transformResponse: (res: ApiResponse<ApiRole[]>) => res.data,
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: 'Role' as const, id })), ROLE_LIST_TAG]
          : [ROLE_LIST_TAG],
    }),

    createRole: build.mutation<ApiRole, RoleRequest>({
      query: (body) => ({ url: ENDPOINTS.ADMIN.ROLES, method: 'POST', body }),
      transformResponse: (res: ApiResponse<ApiRole>) => res.data,
      invalidatesTags: [ROLE_LIST_TAG],
    }),

    updateRole: build.mutation<ApiRole, UpdateRoleRequest>({
      query: ({ id, ...body }) => ({ url: ENDPOINTS.ADMIN.ROLE(id), method: 'PATCH', body }),
      transformResponse: (res: ApiResponse<ApiRole>) => res.data,
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Role', id }, ROLE_LIST_TAG],
    }),

    deleteRole: build.mutation<ApiResponse<unknown>, number>({
      query: (id) => ({ url: ENDPOINTS.ADMIN.ROLE(id), method: 'DELETE' }),
      invalidatesTags: (_result, _error, id) => [{ type: 'Role', id }, ROLE_LIST_TAG],
    }),
  }),
});

export const {
  useGetPermissionCatalogQuery,
  useGetRolesQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
} = rolesApi;
