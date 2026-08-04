import { Bed, Check, ChevronRight, ExternalLink, FileCheck2, Pencil, QrCode, Send, Sparkles, Upload, Utensils, Waves, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { PageId } from '../data/dashboard';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { apiRequest } from '../lib/api';
import { useEscapeToClose } from '../lib/useModalA11y';
import { MaintenanceSection } from '../components/MaintenanceSection';
import { CarsSection } from '../components/CarsSection';

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
  account?: { externalMemberId?: string | null };
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
  const [onboardingModalOpen, setOnboardingModalOpen] = useState(false);
  useEscapeToClose(onboardingModalOpen, () => setOnboardingModalOpen(false));
  const [cleaningModalOpen, setCleaningModalOpen] = useState(false);
  useEscapeToClose(cleaningModalOpen, () => setCleaningModalOpen(false));
  const [beachClubPassOpen, setBeachClubPassOpen] = useState(false);
  useEscapeToClose(beachClubPassOpen, () => setBeachClubPassOpen(false));
  const [passUrl, setPassUrl] = useState<string | null>(null);
  const [passRotating, setPassRotating] = useState(false);

  // Fetch (and lazily mint) the member's pass token the first time they open it.
  useEffect(() => {
    if (!beachClubPassOpen || !currentUserId || passUrl) return;
    apiRequest<{ url: string }>(`/users/${currentUserId}/pass`)
      .then((data) => setPassUrl(data.url))
      .catch(() => setError('Could not load your pass. Try again.'));
  }, [beachClubPassOpen, currentUserId, passUrl]);

  async function rotatePass() {
    if (!currentUserId) return;
    if (!window.confirm('Reset your pass? The QR on any other device stops working immediately.')) return;
    setPassRotating(true);
    try {
      const data = await apiRequest<{ url: string }>(`/users/${currentUserId}/pass/rotate`, { method: 'POST' });
      setPassUrl(data.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not reset your pass.');
    } finally {
      setPassRotating(false);
    }
  }
  const [cleaningDays, setCleaningDays] = useState<string[]>([]);
  const [cleaningTime, setCleaningTime] = useState<string>('');
  const [cleaningNote, setCleaningNote] = useState('');
  const [cleaningSubmitting, setCleaningSubmitting] = useState(false);
  const [cleaningError, setCleaningError] = useState<string | null>(null);

  function toggleCleaningDay(day: string) {
    setCleaningDays((current) => current.includes(day) ? current.filter((d) => d !== day) : [...current, day]);
  }

  async function submitCleaningReschedule() {
    if (!currentUserId) return;
    if (cleaningDays.length === 0 || !cleaningTime) {
      setCleaningError('Pick at least one day and a time slot.');
      return;
    }
    // Structured, machine-readable request the admin can act on directly.
    const description = [
      `Requested: ${cleaningDays.join(', ')} at ${cleaningTime}`,
      cleaningNote.trim() ? `Note: ${cleaningNote.trim()}` : null,
    ].filter(Boolean).join('\n');
    setCleaningSubmitting(true);
    setCleaningError(null);
    try {
      await apiRequest(`/users/${currentUserId}/maintenance`, {
        method: 'POST',
        body: JSON.stringify({
          category: 'Cleaning',
          title: `Cleaning slot · ${cleaningDays.join('/')} ${cleaningTime}`,
          description,
        }),
      });
      setCleaningDays([]);
      setCleaningTime('');
      setCleaningNote('');
      setCleaningModalOpen(false);
      setResidencyMessage('Cleaning slot requested — the team will confirm shortly.');
    } catch (caught) {
      setCleaningError(caught instanceof Error ? caught.message : 'Could not send the request.');
    } finally {
      setCleaningSubmitting(false);
    }
  }

  const CLEANING_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
  const [cleaningSlots, setCleaningSlots] = useState<string[]>([]);
  const [cleaningSlotsSource, setCleaningSlotsSource] = useState<'prospera' | 'default' | null>(null);
  const [cleaningSlotsLoading, setCleaningSlotsLoading] = useState(false);

  // Load slots from ProsperaSub the first time the modal opens.
  useEffect(() => {
    if (!cleaningModalOpen || cleaningSlots.length > 0 || cleaningSlotsLoading) return;
    setCleaningSlotsLoading(true);
    apiRequest<{ slots: string[]; source: 'prospera' | 'default' }>('/public/cleaning-slots')
      .then((data) => {
        setCleaningSlots(data.slots);
        setCleaningSlotsSource(data.source);
      })
      .catch(() => {
        setCleaningSlots(['09:00', '11:00', '13:00', '15:00', '17:00']);
        setCleaningSlotsSource('default');
      })
      .finally(() => setCleaningSlotsLoading(false));
  }, [cleaningModalOpen, cleaningSlots.length, cleaningSlotsLoading]);

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
  }

  useEffect(() => {
    if (!currentUserId) return;
    // No per-call catch: each loader sets its own state before the rejection
    // propagates, so a failure still renders what did load — and now says so,
    // instead of leaving membership and apartment silently blank.
    Promise.all([
      loadProfile(currentUserId),
      loadResidency(currentUserId),
      loadHome(currentUserId),
    ])
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load profile.'));
  }, [currentUserId]);

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
      action: () => setActivePage?.('myProfile'),
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
  const showOnboarding = Boolean(profile) && onboardingDone < onboardingSteps.length && !onboardingModalOpen;

  return (
    <div className="page-stack">
      <PageHeader
        title={`Hello ${(profile?.profile?.fullName?.split(' ')[0]) ?? (profile?.email?.split('@')[0]) ?? 'there'}`}
        description="Your Builders Node account, E-Residency, and residence."
      />
      {!currentUserId ? <section className="panel empty-state">Log in to load account details.</section> : null}
      {error ? <section className="panel"><p className="form-error">{error}</p></section> : null}
      {profileMessage ? <section className="panel"><p className="form-success">{profileMessage}</p></section> : null}
      {residencyMessage ? <section className="panel"><p className="form-success">{residencyMessage}</p></section> : null}

      {showOnboarding ? (() => {
        // Floating "next step" pill — TikTok-style: progress ring on the left,
        // heading + next step in the middle, chevron on the right that opens
        // the full checklist in a modal.
        const nextStep = onboardingSteps.find((step) => !step.done);
        const percent = Math.round((onboardingDone / onboardingSteps.length) * 100);
        const currentIndex = nextStep ? onboardingSteps.indexOf(nextStep) + 1 : onboardingSteps.length;
        return (
          <div className="onboarding-toast" role="region" aria-label="Onboarding">
            <button
              type="button"
              className="onboarding-toast__main"
              onClick={() => nextStep?.action?.()}
              disabled={!nextStep?.action}
            >
              <span
                className="onboarding-toast__ring"
                style={{ '--progress': percent } as React.CSSProperties}
                aria-hidden="true"
              >
                <span className="onboarding-toast__ring-num">
                  {currentIndex}<em>/{onboardingSteps.length}</em>
                </span>
              </span>
              <span className="onboarding-toast__text">
                <small>Get started</small>
                <strong>{nextStep?.label ?? 'All set'}</strong>
              </span>
            </button>
            <button
              type="button"
              className="onboarding-toast__close"
              onClick={() => setOnboardingModalOpen(true)}
              aria-label="See all steps"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        );
      })() : null}

      {onboardingModalOpen ? (
        <div className="modal-overlay" role="presentation" onClick={() => setOnboardingModalOpen(false)}>
          <div
            className="profile-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Set up your account"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h2>Set up your account</h2>
                <p>{onboardingDone} of {onboardingSteps.length} steps done.</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setOnboardingModalOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
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
                    <button
                      className="onboarding-step__action"
                      onClick={() => { setOnboardingModalOpen(false); step.action?.(); }}
                    >
                      {step.actionLabel}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {/* Discord — always visible on Home when the workspace has it enabled.
          Linked → slim "connected" row. Unlinked → prompt with a Connect CTA so
          members don't have to open the setup checklist to link. */}
      {profile?.discordEnabled ? (
        profile.discordId ? (
          <div className="status-row status-row--discord">
            <span className="status-row__dot" />
            <span className="status-row__body">
              <strong>Discord connected</strong>
              {profile.discordUsername ? <span>@{profile.discordUsername}</span> : null}
            </span>
            <button className="text-button" onClick={() => void disconnectDiscord()}>Disconnect</button>
          </div>
        ) : (
          <div className="status-row status-row--discord status-row--action">
            <span className="status-row__icon status-row__icon--discord" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.317 4.492a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.492a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .079.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.086-2.157-2.42 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.095 2.157 2.418 0 1.334-.956 2.42-2.157 2.42zm7.974 0c-1.183 0-2.157-1.086-2.157-2.42 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.095 2.157 2.418 0 1.334-.946 2.42-2.157 2.42z" />
              </svg>
            </span>
            <span className="status-row__body">
              <strong>Connect Discord</strong>
              <span>Link your account to unlock the members channel and your role.</span>
            </span>
            <button className="primary-button compact-button" onClick={() => void connectDiscord()}>Connect</button>
          </div>
        )
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

      {showMemberSections ? (() => {
        const rStatus = residency?.status ?? 'NOT_STARTED';

        // Once the member has moved past NOT_STARTED the 3-step hero is
        // redundant — collapse it into a single status row with an inline action.
        if (rStatus !== 'NOT_STARTED') {
          return (
            <div className={`status-row status-row--residency status-row--${rStatus.toLowerCase()}`}>
              <span className="status-row__icon" aria-hidden="true"><FileCheck2 size={16} /></span>
              <span className="status-row__body">
                <strong>E-Residency</strong>
                <span>{RESIDENCY_LABELS[rStatus] ?? rStatus}
                  {rStatus === 'REJECTED' && residency?.reviewNote ? ` · ${residency.reviewNote}` : ''}
                </span>
              </span>
              {rStatus !== 'VERIFIED' ? (
                <>
                  <input
                    ref={proofInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    style={{ display: 'none' }}
                    onChange={onProofSelected}
                  />
                  <button className="text-button" onClick={() => proofInputRef.current?.click()} disabled={isResidencyLoading}>
                    {isResidencyLoading ? 'Uploading…' : residency?.hasProof ? 'Re-upload' : 'Upload proof'}
                  </button>
                </>
              ) : null}
            </div>
          );
        }

        // Only reached when rStatus === 'NOT_STARTED' — surface it as a loud
        // orange alert bar, not a card in flow. The heavy visual weight signals
        // "action needed" much better than a neutral panel of 3 steps.
        return (
          <div className="residency-alert" role="alert">
            <FileCheck2 size={18} className="residency-alert__icon" aria-hidden="true" />
            <div className="residency-alert__body">
              <strong>E-Residency — action needed</strong>
              <span>Apply on the Próspera portal, then upload your proof.</span>
            </div>
            <a
              className="residency-alert__cta"
              href={residency?.applyUrl ?? 'https://portal.eprospera.com/'}
              target="_blank"
              rel="noopener noreferrer"
            >
              Apply
              <ExternalLink size={14} />
            </a>
            <input
              ref={proofInputRef}
              type="file"
              accept="image/*,application/pdf"
              style={{ display: 'none' }}
              onChange={onProofSelected}
            />
            <button
              className="residency-alert__upload"
              onClick={() => proofInputRef.current?.click()}
              disabled={isResidencyLoading}
              aria-label={isResidencyLoading ? 'Uploading…' : 'I got residency — upload proof'}
              title="I got residency — upload proof"
            >
              <Upload size={14} />
              <span>{isResidencyLoading ? 'Uploading…' : 'I got it'}</span>
            </button>
          </div>
        );
      })() : null}

      {/* One pass for everything the member has access to. Deliberately the
          first thing on Home — it's what they reach for at a door. */}
      {showMemberSections ? (
        <button className="pass-cta" onClick={() => setBeachClubPassOpen(true)}>
          <span className="pass-cta__icon" aria-hidden="true"><QrCode size={22} /></span>
          <span className="pass-cta__body">
            <strong>My member pass</strong>
            <span>Show this at the Beach Club, gym, coworking or front desk</span>
          </span>
          <ChevronRight size={18} className="pass-cta__chevron" />
        </button>
      ) : null}

      {showMemberSections ? (
        <section className="home-section">
          <h3 className="home-section__title">Your stay</h3>
          <div className="stay-grid">
            {(() => {
              // Split "Studio Apartment 604" into "Studio Apartment" + "604".
              const apt = home?.apartment;
              const nums = apt?.name.match(/\d+/g) ?? [];
              const unitNumber = nums.length ? nums[nums.length - 1] : null;
              const unitType = apt && unitNumber
                ? apt.name.replace(new RegExp(`\\s*#?\\s*${unitNumber}\\s*$`), '').trim() || 'Apartment'
                : apt?.name;

              // Cleaning info — pulled from home.cleaning; falls back to global.
              const freq = home?.cleaning?.frequency ?? '';
              const freqNums = freq.match(/\d+/g) ?? [];
              const cleaningCount = freqNums.length ? freqNums[freqNums.length - 1] : null;
              const cleaningUnit = cleaningCount
                ? freq.replace(/\d+/g, '').replace(/^\s*[x×]\s*/i, '').replace(/^\s*times?\s*/i, '').trim()
                : freq;
              const nextDate = home?.cleaning?.nextCleaning
                ? new Date(home.cleaning.nextCleaning).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                : null;
              const hasCleaning = Boolean(freq || nextDate);

              return (
                <article className="stay-card stay-card--apartment">
                  <header className="stay-card__head">
                    <span className="stay-card__icon" aria-hidden="true"><Bed size={16} /></span>
                    <span className="stay-card__label">Apartment</span>
                    {apt ? <span className="stay-card__status">{apt.status}</span> : null}
                  </header>
                  {apt ? (
                    <div className="stay-card__body">
                      <span className="stay-card__value">{unitNumber ?? unitType}</span>
                      <div className="stay-card__meta">
                        <strong>{unitType}</strong>
                        {apt.moveInDate ? (
                          <span>Move-in {new Date(apt.moveInDate).toLocaleDateString()}</span>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="stay-card__body">
                      <span className="stay-card__empty">Not assigned yet</span>
                    </div>
                  )}
                  {apt ? (
                    <div className="stay-card__strip">
                      <span className="stay-card__strip-icon" aria-hidden="true"><Sparkles size={14} /></span>
                      <div className="stay-card__strip-body">
                        <strong>Cleaning</strong>
                        <span>
                          {hasCleaning
                            ? [
                                cleaningCount ? `${cleaningCount}× ${cleaningUnit || 'per month'}` : cleaningUnit || 'Scheduled',
                                nextDate ? `Next ${nextDate}` : null,
                              ].filter(Boolean).join(' · ')
                            : 'Not scheduled yet'}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setCleaningModalOpen(true)}
                      >
                        Reschedule
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })()}

            {(() => {
              const first = home?.meals?.items?.[0]?.meal ?? '';
              const nums = first.match(/\d+/g) ?? [];
              const number = nums.length ? nums[nums.length - 1] : null;
              const planName = number
                ? first.replace(/[-–—]?\s*\d+\s*times?\s*$/i, '').replace(/plan$/i, 'plan').trim()
                : first;

              return (
                <article className="stay-card stay-card--meals">
                  <header className="stay-card__head">
                    <span className="stay-card__icon stay-card__icon--meals" aria-hidden="true"><Utensils size={16} /></span>
                    <span className="stay-card__label">Meals</span>
                  </header>
                  {first ? (
                    <div className="stay-card__body">
                      <span className="stay-card__value">
                        {number ? <>{number}<em>× a day</em></> : planName}
                      </span>
                      <div className="stay-card__meta">
                        <strong>{planName || 'Meals plan'}</strong>
                        <span>Included with your membership</span>
                      </div>
                    </div>
                  ) : (
                    <div className="stay-card__body">
                      <span className="stay-card__empty">Not set yet</span>
                    </div>
                  )}
                </article>
              );
            })()}
          </div>
        </section>
      ) : null}

      {showMemberSections ? (() => {
        // Perks section — starts with Beach Club (comes with Próspera).
        const rStatus = residency?.status ?? 'NOT_STARTED';
        const unlocked = rStatus === 'VERIFIED';
        return (
          <section className="home-section">
            <h3 className="home-section__title">Perks</h3>
            <div className={`status-row status-row--beach${unlocked ? '' : ' status-row--muted'}`}>
              <span className="status-row__icon" aria-hidden="true"><Waves size={16} /></span>
              <span className="status-row__body">
                <strong>Beach Club</strong>
                <span>
                  {unlocked
                    ? 'Included with your Próspera membership — show the pass at the door.'
                    : 'Unlocks once your E-Residency is verified.'}
                </span>
              </span>
              {unlocked ? (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setBeachClubPassOpen(true)}
                >
                  <QrCode size={14} style={{ marginRight: 4 }} />
                  Show pass
                </button>
              ) : null}
            </div>
          </section>
        );
      })() : null}

      {showMemberSections && currentUserId ? (
        <section className="home-section">
          <h3 className="home-section__title">Support</h3>
          <MaintenanceSection currentUserId={currentUserId} />
          <CarsSection currentUserId={currentUserId} />
        </section>
      ) : null}

      {cleaningModalOpen ? (
        <div className="modal-overlay" role="presentation" onClick={() => setCleaningModalOpen(false)}>
          <form
            className="profile-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Request cleaning reschedule"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => { event.preventDefault(); void submitCleaningReschedule(); }}
          >
            <div className="modal-head">
              <div>
                <h2>Book a cleaning slot</h2>
                <p>Pick the days that work and a time slot — the team will confirm.</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setCleaningModalOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: '0.85rem' }}>
                Preferred day(s)
              </label>
              <div className="day-picker" role="group" aria-label="Preferred cleaning days">
                {CLEANING_DAYS.map((day) => (
                  <button
                    key={day}
                    type="button"
                    className={cleaningDays.includes(day) ? 'day-chip day-chip--active' : 'day-chip'}
                    onClick={() => toggleCleaningDay(day)}
                    aria-pressed={cleaningDays.includes(day)}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
            <label>
              Time slot
              <select
                value={cleaningTime}
                onChange={(event) => setCleaningTime(event.target.value)}
                disabled={cleaningSlotsLoading}
              >
                <option value="">
                  {cleaningSlotsLoading ? 'Loading slots…' : '— pick a time —'}
                </option>
                {cleaningSlots.map((time) => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
              {cleaningSlotsSource === 'default' ? (
                <small style={{ display: 'block', marginTop: 4, color: '#6b7280', fontSize: '0.72rem' }}>
                  Standard slots — the team may propose alternatives.
                </small>
              ) : null}
            </label>
            <label>
              Note (optional)
              <textarea
                value={cleaningNote}
                onChange={(event) => setCleaningNote(event.target.value)}
                rows={2}
                placeholder="Anything the cleaner should know (pets, code, …)"
              />
            </label>
            {cleaningError ? <p className="form-error">{cleaningError}</p> : null}
            <button className="primary-button" type="submit" disabled={cleaningSubmitting}>
              {cleaningSubmitting ? 'Sending…' : 'Request slot'}
            </button>
          </form>
        </div>
      ) : null}

      {/* Fullscreen so the QR is big and the white background helps the
          scanner — this gets held up at a door, not read at a desk. */}
      {beachClubPassOpen ? (
        <div className="pass-sheet" role="dialog" aria-modal="true" aria-label="Member pass">
          <button className="pass-sheet__close" onClick={() => setBeachClubPassOpen(false)} aria-label="Close pass">
            <X size={22} />
          </button>

          <div className="pass-sheet__code">
            {passUrl ? (
              <QRCodeSVG value={passUrl} size={264} level="M" marginSize={0} />
            ) : (
              <span className="pass-sheet__loading">Loading…</span>
            )}
          </div>

          <div className="pass-sheet__id">
            <strong>{profile?.profile?.fullName ?? profile?.email ?? 'Member'}</strong>
            {home?.apartment?.name ? <span>{home.apartment.name}</span> : null}
          </div>

          <p className="pass-sheet__hint">
            Turn your brightness up and let staff scan this. It shows everything you have access to.
          </p>

          <button className="pass-sheet__reset" onClick={() => void rotatePass()} disabled={passRotating}>
            {passRotating ? 'Resetting…' : 'Lost your phone? Reset pass'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
