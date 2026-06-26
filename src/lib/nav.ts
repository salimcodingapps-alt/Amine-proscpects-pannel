import {
  LayoutDashboard,
  Database,
  Star,
  Upload,
  CopyCheck,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/**
 * Single source of truth for primary navigation.
 * Rendered by both the desktop sidebar and the mobile drawer.
 * New blocks (Auth, Workspaces, etc.) extend this list — they do not
 * each define their own nav.
 */
export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Database", href: "/database", icon: Database },
  { label: "Watchlist", href: "/watchlist", icon: Star },
  { label: "Duplicates", href: "/duplicates", icon: CopyCheck },
  { label: "Upload", href: "/upload", icon: Upload },
  { label: "Settings", href: "/settings", icon: Settings },
];
