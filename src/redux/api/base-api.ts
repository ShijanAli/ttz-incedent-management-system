import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import { env } from '@/config/env';
import type { RootState } from '@/redux/store';
import { credentialsReceived, loggedOut } from '@/redux/features/auth/auth-slice';
import type { AuthPayload } from '@/redux/features/auth/auth-types';
import { ENDPOINTS, NO_REAUTH_ENDPOINTS } from './endpoints';
import type { ApiResponse } from './types';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: env.apiBaseUrl,
  prepareHeaders: (headers, { getState }) => {
    headers.set('Accept', 'application/json');
    const token = (getState() as RootState).auth.accessToken;
    // A request may pass its own Authorization header (e.g. logout after local state is cleared)
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

// Shared across concurrent 401s so the refresh token is only spent once
let refreshInFlight: Promise<boolean> | null = null;

const urlOf = (args: string | FetchArgs) => (typeof args === 'string' ? args : args.url);

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status !== 401 || NO_REAUTH_ENDPOINTS.includes(urlOf(args))) {
    return result;
  }

  const refreshToken = (api.getState() as RootState).auth.refreshToken;
  if (!refreshToken) {
    api.dispatch(loggedOut());
    return result;
  }

  refreshInFlight ??= (async () => {
    const refreshResult = await rawBaseQuery(
      { url: ENDPOINTS.AUTH.REFRESH, method: 'POST', body: { refresh_token: refreshToken } },
      api,
      extraOptions,
    );
    const payload = (refreshResult.data as ApiResponse<AuthPayload> | undefined)?.data;
    if (payload?.access_token) {
      api.dispatch(credentialsReceived(payload));
      return true;
    }
    api.dispatch(loggedOut());
    return false;
  })().finally(() => {
    refreshInFlight = null;
  });

  if (await refreshInFlight) {
    result = await rawBaseQuery(args, api, extraOptions);
  }
  return result;
};

/** Root API. Feature APIs extend it with `baseApi.injectEndpoints`. */
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'Me', 'Role', 'PermissionCatalog', 'User',
    'Project', 'ProjectMembers', 'ProjectStatuses', 'ProjectGroups', 'ProjectActivity',
    'Group', 'GroupMembers', 'GroupProjects',
    'Issue', 'IssueHistory', 'IssueComments', 'IssueAttachments', 'IssueAssignees',
  ],
  endpoints: () => ({}),
});
