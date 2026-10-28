import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { baseApi } from '@/redux/api/base-api';
import { alwaysFresh } from '@/redux/api/fresh';
import { ENDPOINTS } from '@/redux/api/endpoints';
import { laravelInfiniteOptions, type PageParam } from '@/redux/api/infinite';
import {
  toPaginated,
  type ApiResponse,
  type Paginated,
  type PaginatedApiResponse,
} from '@/redux/api/types';
import { saveBlob } from '@/lib/download';
import type { ActivityEntry } from '@/redux/features/activity/activity-types';
import type {
  ChangeMyStatusRequest,
  ForceCloseIssueRequest,
  IssueAssignee,
  IssueAttachment,
  IssueComment,
  IssueDetail,
  IssueHistoryEntry,
  OverrideAssigneeStatusRequest,
  ReviewIssueRequest,
  TriageIssueRequest,
  UpdateIssueRequest,
} from './issues-types';

/**
 * Anything that moves an issue's status, assignees or fields: the issue itself,
 * its history and assignees, every issue list, and the project's counts and activity.
 */
const issueChangedTags = (issueId: number) => [
  { type: 'Issue' as const, id: issueId },
  { type: 'Issue' as const, id: 'LIST' },
  { type: 'IssueHistory' as const, id: issueId },
  { type: 'IssueActivity' as const, id: issueId },
  { type: 'IssueAssignees' as const, id: issueId },
  'Project' as const,
  'ProjectActivity' as const,
];

const commentTags = (issueId: number) => [
  { type: 'IssueComments' as const, id: issueId },
  { type: 'IssueActivity' as const, id: issueId },
  { type: 'Issue' as const, id: issueId },
  { type: 'Issue' as const, id: 'LIST' },
];

const attachmentTags = (issueId: number) => [
  { type: 'IssueAttachments' as const, id: issueId },
  { type: 'IssueActivity' as const, id: issueId },
  { type: 'Issue' as const, id: issueId },
  { type: 'Issue' as const, id: 'LIST' },
];

/** Builds the multipart body for the update endpoint (Laravel method spoofing) */
function toUpdateFormData({ title, description, attachments = [], remove_attachment_ids = [] }: UpdateIssueRequest) {
  const form = new FormData();
  form.append('_method', 'PATCH');
  form.append('title', title);
  form.append('description', description ?? '');
  attachments.forEach((file) => form.append('attachments[]', file));
  remove_attachment_ids.forEach((id) => form.append('remove_attachment_ids[]', String(id)));
  return form;
}

export const issueDetailApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // ---- The issue ----

    getIssue: build.query<IssueDetail, number>({
      query: (id) => ENDPOINTS.ISSUES.ONE(id),
      transformResponse: (res: ApiResponse<IssueDetail>) => res.data,
      providesTags: (_result, _error, id) => [{ type: 'Issue', id }],
    }),

    /** Title, description and attachments */
    updateIssue: build.mutation<IssueDetail, UpdateIssueRequest>({
      query: (req) => ({ url: ENDPOINTS.ISSUES.ONE(req.issueId), method: 'POST', body: toUpdateFormData(req) }),
      transformResponse: (res: ApiResponse<IssueDetail>) => res.data,
      invalidatesTags: (_result, _error, { issueId }) => [...issueChangedTags(issueId), ...attachmentTags(issueId)],
    }),

    /** Type, priority, severity, category, due date, labels and assignees */
    triageIssue: build.mutation<IssueDetail, TriageIssueRequest>({
      query: ({ issueId, ...body }) => ({ url: ENDPOINTS.ISSUES.ONE(issueId), method: 'PATCH', body }),
      transformResponse: (res: ApiResponse<IssueDetail>) => res.data,
      invalidatesTags: (_result, _error, { issueId }) => issueChangedTags(issueId),
    }),

    deleteIssue: build.mutation<ApiResponse<unknown>, number>({
      query: (id) => ({ url: ENDPOINTS.ISSUES.ONE(id), method: 'DELETE' }),
      // Not the issue's own tags: the detail page is still mounted and would refetch a 404
      invalidatesTags: [{ type: 'Issue', id: 'LIST' }, 'Project', 'ProjectActivity'],
    }),

    // ---- Status ----

    getIssueHistory: build.infiniteQuery<Paginated<IssueHistoryEntry>, number, PageParam>({
      infiniteQueryOptions: laravelInfiniteOptions<IssueHistoryEntry, number>(),
      query: ({ queryArg: issueId, pageParam }) => ({ url: ENDPOINTS.ISSUES.HISTORY(issueId), params: { page: pageParam } }),
      transformResponse: (res: PaginatedApiResponse<IssueHistoryEntry>) => toPaginated(res),
      providesTags: (_result, _error, issueId) => [{ type: 'IssueHistory', id: issueId }],
    }),

    /** Field edits, comments, attachments and assignments logged against the issue, newest first */
    getIssueActivity: build.infiniteQuery<Paginated<ActivityEntry>, number, PageParam>({
      infiniteQueryOptions: laravelInfiniteOptions<ActivityEntry, number>(),
      query: ({ queryArg: issueId, pageParam }) => ({ url: ENDPOINTS.ISSUES.ACTIVITY(issueId), params: { page: pageParam } }),
      transformResponse: (res: PaginatedApiResponse<ActivityEntry>) => toPaginated(res),
      providesTags: (_result, _error, issueId) => [{ type: 'IssueActivity', id: issueId }],
    }),

    /** Super admin closes the issue whatever state it is in; every part moves to Closed */
    forceCloseIssue: build.mutation<ApiResponse<unknown>, ForceCloseIssueRequest>({
      query: ({ issueId, comment }) => ({
        url: ENDPOINTS.ISSUES.FORCE_CLOSE(issueId),
        method: 'POST',
        body: comment ? { comment } : {},
      }),
      invalidatesTags: (_result, _error, { issueId }) => [...issueChangedTags(issueId), ...commentTags(issueId)],
    }),

    /** The signed-in assignee updates their own part */
    changeMyIssueStatus: build.mutation<ApiResponse<unknown>, ChangeMyStatusRequest>({
      query: ({ issueId, ...body }) => ({ url: ENDPOINTS.ISSUES.STATUS(issueId), method: 'PATCH', body }),
      invalidatesTags: (_result, _error, { issueId }) => issueChangedTags(issueId),
    }),

    /** A manager sets someone else's status */
    overrideAssigneeStatus: build.mutation<ApiResponse<unknown>, OverrideAssigneeStatusRequest>({
      query: ({ issueId, userId, ...body }) => ({
        url: ENDPOINTS.ISSUES.ASSIGNEE_STATUS(issueId, userId),
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _error, { issueId }) => issueChangedTags(issueId),
    }),

    /** Reporter confirms the fix or sends it back for a recheck */
    reviewIssue: build.mutation<ApiResponse<unknown>, ReviewIssueRequest>({
      query: ({ issueId, decision, comment }) => ({
        url: ENDPOINTS.ISSUES.REVIEW(issueId),
        method: 'POST',
        body: { decision, ...(comment && { comment }) },
      }),
      invalidatesTags: (_result, _error, { issueId }) => [...issueChangedTags(issueId), ...commentTags(issueId)],
    }),

    // ---- Assignees ----

    getIssueAssignees: build.query<IssueAssignee[], number>({
      query: (issueId) => ENDPOINTS.ISSUES.ASSIGNEES(issueId),
      transformResponse: (res: ApiResponse<IssueAssignee[]>) => res.data,
      providesTags: (_result, _error, issueId) => [{ type: 'IssueAssignees', id: issueId }],
    }),

    assignIssue: build.mutation<ApiResponse<IssueAssignee>, { issueId: number; user_id: number }>({
      query: ({ issueId, user_id }) => ({ url: ENDPOINTS.ISSUES.ASSIGNEES(issueId), method: 'POST', body: { user_id } }),
      invalidatesTags: (_result, _error, { issueId }) => issueChangedTags(issueId),
    }),

    unassignIssue: build.mutation<ApiResponse<unknown>, { issueId: number; userId: number }>({
      query: ({ issueId, userId }) => ({ url: ENDPOINTS.ISSUES.ASSIGNEE(issueId, userId), method: 'DELETE' }),
      invalidatesTags: (_result, _error, { issueId }) => issueChangedTags(issueId),
    }),

    pickIssue: build.mutation<ApiResponse<IssueAssignee>, number>({
      query: (issueId) => ({ url: ENDPOINTS.ISSUES.PICK(issueId), method: 'POST' }),
      invalidatesTags: (_result, _error, issueId) => issueChangedTags(issueId),
    }),

    unpickIssue: build.mutation<ApiResponse<unknown>, number>({
      query: (issueId) => ({ url: ENDPOINTS.ISSUES.PICK(issueId), method: 'DELETE' }),
      invalidatesTags: (_result, _error, issueId) => issueChangedTags(issueId),
    }),

    // ---- Comments ----

    getIssueComments: build.infiniteQuery<Paginated<IssueComment>, number, PageParam>({
      infiniteQueryOptions: laravelInfiniteOptions<IssueComment, number>(),
      query: ({ queryArg: issueId, pageParam }) => ({ url: ENDPOINTS.ISSUES.COMMENTS(issueId), params: { page: pageParam } }),
      transformResponse: (res: PaginatedApiResponse<IssueComment>) => toPaginated(res),
      providesTags: (_result, _error, issueId) => [{ type: 'IssueComments', id: issueId }],
    }),

    addComment: build.mutation<ApiResponse<IssueComment>, { issueId: number; body: string; mentioned_user_ids?: number[] }>({
      query: ({ issueId, ...body }) => ({ url: ENDPOINTS.ISSUES.COMMENTS(issueId), method: 'POST', body }),
      invalidatesTags: (_result, _error, { issueId }) => commentTags(issueId),
    }),

    /** `mentioned_user_ids` is the full list after the edit; leave it out to keep the current mentions */
    editComment: build.mutation<
      ApiResponse<IssueComment>,
      { issueId: number; commentId: number; body: string; mentioned_user_ids?: number[] }
    >({
      query: ({ commentId, body, mentioned_user_ids }) => ({
        url: ENDPOINTS.COMMENTS.ONE(commentId),
        method: 'PATCH',
        body: { body, ...(mentioned_user_ids && { mentioned_user_ids }) },
      }),
      invalidatesTags: (_result, _error, { issueId }) => commentTags(issueId),
    }),

    deleteComment: build.mutation<ApiResponse<unknown>, { issueId: number; commentId: number }>({
      query: ({ commentId }) => ({ url: ENDPOINTS.COMMENTS.ONE(commentId), method: 'DELETE' }),
      invalidatesTags: (_result, _error, { issueId }) => commentTags(issueId),
    }),

    // ---- Attachments ----

    getIssueAttachments: build.query<IssueAttachment[], number>({
      query: (issueId) => ENDPOINTS.ISSUES.ATTACHMENTS(issueId),
      transformResponse: (res: ApiResponse<IssueAttachment[]>) => res.data,
      providesTags: (_result, _error, issueId) => [{ type: 'IssueAttachments', id: issueId }],
    }),

    uploadAttachment: build.mutation<ApiResponse<IssueAttachment>, { issueId: number; file: File }>({
      query: ({ issueId, file }) => {
        const form = new FormData();
        form.append('file', file);
        return { url: ENDPOINTS.ISSUES.ATTACHMENTS(issueId), method: 'POST', body: form };
      },
      invalidatesTags: (_result, _error, { issueId }) => attachmentTags(issueId),
    }),

    deleteAttachment: build.mutation<ApiResponse<unknown>, { issueId: number; attachmentId: number }>({
      query: ({ attachmentId }) => ({ url: ENDPOINTS.ATTACHMENTS.ONE(attachmentId), method: 'DELETE' }),
      invalidatesTags: (_result, _error, { issueId }) => attachmentTags(issueId),
    }),

    /**
     * Downloads through the authenticated base query (so token refresh still works)
     * and hands the file straight to the browser; the Blob never enters the store.
     */
    downloadAttachment: build.mutation<null, Pick<IssueAttachment, 'id' | 'original_name'>>({
      async queryFn({ id, original_name }, _api, _extra, baseQuery) {
        const result = await baseQuery({
          url: ENDPOINTS.ATTACHMENTS.DOWNLOAD(id),
          responseHandler: (response) => response.blob(),
        });
        if (result.error) return { error: result.error as FetchBaseQueryError };
        saveBlob(result.data as Blob, original_name);
        return { data: null };
      },
    }),
  }),
});

// Other people work on the same issue, so every mount loads fresh data
export const useGetIssueQuery = alwaysFresh(issueDetailApi.useGetIssueQuery);
export const useGetIssueHistoryInfiniteQuery = alwaysFresh(issueDetailApi.useGetIssueHistoryInfiniteQuery);
export const useGetIssueActivityInfiniteQuery = alwaysFresh(issueDetailApi.useGetIssueActivityInfiniteQuery);
export const useGetIssueAssigneesQuery = alwaysFresh(issueDetailApi.useGetIssueAssigneesQuery);
export const useGetIssueCommentsInfiniteQuery = alwaysFresh(issueDetailApi.useGetIssueCommentsInfiniteQuery);
export const useGetIssueAttachmentsQuery = alwaysFresh(issueDetailApi.useGetIssueAttachmentsQuery);

export const {
  useUpdateIssueMutation,
  useTriageIssueMutation,
  useDeleteIssueMutation,
  useChangeMyIssueStatusMutation,
  useOverrideAssigneeStatusMutation,
  useReviewIssueMutation,
  useForceCloseIssueMutation,
  useAssignIssueMutation,
  useUnassignIssueMutation,
  usePickIssueMutation,
  useUnpickIssueMutation,
  useAddCommentMutation,
  useEditCommentMutation,
  useDeleteCommentMutation,
  useUploadAttachmentMutation,
  useDeleteAttachmentMutation,
  useDownloadAttachmentMutation,
} = issueDetailApi;
