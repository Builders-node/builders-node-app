import { createContext, useContext, type ReactNode } from 'react';

// Lets landing components trigger navigation to the dedicated Apply page
// without threading props through every section.
const ApplyNavContext = createContext<() => void>(() => {});

export function ApplyNavProvider({ openApply, children }: { openApply: () => void; children: ReactNode }) {
  return <ApplyNavContext.Provider value={openApply}>{children}</ApplyNavContext.Provider>;
}

export function useApplyNav() {
  return useContext(ApplyNavContext);
}

// Account navigation for the landing nav (log in / my account) without prop threading.
type AccountNav = {
  currentUserId: string | null;
  openAccount: () => void;
  openLogin: () => void;
  /**
   * The affiliate page. Routed through here rather than a plain `<a href>` so
   * the nav and the footer navigate in-app — an href would reload the whole
   * bundle to reach a page React already has.
   */
  openAffiliate: () => void;
};

const AccountNavContext = createContext<AccountNav>({
  currentUserId: null,
  openAccount: () => {},
  openLogin: () => {},
  openAffiliate: () => {},
});

export function AccountNavProvider({ value, children }: { value: AccountNav; children: ReactNode }) {
  return <AccountNavContext.Provider value={value}>{children}</AccountNavContext.Provider>;
}

export function useAccountNav() {
  return useContext(AccountNavContext);
}
