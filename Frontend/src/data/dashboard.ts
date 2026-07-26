import type { LucideIcon } from 'lucide-react';
import { Building2, Home, Settings, ShieldCheck, UsersRound } from 'lucide-react';

export type StatusTone = 'good' | 'attention' | 'danger' | 'neutral';

export type NavItem = {
  id: PageId;
  label: string;
  icon: LucideIcon;
};

export type NavSection = {
  id: string;
  title: string;
  adminOnly?: boolean;
  items: NavItem[];
};

export type PageId =
  | 'landing'
  | 'apply'
  | 'login'
  | 'signup'
  | 'setupPassword'
  | 'adminLogin'
  | 'adminDashboard'
  | 'allUsers'
  | 'units'
  | 'dashboard'
  | 'profile'
  | 'security';

export const ADMIN_ROLES = ['SUPER_ADMIN', 'MODERATOR', 'COMMUNITY_LEADER'];

// Sidebar navigation, grouped into a members area and an admin area.
export const navSections: NavSection[] = [
  {
    id: 'members',
    title: 'Members',
    items: [
      { id: 'profile', label: 'Home', icon: Home },
      { id: 'security', label: 'Settings', icon: Settings },
    ],
  },
  {
    id: 'admin',
    title: 'Admin',
    adminOnly: true,
    items: [
      { id: 'adminDashboard', label: 'Admin', icon: ShieldCheck },
      { id: 'allUsers', label: 'Users', icon: UsersRound },
      { id: 'units', label: 'Units', icon: Building2 },
    ],
  },
];

export const allNavItems: NavItem[] = navSections.flatMap((section) => section.items);
