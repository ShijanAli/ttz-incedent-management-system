import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, Permission } from '@/lib/types';
import { userRepo, roleRepo, getUserPermissions, getUserRoles } from '@/lib/repository';

interface AuthSession {
  user: User;
  permissions: Permission[];
  roleNames: string[];
}

interface AuthContextValue {
  session: AuthSession | null;
  loading: boolean;
  login: (email: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
  register: (name: string, email: string, password: string) => { success: boolean; error?: string };
  refreshSession: () => void;
  hasPermission: (perm: Permission) => boolean;
  hasAnyPermission: (perms: Permission[]) => boolean;
  hasAllPermissions: (perms: Permission[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const SESSION_KEY = 'techtrioz_session_user_id';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  const buildSession = useCallback((user: User): AuthSession => {
    const permissions = getUserPermissions(user.id);
    const roles = getUserRoles(user.id);
    return {
      user,
      permissions,
      roleNames: roles.map((r) => r.name),
    };
  }, []);

  const refreshSession = useCallback(() => {
    if (typeof window === 'undefined') return;
    const userId = localStorage.getItem(SESSION_KEY);
    if (!userId) {
      setSession(null);
      return;
    }
    const user = userRepo.find(userId);
    if (!user || user.status !== 'active') {
      localStorage.removeItem(SESSION_KEY);
      setSession(null);
      return;
    }
    setSession(buildSession(user));
  }, [buildSession]);

  useEffect(() => {
    refreshSession();
    setLoading(false);
  }, [refreshSession]);

  const login = useCallback((email: string, password: string): { success: boolean; error?: string } => {
    const user = userRepo.findByEmail(email);
    if (!user) return { success: false, error: 'No account found with that email address.' };
    if (user.password !== password) return { success: false, error: 'Incorrect password. Please try again.' };
    if (user.status !== 'active') return { success: false, error: 'This account has been deactivated. Contact your administrator.' };

    userRepo.update(user.id, { lastActiveAt: new Date().toISOString() });
    if (typeof window !== 'undefined') {
      localStorage.setItem(SESSION_KEY, user.id);
    }
    setSession(buildSession(user));
    return { success: true };
  }, [buildSession]);

  const logout = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SESSION_KEY);
    }
    setSession(null);
  }, []);

  const register = useCallback((name: string, email: string, password: string): { success: boolean; error?: string } => {
    if (userRepo.findByEmail(email)) {
      return { success: false, error: 'An account with this email already exists.' };
    }
    const customerRole = roleRepo.findByName('Customer');
    if (!customerRole) {
      return { success: false, error: 'Registration is not available at this time.' };
    }
    const colors = ['#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777'];
    const newUser = userRepo.create({
      name,
      email,
      password,
      avatarColor: colors[Math.floor(Math.random() * colors.length)],
      roleIds: [customerRole.id],
      status: 'active',
      title: 'Customer',
      department: 'External',
    });
    if (typeof window !== 'undefined') {
      localStorage.setItem(SESSION_KEY, newUser.id);
    }
    setSession(buildSession(newUser));
    return { success: true };
  }, [buildSession]);

  const hasPermission = useCallback((perm: Permission): boolean => {
    return session?.permissions.includes(perm) ?? false;
  }, [session]);

  const hasAnyPermission = useCallback((perms: Permission[]): boolean => {
    if (!session) return false;
    return perms.some((p) => session.permissions.includes(p));
  }, [session]);

  const hasAllPermissions = useCallback((perms: Permission[]): boolean => {
    if (!session) return false;
    return perms.every((p) => session.permissions.includes(p));
  }, [session]);

  return (
    <AuthContext.Provider value={{
      session, loading, login, logout, register, refreshSession,
      hasPermission, hasAnyPermission, hasAllPermissions,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
