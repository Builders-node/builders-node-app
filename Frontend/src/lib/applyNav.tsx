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
};

const AccountNavContext = createContext<AccountNav>({
  currentUserId: null,
  openAccount: () => {},
  openLogin: () => {},
});

export function AccountNavProvider({ value, children }: { value: AccountNav; children: ReactNode }) {
  return <AccountNavContext.Provider value={value}>{children}</AccountNavContext.Provider>;
}

export function useAccountNav() {
  return useContext(AccountNavContext);
}
