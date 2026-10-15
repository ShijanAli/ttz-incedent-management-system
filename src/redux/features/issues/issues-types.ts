import type { IssuePriority, IssueSeverity, IssueType } from '@/lib/types';

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
