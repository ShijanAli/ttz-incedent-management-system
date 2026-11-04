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
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Projects",
    href: "/projects",
    icon: FolderKanban,
  },
  {
    label: "Issues",
    href: "/issues",
    icon: TicketCheck,
  },
  {
    label: "Users",
    href: "/users",
    icon: Users,
  },
  {
    label: "Roles & Permissions",
    href: "/roles",
    icon: ShieldCheck,
  },
  {
    label: "Groups",
    href: "/groups",
    icon: MessageSquare,
  },
  {
    label: "Activity Log",
    href: "/activity",
    icon: History,
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
    after: "/groups",
  },
];
