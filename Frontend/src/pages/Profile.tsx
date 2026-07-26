import { ExternalLink, Pencil, Send, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
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
  status: string; // NOT_STARTED | PENDING_REVIEW | VERIFIED | REJECTED
  applyUrl: string;
  hasProof: boolean;
  proofFileName?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
};

const RESIDENCY_LABELS: Record<string, string> = {
  NOT_STARTED: 'Not started',
  PENDING_REVIEW: 'Pending review',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
};

function toneForResidency(status?: string): 'good' | 'attention' | 'danger' | 'neutral' {
  if (status === 'VERIFIED') return 'good';
  if (status === 'REJECTED') return 'danger';
  if (status === 'PENDING_REVIEW') return 'attention';
  return 'neutral';
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
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
  const proofInputRef = useRef<HTMLInputElement>(null);
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

  async function submitProof(file: File) {
    if (!currentUserId) return;
    setIsResidencyLoading(true);
    setError(null);
    setResidencyMessage(null);
    try {
      const dataBase64 = await fileToBase64(file);
      await apiRequest(`/users/${currentUserId}/residency/proof`, {
        method: 'POST',
        body: JSON.stringify({ fileName: file.name, fileType: file.type || 'application/octet-stream', dataBase64 }),
      });
      await loadResidency(currentUserId);
      setResidencyMessage('Proof uploaded — our team will review it shortly.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not upload proof.');
    } finally {
      setIsResidencyLoading(false);
    }
  }

  function onProofSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void submitProof(file);
  }

  // Member-only sections (E-Residency, community plans) stay hidden until the
  // account is an actual member — a registered-but-not-applied user should not
  // see external membership services yet.
  const member = isMemberStatus(profile?.membership?.status);
  const showMemberSections = Boolean(profile && member);
  const showApplyPrompt = Boolean(profile && !member);

  return (
    <div className="page-stack">
      <PageHeader title="Account" description="Your Builders Node profile, referral code, and E-Residency." />
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
            <p>Apply on Prospera.co, then upload your proof for our team to verify.</p>
          </div>
          <StatusBadge tone={toneForResidency(residency?.status)}>
            {RESIDENCY_LABELS[residency?.status ?? 'NOT_STARTED'] ?? residency?.status ?? 'Not started'}
          </StatusBadge>
        </div>
        <div className="next-step-list">
          <div className="next-step"><strong>1.</strong><span>Apply for E-Residency on Prospera.co.</span></div>
          <div className="next-step"><strong>2.</strong><span>Upload your confirmation/proof below.</span></div>
          <div className="next-step"><strong>3.</strong><span>Our team reviews and verifies it.</span></div>
          {residency?.proofFileName ? (
            <div className="next-step"><strong>Uploaded</strong><span>{residency.proofFileName}{residency.submittedAt ? ` · ${formatDate(residency.submittedAt)}` : ''}</span></div>
          ) : null}
          {residency?.status === 'PENDING_REVIEW' ? (
            <div className="next-step"><strong>Status</strong><span>Waiting for our team to verify your proof.</span></div>
          ) : null}
          {residency?.status === 'VERIFIED' ? (
            <div className="next-step"><strong>Verified</strong><span>Your E-Residency proof has been approved. ✅</span></div>
          ) : null}
          {residency?.status === 'REJECTED' && residency?.reviewNote ? (
            <div className="next-step"><strong>Needs changes</strong><span>{residency.reviewNote}</span></div>
          ) : null}
        </div>
        <div className="button-row">
          <a
            className="primary-button link-button"
            href={residency?.applyUrl ?? 'https://prospera.co/e-residency'}
            target="_blank"
            rel="noopener noreferrer"
          >
            Apply on Prospera.co
            <ExternalLink size={16} />
          </a>
          {residency?.status !== 'VERIFIED' ? (
            <>
              <input
                ref={proofInputRef}
                type="file"
                accept="image/*,application/pdf"
                style={{ display: 'none' }}
                onChange={onProofSelected}
              />
              <button className="ghost-button" onClick={() => proofInputRef.current?.click()} disabled={isResidencyLoading}>
                <Upload size={16} />
                {isResidencyLoading ? 'Uploading…' : residency?.hasProof ? 'Re-upload proof' : "I've applied — upload proof"}
              </button>
            </>
          ) : null}
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
