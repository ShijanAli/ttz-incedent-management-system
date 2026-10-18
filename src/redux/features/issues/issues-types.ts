import type { IssuePriority, IssueSeverity, IssueType } from '@/lib/types';
import type { InfiniteListParams } from '@/redux/api/types';

/** A colored reference shown as a badge (status, category) */
export interface IssueColoredRef {
  id: number;
  name: string;
  color: string;
}

/** Severity as the issue detail API sends it */
export interface IssueSeverityRef {
  value: IssueSeverity;
  /** e.g. "SEV4" */
  label: string;
  /** e.g. "Low — minor or cosmetic" */
  description: string;
}

/** An issue row as the list endpoints return it */
export interface IssueSummary {
  id: number;
  /** Human-facing key, e.g. "ISS-1020" */
  code: string;
  title: string;
  issue_type: IssueType | null;
  priority: IssuePriority | null;
  /** An object on the detail API; may still be the bare key elsewhere. Read it with getSeverityKey() */
  severity: IssueSeverityRef | IssueSeverity | null;
  labels: string[];
  due_date: string | null;
  /** The issue's current workflow status */
  status: IssueColoredRef | null;
  category: IssueColoredRef | null;
  /** True when only some assignees have finished their part */
  is_partial: boolean;
  /** 0-100 */
  progress: number;
  assignee_count: number;
  comment_count: number;
  attachment_count: number;
  created_at: string;
  /** Not sent by the list yet */
  updated_at?: string;
}

/** One row from GET /admin/issues or GET /my/issues, which span projects */
export interface IssueListItem extends IssueSummary {
  /** Usually present; /my/issues may leave it out, so always guard */
  project?: { id: number; name: string } | null;
}

/**
 * Filters for the issue lists; every one is a query param. `page` is handled by
 * the infinite query, and undefined values are dropped from the query string.
 */
export interface IssueListFilters extends InfiniteListParams {
  project_id?: number;
  status_id?: number;
  priority?: IssuePriority;
  issue_type?: IssueType;
  severity?: IssueSeverity;
  /** Exact label match */
  label?: string;
  issue_category_id?: number;
  reported_by?: number;
  assignee_id?: number;
  /** YYYY-MM-DD, inclusive */
  due_before?: string;
  /** YYYY-MM-DD, inclusive */
  due_after?: string;
  /** 1 = only issues nobody is assigned to */
  unassigned?: 1;
  /** Matches the title or the issue code */
  search?: string;
}

/**
 * Super admins see every issue (/admin/issues); everyone else sees the issues of
 * their projects (/my/issues). Both take the same filters and return the same shape.
 */
export type IssueListScope = 'admin' | 'my';

export interface IssueListArgs extends IssueListFilters {
  scope: IssueListScope;
}

/** An issue as returned by the API. Only the fields the UI relies on so far are typed. */
export interface ApiIssue {
  id: number;
  key?: string;
  title: string;
  [field: string]: unknown;
}

// ---- Requests ----

/**
 * Body for POST /projects/{projectId}/issues. The project travels in the URL,
 * never in the body. Field names follow the API's snake_case convention.
 */
export interface CreateIssueBody {
  title: string;
  description: string | null;
  /** From GET /admin/issue-categories; replaces the fixed `issue_type` */
  issue_category_id: number;
  priority: IssuePriority;
  severity: IssueSeverity | null;
  /** Users to assign; an empty array leaves the issue unassigned */
  assignee_ids: number[];
  labels: string[];
  /** YYYY-MM-DD */
  due_date: string | null;
}

export interface CreateIssueRequest extends CreateIssueBody {
  projectId: number;
}

export interface ProjectIssuesArgs extends Omit<IssueListFilters, 'project_id'> {
  /** Goes in the URL: /projects/{projectId}/issues */
  projectId: number;
}

// ---- Single issue ----

/** A user as embedded in issue payloads */
export interface IssueUser {
  id: number;
  name: string;
  designation: string | null;
  status: string;
  email: string;
}

/** One person working on an issue, with their own status and progress */
export interface IssueAssignee {
  user: IssueUser;
  status: IssueColoredRef | null;
  /** 0-100 */
  progress: number;
  /** True when they picked the issue up themselves */
  self_picked: boolean;
  picked_at: string | null;
  completed_at: string | null;
}

export interface IssueAttachment {
  id: number;
  original_name: string;
  mime: string;
  size_bytes: number;
  uploaded_by: IssueUser | null;
  created_at: string;
  /** Relative API path; needs the auth header, so download through the API layer */
  download_url: string;
}

export interface IssueComment {
  id: number;
  body: string;
  author: IssueUser | null;
  edited_at: string | null;
  created_at: string;
}

/** A status change, either of the whole issue ("overall") or one assignee's part */
export interface IssueHistoryEntry {
  id: number;
  scope: 'overall' | 'assignee' | (string & {});
  actor: { id: number; name: string } | null;
  /** The assignee whose status changed, for assignee-scoped entries */
  subject: { id: number; name: string } | null;
  from_status: IssueColoredRef | null;
  to_status: IssueColoredRef | null;
  note: string | null;
  created_at: string;
}

/** What the signed-in user may do on this issue; drives which controls are shown */
export interface IssueAbilities {
  can_edit: boolean;
  can_triage: boolean;
  can_delete: boolean;
  can_pick: boolean;
  can_unpick: boolean;
  can_assign: boolean;
  can_change_own_status: boolean;
  can_reopen: boolean;
  can_comment: boolean;
  can_upload: boolean;
  can_review: boolean;
}

/** GET /issues/{id} */
export interface IssueDetail extends Omit<IssueSummary, 'assignee_count'> {
  description: string | null;
  project: { id: number; name: string };
  reported_by: IssueUser | null;
  closed_at: string | null;
  /** All assignees are done and the reporter needs to confirm or send it back */
  awaiting_review: boolean;
  assignees: IssueAssignee[];
  attachments: IssueAttachment[];
  comments: IssueComment[];
  status_history: IssueHistoryEntry[];
  abilities: IssueAbilities;
}

// ---- Single-issue requests ----

/** POST /issues/{id} (sent as multipart with _method=PATCH, since it can carry files) */
export interface UpdateIssueRequest {
  issueId: number;
  title: string;
  description: string | null;
  attachments?: File[];
  remove_attachment_ids?: number[];
}

/** PATCH /issues/{id}: classification and assignment, for users who can triage */
export interface TriageIssueRequest {
  issueId: number;
  issue_type?: IssueType | null;
  priority?: IssuePriority | null;
  severity?: IssueSeverity | null;
  issue_category_id?: number | null;
  due_date?: string | null;
  labels?: string[];
  assignee_ids?: number[];
}

/** Body shared by "change my status" and "override an assignee's status" */
export interface StatusUpdateBody {
  status_id: number;
  /** 0-100; left out where the backend works it out from the status */
  progress?: number;
  note?: string;
}

/** The backend sets my progress from the status, so none is sent */
export interface ChangeMyStatusRequest extends Omit<StatusUpdateBody, 'progress'> {
  issueId: number;
}

export interface OverrideAssigneeStatusRequest extends StatusUpdateBody {
  issueId: number;
  userId: number;
}

export type ReviewDecision = 'confirm' | 'recheck';

export interface ReviewIssueRequest {
  issueId: number;
  decision: ReviewDecision;
  /** Optional on confirm; required on recheck (up to 5000 characters) */
  comment?: string;
}
