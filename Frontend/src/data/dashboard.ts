import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Building2,
  Car,
  ClipboardList,
  CreditCard,
  FileCheck2,
  Home,
  LayoutDashboard,
  LifeBuoy,
  Library,
  Megaphone,
  Settings,
  Sliders,
  UserCheck,
  UsersRound,
  Wrench,
} from 'lucide-react';

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
  | 'adminApplicants'
  | 'adminResidency'
  | 'adminDesignations'
  | 'adminMaintenance'
  | 'adminSupport'
  | 'adminPayments'
  | 'adminNotifications'
  | 'adminVehicles'
  | 'adminResources'
  | 'adminSettings'
  | 'allUsers'
  | 'units'
  | 'dashboard'
  | 'profile'
  | 'pass'
  | 'resources'
  | 'security';

/** Sub-page ids that render inside the AdminDashboard. */
export const ADMIN_SUB_PAGES: PageId[] = [
  'adminDashboard',
  'adminApplicants',
  'adminResidency',
  'adminDesignations',
  'adminMaintenance',
  'adminSupport',
  'adminPayments',
  'adminNotifications',
  'adminVehicles',
  'adminResources',
  'adminSettings',
];

/** Which internal admin tab each PageId corresponds to. */
export const ADMIN_PAGE_TO_TAB: Record<string, string> = {
  adminDashboard: 'overview',
  adminApplicants: 'applicants',
  adminResidency: 'residency',
  adminDesignations: 'designations',
  adminMaintenance: 'maintenance',
  adminSupport: 'support',
  adminPayments: 'payments',
  adminNotifications: 'notifications',
  adminVehicles: 'vehicles',
  adminResources: 'resources',
  adminSettings: 'settings',
};

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
  adminApplicants: '/admin/applicants',
  adminResidency: '/admin/residency',
  adminDesignations: '/admin/designations',
  adminMaintenance: '/admin/maintenance',
  adminSupport: '/admin/support',
  adminPayments: '/admin/payments',
  adminNotifications: '/admin/notifications',
  adminVehicles: '/admin/vehicles',
  adminResources: '/admin/resources',
  adminSettings: '/admin/settings',
  allUsers: '/users',
  units: '/units',
  dashboard: '/account',
  profile: '/account',
  pass: '/pass',
  resources: '/resources',
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
  '/admin/applicants': 'adminApplicants',
  '/admin/residency': 'adminResidency',
  '/admin/designations': 'adminDesignations',
  '/admin/maintenance': 'adminMaintenance',
  '/admin/support': 'adminSupport',
  '/admin/payments': 'adminPayments',
  '/admin/notifications': 'adminNotifications',
  '/admin/vehicles': 'adminVehicles',
  '/admin/resources': 'adminResources',
  '/admin/settings': 'adminSettings',
  '/users': 'allUsers',
  '/units': 'units',
  '/account': 'profile',
  '/resources': 'resources',
  '/security': 'security',
};

export function pageForPath(pathname: string): PageId | null {
  // Public member pass has a dynamic segment (/pass/:memberId) — treat any
  // /pass/... URL as the same PageId; the page reads the id from location.
  if (pathname === '/pass' || pathname.startsWith('/pass/')) return 'pass';
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
      { id: 'resources', label: 'Resources', icon: BookOpen },
      { id: 'security', label: 'Settings', icon: Settings },
    ],
  },
  {
    id: 'admin',
    title: 'Admin',
    adminOnly: true,
    items: [
      { id: 'adminDashboard', label: 'Overview', icon: LayoutDashboard },
      { id: 'adminApplicants', label: 'Applicants', icon: ClipboardList },
      { id: 'adminResidency', label: 'Residency', icon: FileCheck2 },
      { id: 'adminDesignations', label: 'Designations', icon: UserCheck },
      { id: 'adminMaintenance', label: 'Maintenance', icon: Wrench },
      { id: 'adminSupport', label: 'Support', icon: LifeBuoy },
      { id: 'adminPayments', label: 'Payments', icon: CreditCard },
      { id: 'adminNotifications', label: 'Notifications', icon: Megaphone },
      { id: 'allUsers', label: 'Members', icon: UsersRound },
      { id: 'adminVehicles', label: 'Vehicles', icon: Car },
      { id: 'adminResources', label: 'Resources', icon: Library },
      { id: 'units', label: 'Units', icon: Building2 },
      { id: 'adminSettings', label: 'Settings', icon: Sliders },
    ],
  },
];

export const allNavItems: NavItem[] = navSections.flatMap((section) => section.items);
