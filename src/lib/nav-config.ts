import type { Permission } from '@/lib/types';
import {
  LayoutDashboard, FolderKanban, TicketCheck, Users, ShieldCheck,
  MessageSquare, BarChart3, Bell, Settings, History, type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: Permission;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
  { label: 'Projects', href: '/projects', icon: FolderKanban, permission: 'projects.view' },
  { label: 'Issues', href: '/issues', icon: TicketCheck, permission: 'issues.view' },
  { label: 'Users', href: '/users', icon: Users, permission: 'users.view' },
  { label: 'Roles & Permissions', href: '/roles', icon: ShieldCheck, permission: 'roles.view' },
  { label: 'Groups', href: '/groups', icon: MessageSquare, permission: 'groups.view' },
  { label: 'Reports', href: '/reports', icon: BarChart3, permission: 'reports.view' },
  { label: 'Activity Log', href: '/activity', icon: History, permission: 'activity.view' },
  { label: 'Notifications', href: '/notifications', icon: Bell, permission: 'notifications.view' },
  { label: 'Settings', href: '/settings', icon: Settings, permission: 'settings.view' },
];
