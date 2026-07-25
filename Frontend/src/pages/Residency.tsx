import { ExternalLink, RefreshCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import type { PageId } from '../data/dashboard';
import { apiRequest } from '../lib/api';

type ResidencyProps = {
  currentUserId: string | null;
  setActivePage: (page: PageId) => void;
};

type ResidencyData = {
  status: string;
  stage: string;
  requiredNextSteps?: string[];
  action?: string;
  continueUrl?: string | null;
  lastSyncedAt?: string | null;
  lastError?: string | null;
};

const progressByStatus: Record<string, string> = {
  NOT_STARTED: '0%',
  IN_PROGRESS: '35%',
  PENDING_REVIEW: '65%',
  APPROVED: '100%',
};

export function Residency({ currentUserId, setActivePage }: ResidencyProps) {
  const [residency, setResidency] = useState<ResidencyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function loadResidency(userId: string) {
    const data = await apiRequest<ResidencyData>(`/users/${userId}/residency`);
    setResidency(data);
  }

  useEffect(() => {
    if (!currentUserId) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);
    loadResidency(currentUserId)
      .catch((caught) => {
        if (isMounted) setError(caught instanceof Error ? caught.message : 'Could not load E-Residency.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentUserId]);

  async function startOrContinue() {
    if (!currentUserId) {
      setActivePage('login');
      return;
    }

    setIsLoading(true);
    setError(null);
    setMessage(null);
    try {
      const data = await apiRequest<ResidencyData>(`/users/${currentUserId}/residency/start-or-continue`, {
        method: 'POST',
      });
      await loadResidency(currentUserId);
      setMessage('E-Residency application is ready. Continue link is now saved to your account.');
      if (data.continueUrl) {
        window.open(data.continueUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start E-Residency.');
    } finally {
      setIsLoading(false);
    }
  }

  async function syncResidency() {
    if (!currentUserId) {
      setActivePage('login');
      return;
    }

    setIsLoading(true);
    setError(null);
    setMessage(null);
    try {
      await apiRequest<ResidencyData>(`/users/${currentUserId}/residency/sync`, {
        method: 'POST',
      });
      await loadResidency(currentUserId);
      setMessage('E-Residency status synced from Prospera.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not sync E-Residency.');
    } finally {
      setIsLoading(false);
    }
  }

  const nextSteps = residency?.requiredNextSteps?.length
    ? residency.requiredNextSteps
    : ['Start your Prospera E-Residency application.'];

  return (
    <div className="page-stack">
      <PageHeader
        title="E-Residency"
        description="Apply on Prospera.co. This is separate from your Builders Node account."
        action={<button className="ghost-button" onClick={() => void syncResidency()} disabled={isLoading}><RefreshCcw size={16} /> Sync status</button>}
      />
      {!currentUserId ? (
        <section className="panel empty-state">
          Log in before starting an E-Residency application.
        </section>
      ) : null}
      {error ? <section className="panel"><p className="form-error">{error}</p></section> : null}
      {message ? <section className="panel"><p className="form-success">{message}</p></section> : null}
      <section className="panel residency-panel">
        <div>
          <span className="section-label">Prospera.co</span>
          <h2>{residency?.stage ?? 'Apply for E-Residency'}</h2>
          <p>{residency?.action ?? 'Your E-Residency status loads from the database after your Prospera.co application is linked or synced.'}</p>
        </div>
        <div className="progress-track" aria-label="E-Residency progress">
          <span style={{ width: progressByStatus[residency?.status ?? 'NOT_STARTED'] ?? '15%' }} />
        </div>
        <div className="next-step-list">
          {nextSteps.map((step) => (
            <div className="next-step" key={step}>{step}</div>
          ))}
          {residency?.lastSyncedAt ? <div className="next-step">Last synced {new Date(residency.lastSyncedAt).toLocaleString()}</div> : null}
          {residency?.lastError ? <div className="next-step">Last sync error: {residency.lastError}</div> : null}
        </div>
        <button className="primary-button" onClick={() => void startOrContinue()} disabled={isLoading}>
          {residency?.continueUrl ? 'Continue on Prospera.co' : 'Apply on Prospera.co'}
          <ExternalLink size={16} />
        </button>
      </section>
    </div>
  );
}
