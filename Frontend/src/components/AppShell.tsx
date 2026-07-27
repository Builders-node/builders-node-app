import { Bell, Menu, Moon, Sun, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { ADMIN_ROLES, allNavItems, navSections, type PageId } from '../data/dashboard';

type AppShellProps = {
  activePage: PageId;
  setActivePage: (page: PageId) => void;
  isDark: boolean;
  setIsDark: (value: boolean) => void;
  menuOpen: boolean;
  setMenuOpen: (value: boolean) => void;
  currentUserRole?: string | null;
  currentUserLabel?: string | null;
  children: ReactNode;
};

export function AppShell({
  activePage,
  setActivePage,
  isDark,
  setIsDark,
  menuOpen,
  setMenuOpen,
  currentUserRole,
  currentUserLabel,
  children,
}: AppShellProps) {
  const isAdmin = ADMIN_ROLES.includes(currentUserRole ?? '');
  const avatarInitial = currentUserLabel?.trim().charAt(0).toUpperCase() || '?';
  const visibleSections = navSections.filter((section) => !section.adminOnly || isAdmin);
  const currentLabel = allNavItems.find((item) => item.id === activePage)?.label ?? 'Dashboard';

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
            <button className="top-icon-button" onClick={() => setIsDark(!isDark)} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
              {isDark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button className="top-icon-button" aria-label="Notifications">
              <Bell size={17} />
            </button>
            <button className="top-avatar" onClick={() => setActivePage('profile')} aria-label="Open profile">
              <span>{avatarInitial}</span>
            </button>
          </div>
        </header>
        <div className="main-content">{children}</div>
      </main>
    </div>
  );
}
