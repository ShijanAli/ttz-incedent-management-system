/**
 * Every permission code the backend knows (GET /api/admin/permissions), grouped by module.
 * The signed-in user's own list comes from `account_permissions` on /auth/me; check it with
 * `hasPermission`, `hasAnyPermission` or `hasAllPermissions` from useAuth().
 */
export const PERMISSION_MODULES = {
  dashboard: ['dashboard.view'],
  projects: [
    'projects.view', 'projects.create', 'projects.edit',
    'account.projects.view_all', 'account.projects.edit_all', 'account.projects.delete',
  ],
  issues: [
    'issues.view', 'issues.create', 'issues.edit', 'issues.delete', 'issues.pick', 'issues.assign', 'issues.status',
    'account.issues.force_close', 'account.issues.reopen', 'account.issues.final_status', 'account.issues.review_any',
  ],
  comments: ['comments.view', 'comments.create', 'comments.edit', 'comments.delete'],
  attachments: ['attachments.view', 'attachments.create', 'attachments.delete'],
  /** "Project members" */
  users: ['users.edit'],
  activity: ['activity.view', 'activity.export'],
  'account.users': [
    'account.users.view', 'account.users.create', 'account.users.edit', 'account.users.delete', 'account.users.restore',
  ],
  'account.groups': ['account.groups.view', 'account.groups.create', 'account.groups.edit', 'account.groups.delete'],
  'account.customers': [
    'account.customers.view', 'account.customers.create', 'account.customers.edit', 'account.customers.delete',
  ],
  'account.categories': [
    'account.categories.view', 'account.categories.create', 'account.categories.edit', 'account.categories.delete',
  ],
  'account.statuses': [
    'account.statuses.view', 'account.statuses.create', 'account.statuses.edit', 'account.statuses.delete',
  ],
  'account.roles': [
    'account.roles.view', 'account.roles.create', 'account.roles.edit', 'account.roles.delete', 'account.roles.assign',
  ],
  'account.labels': ['account.labels.manage'],
  'account.notifications': ['account.notifications.test'],
} as const;

export type PermissionModule = keyof typeof PERMISSION_MODULES;
export type PermissionCode = (typeof PERMISSION_MODULES)[PermissionModule][number];

export const ALL_PERMISSION_CODES: readonly PermissionCode[] = Object.values(PERMISSION_MODULES).flat();

/** Permission checks over a list of granted codes. `all` is true for super admins. */
export interface PermissionChecker {
  hasPermission: (code: PermissionCode) => boolean;
  hasAnyPermission: (codes: readonly PermissionCode[]) => boolean;
  hasAllPermissions: (codes: readonly PermissionCode[]) => boolean;
}

export function createPermissionChecker(granted: Iterable<string>, all = false): PermissionChecker {
  const set = new Set(granted);
  const hasPermission = (code: PermissionCode) => all || set.has(code);
  return {
    hasPermission,
    hasAnyPermission: (codes) => codes.some(hasPermission),
    hasAllPermissions: (codes) => codes.every(hasPermission),
  };
}
