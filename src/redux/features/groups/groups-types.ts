import type { InfiniteListParams } from '@/redux/api/types';
import type {
  ProjectMemberUser,
  ProjectPriority,
  ProjectState,
} from '@/redux/features/projects/projects-types';

/** A group as returned by GET /admin/groups */
export interface ApiGroup {
  id: number;
  name: string;
  description: string | null;
  /** Inactive groups cannot be attached to projects */
  is_active: boolean;
  member_count: number;
  created_at: string;
}

export interface GroupMember {
  user: ProjectMemberUser;
  /** Role name, e.g. "Developer" */
  role: string;
}

/** A project the group is attached to (a slimmer project payload) */
export interface GroupProject {
  id: number;
  name: string;
  description: string | null;
  objective: string | null;
  due_date: string | null;
  status: ProjectState | null;
  priority: ProjectPriority | null;
  member_count: number;
  my_role: string;
  my_permissions: string[];
  created_at: string;
}

/** GET /admin/groups/{id} also embeds members and projects */
export interface GroupDetail extends ApiGroup {
  members: GroupMember[];
  projects: GroupProject[];
}

export interface GroupListParams extends InfiniteListParams {
  search?: string;
  /** 1 = active, 0 = inactive; Laravel's boolean rule doesn't accept "true"/"false" strings */
  is_active?: 0 | 1;
}

// ---- Requests ----

export interface GroupFields {
  name: string;
  description: string | null;
  is_active: boolean;
}

export interface CreateGroupRequest extends GroupFields {
  /** Members to add; each gets their default role */
  user_ids: number[];
  /** Projects to attach the group to */
  project_ids: number[];
}

export interface UpdateGroupRequest extends Partial<GroupFields> {
  id: number;
}

export interface AddGroupMemberRequest {
  groupId: number;
  user_id: number;
  /** Omit to use the user's default role */
  role?: string;
}

export interface ChangeGroupMemberRoleRequest {
  groupId: number;
  userId: number;
  role: string;
}

export interface RemoveGroupMemberRequest {
  groupId: number;
  userId: number;
}
