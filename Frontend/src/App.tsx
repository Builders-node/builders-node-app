import { useEffect, useMemo, useState } from 'react';
import { AppShell } from './components/AppShell';
import { AuthPanel } from './components/AuthPanel';
import { PullToRefresh } from './components/PullToRefresh';
import { ADMIN_SUB_PAGES, pageForPath, pathForPage, type PageId } from './data/dashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminLogin } from './pages/AdminLogin';
import { Landing } from './pages/Landing';
import { Profile } from './pages/Profile';
import { Security } from './pages/Security';
import { apiRequest, ApiError, isTokenExpired } from './lib/api';
import { AllUsers } from './pages/AllUsers';
import { Units } from './pages/Units';
import { Apply } from './pages/Apply';
import { VerifyEmail } from './pages/VerifyEmail';
import { Resources } from './pages/Resources';
import { Pass } from './pages/Pass';

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
  security: 'Security — Builders Node',
  dashboard: 'Home — Builders Node',
  allUsers: 'Users — Builders Node',
  units: 'Units — Builders Node',
  adminDashboard: 'Admin — Builders Node',
  adminApplicants: 'Applicants — Builders Node',
  adminResidency: 'Residency — Builders Node',
  adminDesignations: 'Designations — Builders Node',
  adminMaintenance: 'Maintenance — Builders Node',
  adminVehicles: 'Vehicles — Builders Node',
  adminResources: 'Resources — Builders Node',
  adminSettings: 'Admin settings — Builders Node',
  pass: 'Member pass — Builders Node',
};

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
    const target = pathForPage(activePage);
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
    if (activePage === 'units') {
      if (!currentUserId) return <AuthPanel mode="login" setActivePage={setActivePage} setCurrentUserId={updateCurrentUserId} setCurrentUserRole={updateCurrentUserRole} />;
      if (!canAccessAdmin) {
        return (
          <div className="page-stack">
            <section className="panel empty-state">You need a Super Admin, Moderator, or Community Leader role to open units.</section>
          </div>
        );
      }
      return <Units />;
    }
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
  const PROTECTED_PAGES: PageId[] = ['profile', 'resources', 'security', 'allUsers', 'units', ...ADMIN_SUB_PAGES];
  if (
    showLanding ||
    AUTH_PAGES.includes(activePage) ||
    (!currentUserId && PROTECTED_PAGES.includes(activePage))
  ) {
    return (
      <>
        <PullToRefresh />
        {page}
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
      {page}
      <PullToRefresh />
    </AppShell>
  );
}

export default App;
