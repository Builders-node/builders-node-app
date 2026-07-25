import type { PageId } from '../data/dashboard';
import { useState } from 'react';

type AdminLoginProps = {
  setActivePage: (page: PageId) => void;
  setAdminUnlocked: (value: boolean) => void;
  setAdminKey: (value: string) => void;
};

export function AdminLogin({ setActivePage, setAdminUnlocked, setAdminKey }: AdminLoginProps) {
  const [key, setKey] = useState('');

  return (
    <section className="auth-layout admin-auth">
      <div className="auth-copy">
        <button className="brand-mark" onClick={() => setActivePage('landing')} aria-label="Go to landing">
          <img src="/terminus-logo-small.svg" alt="" />
        </button>
        <h1>Admin access</h1>
        <p>Private staff area for reviewing applicants, member setup, E-Residency state, apartments, meals, and cleaning.</p>
      </div>

      <form className="auth-card" onSubmit={(event) => event.preventDefault()}>
        <label>
          Admin access key
          <input value={key} onChange={(event) => setKey(event.target.value)} type="password" placeholder="Private admin key" />
        </label>
        <button
          className="primary-button"
          type="submit"
          onClick={() => {
            setAdminKey(key);
            setAdminUnlocked(true);
            setActivePage('adminDashboard');
          }}
        >
          Open admin dashboard
        </button>
        <button className="text-button" type="button" onClick={() => setActivePage('landing')}>
          Back to public site
        </button>
      </form>
    </section>
  );
}
