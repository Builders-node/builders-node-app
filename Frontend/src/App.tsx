import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from './components/AppShell';
import { AuthPanel } from './components/AuthPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PullToRefresh } from './components/PullToRefresh';
import { ADMIN_SUB_PAGES, canonicalPathFor, pageForPath, pathForPage, type PageId } from './data/dashboard';
import { ApiError, isTokenExpired } from './lib/api';
import { useProfile } from './lib/queries';
import { queryClient } from './lib/queryClient';

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
const ApplyThanks = lazy(() => import('./pages/ApplyThanks').then((m) => ({ default: m.ApplyThanks })));
const Affiliate = lazy(() => import('./pages/Affiliate').then((m) => ({ default: m.Affiliate })));
const Guide = lazy(() => import('./pages/Guide').then((m) => ({ default: m.Guide })));
const AffiliateHub = lazy(() => import('./pages/AffiliateHub').then((m) => ({ default: m.AffiliateHub })));
const AdminLogin = lazy(() => import('./pages/AdminLogin').then((m) => ({ default: m.AdminLogin })));
const Security = lazy(() => import('./pages/Security').then((m) => ({ default: m.Security })));
const Resources = lazy(() => import('./pages/Resources').then((m) => ({ default: m.Resources })));
const Community = lazy(() => import('./pages/Community').then((m) => ({ default: m.Community })));
const MyProfile = lazy(() => import('./pages/MyProfile').then((m) => ({ default: m.MyProfile })));
const Pass = lazy(() => import('./pages/Pass').then((m) => ({ default: m.Pass })));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail').then((m) => ({ default: m.VerifyEmail })));
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })));

const ADMIN_ROLES = ['SUPER_ADMIN', 'MODERATOR', 'COMMUNITY_LEADER'];

const SITE_NAME = 'Builders Node';
const PAGE_TITLES: Partial<Record<PageId, string>> = {
  landing: 'Builders Node — Startup Society in Próspera',
  apply: 'Apply — Builders Node',
  applyThanks: 'Thank you — Builders Node',
  affiliate: 'Affiliate programme — Builders Node',
  guide: 'The private guide — Builders Node',
  login: 'Log in — Builders Node',
  signup: 'Create your account — Builders Node',
  setupPassword: 'Set your password — Builders Node',
  forgotPassword: 'Forgot password — Builders Node',
  resetPassword: 'Reset password — Builders Node',
  verifyEmail: 'Confirm your email — Builders Node',
  adminLogin: 'Admin login — Builders Node',
  profile: 'Account — Builders Node',
  resources: 'Resources — Builders Node',
  affiliateHub: 'Affiliate — Builders Node',
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
  adminCampaigns: 'Traffic — Builders Node',
  adminAffiliates: 'Affiliates — Builders Node',
  adminGuide: 'Guide leads — Builders Node',
  adminSettings: 'Admin settings — Builders Node',
  pass: 'Member pass — Builders Node',
  notFound: 'Page not found — Builders Node',
};

const SITE_ORIGIN = 'https://buildersnode.com';

/**
 * The pages a search engine should know about. Each is canonical at its own
 * URL; index.html can only hard-code one canonical, the homepage, and left
 * alone it told crawlers that /apply and /affiliate were duplicates of '/'.
 */
const PUBLIC_PAGES: PageId[] = ['landing', 'apply', 'affiliate', 'applyThanks', 'guide'];

/**
 * Descriptions for the public pages that are worth a search snippet of their
 * own. The landing keeps index.html's (read back below), which is written for
 * it; every other view falls back to the same.
 */
const PAGE_DESCRIPTIONS: Partial<Record<PageId, string>> = {
  apply:
    'Apply to Builders Node, a startup society in Próspera for builders, founders and content creators. Five minutes; every application is read by a person.',
  affiliate:
    'Earn a reward for every founder you send to Builders Node, a startup society in Próspera. Sign up, share your link, get paid when they join.',
};

/** Pages whose og:url should be their own address rather than the homepage. */
const OG_URL_PAGES: PageId[] = ['landing', 'apply', 'affiliate'];

/**
 * index.html's own values, read once so a view without an override can put
 * them back. Read rather than copied here so the HTML stays the one place
 * they are written.
 */
const HEAD_DEFAULTS = {
  description: document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? '',
  robots: document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content ?? 'index, follow',
};

function setHeadAttr(selector: string, attr: 'content' | 'href', value: string) {
  document.querySelector(selector)?.setAttribute(attr, value);
}

/** Shown only while a split page chunk is in flight. */
function PageFallback() {
  return <div className="page-stack" aria-busy="true" aria-live="polite" />;
}

function App() {
  const [activePage, setActivePage] = useState<PageId>(() => pageForPath(window.location.pathname) ?? 'notFound');
  const [isDark, setIsDark] = useState(false);

  /**
   * Push or replace: the URL-sync effect below has to know which.
   *
   * Every page change used to push a history entry, redirects included. So a
   * signed-in member pressing Back onto '/' was pushed forward to /account
   * again — a fresh entry each time, and the back button never got past it.
   * A redirect is not somewhere the visitor went; it replaces the entry it
   * redirects from. Clicks and links still push.
   *
   * Holds the page the redirect is headed for, not a flag, so a redirect to the
   * page already showing (which renders nothing and so never reaches the
   * effect) can't leave a stale "replace" for the next real click.
   */
  const pendingReplace = useRef<PageId | null>(null);
  const activePageRef = useRef(activePage);
  activePageRef.current = activePage;
  const redirectTo = useCallback((page: PageId) => {
    if (page === activePageRef.current) return;
    pendingReplace.current = page;
    setActivePage(page);
  }, []);
  /** The page setter for screens that both link and redirect (sign-in, reset). */
  const navigate = useCallback(
    (page: PageId, options?: { replace?: boolean }) => (options?.replace ? redirectTo(page) : setActivePage(page)),
    [redirectTo],
  );
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

  // Per-view head for tabs, history, and JS-rendering crawlers: the title,
  // the canonical URL, the description and og:url, and noindex on a 404.
  useEffect(() => {
    document.title = PAGE_TITLES[activePage] ?? SITE_NAME;

    const isPublic = PUBLIC_PAGES.includes(activePage);
    setHeadAttr('link[rel="canonical"]', 'href', SITE_ORIGIN + (isPublic ? pathForPage(activePage) : '/'));
    setHeadAttr('meta[name="description"]', 'content', PAGE_DESCRIPTIONS[activePage] ?? HEAD_DEFAULTS.description);
    setHeadAttr(
      'meta[property="og:url"]',
      'content',
      SITE_ORIGIN + (OG_URL_PAGES.includes(activePage) ? pathForPage(activePage) : '/'),
    );
    // A 404 served as a 200 (all an SPA can do) is a "soft 404" to Google;
    // noindex is what keeps it from being indexed as a real page.
    setHeadAttr('meta[name="robots"]', 'content', activePage === 'notFound' ? 'noindex' : HEAD_DEFAULTS.robots);
  }, [activePage]);

  // Keep the address bar in sync with the active page so every view is
  // deep-linkable, bookmarkable and refresh-safe. Compares pathname only, so any
  // query string (e.g. ?token=... on the reset/verify pages) is preserved.
  const urlSynced = useRef(false);
  useEffect(() => {
    // canonicalPathFor keeps the trailing segment of a dynamic route
    // (/pass/:token) while still rewriting legacy aliases to their new home.
    const target = canonicalPathFor(activePage, window.location.pathname);
    // Replace rather than push when the visitor didn't go anywhere: the first
    // sync on load, a URL that already names this page in another spelling
    // (a legacy alias, a trailing slash — including one reached with Back),
    // and a redirect (see pendingReplace).
    const replace =
      !urlSynced.current ||
      pageForPath(window.location.pathname) === activePage ||
      pendingReplace.current === activePage;
    urlSynced.current = true;
    pendingReplace.current = null;
    // Landing on a token URL (e.g. /reset-password?token=…) already matches the
    // target pathname, so nothing fires and the query survives for the page to read.
    if (window.location.pathname !== target) {
      if (replace) window.history.replaceState(null, '', target);
      else window.history.pushState(null, '', target);
    }
  }, [activePage]);

  /**
   * Meta Pixel pageview on route change.
   *
   * The base code in index.html fires once, on first load. GA4 picks up later
   * routes through Enhanced Measurement and Clarity follows SPAs on its own,
   * but the Pixel does neither — without this it would record a single pageview
   * per session no matter how much of the site someone walked through.
   *
   * The first render is skipped so the initial view isn't counted twice.
   */
  const pixelPrimed = useRef(false);
  useEffect(() => {
    if (!pixelPrimed.current) {
      pixelPrimed.current = true;
      return;
    }
    (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq?.('track', 'PageView');
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
      redirectTo('login');
      queryClient.clear();
    };
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, [redirectTo]);

  // Browser back/forward: derive the active page from the URL.
  useEffect(() => {
    const onPopState = () => {
      setActivePage(pageForPath(window.location.pathname) ?? 'notFound');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // A logged-in user must never sit on the public landing page. Admins/staff
  // land on the admin dashboard; regular users land on their member home.
  useEffect(() => {
    if (currentUserId && activePage === 'landing') {
      const isAdmin = ADMIN_ROLES.includes(currentUserRole ?? '');
      redirectTo(isAdmin ? 'adminDashboard' : 'profile');
    }
  }, [currentUserId, currentUserRole, activePage, redirectTo]);

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

  // A stored user id with no token is a broken session — drop it.
  useEffect(() => {
    if (currentUserId && !localStorage.getItem('terminus_access_token')) updateCurrentUserId(null);
  }, [currentUserId]);

  // The session profile. Every other screen reads the same cache entry, so this
  // is one request per session rather than one per page that needs the name.
  const { data: sessionProfile, error: sessionProfileError } = useProfile(
    currentUserId && localStorage.getItem('terminus_access_token') ? currentUserId : null,
  );

  useEffect(() => {
    if (!sessionProfile) return;
    updateCurrentUserRole(sessionProfile.role);
    updateCurrentUserLabel(sessionProfile.profile?.fullName?.trim() || sessionProfile.email);
    setCurrentUserEmail(sessionProfile.email);
    setCurrentUserReferral(sessionProfile.referralCode ?? null);
  }, [sessionProfile]);

  useEffect(() => {
    if (!sessionProfileError) return;
    // Stale session: the stored user no longer exists / token is invalid.
    // Sign out so we show the landing/login instead of a broken account page.
    if (sessionProfileError instanceof ApiError && (sessionProfileError.status === 401 || sessionProfileError.status === 404)) {
      updateCurrentUserId(null);
      redirectTo(activePageRef.current === 'apply' ? 'apply' : 'landing');
      return;
    }
    updateCurrentUserRole(null);
  }, [sessionProfileError]);

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
    // Public, and stays public for a signed-in member too: a member can be an
    // affiliate, and the landing-page redirect below must not sweep them off it.
    if (activePage === 'affiliate') return <Affiliate setActivePage={setActivePage} currentUserId={currentUserId} />;
    // Public for everybody, members included: a `?key=` link can reach anyone.
    if (activePage === 'guide') return <Guide />;
    // Public, and public for a signed-in applicant too: the apply flow can
    // create an account on its way here, and that person must still land on
    // the page the redirect sent them to.
    if (activePage === 'applyThanks') return <ApplyThanks setActivePage={setActivePage} currentUserId={currentUserId} />;
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
    if (activePage === 'login') return <AuthPanel mode="login" setActivePage={navigate} setCurrentUserId={updateCurrentUserId} setCurrentUserRole={updateCurrentUserRole} />;
    if (activePage === 'signup') return <AuthPanel mode="signup" setActivePage={navigate} setCurrentUserId={updateCurrentUserId} setCurrentUserRole={updateCurrentUserRole} />;
    if (activePage === 'setupPassword') return <AuthPanel mode="setupPassword" setActivePage={navigate} setCurrentUserId={updateCurrentUserId} setCurrentUserRole={updateCurrentUserRole} />;
    if (activePage === 'forgotPassword') return <AuthPanel mode="forgotPassword" setActivePage={navigate} setCurrentUserId={updateCurrentUserId} setCurrentUserRole={updateCurrentUserRole} />;
    if (activePage === 'resetPassword') return <AuthPanel mode="resetPassword" setActivePage={navigate} setCurrentUserId={updateCurrentUserId} setCurrentUserRole={updateCurrentUserRole} />;
    if (activePage === 'verifyEmail') return <VerifyEmail setActivePage={setActivePage} />;
    if (activePage === 'pass') return <Pass />;
    if (activePage === 'notFound') return <NotFound setActivePage={setActivePage} currentUserId={currentUserId} />;
    if (activePage === 'profile') {
      if (!currentUserId) return <AuthPanel mode="login" setActivePage={navigate} setCurrentUserId={updateCurrentUserId} setCurrentUserRole={updateCurrentUserRole} />;
      return <Profile currentUserId={currentUserId} setActivePage={setActivePage} />;
    }
    if (activePage === 'myProfile') {
      if (!currentUserId) return <AuthPanel mode="login" setActivePage={navigate} setCurrentUserId={updateCurrentUserId} setCurrentUserRole={updateCurrentUserRole} />;
      return <MyProfile currentUserId={currentUserId} />;
    }
    if (activePage === 'community') {
      if (!currentUserId) return <AuthPanel mode="login" setActivePage={navigate} setCurrentUserId={updateCurrentUserId} setCurrentUserRole={updateCurrentUserRole} />;
      return <Community currentUserId={currentUserId} setActivePage={setActivePage} />;
    }
    if (activePage === 'resources') {
      if (!currentUserId) return <AuthPanel mode="login" setActivePage={navigate} setCurrentUserId={updateCurrentUserId} setCurrentUserRole={updateCurrentUserRole} />;
      return <Resources />;
    }
    if (activePage === 'affiliateHub') {
      if (!currentUserId) return <AuthPanel mode="login" setActivePage={navigate} setCurrentUserId={updateCurrentUserId} setCurrentUserRole={updateCurrentUserRole} />;
      return <AffiliateHub currentUserId={currentUserId} />;
    }
    if (activePage === 'security') {
      if (!currentUserId) return <AuthPanel mode="login" setActivePage={navigate} setCurrentUserId={updateCurrentUserId} setCurrentUserRole={updateCurrentUserRole} />;
      return <Security currentUserId={currentUserId} setCurrentUserId={updateCurrentUserId} setActivePage={setActivePage} />;
    }
    if (activePage === 'allUsers') {
      if (!currentUserId) return <AuthPanel mode="login" setActivePage={navigate} setCurrentUserId={updateCurrentUserId} setCurrentUserRole={updateCurrentUserRole} />;
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
      if (!currentUserId) return <AuthPanel mode="login" setActivePage={navigate} setCurrentUserId={updateCurrentUserId} setCurrentUserRole={updateCurrentUserRole} />;
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
  const AUTH_PAGES: PageId[] = ['apply', 'applyThanks', 'affiliate', 'guide', 'login', 'signup', 'setupPassword', 'forgotPassword', 'resetPassword', 'verifyEmail', 'adminLogin', 'pass', 'notFound'];
  const PROTECTED_PAGES: PageId[] = ['profile', 'community', 'myProfile', 'resources', 'affiliateHub', 'security', 'allUsers', 'units', ...ADMIN_SUB_PAGES];
  if (
    showLanding ||
    AUTH_PAGES.includes(activePage) ||
    (!currentUserId && PROTECTED_PAGES.includes(activePage))
  ) {
    return (
      <>
        <PullToRefresh />
        <ErrorBoundary>
          <Suspense fallback={<PageFallback />}>{page}</Suspense>
        </ErrorBoundary>
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
        // Nothing cached belongs to the next person to sign in on this device.
        queryClient.clear();
      }}
    >
      {/* Inside the shell, so a broken page keeps the sidebar — and with it a
          way to navigate somewhere that works. */}
      <ErrorBoundary>
        <Suspense fallback={<PageFallback />}>{page}</Suspense>
      </ErrorBoundary>
      <PullToRefresh />
    </AppShell>
  );
}

export default App;
