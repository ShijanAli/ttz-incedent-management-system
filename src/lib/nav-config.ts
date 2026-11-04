import type { PermissionCode } from "@/lib/permissions";
import {
  LayoutDashboard,
  FolderKanban,
  TicketCheck,
  Users,
  ShieldCheck,
  MessageSquare,
  Bell,
  Settings,
  History,
  Building2,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** The link shows when the user holds any of these; omit for links everyone sees */
  permission?: readonly PermissionCode[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: ["dashboard.view"],
  },
  {
    label: "Projects",
    href: "/projects",
    icon: FolderKanban,
    permission: ["projects.view", "account.projects.view_all"],
  },
  {
    label: "Issues",
    href: "/issues",
    icon: TicketCheck,
    permission: ["issues.view", "account.projects.view_all"],
  },
  {
    label: "Users",
    href: "/users",
    icon: Users,
    permission: ["account.users.view"],
  },
  {
    label: "Roles & Permissions",
    href: "/roles",
    icon: ShieldCheck,
    permission: ["account.roles.view"],
  },
  {
    label: "Groups",
    href: "/groups",
    icon: MessageSquare,
    permission: ["account.groups.view"],
  },
  {
    label: "Activity Log",
    href: "/activity",
    icon: History,
    permission: ["activity.view"],
  },
  {
    label: "Notifications",
    href: "/notifications",
    icon: Bell,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

/** Extra pages, each shown right after the `after` link. */
export const ACCOUNT_NAV_ITEMS: (NavItem & { after: string })[] = [
  {
    label: "Customers",
    href: "/customers",
    icon: Building2,
    permission: ["account.customers.view"],
    after: "/groups",
  },
];
