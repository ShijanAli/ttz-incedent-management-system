import { baseApi } from '@/redux/api/base-api';
import { ENDPOINTS } from '@/redux/api/endpoints';
import type { ApiResponse } from '@/redux/api/types';
import type {
  CreateIssueCategoryRequest,
  IssueCategory,
  UpdateIssueCategoryRequest,
} from './issue-categories-types';

const LIST_TAG = { type: 'IssueCategory' as const, id: 'LIST' };

export const issueCategoriesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getIssueCategories: build.query<IssueCategory[], void>({
      query: () => ENDPOINTS.ADMIN.ISSUE_CATEGORIES,
      transformResponse: (res: ApiResponse<IssueCategory[]>) => res.data,
      providesTags: [LIST_TAG],
    }),

    createIssueCategory: build.mutation<IssueCategory, CreateIssueCategoryRequest>({
      query: (body) => ({ url: ENDPOINTS.ADMIN.ISSUE_CATEGORIES, method: 'POST', body }),
      transformResponse: (res: ApiResponse<IssueCategory>) => res.data,
      invalidatesTags: [LIST_TAG],
    }),

    updateIssueCategory: build.mutation<IssueCategory, UpdateIssueCategoryRequest>({
      query: ({ id, ...body }) => ({ url: ENDPOINTS.ADMIN.ISSUE_CATEGORY(id), method: 'PATCH', body }),
      transformResponse: (res: ApiResponse<IssueCategory>) => res.data,
      // Issues show the category's name and color, so they refresh too
      invalidatesTags: [LIST_TAG, 'Issue'],
    }),

    /** Only categories no issue uses can be deleted; the API rejects the rest */
    deleteIssueCategory: build.mutation<ApiResponse<unknown>, number>({
      query: (id) => ({ url: ENDPOINTS.ADMIN.ISSUE_CATEGORY(id), method: 'DELETE' }),
      invalidatesTags: [LIST_TAG],
    }),
  }),
});

export const {
  useGetIssueCategoriesQuery,
  useCreateIssueCategoryMutation,
  useUpdateIssueCategoryMutation,
  useDeleteIssueCategoryMutation,
} = issueCategoriesApi;
