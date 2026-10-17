import { baseApi } from "@/redux/api/base-api";
import { ENDPOINTS } from "@/redux/api/endpoints";
import {
  laravelInfiniteOptions,
  provideInfiniteListTags,
  type PageParam,
} from "@/redux/api/infinite";
import {
  toPaginated,
  type ApiResponse,
  type Paginated,
  type PaginatedApiResponse,
} from "@/redux/api/types";
import {
  DISABLED_STATUS,
  type AdminUser,
  type CreateUserRequest,
  type UpdateUserRequest,
  type UserListParams,
} from "./users-types";

const USER_LIST_TAG = { type: "User", id: "LIST" } as const;
// Role member counts change whenever a user's role or status does
const ROLE_LIST_TAG = { type: "Role", id: "LIST" } as const;

export const usersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getUsers: build.infiniteQuery<
      Paginated<AdminUser>,
      UserListParams,
      PageParam
    >({
      infiniteQueryOptions: laravelInfiniteOptions<AdminUser, UserListParams>(),
      query: ({ queryArg, pageParam }) => ({
        url: ENDPOINTS.ADMIN.USERS,
        params: { ...queryArg, page: pageParam },
      }),
      transformResponse: (res: PaginatedApiResponse<AdminUser>) =>
        toPaginated(res),
      providesTags: (result) => provideInfiniteListTags("User", result),
    }),

    getUser: build.query<AdminUser, number>({
      query: (id) => ENDPOINTS.ADMIN.USER(id),
      transformResponse: (res: ApiResponse<AdminUser>) => res.data,
      providesTags: (_result, _error, id) => [{ type: "User", id }],
    }),

    createUser: build.mutation<AdminUser, CreateUserRequest>({
      query: (body) => ({ url: ENDPOINTS.ADMIN.USERS, method: "POST", body }),
      transformResponse: (res: ApiResponse<AdminUser>) => res.data,
      invalidatesTags: [USER_LIST_TAG, ROLE_LIST_TAG],
    }),

    updateUser: build.mutation<AdminUser, UpdateUserRequest>({
      query: ({ id, ...body }) => ({
        url: ENDPOINTS.ADMIN.USER(id),
        method: "PATCH",
        body,
      }),
      transformResponse: (res: ApiResponse<AdminUser>) => res.data,
      async onQueryStarted({ id, ...changes }, api) {
        await withOptimisticUser(api, id, (user) =>
          Object.assign(user, changes),
        );
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: "User", id },
        USER_LIST_TAG,
        ROLE_LIST_TAG,
      ],
    }),

    /** The backend disables (soft-deletes) the account; it can be re-activated via update */
    disableUser: build.mutation<ApiResponse<unknown>, number>({
      query: (id) => ({ url: ENDPOINTS.ADMIN.USER(id), method: "DELETE" }),
      async onQueryStarted(id, api) {
        await withOptimisticUser(api, id, (user) => {
          user.status = DISABLED_STATUS;
        });
      },
      invalidatesTags: (_result, _error, id) => [
        { type: "User", id },
        USER_LIST_TAG,
        ROLE_LIST_TAG,
      ],
    }),

    resendInvite: build.mutation<ApiResponse<unknown>, number>({
      query: (id) => ({
        url: ENDPOINTS.ADMIN.USER_RESEND_INVITE(id),
        method: "POST",
      }),
    }),
  }),
});

export const {
  useGetUsersInfiniteQuery,
  useGetUserQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDisableUserMutation,
  useResendInviteMutation,
} = usersApi;

interface OptimisticApi {
  dispatch: (action: unknown) => unknown;
  getState: () => unknown;
  queryFulfilled: Promise<unknown>;
}

/**
 * Applies `recipe` to every cached copy of a user so the UI reacts instantly,
 * then rolls the change back if the request fails.
 */
async function withOptimisticUser(
  api: OptimisticApi,
  id: number,
  recipe: (user: AdminUser) => void,
): Promise<void> {
  const state = api.getState() as Parameters<
    typeof usersApi.util.selectCachedArgsForQuery
  >[0];
  const patches = usersApi.util.selectCachedArgsForQuery(state, "getUsers").map(
    (args) =>
      api.dispatch(
        usersApi.util.updateQueryData("getUsers", args, (draft) => {
          for (const page of draft.pages) {
            const user = page.items.find((u) => u.id === id);
            if (user) recipe(user);
          }
        }),
      ) as { undo: () => void },
  );
  patches.push(
    api.dispatch(usersApi.util.updateQueryData("getUser", id, recipe)) as {
      undo: () => void;
    },
  );

  try {
    await api.queryFulfilled;
  } catch {
    patches.forEach((p) => p.undo());
  }
}
