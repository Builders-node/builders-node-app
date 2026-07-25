import { ExternalLink, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { PageId } from '../data/dashboard';
import { PageHeader } from '../components/PageHeader';
import { apiRequest } from '../lib/api';

type DashboardProps = {
  currentUserId: string | null;
  setActivePage: (page: PageId) => void;
  /** Kept for prop compatibility; the app shell now owns the mobile menu toggle. */
  setMenuOpen?: (value: boolean) => void;
};

type HomeData = {
  account: {
    fullName?: string | null;
    email: string;
    mustChangePassword: boolean;
  };
  membership: {
    status: string;
    hasApplied: boolean;
    applicationStatus: string | null;
  };
  eResidency: {
    status: string;
    stage: string;
    actionLabel: string;
    actionUrl: string;
  };
  apartment: {
    name: string;
    status: string;
    moveInDate?: string | null;
    details: string;
  } | null;
  meals: {
    source: string;
    items: Array<{ id: string; day: string; meal: string }>;
  };
  cleaning: {
    source: string;
    nextCleaning?: string | null;
    frequency?: string | null;
    notes?: string | null;
  } | null;
};

const MEMBER_STATUSES = ['APPROVED', 'ACTIVE_MEMBER'];

function isMember(status?: string) {
  return Boolean(status && MEMBER_STATUSES.includes(status));
}

function shouldGateDashboard(status?: string) {
  return status !== 'APPROVED';
}

function isResidencyStarted(status?: string) {
  return Boolean(status && status !== 'NOT_STARTED');
}

export function Dashboard({ currentUserId, setActivePage }: DashboardProps) {
  const [home, setHome] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!currentUserId) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);
    apiRequest<HomeData>(`/users/${currentUserId}/home`)
      .then((data) => {
        if (isMounted) setHome(data);
      })
      .catch((caught) => {
        if (isMounted) setError(caught instanceof Error ? caught.message : 'Could not load home data.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentUserId]);

  const member = isMember(home?.membership.status);
  const hasApplied = Boolean(home?.membership.hasApplied);
  // Registered but not yet a member: they only need the apply flow, not any of
  // the member-only panels (E-Residency, apartment, meals, cleaning).
  const showMemberContent = Boolean(currentUserId && home && member);
  const showPreMember = Boolean(currentUserId && home && !member);
  const isResidencyGateActive = showMemberContent && shouldGateDashboard(home!.eResidency.status);
  const firstName = home?.account.fullName?.trim().split(' ')[0];

  return (
    <div className="page-stack">
      <PageHeader
        title={showPreMember ? (firstName ? `Welcome, ${firstName}` : 'Welcome to Builders Node') : 'Dashboard'}
        description={
          showPreMember
            ? 'Your account is ready. Apply for a membership to unlock your member home.'
            : 'Your member home: E-Residency, assigned apartment, meals, and cleaning.'
        }
        action={
          showPreMember && !hasApplied ? (
            <button className="primary-button" onClick={() => setActivePage('apply')}>
              <Send size={16} />
              Apply for membership
            </button>
          ) : undefined
        }
      />

      {!currentUserId ? (
        <section className="panel empty-state">
          Log in to load your account from the database.
        </section>
      ) : null}
      {isLoading ? <section className="panel">Loading home data...</section> : null}
      {error ? <section className="panel"><p className="form-error">{error}</p></section> : null}

      {showPreMember ? (
        <section className="panel residency-gate-panel">
          <span className="section-label">{hasApplied ? 'Application received' : 'Get started'}</span>
          <h2>{hasApplied ? 'Your application is under review' : 'Apply for membership'}</h2>
          <p>
            {hasApplied
              ? 'Thanks for applying. Our team is reviewing your application — you will get an email once it is approved, and your member dashboard will unlock then.'
              : 'You have an account, but you have not applied yet. Submit your application to join Builders Node and unlock your member home.'}
          </p>
          {!hasApplied ? (
            <button className="primary-button" onClick={() => setActivePage('apply')}>
              <Send size={16} />
              Start your application
            </button>
          ) : null}
        </section>
      ) : null}

      {isResidencyGateActive ? (
        <section className="panel residency-gate-panel">
          <span className="section-label">Required next step</span>
          <h2>{isResidencyStarted(home?.eResidency.status) ? 'E-Residency review in progress' : 'Apply for E-Residency'}</h2>
          <p>
            {isResidencyStarted(home?.eResidency.status)
              ? 'Your E-Residency application is submitted. The rest of the dashboard unlocks after approval.'
              : 'Complete your Prospera E-Residency application before the rest of the member dashboard unlocks.'}
          </p>
          {!isResidencyStarted(home?.eResidency.status) ? (
            <button className="primary-button" onClick={() => setActivePage('profile')}>
              Apply E-Residency
              <ExternalLink size={16} />
            </button>
          ) : null}
        </section>
      ) : null}

      {showMemberContent && !isResidencyGateActive ? (
        <div className="dashboard-workspace dashboard-workspace--single">
          <div className="dashboard-main-column">
            <section className="single-column">
              <article className="panel timeline-panel">
                <h2>E-Residency</h2>
                <p>{home?.eResidency.stage ?? 'Start your E-Residency application directly on Prospera.co. Builders Node tracks this separately from your community account.'}</p>
                <a className="primary-button link-button" href={home?.eResidency.actionUrl ?? 'https://prospera.co/e-residency'}>
                  {home?.eResidency.actionLabel ?? 'Open Prospera.co'}
                  <ExternalLink size={16} />
                </a>
              </article>
            </section>

            <section className="two-column">
              {home?.apartment ? (
                <article className="panel apartment-home-panel">
                  <div className="apartment-placeholder" />
                  <div>
                    <span className="section-label">{home.apartment.status}</span>
                    <h2>{home.apartment.name}</h2>
                    <p>{home.apartment.details}</p>
                    {home.apartment.moveInDate ? <strong>Move-in: {new Date(home.apartment.moveInDate).toLocaleDateString()}</strong> : null}
                  </div>
                </article>
              ) : (
                <article className="panel empty-state">No apartment assignment is saved yet.</article>
              )}

              <article className="panel">
                <h2>Meals menu</h2>
                <div className="next-step-list">
                  {home?.meals.items.length === 0 ? <div className="empty-state">No meals are saved yet.</div> : null}
                  {home?.meals.items.map((item) => (
                    <div className="next-step" key={item.day}>
                      <strong>{item.day}</strong>
                      <span>{item.meal}</span>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="panel split-panel">
              <div>
                <span className="section-label">Cleaning</span>
                <h2>{home?.cleaning?.nextCleaning ? new Date(home.cleaning.nextCleaning).toLocaleDateString() : 'Not scheduled'}</h2>
                <p>{home?.cleaning?.notes ?? 'No cleaning information is saved yet.'}</p>
              </div>
              <div className="detail-box">
                <div><span>Source</span><strong>ProsperaSub.com</strong></div>
                <div><span>Frequency</span><strong>{home?.cleaning?.frequency ?? '-'}</strong></div>
              </div>
            </section>
          </div>

        </div>
      ) : null}
    </div>
  );
}
