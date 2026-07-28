import { useEffect, useState } from 'react';
import type { PageId } from '../data/dashboard';
import { apiRequest } from '../lib/api';

type VerifyEmailProps = {
  setActivePage: (page: PageId) => void;
};

type Status = 'working' | 'ok' | 'error';

export function VerifyEmail({ setActivePage }: VerifyEmailProps) {
  const [status, setStatus] = useState<Status>('working');
  const [message, setMessage] = useState('Confirming your email…');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setStatus('error');
      setMessage('This confirmation link is missing its token. Open the link directly from your email.');
      return;
    }
    apiRequest(`/auth/verify-email/${encodeURIComponent(token)}`, { method: 'POST' })
      .then(() => {
        setStatus('ok');
        setMessage('Your email is confirmed. You can log in now.');
      })
      .catch((caught) => {
        setStatus('error');
        setMessage(caught instanceof Error ? caught.message : 'This confirmation link is invalid or has expired.');
      });
  }, []);

  return (
    <section className="setup-auth-layout">
      <button className="auth-back" type="button" onClick={() => setActivePage('landing')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to site
      </button>

      <div className="auth-copy">
        <button className="brand-mark" onClick={() => setActivePage('landing')} aria-label="Go to landing">
          <img src="/terminus-logo-small.svg" alt="" />
        </button>
        <h1>Email confirmation</h1>
        <p>We're verifying the link from your Builders Node email.</p>
      </div>

      <div className="auth-card setup-auth-card">
        <div className="setup-card-logo">
          <img src="/terminus-logo-small.svg" alt="" />
        </div>
        <h2>{status === 'ok' ? 'All set' : status === 'error' ? 'Something went wrong' : 'One moment…'}</h2>
        <p className={status === 'error' ? 'form-error' : status === 'ok' ? 'form-success' : 'setup-card-copy'}>{message}</p>
        {status !== 'working' ? (
          <button className="primary-button" type="button" onClick={() => setActivePage('login')}>
            Continue to login
          </button>
        ) : null}
      </div>
    </section>
  );
}
