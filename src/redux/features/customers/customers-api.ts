import { baseApi } from '@/redux/api/base-api';
import { alwaysFresh } from '@/redux/api/fresh';
import { ENDPOINTS } from '@/redux/api/endpoints';
import { laravelInfiniteOptions, provideInfiniteListTags, type PageParam } from '@/redux/api/infinite';
import type { ApiResponse, Paginated, PaginatedApiResponse } from '@/redux/api/types';
import type { CreateCustomerRequest, Customer, CustomerListArgs, UpdateCustomerRequest } from './customers-types';

const LIST_TAG = { type: 'Customer' as const, id: 'LIST' };

export const customersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCustomers: build.infiniteQuery<Paginated<Customer>, CustomerListArgs, PageParam>({
      infiniteQueryOptions: laravelInfiniteOptions<Customer, CustomerListArgs>(),
      query: ({ queryArg: { admin, ...filters }, pageParam }) => ({
        url: admin ? ENDPOINTS.ADMIN.CUSTOMERS : ENDPOINTS.CUSTOMERS,
        params: { ...filters, page: pageParam },
      }),
      // A plain (unpaginated) list is treated as a single page
      transformResponse: (res: PaginatedApiResponse<Customer>) => ({
        items: res.data,
        meta: res.meta ?? {
          current_page: 1, last_page: 1, per_page: res.data.length, total: res.data.length,
          from: res.data.length ? 1 : null, to: res.data.length || null,
        },
      }),
      providesTags: (result) => provideInfiniteListTags('Customer', result),
    }),

    createCustomer: build.mutation<Customer, CreateCustomerRequest>({
      query: (body) => ({ url: ENDPOINTS.ADMIN.CUSTOMERS, method: 'POST', body }),
      transformResponse: (res: ApiResponse<Customer>) => res.data,
      invalidatesTags: [LIST_TAG],
    }),

    updateCustomer: build.mutation<Customer, UpdateCustomerRequest>({
      query: ({ id, ...body }) => ({ url: ENDPOINTS.ADMIN.CUSTOMER(id), method: 'PATCH', body }),
      transformResponse: (res: ApiResponse<Customer>) => res.data,
      // Issues show the customer's name, so they refresh too
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Customer', id }, LIST_TAG, 'Issue'],
    }),

    /**
     * Deletes a customer nobody references; one with complaints is deactivated instead.
     * The response message says which happened.
     */
    deleteCustomer: build.mutation<ApiResponse<Customer | null>, number>({
      query: (id) => ({ url: ENDPOINTS.ADMIN.CUSTOMER(id), method: 'DELETE' }),
      invalidatesTags: (_result, _error, id) => [{ type: 'Customer', id }, LIST_TAG],
    }),
  }),
});

export const useGetCustomersInfiniteQuery = alwaysFresh(customersApi.useGetCustomersInfiniteQuery);
export const {
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useDeleteCustomerMutation,
} = customersApi;
