/**
 * Project roles decide what a member can do inside a project; account roles decide
 * what a user can do across the system (e.g. managing users). Each has its own
 * role list and permission catalog.
 */
export type RoleScope = 'project' | 'account';

// ---- Permission catalog (GET /admin/permissions) ----

export interface ApiPermission {
  /** Full permission key, e.g. `issues.edit` */
  name: string;
  action: string;
  label: string;
}

export interface ApiPermissionModule {
  module: string;
  label: string;
  permissions: ApiPermission[];
}

// ---- Roles (GET /admin/roles) ----

export interface ApiRole {
  id: number;
  name: string;
  is_system: boolean;
  /** Which list the role belongs to; not always sent, so callers know it from the list they asked for */
  scope?: RoleScope;
  permissions: string[];
  module_count: number;
  member_count: number;
  /** Not returned by the backend yet; the UI renders blanks until it is */
  description?: string | null;
  is_active?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

// ---- Requests ----

export interface RoleRequest {
  name: string;
  /** Required on create: the tab the role was made on decides it */
  scope?: RoleScope;
  /** Not persisted by the backend yet; sent so it works once supported */
  description?: string;
  permissions: string[];
}

export interface UpdateRoleRequest extends Partial<RoleRequest> {
  id: number;
}
