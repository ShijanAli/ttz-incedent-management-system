import React, { createContext, useCallback, useContext, useMemo } from 'react';
import type { User, Permission } from '@/lib/types';
import { ALL_PERMISSIONS, toAppPermissions } from '@/lib/permissions';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { baseApi } from '@/redux/api/base-api';
import { useGetMeQuery, useLogoutMutation } from '@/redux/features/auth/auth-api';
import { loggedOut, selectAuth } from '@/redux/features/auth/auth-slice';
import type { ApiUser, UserAccess } from '@/redux/features/auth/auth-types';

/**
 * Auth state lives in Redux (src/redux/features/auth). This context adapts it to the
 * session shape the rest of the app was built against, so modules still on mock data keep working.
 */
interface AuthSession {
  user: User;
  permissions: Permission[];
  roleNames: string[];
}

interface AuthContextValue {
  session: AuthSession | null;
  /** True while a stored token is being validated against /auth/me */
  loading: boolean;
  mustChangePassword: boolean;
  /** Raw per-project access from the API, for project-scoped checks */
  access: UserAccess | null;
  logout: () => void;
  register: (name: string, email: string, password: string) => { success: boolean; error?: string };
  refreshSession: () => void;
  hasPermission: (perm: Permission) => boolean;
  hasAnyPermission: (perms: Permission[]) => boolean;
  hasAllPermissions: (perms: Permission[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Every signed-in user can reach these regardless of project access */
const BASELINE_PERMISSIONS: Permission[] = ['dashboard.view', 'notifications.view', 'settings.view'];

const AVATAR_COLORS = ['#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777'];

function resolvePermissions(access: UserAccess | null): Permission[] {
  if (!access) return BASELINE_PERMISSIONS;
  if (access.is_super_admin) return ALL_PERMISSIONS;

  const result = toAppPermissions(access.projects.flatMap((p) => p.permissions));
  BASELINE_PERMISSIONS.forEach((p) => result.add(p));
  if (access.can_manage_users) {
    (['users.view', 'users.create', 'users.update', 'users.deactivate'] as Permission[]).forEach((p) => result.add(p));
  }
  return [...result];
}

function toSessionUser(user: ApiUser): User {
  return {
    id: String(user.id),
    name: user.name,
    email: user.email,
    password: '',
    avatarColor: AVATAR_COLORS[user.id % AVATAR_COLORS.length],
    roleIds: [],
    status: user.status === 'active' ? 'active' : 'inactive',
    title: user.designation ?? undefined,
    phone: user.phone ?? undefined,
    createdAt: user.created_at,
    lastActiveAt: user.last_login_at ?? undefined,
  };
}

function toRoleNames(access: UserAccess | null): string[] {
  if (!access) return [];
  if (access.is_super_admin) return ['Super Admin'];
  return [...new Set(access.projects.map((p) => p.role))];
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const { accessToken, user, access, mustChangePassword } = useAppSelector(selectAuth);
  const [logoutRequest] = useLogoutMutation();

  // Validates a stored token on load and keeps the profile fresh
  const { isLoading, isUninitialized, refetch } = useGetMeQuery(undefined, { skip: !accessToken });
  const loading = Boolean(accessToken) && !user && (isLoading || isUninitialized);

  const session = useMemo<AuthSession | null>(() => {
    if (!accessToken || !user) return null;
    return {
      user: toSessionUser(user),
      permissions: resolvePermissions(access),
      roleNames: toRoleNames(access),
    };
  }, [accessToken, user, access]);

  const logout = useCallback(() => {
    const token = accessToken;
    // Clear locally first so the UI never sees a half-logged-out state
    dispatch(loggedOut());
    dispatch(baseApi.util.resetApiState());
    if (token) logoutRequest(token);
  }, [accessToken, dispatch, logoutRequest]);

  const refreshSession = useCallback(() => {
    if (accessToken) refetch();
  }, [accessToken, refetch]);

  const register = useCallback(
    (): { success: boolean; error?: string } => ({
      success: false,
      error: 'Self-registration is not available. Please contact your administrator for an account.',
    }),
    [],
  );

  const hasPermission = useCallback(
    (perm: Permission) => session?.permissions.includes(perm) ?? false,
    [session],
  );
  const hasAnyPermission = useCallback(
    (perms: Permission[]) => (session ? perms.some((p) => session.permissions.includes(p)) : false),
    [session],
  );
  const hasAllPermissions = useCallback(
    (perms: Permission[]) => (session ? perms.every((p) => session.permissions.includes(p)) : false),
    [session],
  );

  return (
    <AuthContext.Provider
      value={{
        session, loading, mustChangePassword, access, logout, register, refreshSession,
        hasPermission, hasAnyPermission, hasAllPermissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
