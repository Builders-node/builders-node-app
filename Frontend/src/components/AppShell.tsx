import { Bell, LayoutGrid, LogOut, Menu, Moon, Pencil, Settings as SettingsIcon, Share2, Sun, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ADMIN_ROLES, allNavItems, navSections, pageForPath, type NavItem, type PageId } from '../data/dashboard';
import { apiRequest } from '../lib/api';
import { useEscapeToClose } from '../lib/useModalA11y';
import { ReferralModal } from './ReferralModal';

type NotificationItem = {
  id: string;
  type: 'info' | 'success' | 'warning';
  title: string;
  body?: string | null;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
};

function formatWhen(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

type AppShellProps = {
  activePage: PageId;
  setActivePage: (page: PageId) => void;
  isDark: boolean;
  setIsDark: (value: boolean) => void;
  menuOpen: boolean;
  setMenuOpen: (value: boolean) => void;
  currentUserId?: string | null;
  currentUserRole?: string | null;
  currentUserLabel?: string | null;
  currentUserEmail?: string | null;
  referralCode?: string | null;
  onLogout?: () => void;
  children: ReactNode;
};

export function AppShell({
  activePage,
  setActivePage,
  isDark,
  setIsDark,
  menuOpen,
  setMenuOpen,
  currentUserId,
  currentUserRole,
  currentUserLabel,
  currentUserEmail,
  referralCode,
  onLogout,
  children,
}: AppShellProps) {
  const isAdmin = ADMIN_ROLES.includes(currentUserRole ?? '');
  const avatarInitial = currentUserLabel?.trim().charAt(0).toUpperCase() || '?';
  const visibleSections = navSections.filter((section) => !section.adminOnly || isAdmin);
  // A grouped item (Inbox / Settings) owns several sub-pages — match on those too.
  const isNavActive = (item: NavItem) => (item.matches ?? [item.id]).includes(activePage);
  const currentLabel = allNavItems.find(isNavActive)?.label ?? 'Dashboard';

  // Pending counts for the sidebar badges. Admin-only; refreshed on the same
  // cadence as notifications so the Inbox pill stays roughly live.
  const [attention, setAttention] = useState<Record<string, number>>({});
  const badgeFor = (item: NavItem) =>
    (item.badgeKeys ?? []).reduce((sum, key) => sum + (attention[key] ?? 0), 0);

  const [accountOpen, setAccountOpen] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  // Admin "More" sheet on mobile — secondary functions (Admin, Users, Units)
  // live behind one grid button so the bottom tab bar stays uncluttered.
  const [adminSheetOpen, setAdminSheetOpen] = useState(false);
  useEscapeToClose(adminSheetOpen, () => setAdminSheetOpen(false));
  const memberItems = navSections.find((section) => section.id === 'members')?.items ?? [];
  const adminItems = navSections.find((section) => section.id === 'admin')?.items ?? [];

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifItems, setNotifItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountOpen) return;
    function onDocClick(event: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [accountOpen]);

  useEffect(() => {
    if (!notifOpen) return;
    function onDocClick(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [notifOpen]);

  // Load notifications on mount and refresh the unread count periodically.
  useEffect(() => {
    if (!currentUserId) return;
    let alive = true;
    const load = () =>
      apiRequest<{ items: NotificationItem[]; unread: number }>(`/users/${currentUserId}/notifications`)
        .then((data) => {
          if (!alive) return;
          setNotifItems(data.items);
          setUnread(data.unread);
        })
        .catch(() => undefined);
    void load();
    const timer = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [currentUserId]);

  // Sidebar badge counts. Cheap enough to piggyback on the notifications
  // interval; failures are silent (the badge just stays hidden).
  useEffect(() => {
    if (!isAdmin || !currentUserId) return;
    let alive = true;
    const load = () =>
      apiRequest<{ attention?: Record<string, number> }>('/admin/overview')
        .then((data) => {
          if (alive && data.attention) setAttention(data.attention);
        })
        .catch(() => undefined);
    void load();
    const timer = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [isAdmin, currentUserId]);

  async function toggleNotifications() {
    const opening = !notifOpen;
    setNotifOpen(opening);
    if (opening && unread > 0 && currentUserId) {
      setUnread(0);
      setNotifItems((items) => items.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
      try {
        await apiRequest(`/users/${currentUserId}/notifications/read`, { method: 'POST', body: '{}' });
      } catch {
        /* non-critical */
      }
    }
  }

  const inviteLink = referralCode ? `${window.location.origin}/?ref=${referralCode}` : '';

  function go(page: PageId) {
    setActivePage(page);
    setMenuOpen(false);
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}>
        <div className="brand-row">
          <button
            className="brand-mark"
            onClick={() => go(isAdmin ? 'adminDashboard' : 'profile')}
            aria-label={isAdmin ? 'Go to admin dashboard' : 'Go to your home'}
          >
            <img src="/terminus-logo-small.svg" alt="" />
          </button>
          <div className="brand-copy">
            <strong>Builders Node</strong>
            <span>Community OS</span>
          </div>
          <button className="icon-button sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <nav className="nav-list" aria-label="Main navigation">
          {visibleSections.map((section) => (
            <div className="nav-section" key={section.id}>
              <span className="nav-section__title">{section.title}</span>
              {section.items.map((item) => {
                const Icon = item.icon;
                const badge = badgeFor(item);
                return (
                  <button
                    key={item.id}
                    className={isNavActive(item) ? 'nav-item nav-item--active' : 'nav-item'}
                    onClick={() => go(item.id)}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                    {badge > 0 ? <span className="nav-item__badge">{badge > 99 ? '99+' : badge}</span> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {menuOpen ? <button className="scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} /> : null}

      <main className="main-area">
        <header className="top-menu">
          <div className="top-menu-left">
            <button className="top-menu-toggle" onClick={() => setMenuOpen(true)} aria-label="Open menu">
              <Menu size={20} />
            </button>
            <div className="breadcrumb">
              <strong>{currentLabel}</strong>
            </div>
          </div>
          <div className="top-menu-actions">
            <div className="notif-menu" ref={notifRef}>
              <button
                className="top-icon-button"
                aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
                aria-expanded={notifOpen}
                onClick={() => void toggleNotifications()}
              >
                <Bell size={17} />
                {unread > 0 ? <span className="notif-badge">{unread > 9 ? '9+' : unread}</span> : null}
              </button>

              {notifOpen ? (
                <div className="notif-dropdown" role="menu">
                  <div className="notif-dropdown__head"><strong>Notifications</strong></div>
                  {notifItems.length === 0 ? (
                    <p className="notif-empty">You&apos;re all caught up.</p>
                  ) : (
                    <div className="notif-list">
                      {notifItems.map((n) => (
                        <button
                          key={n.id}
                          className={n.readAt ? 'notif-item' : 'notif-item notif-item--unread'}
                          onClick={() => {
                            setNotifOpen(false);
                            if (n.link) go(pageForPath(n.link) ?? 'profile');
                          }}
                        >
                          <span className={`notif-dot notif-dot--${n.type}`} />
                          <span className="notif-item__body">
                            <strong>{n.title}</strong>
                            {n.body ? <span>{n.body}</span> : null}
                            <time>{formatWhen(n.createdAt)}</time>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            <div className="account-menu" ref={accountRef}>
              <button
                className="top-avatar"
                onClick={() => setAccountOpen((open) => !open)}
                aria-label="Account menu"
                aria-expanded={accountOpen}
              >
                <span>{avatarInitial}</span>
              </button>

              {accountOpen ? (
                <div className="account-dropdown" role="menu">
                  <div className="account-dropdown__head">
                    <div className="top-avatar account-dropdown__avatar"><span>{avatarInitial}</span></div>
                    <div className="account-dropdown__id">
                      <strong>{currentUserLabel ?? 'Your account'}</strong>
                      {currentUserEmail ? <span>{currentUserEmail}</span> : null}
                    </div>
                  </div>

                  {referralCode ? (
                    <button className="account-dropdown__invite" onClick={() => { setAccountOpen(false); setReferralOpen(true); }}>
                      <Share2 size={16} />
                      Invite &amp; earn
                    </button>
                  ) : null}

                  <div className="account-dropdown__sep" />

                  <button
                    className="account-dropdown__item"
                    onClick={() => { setAccountOpen(false); go('myProfile'); }}
                  >
                    <Pencil size={16} />
                    Your profile
                  </button>
                  <button className="account-dropdown__item" onClick={() => { setAccountOpen(false); go('security'); }}>
                    <SettingsIcon size={16} />
                    Settings
                  </button>
                  <button className="account-dropdown__item" onClick={() => setIsDark(!isDark)}>
                    {isDark ? <Sun size={16} /> : <Moon size={16} />}
                    {isDark ? 'Light mode' : 'Dark mode'}
                  </button>

                  {onLogout ? (
                    <>
                      <div className="account-dropdown__sep" />
                      <button className="account-dropdown__item account-dropdown__item--danger" onClick={() => { setAccountOpen(false); onLogout(); }}>
                        <LogOut size={16} />
                        Log out
                      </button>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <div className="main-content">{children}</div>
      </main>

      {/* Mobile-first bottom tab bar (primary navigation on small screens).
          Member tabs live here; admin tabs are secondary and collapse into a
          "More" button that opens a grid sheet (ClickUp-style). */}
      <nav className="bottom-nav" aria-label="Primary">
        {memberItems.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(item);
          return (
            <button
              key={item.id}
              className={active ? 'bottom-nav__item bottom-nav__item--active' : 'bottom-nav__item'}
              onClick={() => go(item.id)}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
        {isAdmin && adminItems.length > 0 ? (
          <button
            className={adminItems.some(isNavActive) ? 'bottom-nav__item bottom-nav__item--active' : 'bottom-nav__item'}
            onClick={() => setAdminSheetOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={adminSheetOpen}
          >
            <LayoutGrid size={20} />
            <span>More</span>
          </button>
        ) : null}
      </nav>

      {adminSheetOpen ? (
        <div className="admin-sheet-overlay" role="presentation" onClick={() => setAdminSheetOpen(false)}>
          <div className="admin-sheet" role="dialog" aria-modal="true" aria-label="Admin tools" onClick={(event) => event.stopPropagation()}>
            <div className="admin-sheet__handle" aria-hidden="true" />
            <div className="admin-sheet__grid">
              {adminItems.map((item) => {
                const Icon = item.icon;
                const active = isNavActive(item);
                return (
                  <button
                    key={item.id}
                    className={active ? 'admin-sheet__item admin-sheet__item--active' : 'admin-sheet__item'}
                    onClick={() => { setAdminSheetOpen(false); go(item.id); }}
                  >
                    <span className="admin-sheet__icon"><Icon size={22} /></span>
                    <span className="admin-sheet__label">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {referralOpen && currentUserId ? (
        <ReferralModal userId={currentUserId} inviteLink={inviteLink} onClose={() => setReferralOpen(false)} />
      ) : null}
    </div>
  );
}
