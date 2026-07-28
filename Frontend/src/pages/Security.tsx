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

  const [dataError, setDataError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  async function downloadData() {
    if (!currentUserId) return;
    setDataError(null);
    setIsExporting(true);
    try {
      const data = await apiRequest<unknown>(`/users/${currentUserId}/export`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'builders-node-data.json';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setDataError(caught instanceof Error ? caught.message : 'Could not export your data.');
    } finally {
      setIsExporting(false);
    }
  }

  async function deleteAccount() {
    if (!currentUserId) return;
    setDataError(null);
    setIsDeleting(true);
    try {
      await apiRequest(`/users/${currentUserId}`, { method: 'DELETE' });
      setCurrentUserId(null);
      setActivePage('landing');
    } catch (caught) {
      setDataError(caught instanceof Error ? caught.message : 'Could not delete your account.');
      setIsDeleting(false);
    }
  }

  return (
    <div className="page-stack">
      <PageHeader title="Settings" description="Change your password, export your data, or close your account." />

      <section className="panel form-panel">
        <h2 className="panel-title">Password</h2>
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

      <section className="panel form-panel">
        <h2 className="panel-title">Your data</h2>
        <p className="setup-card-copy">Download a copy of everything we hold about you, or permanently delete your account.</p>
        {dataError ? <p className="form-error">{dataError}</p> : null}
        <button className="ghost-button" disabled={!currentUserId || isExporting} onClick={() => void downloadData()}>
          {isExporting ? 'Preparing…' : 'Download my data'}
        </button>

        {confirmDelete ? (
          <div className="danger-confirm">
            <p className="form-error">
              This permanently deletes your account and all associated data. This cannot be undone.
            </p>
            <div className="danger-confirm__actions">
              <button className="danger-button" disabled={isDeleting} onClick={() => void deleteAccount()}>
                {isDeleting ? 'Deleting…' : 'Yes, delete my account'}
              </button>
              <button className="ghost-button" disabled={isDeleting} onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button className="danger-button" disabled={!currentUserId} onClick={() => setConfirmDelete(true)}>
            Delete my account
          </button>
        )}
      </section>
    </div>
  );
}
