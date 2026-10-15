export interface ApiUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  designation: string | null;
  status: 'active' | 'inactive' | (string & {});
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

export interface ResetPasswordRequest {
  email: string;
  otp: string;
  token?: string;
  password: string;
  password_confirmation: string;
}
