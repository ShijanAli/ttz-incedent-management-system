import React, { createContext, useCallback, useContext, useMemo } from 'react';
import type { User } from '@/lib/types';
import { getAvatarColor } from '@/lib/shared-utils';
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
  roleNames: string[];
}

interface AuthContextValue {
  session: AuthSession | null;
  /** True while a stored token is being validated against /auth/me */
  loading: boolean;
  mustChangePassword: boolean;
  /** Raw per-project access from the API, for project-scoped checks */
  access: UserAccess | null;
  /** Super admins see everything (admin endpoints); others are scoped to their projects */
  isSuperAdmin: boolean;
  logout: () => void;
  register: (name: string, email: string, password: string) => { success: boolean; error?: string };
  refreshSession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);



function toSessionUser(user: ApiUser): User {
  return {
    id: String(user.id),
    name: user.name,
    email: user.email,
    password: '',
    avatarColor: getAvatarColor(user.id),
    roleIds: [],
    status: user.status === 'active' ? 'active' : 'inactive',
    title: user.designation ?? undefined,
    department: user.department ?? undefined,
    phone: user.phone ?? undefined,
    bio: user.bio ?? undefined,
    avatarUrl: user.photo_url ?? user.photo ?? undefined,
    createdAt: user.created_at,
    lastActiveAt: user.last_login_at ?? undefined,
  };
}

function toRoleNames(user: ApiUser, access: UserAccess | null): string[] {
  if (user.is_super_admin || access?.is_super_admin) return ['Super Admin'];
  const names = [user.default_role, ...(access?.projects?.map((p) => p.role) ?? [])];
  return [...new Set(names.filter((n): n is string => Boolean(n)))];
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const { accessToken, user, access, mustChangePassword } = useAppSelector(selectAuth);
  const isSuperAdmin = Boolean(user?.is_super_admin || access?.is_super_admin);
  const [logoutRequest] = useLogoutMutation();

  // Validates a stored token on load and keeps the profile fresh
  const { isLoading, isUninitialized, refetch } = useGetMeQuery(undefined, { skip: !accessToken });
  const loading = Boolean(accessToken) && !user && (isLoading || isUninitialized);

  const session = useMemo<AuthSession | null>(() => {
    if (!accessToken || !user) return null;
    return {
      user: toSessionUser(user),
      roleNames: toRoleNames(user, access),
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

  return (
    <AuthContext.Provider
      value={{
        session, loading, mustChangePassword, access, isSuperAdmin, logout, register, refreshSession,
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
