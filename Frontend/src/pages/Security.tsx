import { PageHeader } from '../components/PageHeader';
import { useState } from 'react';
import type { PageId } from '../data/dashboard';
import { apiRequest } from '../lib/api';

type SecurityProps = {
  currentUserId: string | null;
  setCurrentUserId: (userId: string | null) => void;
  setActivePage: (page: PageId) => void;
};

export function Security({ currentUserId, setCurrentUserId, setActivePage }: SecurityProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function changePassword() {
    setMessage(null);
    setError(null);
    if (!currentUserId) {
      setError('Log in before changing your password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    try {
      // The account is derived from the auth token server-side; no userId in body.
      await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('Password changed.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not change password.');
    }
  }

  return (
    <div className="page-stack">
      <PageHeader title="Security" description="Change your password and review account access." />
      <section className="panel form-panel">
        {!currentUserId ? <p className="empty-state">Log in to change your password.</p> : null}
        <label>Current password<input value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} type="password" placeholder="Current password" /></label>
        <label>New password<input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} type="password" placeholder="At least 8 characters" /></label>
        <label>Confirm new password<input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" placeholder="Repeat new password" /></label>
        {message ? <p className="form-success">{message}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
        <button className="primary-button" onClick={() => void changePassword()}>Change password</button>
        <button
          className="ghost-button"
          onClick={() => {
            setCurrentUserId(null);
            setActivePage('login');
          }}
        >
          Log out
        </button>
      </section>
    </div>
  );
}
