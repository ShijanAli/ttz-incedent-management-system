import type { IssuePriority } from '@/lib/types';

/** GET /dashboard (all of the user's projects) or GET /projects/{id}/dashboard (one project) */
export interface DashboardData {
  scope: {
    type: 'all' | 'project' | (string & {});
    project: { id: number; name: string } | null;
    project_count: number;
  };
  counters: {
    total: number;
    open: number;
    closed: number;
    overdue: number;
    unassigned: number;
    /** Some assignees done, others not */
    partial: number;
    /** Open issues assigned to the signed-in user */
    my_open: number;
  };
  by_status: DashboardStatusCount[];
  /** `priority` is null for issues without one */
  by_priority: { priority: IssuePriority | null; count: number }[];
  by_source: { source: string; label: string; count: number }[];
  complaints_by_customer: { customer?: { id: number; name: string } | null; count: number }[];
  projects: DashboardProject[];
  trends: {
    /** Null on a single project's dashboard */
    projects_created_this_month: number | null;
    issues_created_this_week: number;
    issues_created_last_week: number;
    /** Change against last week, e.g. -84; null when last week had none */
    issues_created_change_pct: number | null;
    issues_closed_this_week: number;
    needs_attention: { issues: number; projects: number };
  };
  /** Newest first */
  latest: DashboardActivity[];
}

export interface DashboardStatusCount {
  status_id: number;
  name: string;
  slug: string;
  color: string;
  count: number;
}

export interface DashboardProject {
  id: number;
  name: string;
  status: string;
  due_date: string | null;
  total: number;
  closed: number;
  /** 0-100 */
  progress: number;
}

export interface DashboardActivity {
  occurred_at: string;
  /** e.g. status, issue.created, issue.updated, issue.confirmed, assignee.added, comment.added */
  type: string;
  actor: { id: number; name: string } | null;
  issue: { id: number; code: string; title: string } | null;
  project: { id: number; name: string } | null;
  /** Ready-to-show sentence, e.g. "Chandan Paul moved #ISS-1048 to Resolved" */
  summary: string;
}
