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
