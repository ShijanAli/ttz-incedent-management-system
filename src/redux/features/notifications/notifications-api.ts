import { baseApi } from '@/redux/api/base-api';
import { alwaysFresh } from '@/redux/api/fresh';
import { ENDPOINTS } from '@/redux/api/endpoints';
import { laravelInfiniteOptions, type PageParam } from '@/redux/api/infinite';
import { toPaginated, type ApiResponse, type Paginated, type PaginatedApiResponse } from '@/redux/api/types';
import type { AppNotification } from './notifications-types';

const LIST_TAG = { type: 'Notification' as const, id: 'LIST' };
const COUNT_TAG = { type: 'Notification' as const, id: 'COUNT' };

export const notificationsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** Newest first, 25 per page. The topbar and the notifications page share this cache. */
    getNotifications: build.infiniteQuery<Paginated<AppNotification>, void, PageParam>({
      infiniteQueryOptions: laravelInfiniteOptions<AppNotification, void>(),
      query: ({ pageParam }) => ({ url: ENDPOINTS.NOTIFICATIONS.LIST, params: { page: pageParam } }),
      transformResponse: (res: PaginatedApiResponse<AppNotification>) => toPaginated(res),
      providesTags: [LIST_TAG],
    }),

    getUnreadNotificationCount: build.query<number, void>({
      query: () => ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT,
      transformResponse: (res: ApiResponse<{ count: number }>) => res.data.count,
      providesTags: [COUNT_TAG],
    }),

    markNotificationRead: build.mutation<ApiResponse<unknown>, string>({
      query: (id) => ({ url: ENDPOINTS.NOTIFICATIONS.READ(id), method: 'POST' }),
      // Flip the row and the badge right away; roll back if the request fails
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        const now = new Date().toISOString();
        let wasUnread = false;
        const list = dispatch(
          notificationsApi.util.updateQueryData('getNotifications', undefined, (draft) => {
            for (const page of draft.pages) {
              const row = page.items.find((n) => n.id === id);
              if (row && !row.read_at) {
                row.read_at = now;
                wasUnread = true;
              }
            }
          }),
        );
        const count = dispatch(
          notificationsApi.util.updateQueryData('getUnreadNotificationCount', undefined, (draft) =>
            wasUnread ? Math.max(0, draft - 1) : draft,
          ),
        );
        try {
          await queryFulfilled;
        } catch {
          list.undo();
          count.undo();
        }
      },
      invalidatesTags: [COUNT_TAG],
    }),

    markAllNotificationsRead: build.mutation<ApiResponse<unknown>, void>({
      query: () => ({ url: ENDPOINTS.NOTIFICATIONS.READ_ALL, method: 'POST' }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        const now = new Date().toISOString();
        const list = dispatch(
          notificationsApi.util.updateQueryData('getNotifications', undefined, (draft) => {
            for (const page of draft.pages) {
              for (const row of page.items) row.read_at ??= now;
            }
          }),
        );
        const count = dispatch(notificationsApi.util.updateQueryData('getUnreadNotificationCount', undefined, () => 0));
        try {
          await queryFulfilled;
        } catch {
          list.undo();
          count.undo();
        }
      },
      invalidatesTags: [COUNT_TAG],
    }),
  }),
});

// New notifications arrive all the time, so every mount loads fresh data
export const useGetNotificationsInfiniteQuery = alwaysFresh(notificationsApi.useGetNotificationsInfiniteQuery);
export const useGetUnreadNotificationCountQuery = alwaysFresh(notificationsApi.useGetUnreadNotificationCountQuery);

export const {
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} = notificationsApi;
