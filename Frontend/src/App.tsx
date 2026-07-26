import { useEffect, useMemo, useState } from 'react';
import { AppShell } from './components/AppShell';
import { AuthPanel } from './components/AuthPanel';
import type { PageId } from './data/dashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminLogin } from './pages/AdminLogin';
import { Dashboard } from './pages/Dashboard';
import { Landing } from './pages/Landing';
import { Profile } from './pages/Profile';
import { Residency } from './pages/Residency';
import { Security } from './pages/Security';
import { apiRequest, ApiError } from './lib/api';
import { AllUsers } from './pages/AllUsers';
import { Units } from './pages/Units';
import { Apply } from './pages/Apply';

const ADMIN_ROLES = ['SUPER_ADMIN', 'MODERATOR', 'COMMUNITY_LEADER'];

const SITE_NAME = 'Builders Node';
const PAGE_TITLES: Partial<Record<PageId, string>> = {
  landing: 'Builders Node — Startup Society in Próspera',
  apply: 'Apply — Builders Node',
  login: 'Log in — Builders Node',
  signup: 'Create your account — Builders Node',
  setupPassword: 'Set your password — Builders Node',
  adminLogin: 'Admin login — Builders Node',
  profile: 'Account — Builders Node',
  residency: 'E-Residency — Builders Node',
  security: 'Security — Builders Node',
  dashboard: 'Home — Builders Node',
  allUsers: 'Users — Builders Node',
  units: 'Units — Builders Node',
  adminDashboard: 'Admin — Builders Node',
};

function pageForPath(pathname: string): PageId | null {
  if (pathname === '/apply') return 'apply';
  if (pathname === '/setup-password') return 'setupPassword';
  return null;
}

function App() {
  const [activePage, setActivePage] = useState<PageId>(() => pageForPath(window.location.pathname) ?? 'landing');
  const [isDark, setIsDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => localStorage.getItem('terminus_user_id'));
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(() => localStorage.getItem('terminus_user_role'));
  // Display name (or email) for the avatar/initial. Cached so it shows instantly on reload.
  const [currentUserLabel, setCurrentUserLabel] = useState<string | null>(() => localStorage.getItem('terminus_user_label'));

  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  }, [isDark]);

  // Per-view document title for tabs, history, and JS-rendering crawlers.
  useEffect(() => {
    document.title = PAGE_TITLES[activePage] ?? SITE_NAME;
  }, [activePage]);

  // Keep the /apply URL in sync so it is deep-linkable and refresh-safe.
  useEffect(() => {
    const path = window.location.pathname;
    if (activePage === 'apply' && path !== '/apply') {
      window.history.pushState(null, '', '/apply');
    } else if (activePage === 'landing' && path === '/apply') {
      window.history.pushState(null, '', '/');
    }
  }, [activePage]);

  // Browser back/forward between /apply and the rest of the app.
  useEffect(() => {
    const onPopState = () => {
      const mapped = pageForPath(window.location.pathname);
      setActivePage(mapped ?? 'landing');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // A logged-in user must never sit on the public landing page. The signed-in
  // home is the profile for everyone (admins reach the admin panel from the nav).
  useEffect(() => {
    if (currentUserId && activePage === 'landing') {
      setActivePage('profile');
    }
  }, [currentUserId, activePage]);

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

    apiRequest<{ role: string; email: string; profile?: { fullName?: string | null } }>(`/users/${currentUserId}/profile`)
      .then((profile) => {
        updateCurrentUserRole(profile.role);
        updateCurrentUserLabel(profile.profile?.fullName?.trim() || profile.email);
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
      // Logged-in fallback while the redirect effect switches to 'profile'.
      return <Profile currentUserId={currentUserId} setActivePage={setActivePage} />;
    }
    if (activePage === 'apply') return <Apply currentUserId={currentUserId} currentUserRole={currentUserRole} setActivePage={setActivePage} />;
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
    if (activePage === 'profile') return <Profile currentUserId={currentUserId} setActivePage={setActivePage} />;
    if (activePage === 'residency') return <Residency currentUserId={currentUserId} setActivePage={setActivePage} />;
    if (activePage === 'security') return <Security currentUserId={currentUserId} setCurrentUserId={updateCurrentUserId} setActivePage={setActivePage} />;
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
    if (activePage === 'adminDashboard') {
      if (!currentUserId) return <AuthPanel mode="login" setActivePage={setActivePage} setCurrentUserId={updateCurrentUserId} setCurrentUserRole={updateCurrentUserRole} />;
      if (!canAccessAdmin) {
        return (
          <div className="page-stack">
            <section className="panel empty-state">You need a Super Admin, Moderator, or Community Leader role to open admin tools.</section>
          </div>
        );
      }

      return <AdminDashboard currentUserRole={currentUserRole} setActivePage={setActivePage} />;
    }
    return <Dashboard currentUserId={currentUserId} setActivePage={setActivePage} setMenuOpen={setMenuOpen} />;
  }, [activePage, currentUserId, currentUserRole, showLanding]);

  if (
    showLanding ||
    activePage === 'apply' ||
    activePage === 'login' ||
    activePage === 'signup' ||
    activePage === 'setupPassword' ||
    activePage === 'adminLogin'
  ) {
    return page;
  }

  return (
    <AppShell
      activePage={activePage}
      setActivePage={setActivePage}
      isDark={isDark}
      setIsDark={setIsDark}
      menuOpen={menuOpen}
      setMenuOpen={setMenuOpen}
      currentUserRole={currentUserRole}
      currentUserLabel={currentUserLabel}
    >
      {page}
    </AppShell>
  );
}

export default App;
