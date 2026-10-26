import { baseApi } from '@/redux/api/base-api';
import { alwaysFresh } from '@/redux/api/fresh';
import { ENDPOINTS } from '@/redux/api/endpoints';
import type { ApiResponse } from '@/redux/api/types';
import type { DashboardData } from './dashboard-types';

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** Pass a project id for that project's dashboard; leave it out for all of the user's projects */
    getDashboard: build.query<DashboardData, number | void>({
      query: (projectId) => (projectId ? ENDPOINTS.PROJECTS.DASHBOARD(projectId) : ENDPOINTS.DASHBOARD),
      transformResponse: (res: ApiResponse<DashboardData>) => res.data,
    }),
  }),
});

// Counts move whenever anyone touches an issue, so every visit loads fresh numbers
export const useGetDashboardQuery = alwaysFresh(dashboardApi.useGetDashboardQuery);
