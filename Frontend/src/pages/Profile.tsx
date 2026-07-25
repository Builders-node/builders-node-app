import { ExternalLink, Pencil, RefreshCcw, Send, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { PageId } from '../data/dashboard';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { apiRequest } from '../lib/api';

type ProfileProps = {
  currentUserId: string | null;
  setActivePage?: (page: PageId) => void;
};

const MEMBER_STATUSES = ['APPROVED', 'ACTIVE_MEMBER'];

function isMemberStatus(status?: string) {
  return Boolean(status && MEMBER_STATUSES.includes(status));
}

type ProfileData = {
  email: string;
  referralCode?: string | null;
  role: string;
  profile?: {
    fullName?: string | null;
    phone?: string | null;
    location?: string | null;
  } | null;
  membership?: {
    status: string;
    startingDate?: string | null;
    dueDate?: string | null;
    finishDate?: string | null;
  } | null;
  communityPlans?: Array<{
    id: string;
    planName: string;
    status: string;
    amountCents: number;
    currency: string;
    purchasedAt: string;
    startsAt?: string | null;
    endsAt?: string | null;
    renewalDate?: string | null;
    source: string;
  }>;
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

function toneForResidency(status?: string) {
  if (status === 'APPROVED') return 'good';
  if (status === 'IN_PROGRESS' || status === 'PENDING_REVIEW' || status === 'NOT_STARTED') return 'attention';
  return 'neutral';
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : '';
}

function formatMoney(cents?: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format((cents ?? 0) / 100);
}

export function Profile({ currentUserId, setActivePage }: ProfileProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [residency, setResidency] = useState<ResidencyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [residencyMessage, setResidencyMessage] = useState<string | null>(null);
  const [isResidencyLoading, setIsResidencyLoading] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editLocation, setEditLocation] = useState('');

  async function loadResidency(userId: string) {
    const data = await apiRequest<ResidencyData>(`/users/${userId}/residency`);
    setResidency(data);
  }

  async function loadProfile(userId: string) {
    const data = await apiRequest<ProfileData>(`/users/${userId}/profile`);
    setProfile(data);
    setEditFullName(data.profile?.fullName ?? '');
    setEditPhone(data.profile?.phone ?? '');
    setEditLocation(data.profile?.location ?? '');
  }

  useEffect(() => {
    if (!currentUserId) return;
    Promise.all([
      loadProfile(currentUserId),
      loadResidency(currentUserId),
    ])
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load profile.'));
  }, [currentUserId]);

  async function saveProfile() {
    if (!currentUserId) return;
    setError(null);
    setProfileMessage(null);
    try {
      await apiRequest(`/users/${currentUserId}/profile`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: editFullName,
          phone: editPhone,
          location: editLocation,
        }),
      });
      await loadProfile(currentUserId);
      setIsEditOpen(false);
      setProfileMessage('Profile updated.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update profile.');
    }
  }

  async function startOrContinueResidency() {
    if (!currentUserId) return;
    setIsResidencyLoading(true);
    setError(null);
    setResidencyMessage(null);
    try {
      const data = await apiRequest<ResidencyData>(`/users/${currentUserId}/residency/start-or-continue`, {
        method: 'POST',
      });
      await loadResidency(currentUserId);
      setResidencyMessage('E-Residency application link is ready.');
      if (data.continueUrl) {
        window.open(data.continueUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start E-Residency.');
    } finally {
      setIsResidencyLoading(false);
    }
  }

  async function syncResidency() {
    if (!currentUserId) return;
    setIsResidencyLoading(true);
    setError(null);
    setResidencyMessage(null);
    try {
      await apiRequest<ResidencyData>(`/users/${currentUserId}/residency/sync`, {
        method: 'POST',
      });
      await loadResidency(currentUserId);
      setResidencyMessage('E-Residency status synced from Prospera.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not sync E-Residency.');
    } finally {
      setIsResidencyLoading(false);
    }
  }

  const nextSteps = residency?.requiredNextSteps?.length
    ? residency.requiredNextSteps
    : ['Start or continue your Prospera E-Residency application.'];

  // Member-only sections (E-Residency, community plans) stay hidden until the
  // account is an actual member — a registered-but-not-applied user should not
  // see external membership services yet.
  const member = isMemberStatus(profile?.membership?.status);
  const showMemberSections = Boolean(profile && member);
  const showApplyPrompt = Boolean(profile && !member);

  return (
    <div className="page-stack">
      <PageHeader title="Account" description="This comes from the original apply form and can be edited by the member team." />
      {!currentUserId ? <section className="panel empty-state">Log in to load account details.</section> : null}
      {error ? <section className="panel"><p className="form-error">{error}</p></section> : null}
      {profileMessage ? <section className="panel"><p className="form-success">{profileMessage}</p></section> : null}
      {residencyMessage ? <section className="panel"><p className="form-success">{residencyMessage}</p></section> : null}
      <section className="panel form-panel">
        <div className="profile-card-head">
          <div className="profile-summary">
            <div className="avatar">{profile?.profile?.fullName?.slice(0, 1) ?? '?'}</div>
            <div>
              <h2>{profile?.profile?.fullName ?? 'No name loaded'}</h2>
              <p>{profile?.email ?? ''}</p>
              <StatusBadge tone="good">{profile?.membership?.status ?? 'No membership'}</StatusBadge>
            </div>
          </div>
          <button className="icon-button profile-edit-button" onClick={() => setIsEditOpen(true)} aria-label="Edit profile">
            <Pencil size={18} />
          </button>
        </div>
      </section>

      {showApplyPrompt ? (
        <section className="panel residency-gate-panel">
          <span className="section-label">Membership</span>
          <h2>You are not a member yet</h2>
          <p>
            Apply for a Builders Node membership to unlock your E-Residency tracking, community plans, and the
            rest of your member account.
          </p>
          {setActivePage ? (
            <button className="primary-button" onClick={() => setActivePage('apply')}>
              <Send size={16} />
              Apply for membership
            </button>
          ) : null}
        </section>
      ) : null}

      {isEditOpen ? (
        <div className="modal-overlay" role="presentation" onClick={() => setIsEditOpen(false)}>
          <form
            className="profile-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Edit profile"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              void saveProfile();
            }}
          >
            <div className="modal-head">
              <div>
                <h2>Edit account</h2>
                <p>Update the editable profile fields.</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setIsEditOpen(false)} aria-label="Close edit profile">
                <X size={18} />
              </button>
            </div>
            <div className="form-grid">
              <label>Full name<input value={editFullName} onChange={(event) => setEditFullName(event.target.value)} placeholder="Full name" /></label>
              <label>Email<input value={profile?.email ?? ''} readOnly /></label>
              <label>Role<input value={profile?.role?.split('_').join(' ') ?? ''} readOnly /></label>
              <label>Phone<input value={editPhone} onChange={(event) => setEditPhone(event.target.value)} placeholder="Phone number" /></label>
              <label>Location<input value={editLocation} onChange={(event) => setEditLocation(event.target.value)} placeholder="Location" /></label>
              <label>Starting date<input value={formatDate(profile?.membership?.startingDate)} readOnly /></label>
              <label>Due date<input value={formatDate(profile?.membership?.dueDate)} readOnly /></label>
              <label>Finish date<input value={formatDate(profile?.membership?.finishDate)} readOnly /></label>
            </div>
            <button className="primary-button" type="submit">Save changes</button>
          </form>
        </div>
      ) : null}

      <section className="panel admin-user-list-panel">
        <div className="admin-panel__head">
          <div>
            <span className="section-label">Referral program</span>
            <h2>Invite code</h2>
            <p>Share this code with people applying to Builders Node.</p>
          </div>
          <StatusBadge tone={profile?.referralCode ? 'good' : 'neutral'}>{profile?.referralCode ? 'Active' : 'Missing'}</StatusBadge>
        </div>
        <div className="detail-box">
          <div><span>Your code</span><strong>{profile?.referralCode ?? '-'}</strong></div>
          <div><span>Apply link</span><strong>{profile?.referralCode ? `${window.location.origin}/?ref=${profile.referralCode}` : '-'}</strong></div>
        </div>
      </section>

      {showMemberSections ? (
      <section className="panel residency-panel">
        <div className="admin-panel__head">
          <div>
            <span className="section-label">Prospera.co</span>
            <h2>E-Residency</h2>
            <p>{residency?.stage ?? 'Apply for E-Residency'}</p>
          </div>
          <StatusBadge tone={toneForResidency(residency?.status)}>{residency?.status ?? 'NOT_STARTED'}</StatusBadge>
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
        <div className="button-row">
          <button className="primary-button" onClick={() => void startOrContinueResidency()} disabled={isResidencyLoading}>
            {residency?.continueUrl ? 'Continue on Prospera.co' : 'Apply on Prospera.co'}
            <ExternalLink size={16} />
          </button>
          <button className="ghost-button" onClick={() => void syncResidency()} disabled={isResidencyLoading}>
            <RefreshCcw size={16} />
            Sync status
          </button>
        </div>
      </section>
      ) : null}

      {showMemberSections ? (
      <section className="panel admin-user-list-panel">
        <div className="admin-panel__head">
          <div>
            <span className="section-label">ProsperaSub.com</span>
            <h2>Community plans</h2>
            <p>Every Builders Node community plan connected to this account.</p>
          </div>
          <StatusBadge tone={profile?.communityPlans?.length ? 'good' : 'neutral'}>
            {String(profile?.communityPlans?.length ?? 0)}
          </StatusBadge>
        </div>
        {profile?.communityPlans?.length ? null : <div className="empty-state">No community plans purchased yet.</div>}
        {profile?.communityPlans?.map((plan) => (
          <div className="admin-user-list-row" key={plan.id}>
            <div>
              <strong>{plan.planName}</strong>
              <span>{plan.source} · Purchased {formatDate(plan.purchasedAt)} · {formatMoney(plan.amountCents, plan.currency)}</span>
            </div>
            <StatusBadge tone={plan.status === 'ACTIVE' ? 'good' : plan.status === 'OVERDUE' ? 'danger' : 'attention'}>{plan.status}</StatusBadge>
          </div>
        ))}
      </section>
      ) : null}
    </div>
  );
}
