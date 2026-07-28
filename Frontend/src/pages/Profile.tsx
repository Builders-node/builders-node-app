import { Check, ExternalLink, Pencil, Send, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { PageId } from '../data/dashboard';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { apiRequest } from '../lib/api';
import { useEscapeToClose } from '../lib/useModalA11y';
import { MaintenanceSection } from '../components/MaintenanceSection';

type ProfileProps = {
  currentUserId: string | null;
  setActivePage?: (page: PageId) => void;
};

const MEMBER_STATUSES = ['APPROVED', 'ACTIVE_MEMBER'];
const ADMIN_ROLES = ['SUPER_ADMIN', 'MODERATOR', 'COMMUNITY_LEADER'];

function isMemberStatus(status?: string) {
  return Boolean(status && MEMBER_STATUSES.includes(status));
}

function membershipTone(status?: string): 'good' | 'attention' | 'danger' | 'neutral' {
  if (status === 'ACTIVE_MEMBER' || status === 'APPROVED') return 'good';
  if (status === 'PAST_MEMBER' || status === 'CANCELLED') return 'neutral';
  return 'attention'; // APPLICANT / unknown
}

type ProfileData = {
  email: string;
  referralCode?: string | null;
  role: string;
  emailVerifiedAt?: string | null;
  discordId?: string | null;
  discordUsername?: string | null;
  discordEnabled?: boolean;
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

type HomeMemberData = {
  membership?: { status: string; hasApplied: boolean; applicationStatus?: string | null };
  apartment: { name: string; status: string; moveInDate?: string | null; details: string } | null;
  meals: { items: Array<{ id: string; day: string; meal: string }> };
  cleaning: { nextCleaning?: string | null; frequency?: string | null; notes?: string | null } | null;
};

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
  const [home, setHome] = useState<HomeMemberData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [residencyMessage, setResidencyMessage] = useState<string | null>(null);
  const [isResidencyLoading, setIsResidencyLoading] = useState(false);
  const proofInputRef = useRef<HTMLInputElement>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  useEscapeToClose(isEditOpen, () => setIsEditOpen(false));
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editLocation, setEditLocation] = useState('');

  async function loadResidency(userId: string) {
    const data = await apiRequest<ResidencyData>(`/users/${userId}/residency`);
    setResidency(data);
  }

  async function loadHome(userId: string) {
    const data = await apiRequest<HomeMemberData>(`/users/${userId}/home`);
    setHome(data);
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
      loadHome(currentUserId).catch(() => undefined),
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

  async function connectDiscord() {
    if (!currentUserId) return;
    setError(null);
    try {
      const { url } = await apiRequest<{ url: string }>(`/users/${currentUserId}/discord/authorize-url`);
      window.location.href = url; // full-page redirect to Discord's consent screen
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start Discord verification.');
    }
  }

  async function disconnectDiscord() {
    if (!currentUserId) return;
    setError(null);
    try {
      await apiRequest(`/users/${currentUserId}/discord`, { method: 'DELETE' });
      await loadProfile(currentUserId);
      setProfileMessage('Discord disconnected.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not disconnect Discord.');
    }
  }

  // Handle the return from Discord's OAuth redirect (?discord=connected|error).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('discord');
    if (!status) return;
    if (status === 'connected') setProfileMessage('Discord connected — your role has been granted.');
    if (status === 'error') setError('Discord verification failed. Please try again.');
    // Clean the query so it doesn't re-fire on refresh.
    window.history.replaceState(null, '', '/account');
    if (currentUserId) void loadProfile(currentUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Membership (customer status) is independent of role (staff/permissions).
  // Staff accounts don't need a membership, so they never see the apply prompt.
  const member = isMemberStatus(profile?.membership?.status);
  const isStaff = ADMIN_ROLES.includes(profile?.role ?? '');
  const hasApplied = Boolean(home?.membership?.hasApplied);
  const showMemberSections = Boolean(profile && member);
  const showApplyPrompt = Boolean(profile && !member && !isStaff);
  const isLoading = Boolean(currentUserId) && !profile && !error;

  // Onboarding checklist — derived purely from data already loaded.
  const onboardingSteps = [
    {
      key: 'profile',
      label: 'Complete your profile',
      done: Boolean(profile?.profile?.fullName && profile?.profile?.phone && profile?.profile?.location),
      show: true,
      actionLabel: 'Complete',
      action: () => setIsEditOpen(true),
    },
    {
      key: 'email',
      label: 'Verify your email',
      done: Boolean(profile?.emailVerifiedAt),
      show: true,
      actionLabel: undefined as string | undefined,
      action: undefined as (() => void) | undefined,
    },
    {
      key: 'discord',
      label: 'Connect Discord',
      done: Boolean(profile?.discordId),
      show: Boolean(profile?.discordEnabled),
      actionLabel: 'Connect',
      action: () => void connectDiscord(),
    },
    {
      key: 'residency',
      label: 'Start your E-Residency',
      done: Boolean(residency && residency.status !== 'NOT_STARTED'),
      show: showMemberSections,
      actionLabel: 'Start',
      action: () => { if (residency?.applyUrl) window.open(residency.applyUrl, '_blank', 'noopener'); },
    },
  ].filter((step) => step.show);
  const onboardingDone = onboardingSteps.filter((step) => step.done).length;
  const showOnboarding = Boolean(profile) && onboardingDone < onboardingSteps.length;

  return (
    <div className="page-stack">
      <PageHeader title="Home" description="Your Builders Node account, E-Residency, and residence." />
      {!currentUserId ? <section className="panel empty-state">Log in to load account details.</section> : null}
      {error ? <section className="panel"><p className="form-error">{error}</p></section> : null}
      {profileMessage ? <section className="panel"><p className="form-success">{profileMessage}</p></section> : null}
      {residencyMessage ? <section className="panel"><p className="form-success">{residencyMessage}</p></section> : null}
      {isLoading ? (
        <section className="panel form-panel" aria-busy="true">
          <div className="profile-card-head">
            <div className="profile-summary">
              <div className="avatar skeleton skeleton--circle" />
              <div className="skeleton-lines">
                <span className="skeleton skeleton--line" style={{ width: '11rem' }} />
                <span className="skeleton skeleton--line" style={{ width: '14rem' }} />
                <span className="skeleton skeleton--pill" style={{ width: '7rem' }} />
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="panel form-panel">
          <div className="profile-card-head">
            <div className="profile-summary">
              <div className="avatar">{profile?.profile?.fullName?.slice(0, 1) ?? '?'}</div>
              <div>
                <h2>{profile?.profile?.fullName ?? 'No name loaded'}</h2>
                <p>{profile?.email ?? ''}</p>
                <StatusBadge tone={isStaff ? 'good' : membershipTone(profile?.membership?.status)}>
                  {isStaff ? (profile?.role?.split('_').join(' ') ?? 'Staff') : (profile?.membership?.status ?? 'No membership')}
                </StatusBadge>
              </div>
            </div>
            <button className="icon-button profile-edit-button" onClick={() => setIsEditOpen(true)} aria-label="Edit profile">
              <Pencil size={18} />
            </button>
          </div>
        </section>
      )}

      {showOnboarding ? (
        <section className="panel onboarding-card">
          <div className="onboarding-card__head">
            <div>
              <span className="section-label">Get started</span>
              <h2>Set up your account</h2>
            </div>
            <span className="onboarding-card__count">{onboardingDone}/{onboardingSteps.length}</span>
          </div>
          <div className="onboarding-progress">
            <span style={{ width: `${(onboardingDone / onboardingSteps.length) * 100}%` }} />
          </div>
          <ul className="onboarding-steps">
            {onboardingSteps.map((step) => (
              <li key={step.key} className={step.done ? 'onboarding-step onboarding-step--done' : 'onboarding-step'}>
                <span className="onboarding-step__check">{step.done ? <Check size={13} /> : null}</span>
                <span className="onboarding-step__label">{step.label}</span>
                {!step.done && step.action ? (
                  <button className="onboarding-step__action" onClick={step.action}>{step.actionLabel}</button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {profile?.discordEnabled ? (
        <section className="panel form-panel discord-card">
          <div className="discord-card__head">
            <div>
              <span className="section-label">Community</span>
              <h2>Discord</h2>
              <p className="discord-card__copy">
                {profile.discordId
                  ? 'Your Discord is verified — your member role is active on the server.'
                  : 'Connect your Discord to verify your membership and get your role on the server automatically.'}
              </p>
            </div>
          </div>
          {profile.discordId ? (
            <div className="discord-card__connected">
              <span className="discord-card__badge">Connected{profile.discordUsername ? ` · @${profile.discordUsername}` : ''}</span>
              <button className="ghost-button" onClick={() => void disconnectDiscord()}>Disconnect</button>
            </div>
          ) : (
            <button className="primary-button discord-card__connect" onClick={() => void connectDiscord()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.24.5c1.66.4 2.9 1 4.06 1.8a14 14 0 0 0-9.44 0c1.16-.8 2.4-1.4 4.06-1.8L13.6 3A19.8 19.8 0 0 0 8.7 4.4C5.6 9 4.8 13.5 5.2 17.9a20 20 0 0 0 5.1 2.6l.66-1.1c-.6-.22-1.15-.5-1.66-.83l.4-.3a14 14 0 0 0 11 0l.4.3c-.5.33-1.06.6-1.66.83l.66 1.1a20 20 0 0 0 5.1-2.6c.5-5.1-.85-9.55-4.6-13.5ZM9.9 15.3c-.98 0-1.78-.9-1.78-2s.78-2 1.78-2 1.8.9 1.78 2c0 1.1-.8 2-1.78 2Zm4.2 0c-.98 0-1.78-.9-1.78-2s.78-2 1.78-2 1.8.9 1.78 2c0 1.1-.8 2-1.78 2Z" />
              </svg>
              Connect Discord
            </button>
          )}
        </section>
      ) : null}

      {showApplyPrompt ? (
        <section className="panel residency-gate-panel">
          <span className="section-label">Membership</span>
          {hasApplied ? (
            <>
              <h2>Your application is under review</h2>
              <p>
                Thanks for applying. Our team is reviewing your application — you&apos;ll get an email once it&apos;s
                approved, and your member home unlocks then.
              </p>
            </>
          ) : (
            <>
              <h2>You are not a member yet</h2>
              <p>
                Apply for a Builders Node membership to unlock your E-Residency, community plans, and the rest of
                your member account.
              </p>
              {setActivePage ? (
                <button className="primary-button" onClick={() => setActivePage('apply')}>
                  <Send size={16} />
                  Apply for membership
                </button>
              ) : null}
            </>
          )}
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
              <label>Phone<input value={editPhone} onChange={(event) => setEditPhone(event.target.value)} placeholder="Phone number" /></label>
              <label>Location<input value={editLocation} onChange={(event) => setEditLocation(event.target.value)} placeholder="Location" /></label>
            </div>
            <p className="modal-hint">Your email and membership details aren&apos;t editable here — contact us if they need to change.</p>
            <button className="primary-button" type="submit">Save changes</button>
          </form>
        </div>
      ) : null}

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

      {showMemberSections ? (
      <div className="two-column">
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
          <article className="panel">
            <span className="section-label">Apartment</span>
            <h2>Not assigned</h2>
            <p className="empty-state">No apartment assignment is saved yet.</p>
          </article>
        )}

        <article className="panel">
          <span className="section-label">ProsperaSub.com</span>
          <h2>Meals menu</h2>
          <div className="next-step-list">
            {home?.meals?.items?.length ? (
              home.meals.items.map((item) => (
                <div className="next-step" key={item.id ?? item.day}>
                  <strong>{item.day}</strong>
                  <span>{item.meal}</span>
                </div>
              ))
            ) : (
              <div className="empty-state">No meals are saved yet.</div>
            )}
          </div>
        </article>
      </div>
      ) : null}

      {showMemberSections ? (
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
      ) : null}

      {showMemberSections && currentUserId ? <MaintenanceSection currentUserId={currentUserId} /> : null}
    </div>
  );
}
