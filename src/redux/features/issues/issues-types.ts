import type { IssuePriority, IssueSeverity, IssueType } from '@/lib/types';
import type { InfiniteListParams } from '@/redux/api/types';

/** A colored reference shown as a badge (status, category) */
export interface IssueColoredRef {
  id: number;
  name: string;
  color: string;
}

/** An issue row as the list endpoints return it */
export interface IssueSummary {
  id: number;
  /** Human-facing key, e.g. "ISS-1020" */
  code: string;
  title: string;
  issue_type: IssueType | null;
  priority: IssuePriority | null;
  severity: IssueSeverity | null;
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
  project: { id: number; name: string };
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
  type: IssueType;
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
