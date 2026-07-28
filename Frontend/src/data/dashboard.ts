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
  | 'forgotPassword'
  | 'resetPassword'
  | 'verifyEmail'
  | 'setupPassword'
  | 'adminLogin'
  | 'adminDashboard'
  | 'allUsers'
  | 'units'
  | 'dashboard'
  | 'profile'
  | 'security';

export const ADMIN_ROLES = ['SUPER_ADMIN', 'MODERATOR', 'COMMUNITY_LEADER'];

/** Canonical URL path for each page (source of truth for the address bar). */
export const PAGE_PATHS: Record<PageId, string> = {
  landing: '/',
  apply: '/apply',
  login: '/login',
  signup: '/signup',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  verifyEmail: '/verify-email',
  setupPassword: '/setup-password',
  adminLogin: '/admin-login',
  adminDashboard: '/admin',
  allUsers: '/users',
  units: '/units',
  dashboard: '/account',
  profile: '/account',
  security: '/security',
};

// Reverse map. '/account' resolves to `profile` (dashboard is a legacy alias).
const PATH_TO_PAGE: Record<string, PageId> = {
  '/': 'landing',
  '/apply': 'apply',
  '/login': 'login',
  '/signup': 'signup',
  '/forgot-password': 'forgotPassword',
  '/reset-password': 'resetPassword',
  '/verify-email': 'verifyEmail',
  '/setup-password': 'setupPassword',
  '/admin-login': 'adminLogin',
  '/admin': 'adminDashboard',
  '/users': 'allUsers',
  '/units': 'units',
  '/account': 'profile',
  '/security': 'security',
};

export function pageForPath(pathname: string): PageId | null {
  return PATH_TO_PAGE[pathname] ?? null;
}

export function pathForPage(page: PageId): string {
  return PAGE_PATHS[page] ?? '/';
}

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
