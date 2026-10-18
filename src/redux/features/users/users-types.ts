import type { ApiUser } from '@/redux/features/auth/auth-types';
import type { InfiniteListParams } from '@/redux/api/types';

export type UserStatus = 'active' | 'invited' | 'disabled' | (string & {});

/** Status the backend sets after DELETE /admin/users/{id} */
export const DISABLED_STATUS: UserStatus = 'disabled';

export const isUserDisabled = (status: UserStatus) => status === DISABLED_STATUS;

/** A user as returned by the /admin/users endpoints */
export interface AdminUser extends Omit<ApiUser, 'can_manage_users' | 'status'> {
  status: UserStatus;
  /** Role name, e.g. "Developer" */
  default_role: string | null;
  department?: string | null;
}

export interface UserListParams extends InfiniteListParams {
  /** Server-side status filter; omit for all statuses */
  status?: UserStatus;
  /** Server-side text search (name, email, ...); omit when empty */
  search?: string;
}

// ---- Requests ----

export interface CreateUserRequest {
  name: string;
  email: string;
  default_role: string | null;
  phone: string | null;
  designation: string | null;
  /** Not persisted by the backend yet; sent so it works once supported */
  department: string | null;
}

export interface UpdateUserRequest {
  id: number;
  name?: string;
  phone?: string | null;
  designation?: string | null;
  default_role?: string | null;
  status?: UserStatus;
  /** Not persisted by the backend yet; sent so it works once supported */
  department?: string | null;
}
