import { Bell, LogOut, Menu, Moon, Settings as SettingsIcon, Share2, Sun, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ADMIN_ROLES, allNavItems, navSections, type PageId } from '../data/dashboard';
import { ReferralModal } from './ReferralModal';

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
  const currentLabel = allNavItems.find((item) => item.id === activePage)?.label ?? 'Dashboard';

  const [accountOpen, setAccountOpen] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

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
                return (
                  <button
                    key={item.id}
                    className={activePage === item.id ? 'nav-item nav-item--active' : 'nav-item'}
                    onClick={() => go(item.id)}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
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
              {currentLabel === 'Home' ? (
                <strong>Home</strong>
              ) : (
                <>
                  <span>Home</span>
                  <strong>/ {currentLabel}</strong>
                </>
              )}
            </div>
          </div>
          <div className="top-menu-actions">
            <button className="top-icon-button" aria-label="Notifications">
              <Bell size={17} />
            </button>
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

      {/* Mobile-first bottom tab bar (primary navigation on small screens). */}
      <nav className="bottom-nav" aria-label="Primary">
        {visibleSections
          .flatMap((section) => section.items)
          .map((item) => {
            const Icon = item.icon;
            const active = activePage === item.id;
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
      </nav>

      {referralOpen && currentUserId ? (
        <ReferralModal userId={currentUserId} inviteLink={inviteLink} onClose={() => setReferralOpen(false)} />
      ) : null}
    </div>
  );
}
