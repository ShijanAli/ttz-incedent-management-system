import { baseApi } from '@/redux/api/base-api';
import { alwaysFresh } from '@/redux/api/fresh';
import { ENDPOINTS } from '@/redux/api/endpoints';
import { laravelInfiniteOptions, type PageParam } from '@/redux/api/infinite';
import { toPaginated, type ApiResponse, type Paginated, type PaginatedApiResponse } from '@/redux/api/types';
import type { AppNotification, NotificationPreferences } from './notifications-types';

const LIST_TAG = { type: 'Notification' as const, id: 'LIST' };
const COUNT_TAG = { type: 'Notification' as const, id: 'COUNT' };
const PREFERENCES_TAG = 'NotificationPreferences' as const;

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

    /** Marks the chosen notifications read (100 ids at most); ones that aren't yours are skipped server-side */
    markSelectedNotificationsRead: build.mutation<ApiResponse<unknown>, string[]>({
      query: (ids) => ({ url: ENDPOINTS.NOTIFICATIONS.READ_SELECTED, method: 'POST', body: { ids } }),
      async onQueryStarted(ids, { dispatch, queryFulfilled }) {
        const now = new Date().toISOString();
        const chosen = new Set(ids);
        let newlyRead = 0;
        const list = dispatch(
          notificationsApi.util.updateQueryData('getNotifications', undefined, (draft) => {
            for (const page of draft.pages) {
              for (const row of page.items) {
                if (chosen.has(row.id) && !row.read_at) {
                  row.read_at = now;
                  newlyRead += 1;
                }
              }
            }
          }),
        );
        const count = dispatch(
          notificationsApi.util.updateQueryData('getUnreadNotificationCount', undefined, (draft) =>
            Math.max(0, draft - newlyRead),
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

    deleteNotification: build.mutation<ApiResponse<unknown>, string>({
      query: (id) => ({ url: ENDPOINTS.NOTIFICATIONS.DELETE(id), method: 'DELETE' }),
      invalidatesTags: [LIST_TAG, COUNT_TAG],
    }),

    /** POST rather than DELETE: some proxies drop a DELETE body */
    deleteSelectedNotifications: build.mutation<ApiResponse<unknown>, string[]>({
      query: (ids) => ({ url: ENDPOINTS.NOTIFICATIONS.DELETE_SELECTED, method: 'POST', body: { ids } }),
      invalidatesTags: [LIST_TAG, COUNT_TAG],
    }),

    getNotificationPreferences: build.query<NotificationPreferences, void>({
      query: () => ENDPOINTS.NOTIFICATIONS.PREFERENCES,
      transformResponse: (res: ApiResponse<NotificationPreferences>) => res.data,
      providesTags: [PREFERENCES_TAG],
    }),

    /** Send only the toggles that changed; the response is the full set */
    updateNotificationPreferences: build.mutation<NotificationPreferences, Partial<NotificationPreferences>>({
      query: (body) => ({ url: ENDPOINTS.NOTIFICATIONS.PREFERENCES, method: 'PATCH', body }),
      transformResponse: (res: ApiResponse<NotificationPreferences>) => res.data,
      // Flip the switch right away, then settle on what the server returns
      async onQueryStarted(patch, { dispatch, queryFulfilled }) {
        const optimistic = dispatch(
          notificationsApi.util.updateQueryData('getNotificationPreferences', undefined, (draft) => {
            Object.assign(draft, patch);
          }),
        );
        try {
          const { data } = await queryFulfilled;
          dispatch(notificationsApi.util.upsertQueryData('getNotificationPreferences', undefined, data));
        } catch {
          optimistic.undo();
        }
      },
    }),
  }),
});

// New notifications arrive all the time, so every mount loads fresh data
export const useGetNotificationsInfiniteQuery = alwaysFresh(notificationsApi.useGetNotificationsInfiniteQuery);
export const useGetUnreadNotificationCountQuery = alwaysFresh(notificationsApi.useGetUnreadNotificationCountQuery);

export const {
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useMarkSelectedNotificationsReadMutation,
  useDeleteNotificationMutation,
  useDeleteSelectedNotificationsMutation,
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
} = notificationsApi;
