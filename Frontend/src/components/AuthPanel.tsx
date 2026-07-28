import type { PageId } from '../data/dashboard';
import { apiRequest } from '../lib/api';
import { useState } from 'react';
import { GoogleSignInButton } from './GoogleSignInButton';

type AuthPanelProps = {
  mode: 'login' | 'setupPassword' | 'signup' | 'resetPassword' | 'forgotPassword';
  setActivePage: (page: PageId) => void;
  setCurrentUserId: (userId: string | null) => void;
  setCurrentUserRole: (role: string | null) => void;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthPanel({ mode, setActivePage, setCurrentUserId, setCurrentUserRole }: AuthPanelProps) {
  const isSetup = mode === 'setupPassword';
  const isReset = mode === 'resetPassword';
  const isForgot = mode === 'forgotPassword';
  const isSignup = mode === 'signup';
  const isLogin = mode === 'login';
  // Setup and reset are the same mechanic: a token from an email + a new password.
  const isTokenPassword = isSetup || isReset;
  const googleEnabled = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [token, setToken] = useState(() => new URLSearchParams(window.location.search).get('token') ?? '');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ADMIN_ROLES = ['SUPER_ADMIN', 'MODERATOR', 'COMMUNITY_LEADER'];

  function startSession(session: { accessToken: string; user: { id: string; role: string } }) {
    localStorage.setItem('terminus_access_token', session.accessToken);
    setCurrentUserId(session.user.id);
    setCurrentUserRole(session.user.role);
    setActivePage(ADMIN_ROLES.includes(session.user.role) ? 'adminDashboard' : 'profile');
  }

  async function signInWithGoogle(credential: string) {
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      const session = await apiRequest<{ accessToken: string; user: { id: string; role: string } }>('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ credential }),
      });
      startSession(session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Google sign-in failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submit() {
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      if (isForgot) {
        if (!EMAIL_RE.test(email)) {
          throw new Error('Enter a valid email address.');
        }
        await apiRequest('/auth/password-reset', {
          method: 'POST',
          body: JSON.stringify({ email }),
        });
        setSuccess('If an account exists for that email, we sent a reset link. Check your inbox.');
        return;
      }

      if (isTokenPassword) {
        if (!token.trim()) {
          throw new Error('This link is missing its token. Open it directly from your Builders Node email.');
        }
        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters.');
        }
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.');
        }
        await apiRequest('/auth/password-reset/confirm', {
          method: 'POST',
          body: JSON.stringify({ token, password }),
        });
        window.history.replaceState(null, '', '/');
        setSuccess(isReset ? 'Password updated. You can log in now.' : 'Password set. You can log in now.');
        setTimeout(() => setActivePage('login'), 700);
        return;
      }

      if (isSignup) {
        if (!fullName.trim()) {
          throw new Error('Enter your full name.');
        }
        if (!EMAIL_RE.test(email)) {
          throw new Error('Enter a valid email address.');
        }
        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters.');
        }
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.');
        }
        const session = await apiRequest<{ accessToken: string; user: { id: string; role: string } }>('/auth/signup', {
          method: 'POST',
          body: JSON.stringify({ fullName: fullName.trim(), email, password }),
        });
        startSession(session);
        return;
      }

      if (!EMAIL_RE.test(email)) {
        throw new Error('Enter a valid email address.');
      }
      const session = await apiRequest<{ accessToken: string; user: { id: string; role: string } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      startSession(session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not complete request.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const heading = isSetup
    ? 'Set your password'
    : isReset
      ? 'Reset your password'
      : isForgot
        ? 'Forgot your password?'
        : isSignup
          ? 'Join Builders Node'
          : 'Welcome back to Builders Node';
  const copy = isSetup
    ? 'Use the secure link from your approval email, set a new password, then continue to your member home.'
    : isReset
      ? 'Choose a new password to regain access to your Builders Node account.'
      : isForgot
        ? "Enter your email and we'll send you a link to reset your password."
        : isSignup
          ? 'Create your account, then apply for a membership from inside your dashboard.'
          : 'Log in after receiving your Builders Node credentials and setting your password.';
  const cardTitle = isSetup
    ? 'Set up your account'
    : isReset
      ? 'Choose a new password'
      : isForgot
        ? 'Reset your password'
        : isSignup
          ? 'Create your account'
          : 'Sign in to your account';
  const cardCopy = isSetup
    ? 'Create a secure password from your Builders Node invitation email.'
    : isReset
      ? 'Enter a new password for your account.'
      : isForgot
        ? "We'll email you a secure link to set a new password."
        : isSignup
          ? 'Register with your email and a password.'
          : 'Use your Builders Node member email and password.';
  const submitLabel = isSubmitting
    ? 'Working...'
    : isSetup
      ? 'Set password and continue'
      : isReset
        ? 'Update password'
        : isForgot
          ? 'Send reset link'
          : isSignup
            ? 'Create account'
            : 'Log in';

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
        <h1>{heading}</h1>
        <p>{copy}</p>
      </div>

      <form
        className="auth-card setup-auth-card"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="setup-card-logo">
          <img src="/terminus-logo-small.svg" alt="" />
        </div>
        <h2>{cardTitle}</h2>
        <p className="setup-card-copy">{cardCopy}</p>

        {isLogin && googleEnabled ? (
          <div className="auth-google">
            <GoogleSignInButton text="signin_with" onCredential={(credential) => void signInWithGoogle(credential)} />
            <div className="auth-divider"><span>or</span></div>
          </div>
        ) : isSignup && googleEnabled ? (
          <div className="auth-google">
            <GoogleSignInButton text="signup_with" onCredential={(credential) => void signInWithGoogle(credential)} />
            <div className="auth-divider"><span>or</span></div>
          </div>
        ) : null}

        {isSignup ? (
          <label>
            Full name
            <input type="text" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Satoshi Nakamoto" />
          </label>
        ) : null}

        {isTokenPassword ? (
          <input type="hidden" value={token} readOnly />
        ) : (
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
          </label>
        )}

        {isForgot ? null : (
          <label>
            {isTokenPassword ? 'New password' : 'Password'}
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" />
          </label>
        )}

        {isTokenPassword || isSignup ? (
          <label>
            Confirm password
            <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat your password" />
          </label>
        ) : null}

        {error ? <p className="form-error">{error}</p> : null}
        {success ? <p className="form-success">{success}</p> : null}

        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {submitLabel}
        </button>

        {isTokenPassword || isForgot ? (
          <button className="text-button" type="button" onClick={() => setActivePage('login')}>
            Back to login
          </button>
        ) : isSignup ? (
          <button className="text-button" type="button" onClick={() => setActivePage('login')}>
            Already have an account? Log in
          </button>
        ) : (
          <div className="auth-links">
            <button className="text-button" type="button" onClick={() => setActivePage('forgotPassword')}>
              Forgot password?
            </button>
            <button className="text-button" type="button" onClick={() => setActivePage('signup')}>
              Create an account
            </button>
          </div>
        )}
      </form>
    </section>
  );
}
