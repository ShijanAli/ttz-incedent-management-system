/**
 * Every backend endpoint path lives here. Paths are relative to VITE_API_BASE_URL.
 * Add new modules as new groups (e.g. PROJECTS, ISSUES) so feature APIs never hardcode URLs.
 */
export const ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    REFRESH: '/api/auth/refresh',
    ME: '/api/auth/me',
    LOGOUT: '/api/auth/logout',
    CHANGE_PASSWORD: '/api/auth/change-password',
    FORGOT_PASSWORD: '/api/auth/forgot-password',
    VERIFY_FORGOT_OTP: '/api/auth/verify-forgot-otp',
    RESET_PASSWORD: '/api/auth/reset-password',
  },
  ADMIN: {
    PERMISSIONS: '/api/admin/permissions',
    ROLES: '/api/admin/roles',
    ROLE: (id: number | string) => `/api/admin/roles/${id}`,
    USERS: '/api/admin/users',
    USER: (id: number | string) => `/api/admin/users/${id}`,
    USER_RESEND_INVITE: (id: number | string) => `/api/admin/users/${id}/resend-invite`,
  },
  PROJECTS: {
    LIST: '/api/projects',
    ONE: (id: number | string) => `/api/projects/${id}`,
    MEMBERS: (id: number | string) => `/api/projects/${id}/members`,
    MEMBER: (id: number | string, userId: number | string) => `/api/projects/${id}/members/${userId}`,
    STATUSES: (id: number | string) => `/api/projects/${id}/statuses`,
  },
} as const;

/** Requests that must never trigger the 401 -> refresh-token retry. */
export const NO_REAUTH_ENDPOINTS: readonly string[] = [
  ENDPOINTS.AUTH.LOGIN,
  ENDPOINTS.AUTH.REFRESH,
  ENDPOINTS.AUTH.LOGOUT,
  ENDPOINTS.AUTH.FORGOT_PASSWORD,
  ENDPOINTS.AUTH.VERIFY_FORGOT_OTP,
  ENDPOINTS.AUTH.RESET_PASSWORD,
];
