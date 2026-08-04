import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { AppShell } from './components/AppShell';
import { AuthPanel } from './components/AuthPanel';
import { PullToRefresh } from './components/PullToRefresh';
import { ADMIN_SUB_PAGES, canonicalPathFor, pageForPath, type PageId } from './data/dashboard';
import { apiRequest, ApiError, isTokenExpired } from './lib/api';

// Eager: the member home is the first paint after login, so lazy-loading it
// would only add a round trip to the most common path.
import { Profile } from './pages/Profile';

/**
 * Everything else is split out. A member never opens the admin panel, an admin
 * never re-reads the landing page, and only applicants see Apply — shipping all
 * of it up front made every first load carry the whole product.
 *
 * Written out one by one rather than through a generic helper: these are named
 * exports, and only the explicit `.then(m => ({ default: m.X }))` form lets
 * TypeScript keep each component's prop types.
 */
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const AllUsers = lazy(() => import('./pages/AllUsers').then((m) => ({ default: m.AllUsers })));
const Units = lazy(() => import('./pages/Units').then((m) => ({ default: m.Units })));
const Landing = lazy(() => import('./pages/Landing').then((m) => ({ default: m.Landing })));
const Apply = lazy(() => import('./pages/Apply').then((m) => ({ default: m.Apply })));
const AdminLogin = lazy(() => import('./pages/AdminLogin').then((m) => ({ default: m.AdminLogin })));
const Security = lazy(() => import('./pages/Security').then((m) => ({ default: m.Security })));
const Resources = lazy(() => import('./pages/Resources').then((m) => ({ default: m.Resources })));
const Community = lazy(() => import('./pages/Community').then((m) => ({ default: m.Community })));
const MyProfile = lazy(() => import('./pages/MyProfile').then((m) => ({ default: m.MyProfile })));
const Pass = lazy(() => import('./pages/Pass').then((m) => ({ default: m.Pass })));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail').then((m) => ({ default: m.VerifyEmail })));

const ADMIN_ROLES = ['SUPER_ADMIN', 'MODERATOR', 'COMMUNITY_LEADER'];

const SITE_NAME = 'Builders Node';
const PAGE_TITLES: Partial<Record<PageId, string>> = {
  landing: 'Builders Node — Startup Society in Próspera',
  apply: 'Apply — Builders Node',
  login: 'Log in — Builders Node',
  signup: 'Create your account — Builders Node',
  setupPassword: 'Set your password — Builders Node',
  forgotPassword: 'Forgot password — Builders Node',
  resetPassword: 'Reset password — Builders Node',
  verifyEmail: 'Confirm your email — Builders Node',
  adminLogin: 'Admin login — Builders Node',
  profile: 'Account — Builders Node',
  resources: 'Resources — Builders Node',
  community: 'Community — Builders Node',
  myProfile: 'Your profile — Builders Node',
  security: 'Security — Builders Node',
  dashboard: 'Home — Builders Node',
  allUsers: 'Users — Builders Node',
  units: 'Units — Builders Node',
  adminDashboard: 'Admin — Builders Node',
  adminApplicants: 'Applicants — Builders Node',
  adminResidency: 'Residency — Builders Node',
  adminDesignations: 'Designations — Builders Node',
  adminMaintenance: 'Maintenance — Builders Node',
  adminSupport: 'Support — Builders Node',
  adminPayments: 'Payments — Builders Node',
  adminNotifications: 'Notifications — Builders Node',
  adminVehicles: 'Vehicles — Builders Node',
  adminResources: 'Resources — Builders Node',
  adminEvents: 'Events — Builders Node',
  adminSettings: 'Admin settings — Builders Node',
  pass: 'Member pass — Builders Node',
};

/** Shown only while a split page chunk is in flight. */
function PageFallback() {
  return <div className="page-stack" aria-busy="true" aria-live="polite" />;
}

function App() {
  const [activePage, setActivePage] = useState<PageId>(() => pageForPath(window.location.pathname) ?? 'landing');
  const [isDark, setIsDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    // Drop a dead/expired session on boot so we never fire a doomed authed request.
    const id = localStorage.getItem('terminus_user_id');
    if (!id || isTokenExpired(localStorage.getItem('terminus_access_token'))) {
      ['terminus_access_token', 'terminus_user_id', 'terminus_user_role', 'terminus_user_label'].forEach((key) => localStorage.removeItem(key));
      return null;
    }
    return id;
  });
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(() => localStorage.getItem('terminus_user_role'));
  // Display name (or email) for the avatar/initial. Cached so it shows instantly on reload.
  const [currentUserLabel, setCurrentUserLabel] = useState<string | null>(() => localStorage.getItem('terminus_user_label'));
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserReferral, setCurrentUserReferral] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  }, [isDark]);

  // Per-view document title for tabs, history, and JS-rendering crawlers.
  useEffect(() => {
    document.title = PAGE_TITLES[activePage] ?? SITE_NAME;
  }, [activePage]);

  // Keep the address bar in sync with the active page so every view is
  // deep-linkable, bookmarkable and refresh-safe. Compares pathname only, so any
  // query string (e.g. ?token=... on the reset/verify pages) is preserved.
  useEffect(() => {
    // canonicalPathFor keeps the trailing segment of a dynamic route
    // (/pass/:token) while still rewriting legacy aliases to their new home.
    const target = canonicalPathFor(activePage, window.location.pathname);
    // Landing on a token URL (e.g. /reset-password?token=…) already matches the
    // target pathname, so no push fires and the query survives for the page to read.
    if (window.location.pathname !== target) {
      window.history.pushState(null, '', target);
    }
  }, [activePage]);

  // Global reaction to an expired/invalid session (any authed request got 401):
  // api.ts already cleared storage — reset React state and go to login.
  useEffect(() => {
    const onUnauthorized = () => {
      setCurrentUserId(null);
      setCurrentUserRole(null);
      setCurrentUserLabel(null);
      setCurrentUserEmail(null);
      setCurrentUserReferral(null);
      setActivePage('login');
    };
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, []);

  // Browser back/forward: derive the active page from the URL.
  useEffect(() => {
    const onPopState = () => {
      setActivePage(pageForPath(window.location.pathname) ?? 'landing');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // A logged-in user must never sit on the public landing page. Admins/staff
  // land on the admin dashboard; regular users land on their member home.
  useEffect(() => {
    if (currentUserId && activePage === 'landing') {
      const isAdmin = ADMIN_ROLES.includes(currentUserRole ?? '');
      setActivePage(isAdmin ? 'adminDashboard' : 'profile');
    }
  }, [currentUserId, currentUserRole, activePage]);

  function updateCurrentUserId(userId: string | null) {
    setCurrentUserId(userId);
    if (userId) {
      localStorage.setItem('terminus_user_id', userId);
    } else {
      localStorage.removeItem('terminus_user_id');
      localStorage.removeItem('terminus_access_token');
      localStorage.removeItem('terminus_user_role');
      localStorage.removeItem('terminus_user_label');
      setCurrentUserRole(null);
      setCurrentUserLabel(null);
    }
  }

  function updateCurrentUserRole(role: string | null) {
    setCurrentUserRole(role);
    if (role) {
      localStorage.setItem('terminus_user_role', role);
    } else {
      localStorage.removeItem('terminus_user_role');
    }
  }

  function updateCurrentUserLabel(label: string | null) {
    setCurrentUserLabel(label);
    if (label) {
      localStorage.setItem('terminus_user_label', label);
    } else {
      localStorage.removeItem('terminus_user_label');
    }
  }

  useEffect(() => {
    if (!currentUserId) return;
    // A stored user id with no token is a broken session — drop it.
    if (!localStorage.getItem('terminus_access_token')) {
      updateCurrentUserId(null);
      return;
    }

    apiRequest<{ role: string; email: string; referralCode?: string | null; profile?: { fullName?: string | null } }>(`/users/${currentUserId}/profile`)
      .then((profile) => {
        updateCurrentUserRole(profile.role);
        updateCurrentUserLabel(profile.profile?.fullName?.trim() || profile.email);
        setCurrentUserEmail(profile.email);
        setCurrentUserReferral(profile.referralCode ?? null);
      })
      .catch((error) => {
        // Stale session: the stored user no longer exists / token is invalid.
        // Sign out so we show the landing/login instead of a broken account page.
        if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
          updateCurrentUserId(null);
          setActivePage((current) => (current === 'apply' ? 'apply' : 'landing'));
          return;
        }
        updateCurrentUserRole(null);
      });
  }, [currentUserId]);

  // Logged-in users never see the landing: render their home instead while the
  // redirect effect switches activePage. Guests see the real landing.
  const showLanding = activePage === 'landing' && !currentUserId;

  const page = useMemo(() => {
    const canAccessAdmin = ADMIN_ROLES.includes(currentUserRole ?? '');

    if (activePage === 'landing') {
      if (showLanding) return <Landing setActivePage={setActivePage} currentUserId={currentUserId} />;
      // Logged-in fallback while the redirect effect runs: admins → admin panel.
      if (canAccessAdmin) return <AdminDashboard currentUserRole={currentUserRole} setActivePage={setActivePage} />;
      return <Profile currentUserId={currentUserId} setActivePage={setActivePage} />;
    }
    if (activePage === 'apply') return <Apply currentUserId={currentUserId} currentUserRole={currentUserRole} setActivePage={setActivePage} setCurrentUserId={updateCurrentUserId} setCurrentUserRole={updateCurrentUserRole} />;
    if (activePage === 'adminLogin') {
      return (
        <AdminLogin
          setActivePage={setActivePage}
          setAdminUnlocked={() => undefined}
          setAdminKey={() => undefined}
        />
      );
    }
    if (activePage === 'login') return <AuthPanel mode="login" setActivePage={setActivePage} setCurrentUserId={updateCurrentUserId} setCurrentUserRole={updateCurrentUserRole} />;
    if (activePage === 'signup') return <AuthPanel mode="signup" setActivePage={setActivePage} setCurrentUserId={updateCurrentUserId} setCurrentUserRole={updateCurrentUserRole} />;
    if (activePage === 'setupPassword') return <AuthPanel mode="setupPassword" setActivePage={setActivePage} setCurrentUserId={updateCurrentUserId} setCurrentUserRole={updateCurrentUserRole} />;
    if (activePage === 'forgotPassword') return <AuthPanel mode="forgotPassword" setActivePage={setActivePage} setCurrentUserId={updateCurrentUserId} setCurrentUserRole={updateCurrentUserRole} />;
    if (activePage === 'resetPassword') return <AuthPanel mode="resetPassword" setActivePage={setActivePage} setCurrentUserId={updateCurrentUserId} setCurrentUserRole={updateCurrentUserRole} />;
    if (activePage === 'verifyEmail') return <VerifyEmail setActivePage={setActivePage} />;
    if (activePage === 'pass') return <Pass />;
    if (activePage === 'profile') {
      if (!currentUserId) return <AuthPanel mode="login" setActivePage={setActivePage} setCurrentUserId={updateCurrentUserId} setCurrentUserRole={updateCurrentUserRole} />;
      return <Profile currentUserId={currentUserId} setActivePage={setActivePage} />;
    }
    if (activePage === 'myProfile') {
      if (!currentUserId) return <AuthPanel mode="login" setActivePage={setActivePage} setCurrentUserId={updateCurrentUserId} setCurrentUserRole={updateCurrentUserRole} />;
      return <MyProfile currentUserId={currentUserId} />;
    }
    if (activePage === 'community') {
      if (!currentUserId) return <AuthPanel mode="login" setActivePage={setActivePage} setCurrentUserId={updateCurrentUserId} setCurrentUserRole={updateCurrentUserRole} />;
      return <Community currentUserId={currentUserId} setActivePage={setActivePage} />;
    }
    if (activePage === 'resources') {
      if (!currentUserId) return <AuthPanel mode="login" setActivePage={setActivePage} setCurrentUserId={updateCurrentUserId} setCurrentUserRole={updateCurrentUserRole} />;
      return <Resources />;
    }
    if (activePage === 'security') {
      if (!currentUserId) return <AuthPanel mode="login" setActivePage={setActivePage} setCurrentUserId={updateCurrentUserId} setCurrentUserRole={updateCurrentUserRole} />;
      return <Security currentUserId={currentUserId} setCurrentUserId={updateCurrentUserId} setActivePage={setActivePage} />;
    }
    if (activePage === 'allUsers') {
      if (!currentUserId) return <AuthPanel mode="login" setActivePage={setActivePage} setCurrentUserId={updateCurrentUserId} setCurrentUserRole={updateCurrentUserRole} />;
      if (!canAccessAdmin) {
        return (
          <div className="page-stack">
            <section className="panel empty-state">You need a Super Admin, Moderator, or Community Leader role to open users.</section>
          </div>
        );
      }

      return <AllUsers currentUserId={currentUserId} currentUserRole={currentUserRole} />;
    }
    // `units` is part of ADMIN_SUB_PAGES now — it renders as a Settings
    // sub-tab inside AdminDashboard rather than as its own page.
    if (ADMIN_SUB_PAGES.includes(activePage)) {
      if (!currentUserId) return <AuthPanel mode="login" setActivePage={setActivePage} setCurrentUserId={updateCurrentUserId} setCurrentUserRole={updateCurrentUserRole} />;
      if (!canAccessAdmin) {
        return (
          <div className="page-stack">
            <section className="panel empty-state">You need a Super Admin, Moderator, or Community Leader role to open admin tools.</section>
          </div>
        );
      }

      return <AdminDashboard currentUserRole={currentUserRole} setActivePage={setActivePage} adminPage={activePage} />;
    }
    // Profile is the single member home (also the fallback for the legacy
    // 'dashboard' page id and any unmatched page).
    return <Profile currentUserId={currentUserId} setActivePage={setActivePage} />;
  }, [activePage, currentUserId, currentUserRole, showLanding]);

  // Full-screen views (no app shell): the landing, every auth screen, and any
  // protected page viewed while logged out (which falls back to the login panel).
  const AUTH_PAGES: PageId[] = ['apply', 'login', 'signup', 'setupPassword', 'forgotPassword', 'resetPassword', 'verifyEmail', 'adminLogin', 'pass'];
  const PROTECTED_PAGES: PageId[] = ['profile', 'community', 'myProfile', 'resources', 'security', 'allUsers', 'units', ...ADMIN_SUB_PAGES];
  if (
    showLanding ||
    AUTH_PAGES.includes(activePage) ||
    (!currentUserId && PROTECTED_PAGES.includes(activePage))
  ) {
    return (
      <>
        <PullToRefresh />
        <Suspense fallback={<PageFallback />}>{page}</Suspense>
      </>
    );
  }

  return (
    <AppShell
      activePage={activePage}
      setActivePage={setActivePage}
      isDark={isDark}
      setIsDark={setIsDark}
      menuOpen={menuOpen}
      setMenuOpen={setMenuOpen}
      currentUserId={currentUserId}
      currentUserRole={currentUserRole}
      currentUserLabel={currentUserLabel}
      currentUserEmail={currentUserEmail}
      referralCode={currentUserReferral}
      onLogout={() => {
        updateCurrentUserId(null);
        setCurrentUserEmail(null);
        setCurrentUserReferral(null);
        setActivePage('landing');
      }}
    >
      <Suspense fallback={<PageFallback />}>{page}</Suspense>
      <PullToRefresh />
    </AppShell>
  );
}

export default App;
