import type { InfiniteListParams } from '@/redux/api/types';

/** Lifecycle state of a project. "active" is confirmed; the rest mirror the UI options. */
export type ProjectState = 'planning' | 'active' | 'on_hold' | 'completed' | 'archived' | (string & {});

/** Not returned by the backend yet; the UI keeps the field and shows blanks until it is */
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
}

export interface ProjectMemberUser {
  id: number;
  name: string;
  designation: string | null;
  status: string;
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
  state: ProjectState;
  statuses: ProjectStatus[];
  members: ProjectMember[];
  groups: ProjectGroupSummary[];
  member_count: number;
  issue_counts: ProjectIssueCounts;
  /** The signed-in user's role in this project, e.g. "Super admin" */
  my_role: string;
  /** Backend permission names the signed-in user has in this project */
  my_permissions: string[];
  created_at: string;

  // ---- Not returned by the backend yet; sent on save so they work once supported ----
  objectives?: string | null;
  priority?: ProjectPriority | null;
  color?: string | null;
  start_date?: string | null;
}

export interface ProjectListParams extends InfiniteListParams {
  search?: string;
  state?: ProjectState;
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
  state: ProjectState;
  objectives?: string | null;
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

export interface ProjectStatusInput {
  status_id: number;
  sort_order: number;
  is_initial: boolean;
  is_terminal: boolean;
}

export interface ReplaceProjectStatusesRequest {
  projectId: number;
  statuses: ProjectStatusInput[];
}
