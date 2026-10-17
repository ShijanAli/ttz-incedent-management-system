import type { Permission, PermissionModule } from '@/lib/types';

export const PERMISSION_MODULES: {
  module: PermissionModule;
  label: string;
  permissions: { value: Permission; label: string; description: string }[];
}[] = [
  {
    module: 'dashboard',
    label: 'Dashboard',
    permissions: [
      { value: 'dashboard.view', label: 'View', description: 'Access the dashboard page' },
    ],
  },
  {
    module: 'projects',
    label: 'Projects',
    permissions: [
      { value: 'projects.view', label: 'View', description: 'View project list and details' },
      { value: 'projects.create', label: 'Create', description: 'Create new projects' },
      { value: 'projects.update', label: 'Update', description: 'Edit project details' },
      { value: 'projects.delete', label: 'Delete', description: 'Delete or archive projects' },
      { value: 'projects.assign_members', label: 'Assign Members', description: 'Assign or remove project members' },
    ],
  },
  {
    module: 'issues',
    label: 'Issues',
    permissions: [
      { value: 'issues.view', label: 'View', description: 'View issues in authorized projects' },
      { value: 'issues.create', label: 'Create', description: 'Create new issues' },
      { value: 'issues.update', label: 'Update', description: 'Edit issue details' },
      { value: 'issues.delete', label: 'Delete', description: 'Delete issues' },
      { value: 'issues.assign', label: 'Assign', description: 'Assign or reassign issues' },
      { value: 'issues.pick', label: 'Pick', description: 'Pick up or drop issues yourself' },
      { value: 'issues.change_status', label: 'Change Status', description: 'Change issue workflow status' },
      { value: 'issues.comment', label: 'Comment', description: 'Add comments to issues' },
      { value: 'issues.approve', label: 'Approve', description: 'Approve completed issues' },
    ],
  },
  {
    module: 'comments',
    label: 'Comments',
    permissions: [
      { value: 'comments.view', label: 'View', description: 'Read issue comments' },
      { value: 'comments.create', label: 'Create', description: 'Add comments to issues' },
      { value: 'comments.edit', label: 'Edit', description: 'Edit your own comments' },
      { value: 'comments.delete', label: 'Delete', description: 'Delete your own comments' },
    ],
  },
  {
    module: 'attachments',
    label: 'Attachments',
    permissions: [
      { value: 'attachments.view', label: 'View', description: 'See and download issue files' },
      { value: 'attachments.create', label: 'Upload', description: 'Attach files to issues' },
      { value: 'attachments.delete', label: 'Delete', description: 'Remove issue files' },
    ],
  },
  {
    module: 'users',
    label: 'Users',
    permissions: [
      { value: 'users.view', label: 'View', description: 'View user list and profiles' },
      { value: 'users.create', label: 'Create', description: 'Create new user accounts' },
      { value: 'users.update', label: 'Update', description: 'Edit user profiles and roles' },
      { value: 'users.deactivate', label: 'Deactivate', description: 'Activate or deactivate accounts' },
    ],
  },
  {
    module: 'roles',
    label: 'Roles & Permissions',
    permissions: [
      { value: 'roles.view', label: 'View', description: 'View roles and permissions' },
      { value: 'roles.create', label: 'Create', description: 'Create new roles' },
      { value: 'roles.update', label: 'Update', description: 'Edit role details and permissions' },
      { value: 'roles.delete', label: 'Delete', description: 'Delete custom roles' },
      { value: 'roles.assign_permissions', label: 'Assign Permissions', description: 'Modify role permission sets' },
    ],
  },
  {
    module: 'groups',
    label: 'Groups',
    permissions: [
      { value: 'groups.view', label: 'View', description: 'View authorized groups' },
      { value: 'groups.create', label: 'Create', description: 'Create private groups' },
      { value: 'groups.update', label: 'Update', description: 'Edit group details' },
      { value: 'groups.delete', label: 'Delete', description: 'Delete groups' },
      { value: 'groups.manage_members', label: 'Manage Members', description: 'Add or remove group members' },
      { value: 'groups.send_message', label: 'Send Message', description: 'Send messages in groups' },
    ],
  },
  {
    module: 'reports',
    label: 'Reports',
    permissions: [
      { value: 'reports.view', label: 'View', description: 'View reports and analytics' },
      { value: 'reports.export', label: 'Export', description: 'Export report data to CSV' },
    ],
  },
  {
    module: 'notifications',
    label: 'Notifications',
    permissions: [
      { value: 'notifications.view', label: 'View', description: 'View notifications' },
    ],
  },
  {
    module: 'settings',
    label: 'Settings',
    permissions: [
      { value: 'settings.view', label: 'View', description: 'View settings' },
      { value: 'settings.update', label: 'Update', description: 'Modify system or personal settings' },
    ],
  },
  {
    module: 'activity',
    label: 'Activity Log',
    permissions: [
      { value: 'activity.view', label: 'View', description: 'View system activity log' },
      { value: 'activity.export', label: 'Export', description: 'Export activity log data' },
    ],
  },
];

export const ALL_PERMISSIONS: Permission[] = PERMISSION_MODULES.flatMap(
  (m) => m.permissions.map((p) => p.value)
);

export const PERMISSION_LABELS: Record<Permission, string> = Object.fromEntries(
  PERMISSION_MODULES.flatMap((m) => m.permissions.map((p) => [p.value, p.label]))
) as Record<Permission, string>;

export const MODULE_LABELS: Record<PermissionModule, string> = Object.fromEntries(
  PERMISSION_MODULES.map((m) => [m.module, m.label])
) as Record<PermissionModule, string>;

export function getModulePermissions(module: PermissionModule): Permission[] {
  const found = PERMISSION_MODULES.find((m) => m.module === module);
  return found ? found.permissions.map((p) => p.value) : [];
}

export function getPermissionModule(perm: Permission): PermissionModule {
  return perm.split('.')[0] as PermissionModule;
}

/**
 * API permission names that differ from the app's permission names. Names that
 * match an app permission (e.g. `issues.pick`, `comments.delete`) need no entry.
 */
const API_PERMISSION_ALIASES: Record<string, Permission[]> = {
  'projects.edit': ['projects.update', 'projects.assign_members'],
  'issues.edit': ['issues.update'],
  'issues.status': ['issues.change_status'],
  'comments.create': ['issues.comment'],
  'users.edit': ['users.view', 'users.update'],
};

/**
 * Backend permissions per system role, mirroring GET /api/admin/roles.
 * Fallback only, for a session whose user payload has no `permissions`
 * (/auth/me sends them; login and refresh may not).
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  Manager: [
    'dashboard.view', 'projects.view', 'projects.edit', 'projects.delete',
    'issues.view', 'issues.create', 'issues.edit', 'issues.delete', 'issues.pick', 'issues.assign', 'issues.status',
    'users.edit', 'reports.view',
    'comments.view', 'comments.create', 'comments.edit', 'comments.delete',
    'attachments.view', 'attachments.create', 'attachments.delete',
  ],
  Developer: [
    'dashboard.view', 'projects.view', 'issues.view', 'issues.edit', 'issues.pick', 'issues.status',
    'comments.view', 'comments.create', 'comments.edit', 'attachments.view', 'attachments.create',
  ],
  Reporter: [
    'dashboard.view', 'projects.view', 'issues.view', 'issues.create', 'issues.status',
    'comments.view', 'comments.create', 'comments.edit', 'attachments.view', 'attachments.create',
  ],
  Viewer: ['dashboard.view', 'projects.view', 'issues.view', 'comments.view', 'attachments.view'],
};

/** Translates backend permission names into the app permissions they unlock. */
export function toAppPermissions(apiPermissions: Iterable<string>): Set<Permission> {
  const known = new Set<string>(ALL_PERMISSIONS);
  const result = new Set<Permission>();
  for (const perm of apiPermissions) {
    if (known.has(perm)) result.add(perm as Permission);
    API_PERMISSION_ALIASES[perm]?.forEach((p) => result.add(p));
  }
  return result;
}
