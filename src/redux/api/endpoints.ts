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
  PROFILE: '/api/profile',
  /** Counters, breakdowns and latest activity across the user's projects */
  DASHBOARD: '/api/dashboard',
  ADMIN: {
    PERMISSIONS: '/api/admin/permissions',
    ROLES: '/api/admin/roles',
    ROLE: (id: number | string) => `/api/admin/roles/${id}`,
    USERS: '/api/admin/users',
    USER: (id: number | string) => `/api/admin/users/${id}`,
    USER_RESEND_INVITE: (id: number | string) => `/api/admin/users/${id}/resend-invite`,
    GROUPS: '/api/admin/groups',
    GROUP: (id: number | string) => `/api/admin/groups/${id}`,
    GROUP_MEMBERS: (id: number | string) => `/api/admin/groups/${id}/members`,
    GROUP_MEMBER: (id: number | string, userId: number | string) => `/api/admin/groups/${id}/members/${userId}`,
    GROUP_PROJECTS: (id: number | string) => `/api/admin/groups/${id}/projects`,
    ISSUES: '/api/admin/issues',
    ISSUE_CATEGORIES: '/api/admin/issue-categories',
    ISSUE_CATEGORY: (id: number | string) => `/api/admin/issue-categories/${id}`,
    /** Global workflow statuses projects pick from */
    STATUSES: '/api/admin/statuses',
  },
  MY: {
    ISSUES: '/api/my/issues',
  },
  /** Active global statuses for any signed-in user; add ?project_id= for that project's own ones too */
  STATUSES: '/api/statuses',
  /** Read-only list for every signed-in user; managing categories stays under ADMIN */
  ISSUE_CATEGORIES: '/api/issue-categories',
  ISSUES: {
    ONE: (id: number | string) => `/api/issues/${id}`,
    HISTORY: (id: number | string) => `/api/issues/${id}/history`,
    STATUS: (id: number | string) => `/api/issues/${id}/status`,
    PICK: (id: number | string) => `/api/issues/${id}/pick`,
    REVIEW: (id: number | string) => `/api/issues/${id}/review`,
    ASSIGNEES: (id: number | string) => `/api/issues/${id}/assignees`,
    ASSIGNEE: (id: number | string, userId: number | string) => `/api/issues/${id}/assignees/${userId}`,
    ASSIGNEE_STATUS: (id: number | string, userId: number | string) => `/api/issues/${id}/assignees/${userId}/status`,
    COMMENTS: (id: number | string) => `/api/issues/${id}/comments`,
    ATTACHMENTS: (id: number | string) => `/api/issues/${id}/attachments`,
  },
  COMMENTS: {
    ONE: (id: number | string) => `/api/comments/${id}`,
  },
  ATTACHMENTS: {
    ONE: (id: number | string) => `/api/attachments/${id}`,
    DOWNLOAD: (id: number | string) => `/api/attachments/${id}/download`,
  },
  NOTIFICATIONS: {
    LIST: '/api/notifications',
    UNREAD_COUNT: '/api/notifications/unread-count',
    READ: (id: string) => `/api/notifications/${id}/read`,
    READ_ALL: '/api/notifications/read-all',
    /** GET the user's toggles; PATCH only the ones that changed */
    PREFERENCES: '/api/notification-preferences',
  },
  PROJECTS: {
    LIST: '/api/projects',
    ONE: (id: number | string) => `/api/projects/${id}`,
    MEMBERS: (id: number | string) => `/api/projects/${id}/members`,
    MEMBER: (id: number | string, userId: number | string) => `/api/projects/${id}/members/${userId}`,
    STATUSES: (id: number | string) => `/api/projects/${id}/statuses`,
    STATUS: (id: number | string, statusId: number | string) => `/api/projects/${id}/statuses/${statusId}`,
    ISSUES: (id: number | string) => `/api/projects/${id}/issues`,
    GROUPS: (id: number | string) => `/api/projects/${id}/groups`,
    GROUP: (id: number | string, groupId: number | string) => `/api/projects/${id}/groups/${groupId}`,
    ACTIVITY: (id: number | string) => `/api/projects/${id}/activity`,
    DASHBOARD: (id: number | string) => `/api/projects/${id}/dashboard`,
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
