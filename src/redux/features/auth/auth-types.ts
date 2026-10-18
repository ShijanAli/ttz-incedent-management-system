export interface ApiUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  designation: string | null;
  status: 'active' | 'inactive' | (string & {});
  department?: string | null;
  bio?: string | null;
  /** Profile photo URL; the backend may send it under either key */
  photo_url?: string | null;
  photo?: string | null;
  /** System-wide role name, e.g. "Developer"; drives the sidebar and dashboard */
  default_role?: string | null;
  /**
   * Backend permission names for the default role, sent by /auth/me. The source of
   * truth for modules and actions; DEFAULT_ROLE_PERMISSIONS covers payloads without it.
   */
  permissions?: string[];
  is_super_admin: boolean;
  /** Sent on /auth/me; login sends it inside `access` instead */
  can_manage_users?: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface ProjectAccess {
  project_id: number;
  project_name: string;
  role: string;
  permissions: string[];
}

export interface UserAccess {
  is_super_admin: boolean;
  can_manage_users: boolean;
  projects: ProjectAccess[];
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  /** Access-token lifetime in seconds */
  expires_in: number;
  token_type: string;
}

/** Returned by both /auth/login and /auth/refresh */
export interface AuthPayload extends AuthTokens {
  must_change_password: boolean;
  user: ApiUser;
  access: UserAccess;
}

/** `access` is not always present on /auth/me */
export type MeResponse = ApiUser & { access?: UserAccess };

// ---- Requests ----

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  password: string;
  password_confirmation: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface VerifyForgotOtpRequest {
  email: string;
  otp: string;
}

/** Shape is not documented yet; the reset token may come back under either key. */
export interface VerifyForgotOtpResponse {
  token?: string;
  reset_token?: string;
}

/** Sent as JSON (PATCH) without a photo, or multipart (POST) when `photo` is set */
export interface UpdateProfileRequest {
  name: string;
  email: string;
  /** Required by the backend only when `email` changes */
  current_password?: string;
  phone: string;
  designation: string;
  department: string;
  bio: string;
  photo?: File;
}

export interface ResetPasswordRequest {
  email: string;
  otp: string;
  token?: string;
  password: string;
  password_confirmation: string;
}
