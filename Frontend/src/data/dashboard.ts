import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Home,
  Inbox,
  LayoutDashboard,
  Megaphone,
  Settings,
  Sliders,
  UserCheck,
  UsersRound,
} from 'lucide-react';

export type StatusTone = 'good' | 'attention' | 'danger' | 'neutral';

export type NavItem = {
  id: PageId;
  label: string;
  /**
   * Used in the mobile tab bar, where a slot is ~70px wide and anything longer
   * gets an ellipsis. Only set it where the full label doesn't fit.
   */
  shortLabel?: string;
  icon: LucideIcon;
  /**
   * Pages that should light this nav item up. Used by the grouped admin items
   * (Inbox / Settings) where one sidebar entry fronts several sub-pages.
   * Defaults to just `id`.
   */
  matches?: PageId[];
  /**
   * Key into the admin overview `attention` block. When set, the sidebar shows
   * the summed count as a pill. Multiple keys are added together.
   */
  badgeKeys?: string[];
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
  | 'adminEvents'
  | 'adminCampaigns'
  | 'adminSettings'
  | 'allUsers'
  | 'units'
  | 'dashboard'
  | 'profile'
  | 'pass'
  | 'community'
  | 'myProfile'
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
  'adminEvents',
  'adminCampaigns',
  'adminSettings',
  'units',
];

/**
 * Every page that belongs to the admin area.
 *
 * This is what decides which mode the shell is in. Deriving the mode from the
 * current page (rather than storing a separate flag) means a deep link, a
 * bookmark or the back button can't leave the sidebar showing one area while
 * the content shows the other.
 */
export const ADMIN_AREA_PAGES: PageId[] = [...ADMIN_SUB_PAGES, 'allUsers'];

export function isAdminPage(page: PageId): boolean {
  return ADMIN_AREA_PAGES.includes(page);
}

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
  adminEvents: 'events',
  adminCampaigns: 'campaigns',
  adminSettings: 'settings',
  units: 'units',
};

/**
 * The five day-to-day queues, surfaced as sub-tabs under a single "Inbox"
 * sidebar entry. `attentionKey` reads from the admin overview `attention`
 * block to show a per-tab pending count.
 */
export const INBOX_TABS: Array<{ page: PageId; label: string; attentionKey: string }> = [
  { page: 'adminApplicants', label: 'Applicants', attentionKey: 'pendingApplications' },
  { page: 'adminResidency', label: 'Residency', attentionKey: 'pendingResidency' },
  { page: 'adminSupport', label: 'Support', attentionKey: 'openTickets' },
  { page: 'adminPayments', label: 'Payments', attentionKey: 'overduePayments' },
  { page: 'adminMaintenance', label: 'Maintenance', attentionKey: 'openMaintenance' },
];

/** Rarely-touched CRUD, grouped as sub-tabs under a single "Settings" entry. */
export const SETTINGS_TABS: Array<{ page: PageId; label: string }> = [
  { page: 'adminSettings', label: 'Plans & batch' },
  { page: 'adminVehicles', label: 'Vehicles' },
  { page: 'units', label: 'Units' },
  { page: 'adminResources', label: 'Resources' },
  { page: 'adminEvents', label: 'Events' },
  { page: 'adminCampaigns', label: 'Traffic' },
];

export const INBOX_PAGES: PageId[] = INBOX_TABS.map((tab) => tab.page);
export const SETTINGS_PAGES: PageId[] = SETTINGS_TABS.map((tab) => tab.page);

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
  // Day-to-day queues live under one Inbox group.
  adminApplicants: '/admin/inbox/applicants',
  adminResidency: '/admin/inbox/residency',
  adminSupport: '/admin/inbox/support',
  adminPayments: '/admin/inbox/payments',
  adminMaintenance: '/admin/inbox/maintenance',
  adminDesignations: '/admin/designations',
  adminNotifications: '/admin/notifications',
  // Rarely-touched CRUD lives under the Settings group.
  adminSettings: '/admin/settings',
  adminVehicles: '/admin/settings/vehicles',
  units: '/admin/settings/units',
  adminResources: '/admin/settings/resources',
  adminEvents: '/admin/settings/events',
  adminCampaigns: '/admin/settings/traffic',
  allUsers: '/users',
  dashboard: '/account',
  profile: '/account',
  pass: '/pass',
  community: '/community',
  myProfile: '/profile',
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
  '/admin/designations': 'adminDesignations',
  '/admin/notifications': 'adminNotifications',
  // Inbox group.
  '/admin/inbox': 'adminApplicants', // group root → first tab
  '/admin/inbox/applicants': 'adminApplicants',
  '/admin/inbox/residency': 'adminResidency',
  '/admin/inbox/support': 'adminSupport',
  '/admin/inbox/payments': 'adminPayments',
  '/admin/inbox/maintenance': 'adminMaintenance',
  // Settings group.
  '/admin/settings': 'adminSettings',
  '/admin/settings/vehicles': 'adminVehicles',
  '/admin/settings/units': 'units',
  '/admin/settings/resources': 'adminResources',
  '/admin/settings/events': 'adminEvents',
  '/admin/settings/traffic': 'adminCampaigns',
  '/users': 'allUsers',
  // Legacy flat paths — kept so old bookmarks/links still resolve. The URL
  // sync effect in App.tsx rewrites them to the canonical path above.
  '/admin/applicants': 'adminApplicants',
  '/admin/residency': 'adminResidency',
  '/admin/maintenance': 'adminMaintenance',
  '/admin/support': 'adminSupport',
  '/admin/payments': 'adminPayments',
  '/admin/vehicles': 'adminVehicles',
  '/admin/resources': 'adminResources',
  '/units': 'units',
  '/account': 'profile',
  '/community': 'community',
  '/profile': 'myProfile',
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

/** Pages whose real URL carries a trailing dynamic segment (/pass/:token). */
const DYNAMIC_PAGES: PageId[] = ['pass'];

/**
 * The path the address bar should hold for `page`.
 *
 * Normally that's the canonical path — which is what rewrites the legacy admin
 * aliases (/admin/support → /admin/inbox/support). But for a dynamic route the
 * canonical path is only a prefix, so when the current URL is already a deeper
 * form of it we hand that back untouched. Without this the URL-sync effect
 * strips the token off /pass/:token and the pass reads as "missing its code".
 */
export function canonicalPathFor(page: PageId, currentPathname: string): string {
  const base = pathForPage(page);
  if (DYNAMIC_PAGES.includes(page) && currentPathname.startsWith(`${base}/`)) {
    return currentPathname;
  }
  return base;
}

// Sidebar navigation, grouped into a members area and an admin area.
export const navSections: NavSection[] = [
  {
    id: 'members',
    title: 'Members',
    items: [
      { id: 'profile', label: 'Home', icon: Home },
      { id: 'community', label: 'Community', icon: UsersRound },
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
      {
        // Fronts the five day-to-day queues; sub-tabs live inside the page.
        id: 'adminApplicants',
        label: 'Inbox',
        icon: Inbox,
        matches: INBOX_PAGES,
        badgeKeys: INBOX_TABS.map((tab) => tab.attentionKey),
      },
      { id: 'allUsers', label: 'Members', icon: UsersRound },
      // "Assign" is what the page does — assign apartment, meal and cleaning plan.
      { id: 'adminDesignations', label: 'Designations', shortLabel: 'Assign', icon: UserCheck },
      { id: 'adminNotifications', label: 'Notifications', shortLabel: 'Notify', icon: Megaphone },
      {
        // Fronts the rarely-touched CRUD (plans, vehicles, units, resources).
        id: 'adminSettings',
        label: 'Settings',
        icon: Sliders,
        matches: SETTINGS_PAGES,
      },
    ],
  },
];

export const allNavItems: NavItem[] = navSections.flatMap((section) => section.items);
