import type { InfiniteListParams } from '@/redux/api/types';

/** Project lifecycle status, as accepted by the API */
export type ProjectState = 'active' | 'completed' | 'archived' | (string & {});

/** Project priority, as accepted by the API */
export type ProjectPriority = 'low' | 'medium' | 'high' | 'critical';

/** A workflow status attached to a project */
export interface ProjectStatus {
  id: number;
  name: string;
  slug: string;
  color: string;
  sort_order: number;
  is_initial: boolean;
  is_terminal: boolean;
  /** Issues currently in this status; only on project payloads, not on /statuses */
  count?: number;
  /** Owning project for a status the project created itself; null for a shared one. Not always sent. */
  project_id?: number | null;
}

/** A status from GET /api/admin/statuses or /api/statuses; projects pick their workflow from these */
export interface CatalogStatus {
  id: number;
  /** Null for global statuses; set for a project's own ones */
  project_id: number | null;
  name: string;
  slug: string;
  color: string;
  sort_order: number;
  /** /api/statuses only returns active ones and may leave this out */
  is_active?: boolean;
  created_at?: string;
}

/**
 * Super admins read the full admin catalog; everyone else reads /api/statuses,
 * which can add one project's own statuses (members of that project only)
 */
export interface StatusCatalogArgs {
  admin: boolean;
  projectId?: number;
}

export interface ProjectMemberUser {
  id: number;
  name: string;
  designation: string | null;
  status: string;
  /** Contact details for the hover card; optional so payloads without them still render */
  email?: string | null;
  phone?: string | null;
  department?: string | null;
  bio?: string | null;
  photo_url?: string | null;
}

/** "direct" members can be edited; "group" members come in through a group */
export type MemberSource = 'direct' | 'group' | (string & {});

export interface ProjectMember {
  user: ProjectMemberUser;
  /** Role name, e.g. "Developer" */
  role: string;
  source: MemberSource;
}

export interface ProjectGroupSummary {
  id: number;
  name: string;
  member_count: number;
}

export interface ProjectIssueCounts {
  total: number;
  open: number;
  closed: number;
  overdue: number;
}

export interface ApiProject {
  id: number;
  name: string;
  description: string | null;
  /** YYYY-MM-DD */
  due_date: string | null;
  /** Lifecycle status (planning, active, ...). Not to be confused with the workflow `statuses`. */
  status: ProjectState | null;
  /** Signed URL of the project's logo; null when none is set (show initials instead) */
  logo_url?: string | null;
  /** Left out of the list response (GET /projects); only the single project sends it */
  statuses?: ProjectStatus[];
  members: ProjectMember[];
  /** Left out of the list response (GET /projects); only the single project sends it */
  groups?: ProjectGroupSummary[];
  member_count: number;
  issue_counts: ProjectIssueCounts;
  /** The signed-in user's role in this project, e.g. "Super admin" */
  my_role: string;
  /**
   * Backend permission names the signed-in user has in this project. Left out of the
   * list response, where projectCan falls back to what `my_role` grants.
   */
  my_permissions?: string[];
  created_at: string;

  // ---- Not returned by the backend yet; sent on save so they work once supported ----
  objective?: string | null;
  priority?: ProjectPriority | null;
  color?: string | null;
  start_date?: string | null;
}

export interface ProjectListParams extends InfiniteListParams {
  search?: string;
  status?: ProjectState;
  priority?: ProjectPriority;
}

/** One dropdown entry: send `value`, show `label` */
export interface FilterOption {
  value: string;
  label: string;
}

/** GET /api/projects/filters */
export interface ProjectFilterOptions {
  statuses: FilterOption[];
  priorities: FilterOption[];
}

// ---- Requests ----

export interface ProjectMemberInput {
  user_id: number;
  /** Omit to use the user's default role */
  role?: string;
}

/** Fields shared by create and update */
export interface ProjectFields {
  name: string;
  description: string;
  due_date: string | null;
  status: ProjectState;
  objective?: string | null;
  priority?: ProjectPriority;
  color?: string;
  start_date?: string | null;
}

export interface CreateProjectRequest extends ProjectFields {
  status_ids: number[];
  members: ProjectMemberInput[];
}

export interface UpdateProjectRequest extends Partial<ProjectFields> {
  id: number;
}

/** POST /projects/{id} with form-data: upload a logo, or delete the current one */
export interface UpdateProjectLogoRequest {
  id: number;
  /** jpg, jpeg, png or webp, 2 MB at most */
  logo?: File;
  remove?: boolean;
}

export interface AddProjectMemberRequest extends ProjectMemberInput {
  projectId: number;
}

export interface ChangeMemberRoleRequest {
  projectId: number;
  userId: number;
  role: string;
}

export interface RemoveProjectMemberRequest {
  projectId: number;
  userId: number;
}

/** POST /projects/{id}/statuses: a brand-new status in this project's workflow */
export interface CreateProjectStatusRequest {
  projectId: number;
  /** Up to 50 characters; the slug is made from it */
  name: string;
  /** #RRGGBB */
  color: string;
  /** 0-65535; left out, it goes after the last status */
  sort_order?: number;
  is_terminal?: boolean;
}

/** PATCH /projects/{id}/statuses/{statusId}; send only what changes */
export interface UpdateProjectStatusRequest {
  projectId: number;
  statusId: number;
  name?: string;
  color?: string;
}

/** DELETE /projects/{id}/statuses/{statusId} */
export interface DeleteProjectStatusRequest {
  projectId: number;
  statusId: number;
}

export interface ProjectStatusInput {
  status_id: number;
  sort_order: number;
  is_initial: boolean;
  is_terminal: boolean;
}

export interface AttachProjectGroupRequest {
  projectId: number;
  /** An active, non-deleted group */
  group_id: number;
}

export interface DetachProjectGroupRequest {
  projectId: number;
  groupId: number;
}

export interface ReplaceProjectStatusesRequest {
  projectId: number;
  statuses: ProjectStatusInput[];
}
