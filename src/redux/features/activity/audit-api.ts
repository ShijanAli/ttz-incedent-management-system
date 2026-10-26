import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { baseApi } from '@/redux/api/base-api';
import { alwaysFresh } from '@/redux/api/fresh';
import { ENDPOINTS } from '@/redux/api/endpoints';
import { laravelInfiniteOptions, type PageParam } from '@/redux/api/infinite';
import type { Paginated, PaginatedApiResponse } from '@/redux/api/types';
import { saveBlob } from '@/lib/download';
import type { AuditArgs, AuditEntry } from './activity-types';

/** Drops empty filters so they never reach the query string */
const cleanParams = ({ projectId: _projectId, ...filters }: AuditArgs) =>
  Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''));

export const auditApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getProjectAudit: build.infiniteQuery<Paginated<AuditEntry>, AuditArgs, PageParam>({
      infiniteQueryOptions: laravelInfiniteOptions<AuditEntry, AuditArgs>(),
      query: ({ queryArg, pageParam }) => ({
        url: ENDPOINTS.PROJECTS.AUDIT(queryArg.projectId),
        params: { ...cleanParams(queryArg), page: pageParam },
      }),
      // Tolerates an unpaginated reply by treating it as a single page
      transformResponse: (res: PaginatedApiResponse<AuditEntry>) => ({
        items: res.data,
        meta: res.meta ?? {
          current_page: 1, last_page: 1, per_page: res.data.length, total: res.data.length,
          from: res.data.length ? 1 : null, to: res.data.length || null,
        },
      }),
      providesTags: (_result, _error, { projectId }) => [{ type: 'ProjectActivity', id: projectId }],
    }),

    /** Downloads the CSV through the authenticated base query, with the same filters as the list */
    exportProjectAudit: build.mutation<null, AuditArgs & { fileName: string }>({
      async queryFn({ fileName, ...args }, _api, _extra, baseQuery) {
        const result = await baseQuery({
          url: ENDPOINTS.PROJECTS.AUDIT_EXPORT(args.projectId),
          params: cleanParams(args),
          responseHandler: (response) => response.blob(),
        });
        if (result.error) return { error: result.error as FetchBaseQueryError };
        saveBlob(result.data as Blob, fileName);
        return { data: null };
      },
    }),
  }),
});

// Other people keep changing things, so every visit loads the latest entries
export const useGetProjectAuditInfiniteQuery = alwaysFresh(auditApi.useGetProjectAuditInfiniteQuery);
export const { useExportProjectAuditMutation } = auditApi;
