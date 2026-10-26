/** Who performed the action; null for system events */
export interface ActivityCauser {
  id: number;
  name: string;
}

/** What the action happened to, e.g. a Project or an Issue */
export interface ActivitySubject {
  type: string;
  id: number;
  /** Ready-to-show name, e.g. "ISS-1018 Test Issue" */
  label: string;
}

/** Field-level diff recorded for "created" / "updated" events */
export interface ActivityChanges {
  old: Record<string, unknown> | null;
  attributes: Record<string, unknown>;
}

/** One entry from an activity log endpoint */
export interface ActivityEntry {
  id: number;
  /** e.g. "created", "updated", "member.added", "group.attached", "project.statuses_changed" */
  event: string;
  causer: ActivityCauser | null;
  subject: ActivitySubject | null;
  changes: ActivityChanges | null;
  /** Event-specific extras, e.g. { user_id, role } or { group_id, group_name } */
  properties: Record<string, unknown> | null;
  created_at: string;
}

// ---- Audit log (GET /projects/{id}/audit) ----

/** Filter for `type`; each covers a family of entries (e.g. "issue" = created, edited, confirmed...) */
export type AuditTypeFilter = 'status' | 'issue' | 'comment' | 'attachment' | 'member';

/** Query params shared by the audit list and its CSV export */
export interface AuditFilters {
  /** YYYY-MM-DD, on or after (Asia/Dhaka) */
  from?: string;
  /** YYYY-MM-DD, on or before (Asia/Dhaka) */
  to?: string;
  actor_id?: number;
  issue_id?: number;
  type?: AuditTypeFilter;
}

export interface AuditArgs extends AuditFilters {
  projectId: number;
}

/** One audit row: who changed which field from what to what */
export interface AuditEntry {
  occurred_at: string;
  /** e.g. status, issue.created, issue.updated, issue.confirmed, issue.rechecked, assignee.added, comment.added, project.statuses_changed */
  type: string;
  /** Null for automatic changes (e.g. a status that follows from a pick-up) */
  actor: ActivityCauser | null;
  issue: { id: number; code: string; title: string } | null;
  /** The person the change is about, e.g. whose assignee status moved */
  subject_user: ActivityCauser | null;
  /** e.g. issue_status, assignee_status, assignee, comment, description, status_set */
  field: string | null;
  old: string | null;
  new: string | null;
  note: string | null;
}
