/**
 * Event keys the backend sends, e.g. `issue.picked`, `comment.created`. Kept open
 * so a new event still renders (with a generic icon) before the UI knows about it.
 */
export type NotificationEvent =
  | 'issue.created' | 'issue.updated' | 'issue.deleted' | 'issue.picked' | 'issue.assigned' | 'issue.unassigned'
  | 'issue.status_changed' | 'issue.reviewed'
  /** Deadline reminders; nobody triggers these, so `actor` is null */
  | 'issue.due_soon' | 'issue.overdue'
  | 'comment.created' | 'comment.updated' | 'comment.deleted' | 'comment.mentioned'
  | 'attachment.added' | 'attachment.deleted'
  | (string & {});

export interface NotificationPayload {
  event: NotificationEvent;
  issue_id: number | null;
  issue_code: string | null;
  issue_title: string | null;
  project_id: number | null;
  project_name: string | null;
  /** Null for system events such as deadline reminders */
  actor: { id: number; name: string } | null;
  /** Ready-to-show sentence, e.g. "Tanbir Hossain picked up this issue in Trakon Mobile App." */
  message: string;
  /** In-app route to open, e.g. "/issues/35"; null when the target is gone (deleted issue) */
  path: string | null;
  /** Event-specific extras; an empty array when there are none */
  context: Record<string, unknown> | unknown[];
}

/** One row from GET /notifications */
export interface AppNotification {
  /** UUID */
  id: string;
  data: NotificationPayload;
  read_at: string | null;
  created_at: string;
}

/** GET/PATCH /notification-preferences. All on by default; the in-app bell can't be turned off. */
export interface NotificationPreferences {
  email_notifications: boolean;
  push_notifications: boolean;
  /** Day before the due date and once it's overdue */
  deadline_alerts: boolean;
  mention_alerts: boolean;
}
