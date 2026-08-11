import { ArrowLeft, Check, FileText, Home, Link as LinkIcon, Pencil, Search, Send, ShieldCheck, Users, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { Toast } from '../components/Toast';
import {
  ADMIN_PAGE_TO_TAB,
  INBOX_PAGES,
  INBOX_TABS,
  SETTINGS_PAGES,
  SETTINGS_TABS,
  type PageId,
  type StatusTone,
} from '../data/dashboard';
import { Units } from './Units';
import { apiRequest } from '../lib/api';
import { useEscapeToClose } from '../lib/useModalA11y';

type AdminOverview = {
  metrics: {
    applications: number;
    users: number;
    pendingSetup: number;
    activeMembers: number;
  };
  attention?: {
    pendingApplications: number;
    pendingResidency: number;
    openTickets: number;
    overduePayments: number;
  };
  income: {
    currency: string;
    weekCents: number;
    monthCents: number;
    yearCents: number;
    allTimeCents: number;
    paidPaymentCount: number;
  };
  applications: Array<{
    id: string;
    fullName: string;
    email: string;
    phone?: string | null;
    referralCode?: string | null;
    referredByUserId?: string | null;
    status: string;
    apartmentAvailable?: boolean | null;
    /** When an admin last nudged them to book the intro call, if ever. */
    meetingReminderSentAt?: string | null;
    paymentStatus: string;
    paymentLink?: string | null;
    adminNote?: string | null;
    // What the applicant actually filled in. `note` is the readable summary the
    // form builds (move-in, stay, plan, sizes, socials); `about` and the links
    // are the same answers kept as structured fields.
    note?: string | null;
    about?: string | null;
    socialLinksJson?: string | null;
    createdAt: string;
  }>;
  users: Array<{
    id: string;
    fullName?: string | null;
    email: string;
    referralCode?: string | null;
    role: string;
    membershipStatus?: string | null;
    residencyStatus: string;
    apartment?: string | null;
    mealPlan?: string | null;
    /** YYYY-MM-DD deliveries begin, when the admin set one. */
    mealStartDate?: string | null;
    /** YYYY-MM-DD they said they're arriving, from their apply form. */
    moveInDate?: string | null;
    cleaningPlan?: string | null;
    mustChangePassword: boolean;
    createdAt: string;
  }>;
};

type DesignationUser = AdminOverview['users'][number];
type DesignationFilterId = 'all' | 'incomplete' | 'new' | 'members';
type Applicant = AdminOverview['applications'][number];
type ApplicantAction = { key: string; label: string; icon: ReactNode; tone?: 'ghost' | 'danger'; hint?: string; run: () => void };
type AdminTab = 'overview' | 'applicants' | 'residency' | 'designations' | 'maintenance' | 'support' | 'payments' | 'notifications' | 'resources' | 'events' | 'vehicles' | 'units' | 'settings';

type AdminVehicle = {
  id: string;
  name: string;
  description?: string | null;
  active: boolean;
  photoFileName?: string | null;
  _count?: { bookings: number };
};
type AdminVehicleBooking = {
  id: string;
  vehicleId: string;
  startDate: string;
  endDate: string;
  status: string;
  renterName: string;
  renterEmail: string;
  vehicle: { id: string; name: string };
};

type AdminResource = { id: string; title: string; slug: string; category: string; body: string; published: boolean; order: number };
type AdminMaintenance = {
  id: string;
  category: string;
  title: string;
  description: string;
  status: string;
  adminNote?: string | null;
  createdAt: string;
  requesterName: string;
  requesterEmail: string;
  hasPhoto: boolean;
};

type AdminSupportTicket = {
  id: string;
  userId: string;
  email: string;
  fullName: string | null;
  subject: string;
  message: string;
  /** The opening message plus every reply, oldest first. */
  messages: Array<{ id: string; author: string; body: string; createdAt: string }>;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  /** Internal — the member never sees this. Replies are messages. */
  adminNote?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
};

type AdminPayment = {
  id: string;
  userId: string;
  email: string;
  fullName: string | null;
  amountCents: number;
  currency: string;
  status: 'DUE' | 'OVERDUE' | 'PAID' | 'CANCELLED';
  dueDate: string;
  paidAt?: string | null;
  description: string;
  receiptUrl?: string | null;
  adminNote?: string | null;
};

type AdminEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  capacity: number | null;
  published: boolean;
  goingCount: number;
  maybeCount: number;
  declinedCount: number;
  attendees: Array<{ name: string; email: string; status: string }>;
};

type AdminNotificationLog = {
  id: string;
  recipient: string;
  recipientEmail: string;
  type: 'info' | 'success' | 'warning';
  title: string;
  body?: string | null;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
};

type ResidencyReview = {
  userId: string;
  email: string;
  fullName?: string | null;
  status: string;
  proofFileName?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
};

type AdminUserDetail = {
  id: string;
  email: string;
  referralCode?: string | null;
  role: string;
  mustChangePassword: boolean;
  emailVerifiedAt?: string | null;
  createdAt: string;
  profile?: {
    fullName?: string | null;
    phone?: string | null;
    location?: string | null;
    avatarUrl?: string | null;
  } | null;
  membership?: {
    status: string;
    startingDate?: string | null;
    dueDate?: string | null;
    finishDate?: string | null;
  } | null;
  residencyApplication?: {
    status: string;
    stage: string;
    continueUrl?: string | null;
    requiredNextSteps?: string[];
    lastSyncedAt?: string | null;
    lastError?: string | null;
  } | null;
  subscriptionPlan?: {
    planName: string;
    status: string;
    renewalDate?: string | null;
    paymentUrl?: string | null;
  } | null;
  communityPlans: Array<{
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
  assignedApartment?: {
    moveInDate?: string | null;
    moveOutDate?: string | null;
    notes?: string | null;
    apartment: {
      name: string;
      description: string;
      availability: string;
    };
  } | null;
  meals: Array<{ id: string; day: string; meal: string; source: string }>;
  cleaningSchedules: Array<{ id: string; frequency?: string | null; nextCleaning?: string | null; notes?: string | null; source: string }>;
  payments: Array<{ id: string; amountCents: number; currency: string; status: string; dueDate: string; paidAt?: string | null; description: string }>;
  supportTickets: Array<{ id: string; subject: string; message: string; status: string; createdAt: string }>;
  summary: {
    paidTotalCents: number;
    openPayments: number;
    supportTickets: number;
  };
};

type MealOption = {
  id: string;
  name: string;
  description: string | null;
  weeklyPriceCents: number | null;
  mealsPerWeek: number | null;
  mealsPerDay?: number | null;
  daysPerWeek?: number | null;
  mealsLabel?: string | null;
  deliveryInfo: string | null;
  location: string | null;
  imageUrl: string | null;
};

type CleaningOption = {
  id: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  pricePerCleaningCents: number | null;
  monthlyPriceCents: number | null;
  cleaningsPerMonth: number | null;
  serviceFrequency: string | null;
  apartmentType: string | null;
};

type ApartmentOption = {
  id: string;
  name: string;
};

type GlobalSettings = {
  mealPlan: MealOption | null;
  mealOptions: MealOption[];
  cleaningPlan: CleaningOption | null;
  cleaningOptions: CleaningOption[];
  apartmentOptions: ApartmentOption[];
  batch: { startDate: string | null; label: string | null };
};

type AdminDashboardProps = {
  currentUserRole: string | null;
  setActivePage: (page: PageId) => void;
  /**
   * Which admin sub-page to render. The sidebar is the source of truth for
   * navigation now — each admin sub-page has its own URL (see ADMIN_PAGE_TO_TAB
   * in data/dashboard.ts). Defaults to overview when not supplied.
   */
  adminPage?: PageId;
};

type FunnelStage = {
  key: string;
  label: string;
  detail: string;
  count: number;
  waiting: number;
};

function toneForStatus(status: string): StatusTone {
  if (status === 'ACTIVE_MEMBER' || status === 'APPROVED' || status === 'PAYMENT_CONFIRMED' || status === 'CREDENTIALS_SENT') return 'good';
  if (status === 'SUBMITTED' || status === 'IN_PROGRESS' || status === 'PAYMENT_LINK_SENT' || status === 'PENDING') return 'attention';
  if (status.includes('REJECTED') || status === 'NO_APARTMENT_AVAILABLE') return 'danger';
  return 'neutral';
}

function nextStepFor(status: string, apartmentAvailable?: boolean | null, paymentStatus?: string) {
  if (status === 'SUBMITTED') return 'Check apartment + first approval';
  if (status === 'FIRST_APPROVED') return 'Online meeting check';
  if (status === 'MEETING_APPROVED' && !apartmentAvailable) return 'Confirm apartment availability';
  if ((status === 'MEETING_APPROVED' || status === 'APARTMENT_AVAILABLE') && paymentStatus !== 'PENDING' && paymentStatus !== 'SUCCESS') return 'Send payment link';
  if (status === 'PAYMENT_LINK_SENT') return 'Confirm payment';
  if (status === 'PAYMENT_CONFIRMED') return 'Activate membership';
  if (status === 'CREDENTIALS_SENT') return 'Onboarded — member is active';
  if (status.includes('REJECTED')) return 'Send waitlist/rejection message';
  if (status === 'NO_APARTMENT_AVAILABLE') return 'Propose new apartment date';
  return 'Review';
}

// Ordered pipeline shown as a per-applicant progress stepper.
// No "Password" step. The applicant creates their own account and picks their
// own password on the way in, during apply — it was left over from when an
// admin mailed out credentials at the end, and it showed every applicant a
// sixth hurdle that nobody has had to clear in a long time.
const APPLICANT_STAGES = ['Apply', 'First check', 'Meeting', 'Apartment', 'Payment'];

// Kanban columns for the pipeline board, keyed by the applicant's current stage.
const PIPELINE_COLUMNS: { stage: number; title: string }[] = [
  { stage: 1, title: 'First check' },
  { stage: 2, title: 'Meeting' },
  { stage: 3, title: 'Apartment' },
  { stage: 4, title: 'Payment' },
  { stage: 5, title: 'Onboarded' },
  { stage: -1, title: 'Rejected' },
];

function pipelineStage(status: string, apartmentAvailable?: boolean | null): number {
  const index = applicantStageIndex(status, apartmentAvailable);
  return index < 0 ? -1 : Math.min(index, 5);
}

type ApplicantBucket = 'action' | 'onboarded' | 'rejected';
type ApplicantFilterId = 'all' | ApplicantBucket;
const APPLICANTS_PER_PAGE = 8;
const NOTIFICATIONS_PER_PAGE = 10;

// Index of the stage the applicant is currently AT (stages before it are done).
// 5 = fully onboarded, -1 = rejected.
//
// This has to agree with TERMINAL_APPLICATION_STATUSES on the server — the
// sidebar badge counts with the server's list and these chips count with this
// one, so any disagreement shows up as a badge that contradicts the filters.
function applicantStageIndex(status: string, apartmentAvailable?: boolean | null): number {
  switch (status) {
    case 'SUBMITTED':
      return 1;
    case 'FIRST_APPROVED':
      return 2;
    case 'MEETING_APPROVED':
      return apartmentAvailable ? 4 : 3;
    case 'APARTMENT_AVAILABLE':
    case 'PAYMENT_LINK_SENT':
      return 4;
    // Still sitting on the Apartment step, waiting for an admin to propose a new
    // date. It used to be bucketed as rejected, which hid a live task under a
    // filter nobody checks.
    case 'NO_APARTMENT_AVAILABLE':
      return 3;
    // Paid, but an admin still has to click "Complete onboarding" — so they stay
    // on the Payment step rather than moving to a step of their own. Keeping
    // them here is what keeps them under "Action needed" instead of quietly
    // counting as onboarded before anyone finished them.
    case 'PAYMENT_CONFIRMED':
      return 4;
    // Both ends of the pipeline: the current one, and the legacy direct approval.
    case 'CREDENTIALS_SENT':
    case 'APPROVED':
      return 5;
    default:
      return status.includes('REJECTED') ? -1 : 1;
  }
}

/**
 * The applicant's own answers, ready to render.
 *
 * The form flattens most of itself into `note` as "Label: value" lines — it was
 * built for a human to skim, not to parse — so that's read back line by line
 * rather than guessing at fields. `about` and the socials are separate columns
 * and are appended; when both exist the note's copy is dropped so the long
 * answer isn't shown twice.
 */
function parseApplicationAnswers(app: {
  note?: string | null;
  about?: string | null;
  socialLinksJson?: string | null;
  phone?: string | null;
}): Array<{ label: string; value: string; isLink?: boolean }> {
  const out: Array<{ label: string; value: string; isLink?: boolean }> = [];
  if (app.phone) out.push({ label: 'Phone', value: app.phone });

  const noteLines = (app.note ?? '').split('\n');
  const freeText: string[] = [];
  let inAbout = false;
  for (const rawLine of noteLines) {
    const line = rawLine.trim();
    if (!line) continue;
    const split = line.indexOf(':');
    const label = split > 0 ? line.slice(0, split).trim() : '';

    // "About:" is the last thing the form writes and everything after it is the
    // applicant's prose. It has to end the label parsing rather than skip one
    // line: those paragraphs contain URLs, and splitting them on the colon in
    // "https://" turns a sentence into a nonsense label/value pair.
    if (!inAbout && label.toLowerCase() === 'about') {
      inAbout = true;
      continue;
    }
    if (inAbout) {
      freeText.push(line);
      continue;
    }
    if (split > 0) out.push({ label, value: line.slice(split + 1).trim() });
    else freeText.push(line);
  }

  try {
    const links = JSON.parse(app.socialLinksJson ?? '{}') as Record<string, string>;
    for (const [key, url] of Object.entries(links)) {
      if (url) out.push({ label: key.charAt(0).toUpperCase() + key.slice(1), value: url, isLink: true });
    }
  } catch {
    /* malformed JSON shouldn't blank the whole panel */
  }

  // Prefer the structured column; older applications only have it inside `note`.
  const about = app.about?.trim() || freeText.join('\n');
  if (about) out.push({ label: 'About', value: about });
  return out;
}

/**
 * What the applicant actually wrote, collapsed behind a toggle.
 *
 * Shared by the list and the board: deciding on someone off a name and an email
 * is just as bad in a kanban column as it is in a row, and the board is where
 * the first check — the one that reads the application — is made.
 */
function ApplicantAnswers({
  application,
  open,
  onToggle,
}: {
  application: Parameters<typeof parseApplicationAnswers>[0];
  open: boolean;
  onToggle: () => void;
}) {
  const answers = parseApplicationAnswers(application);
  if (answers.length === 0) return null;

  return (
    <div className="applicant-answers">
      <button className="applicant-answers__toggle" onClick={onToggle} aria-expanded={open}>
        <FileText size={14} />
        {open ? 'Hide application' : 'View application'}
      </button>
      {open ? (
        <dl className="applicant-answers__list">
          {answers.map(({ label, value, isLink }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                {isLink ? (
                  <a href={value} target="_blank" rel="noopener noreferrer">
                    {value}
                  </a>
                ) : (
                  value
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

function applicantBucket(status: string, apartmentAvailable?: boolean | null): ApplicantBucket {
  const index = applicantStageIndex(status, apartmentAvailable);
  if (index < 0) return 'rejected';
  if (index >= APPLICANT_STAGES.length) return 'onboarded';
  return 'action';
}

const firstCheckPassed = new Set([
  'FIRST_APPROVED',
  'MEETING_APPROVED',
  'APARTMENT_AVAILABLE',
  'PAYMENT_LINK_SENT',
  'PAYMENT_CONFIRMED',
  'CREDENTIALS_SENT',
]);

const secondCheckPassed = new Set([
  'MEETING_APPROVED',
  'APARTMENT_AVAILABLE',
  'PAYMENT_LINK_SENT',
  'PAYMENT_CONFIRMED',
  'CREDENTIALS_SENT',
]);

const approvedStatuses = new Set(['PAYMENT_CONFIRMED', 'CREDENTIALS_SENT']);
const roleOptions = ['MEMBER', 'SUPER_ADMIN', 'MODERATOR', 'COMMUNITY_LEADER'];

/** A membership tier as the admin edits it. Prices are held as cents. */
type MembershipPlan = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  shortStayPriceCents: number;
  currency: string;
  occupancy: number;
  active: boolean;
  order: number;
};

/** The editable copy of a plan — money as typed, converted on save. */
type PlanDraft = { name: string; description: string; price: string; shortStayPrice: string; occupancy: string; active: boolean };

/** Whole dollars — these are prices, not invoice totals. */
function planMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100);
}

function draftFrom(plan: MembershipPlan): PlanDraft {
  return {
    name: plan.name,
    description: plan.description ?? '',
    price: (plan.priceCents / 100).toString(),
    shortStayPrice: (plan.shortStayPriceCents / 100).toString(),
    occupancy: String(plan.occupancy),
    active: plan.active,
  };
}

/**
 * One member's unsaved designation form.
 *
 * `mealStartDate` is the day deliveries begin — a plan is usually assigned well
 * before the member lands, so it's asked for separately rather than inferred
 * from when the admin pressed save. Empty means "start now".
 */
type DesignationDraft = { apartmentName: string; mealPlan: string; mealStartDate: string; cleaningPlan: string };

/**
 * "from 3 February" while the first delivery is still ahead, nothing once it has
 * passed — a date that's already gone tells you nothing the plan name doesn't,
 * and the row is easier to scan without it.
 */
function mealStartLabel(iso: string): string | null {
  const starts = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(starts.getTime()) || starts <= new Date()) return null;
  return `from ${starts.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' })}`;
}
const emptyDesignationDraft: DesignationDraft = { apartmentName: '', mealPlan: '', mealStartDate: '', cleaningPlan: '' };

function roleLabel(role: string) {
  return role.split('_').join(' ');
}

const NEW_USER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function isNewUser(createdAt: string): boolean {
  const created = new Date(createdAt).getTime();
  return Number.isFinite(created) && Date.now() - created <= NEW_USER_WINDOW_MS;
}

function joinedLabel(createdAt: string): string {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return '';
  return `Joined ${created.toLocaleDateString()}`;
}

function isDesignationComplete(user: DesignationUser): boolean {
  return Boolean(user.apartment && user.mealPlan && user.cleaningPlan);
}

// Build a <select> option list from catalog names, keeping any pre-existing
// custom value selectable so older free-text designations still show.
function optionNames(catalog: string[], current: string): string[] {
  const names = [...catalog];
  if (current && !names.includes(current)) {
    names.unshift(current);
  }
  return names;
}

function formatMoney(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function buildFunnel(overview: AdminOverview | null): FunnelStage[] {
  const applications = overview?.applications ?? [];
  const users = overview?.users ?? [];

  return [
    {
      key: 'apply',
      label: 'Apply',
      detail: 'Form submitted',
      count: applications.length,
      waiting: applications.filter((application) => application.status === 'SUBMITTED').length,
    },
    {
      key: 'first',
      label: 'First Check',
      detail: 'Admin review',
      count: applications.filter((application) => firstCheckPassed.has(application.status)).length,
      waiting: applications.filter((application) => application.status === 'SUBMITTED').length,
    },
    {
      key: 'second',
      label: 'Second Check',
      detail: 'Online meeting',
      count: applications.filter((application) => secondCheckPassed.has(application.status)).length,
      waiting: applications.filter((application) => application.status === 'FIRST_APPROVED').length,
    },
    {
      key: 'approve',
      label: 'Approve',
      detail: 'Payment confirmed',
      count: applications.filter((application) => approvedStatuses.has(application.status) || application.paymentStatus === 'SUCCESS').length,
      waiting: applications.filter((application) => application.status === 'PAYMENT_LINK_SENT' || application.paymentStatus === 'PENDING').length,
    },
    {
      key: 'residency',
      label: 'Approve Residency',
      detail: 'E-Residency approved',
      count: users.filter((user) => user.residencyStatus === 'APPROVED').length,
      waiting: users.filter((user) => user.residencyStatus === 'IN_PROGRESS' || user.residencyStatus === 'PENDING_REVIEW').length,
    },
  ];
}

function percentOfTotal(count: number, total: number) {
  if (total === 0) return '0%';
  return `${Math.round((count / total) * 100)}%`;
}

function dropOffFromPrevious(stage: FunnelStage, previous?: FunnelStage) {
  if (!previous || previous.count === 0) return '0%';
  return `${Math.max(0, Math.round(((previous.count - stage.count) / previous.count) * 100))}%`;
}

export function AdminDashboard({ currentUserRole, setActivePage, adminPage }: AdminDashboardProps) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [isUserDetailLoading, setIsUserDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Stable, because Toast keys its auto-dismiss timer off this identity — a
  // fresh closure every render would restart the countdown and the toast would
  // never fade.
  const dismissNotice = useCallback(() => setNotice(null), []);
  // Which section is on screen — sourced from the URL / sidebar via `adminPage`.
  const adminTab = (ADMIN_PAGE_TO_TAB[adminPage ?? 'adminDashboard'] ?? 'overview') as AdminTab;
  const [applicantView, setApplicantView] = useState<'list' | 'board'>('board');
  // One open at a time — several long answers expanded at once turns the queue
  // into a wall of prose you have to scroll past.
  const [expandedApplicantId, setExpandedApplicantId] = useState<string | null>(null);
  const [selectedApplicantIds, setSelectedApplicantIds] = useState<Set<string>>(new Set());
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const [maintenance, setMaintenance] = useState<AdminMaintenance[]>([]);
  const [maintenanceFilter, setMaintenanceFilter] = useState<'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'ALL'>('OPEN');
  const [maintenanceSearch, setMaintenanceSearch] = useState('');
  const [residencySearch, setResidencySearch] = useState('');
  const [residencyFilter, setResidencyFilter] = useState<'PENDING_REVIEW' | 'VERIFIED' | 'REJECTED' | 'ALL'>('PENDING_REVIEW');
  const [vehiclesSearch, setVehiclesSearch] = useState('');
  const [resourcesSearch, setResourcesSearch] = useState('');
  const [resourcesFilter, setResourcesFilter] = useState<string>('ALL');
  const [supportTickets, setSupportTickets] = useState<AdminSupportTicket[]>([]);
  const [supportFilter, setSupportFilter] = useState<'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'ALL'>('OPEN');
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [paymentsFilter, setPaymentsFilter] = useState<'OVERDUE' | 'DUE' | 'PAID' | 'ALL'>('OVERDUE');
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [eventForm, setEventForm] = useState<{
    id?: string;
    title: string;
    description: string;
    location: string;
    startsAt: string;
    endsAt: string;
    capacity: string;
    published: boolean;
  } | null>(null);
  useEscapeToClose(Boolean(eventForm), () => setEventForm(null));
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [notifRecent, setNotifRecent] = useState<AdminNotificationLog[]>([]);
  const [notifTotal, setNotifTotal] = useState(0);
  const [notifPage, setNotifPage] = useState(0);
  const [notifForm, setNotifForm] = useState<{
    audience: 'member' | 'all-members';
    userId: string;
    type: 'info' | 'success' | 'warning';
    title: string;
    message: string;
    link: string;
  }>({ audience: 'all-members', userId: '', type: 'info', title: '', message: '', link: '' });
  const [notifSending, setNotifSending] = useState(false);
  const [notifSentMsg, setNotifSentMsg] = useState<string | null>(null);
  const [invoiceForm, setInvoiceForm] = useState<{ userId: string; amountCents: string; description: string; dueDate: string; payUrl: string } | null>(null);
  useEscapeToClose(Boolean(invoiceForm), () => setInvoiceForm(null));
  const [resources, setResources] = useState<AdminResource[]>([]);
  const [resourceForm, setResourceForm] = useState<{ id?: string; title: string; category: string; body: string; published: boolean } | null>(null);
  useEscapeToClose(Boolean(resourceForm), () => setResourceForm(null));
  const [vehicles, setVehicles] = useState<AdminVehicle[]>([]);
  const [vehicleBookings, setVehicleBookings] = useState<AdminVehicleBooking[]>([]);
  const [vehicleForm, setVehicleForm] = useState<{ id?: string; name: string; description: string; active: boolean; photoBase64?: string; photoFileName?: string; photoFileType?: string } | null>(null);
  useEscapeToClose(Boolean(vehicleForm), () => setVehicleForm(null));
  const [residencyReviews, setResidencyReviews] = useState<ResidencyReview[]>([]);
  const [residencyRejectDrafts, setResidencyRejectDrafts] = useState<Record<string, string>>({});
  const [proofView, setProofView] = useState<{ review: ResidencyReview; src: string; fileType: string; fileName: string } | null>(null);
  useEscapeToClose(Boolean(proofView), () => setProofView(null));
  const [applicantSearch, setApplicantSearch] = useState('');
  const [applicantFilter, setApplicantFilter] = useState<ApplicantFilterId>('action');
  const [applicantPage, setApplicantPage] = useState(0);
  const [designationDrafts, setDesignationDrafts] = useState<Record<string, DesignationDraft>>({});
  // One row open at a time. Two half-edited rows on screen is two chances to
  // save the wrong person's apartment.
  const [editingDesignationId, setEditingDesignationId] = useState<string | null>(null);
  const [designationSearch, setDesignationSearch] = useState('');
  const [designationFilter, setDesignationFilter] = useState<DesignationFilterId>('all');
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlan[]>([]);
  const [planDrafts, setPlanDrafts] = useState<Record<string, PlanDraft>>({});
  const [newPlan, setNewPlan] = useState<PlanDraft | null>(null);
  // Read by default: a price is something you check far more often than you
  // change, and four open inputs per plan made every row look like a task.
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [globalMealPlanId, setGlobalMealPlanId] = useState<string>('');
  const [customMealName, setCustomMealName] = useState('');
  const [customMealPrice, setCustomMealPrice] = useState('');
  const [customMealMeals, setCustomMealMeals] = useState('');
  const [globalCleaningPlanId, setGlobalCleaningPlanId] = useState<string>('');
  const [batchStartDate, setBatchStartDate] = useState('');
  const [batchLabel, setBatchLabel] = useState('');
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);
  const [isSavingGlobal, setIsSavingGlobal] = useState(false);
  const [isSavingGlobalCleaning, setIsSavingGlobalCleaning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const canManageRoles = currentUserRole === 'SUPER_ADMIN';

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    apiRequest<AdminOverview>('/admin/overview')
      .then((data) => {
        if (isMounted) {
          setOverview(data);
          setDesignationDrafts((current) => {
            const next = { ...current };
            data.users.forEach((user) => {
              next[user.id] ??= {
                apartmentName: user.apartment ?? '',
                mealPlan: user.mealPlan ?? '',
                // Falls back to the arrival date they gave on the apply form —
                // that IS when deliveries should start, so an admin shouldn't
                // have to copy it across from the application by hand.
                mealStartDate: user.mealStartDate ?? user.moveInDate ?? '',
                cleaningPlan: user.cleaningPlan ?? '',
              };
            });
            return next;
          });
        }
      })
      .catch((caught) => {
        if (isMounted) setError(caught instanceof Error ? caught.message : 'Could not load admin data.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    apiRequest<GlobalSettings>('/admin/settings/global')
      .then((data) => {
        if (isMounted) {
          applyGlobalSettings(data);
        }
      })
      .catch(() => {
        /* non-fatal: global settings panel just stays empty */
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    apiRequest<ResidencyReview[]>('/admin/residency-reviews')
      .then((data) => {
        if (isMounted) setResidencyReviews(data);
      })
      .catch(() => {
        /* non-fatal */
      });
    return () => {
      isMounted = false;
    };
  }, []);

  async function reviewResidency(userId: string, decision: 'VERIFIED' | 'REJECTED') {
    setError(null);
    setNotice(null);
    try {
      const note = decision === 'REJECTED' ? residencyRejectDrafts[userId]?.trim() : undefined;
      const data = await apiRequest<ResidencyReview[]>(`/admin/users/${userId}/residency/review`, {
        method: 'POST',
        body: JSON.stringify({ decision, note }),
      });
      setResidencyReviews(data);
      setNotice(decision === 'VERIFIED' ? 'E-Residency verified.' : 'E-Residency sent back for changes.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update E-Residency review.');
    }
  }

  async function viewResidencyProof(review: ResidencyReview) {
    setError(null);
    try {
      const proof = await apiRequest<{ fileName: string; fileType: string; dataBase64: string }>(`/users/${review.userId}/residency/proof`);
      const src = proof.dataBase64.startsWith('data:')
        ? proof.dataBase64
        : `data:${proof.fileType};base64,${proof.dataBase64}`;
      setProofView({ review, src, fileType: proof.fileType, fileName: proof.fileName });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load proof file.');
    }
  }

  const residencyPendingCount = residencyReviews.filter((r) => r.status === 'PENDING_REVIEW').length;

  useEffect(() => {
    setApplicantPage(0);
  }, [applicantFilter, applicantSearch]);

  /**
   * Seven stages don't fit across the pane, so the board scrolls. Land it on the
   * first column that actually has someone in it — otherwise a pipeline whose
   * work sits in a later stage opens on a row of empty boxes and reads as if
   * there are no applicants at all.
   */
  const pipelineBoardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const board = pipelineBoardRef.current;
    if (!board) return;
    const firstFilled = board.querySelector('.pipeline-col:has(.pipeline-card)');
    if (firstFilled instanceof HTMLElement) {
      board.scrollLeft = Math.max(0, firstFilled.offsetLeft - board.offsetLeft - 8);
    }
  }, [applicantView, overview]);

  const metrics = [
    { label: 'Applications', value: overview?.metrics.applications ?? 0, tone: 'neutral' as StatusTone },
    { label: 'Users', value: overview?.metrics.users ?? 0, tone: 'good' as StatusTone },
    { label: 'Pending setup', value: overview?.metrics.pendingSetup ?? 0, tone: 'attention' as StatusTone },
    { label: 'Active members', value: overview?.metrics.activeMembers ?? 0, tone: 'good' as StatusTone },
  ];
  const incomeCards = [
    {
      label: 'This week',
      value: formatMoney(overview?.income.weekCents ?? 0, overview?.income.currency),
      detail: 'Paid dues and payments',
    },
    {
      label: 'This month',
      value: formatMoney(overview?.income.monthCents ?? 0, overview?.income.currency),
      detail: 'Calendar month income',
    },
    {
      label: 'This year',
      value: formatMoney(overview?.income.yearCents ?? 0, overview?.income.currency),
      detail: `${overview?.income.paidPaymentCount ?? 0} paid records`,
    },
  ];
  const funnel = buildFunnel(overview);
  const totalApplications = funnel[0]?.count ?? 0;
  const approvedMembers = funnel[3]?.count ?? 0;
  const conversion = percentOfTotal(approvedMembers, totalApplications);

  const applicantFilters: Array<{ id: ApplicantFilterId; label: string; matches: (app: Applicant) => boolean }> = [
    { id: 'action', label: 'Action needed', matches: (app) => applicantBucket(app.status, app.apartmentAvailable) === 'action' },
    { id: 'onboarded', label: 'Onboarded', matches: (app) => applicantBucket(app.status, app.apartmentAvailable) === 'onboarded' },
    { id: 'rejected', label: 'Rejected', matches: (app) => applicantBucket(app.status, app.apartmentAvailable) === 'rejected' },
    { id: 'all', label: 'All', matches: () => true },
  ];
  const allApplicants = overview?.applications ?? [];
  const applicantQuery = applicantSearch.trim().toLowerCase();
  const activeApplicantFilter = applicantFilters.find((filter) => filter.id === applicantFilter) ?? applicantFilters[0];
  const searchedApplicants = allApplicants.filter(
    (app) =>
      !applicantQuery ||
      (app.fullName ?? '').toLowerCase().includes(applicantQuery) ||
      app.email.toLowerCase().includes(applicantQuery),
  );
  /**
   * The board draws one column per pipeline stage, so applying the bucket chips
   * on top of it was filtering a view that already partitions by the same thing:
   * pick "Action needed" and the Onboarded column could only ever read 0, while
   * the chip beside it said 3. The chips belong to the list.
   */
  const filteredApplicants =
    applicantView === 'board' ? searchedApplicants : searchedApplicants.filter(activeApplicantFilter.matches);
  const applicantPageCount = Math.max(1, Math.ceil(filteredApplicants.length / APPLICANTS_PER_PAGE));
  // From the server's total, not the page we're holding — the last page is
  // usually short, and counting from it would say "page 1 of 1" every time.
  const notifPageCount = Math.max(1, Math.ceil(notifTotal / NOTIFICATIONS_PER_PAGE));
  const safeApplicantPage = Math.min(applicantPage, applicantPageCount - 1);
  const pagedApplicants = filteredApplicants.slice(
    safeApplicantPage * APPLICANTS_PER_PAGE,
    safeApplicantPage * APPLICANTS_PER_PAGE + APPLICANTS_PER_PAGE,
  );
  const applicantCountFor = (id: ApplicantFilterId) => {
    const filter = applicantFilters.find((item) => item.id === id);
    return filter ? allApplicants.filter(filter.matches).length : 0;
  };

  const designationFilters: Array<{ id: DesignationFilterId; label: string; matches: (user: DesignationUser) => boolean }> = [
    { id: 'all', label: 'All', matches: () => true },
    { id: 'incomplete', label: 'Needs assignment', matches: (user) => !isDesignationComplete(user) },
    { id: 'new', label: 'New', matches: (user) => isNewUser(user.createdAt) },
    { id: 'members', label: 'Active members', matches: (user) => user.membershipStatus === 'ACTIVE_MEMBER' },
  ];
  const allDesignationUsers = overview?.users ?? [];
  const designationQuery = designationSearch.trim().toLowerCase();
  const activeDesignationFilter = designationFilters.find((filter) => filter.id === designationFilter) ?? designationFilters[0];
  const designationUsers = allDesignationUsers
    .filter(activeDesignationFilter.matches)
    .filter(
      (user) =>
        !designationQuery ||
        (user.fullName ?? '').toLowerCase().includes(designationQuery) ||
        user.email.toLowerCase().includes(designationQuery),
    )
    .slice()
    .sort((a, b) => {
      // Most actionable first: users still needing assignment, then newest joined.
      const completeDiff = (isDesignationComplete(a) ? 1 : 0) - (isDesignationComplete(b) ? 1 : 0);
      if (completeDiff !== 0) return completeDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  const designationCountFor = (id: DesignationFilterId) => {
    const filter = designationFilters.find((item) => item.id === id);
    return filter ? allDesignationUsers.filter(filter.matches).length : 0;
  };

  async function refreshOverview() {
    const data = await apiRequest<AdminOverview>('/admin/overview');
    setOverview(data);
    setDesignationDrafts((current) => {
      const next = { ...current };
      data.users.forEach((user) => {
        next[user.id] = {
          apartmentName: current[user.id]?.apartmentName ?? user.apartment ?? '',
          mealPlan: current[user.id]?.mealPlan ?? user.mealPlan ?? '',
          mealStartDate: current[user.id]?.mealStartDate ?? user.mealStartDate ?? user.moveInDate ?? '',
          cleaningPlan: current[user.id]?.cleaningPlan ?? user.cleaningPlan ?? '',
        };
      });
      return next;
    });
  }

  async function loadMaintenance() {
    try {
      setMaintenance(await apiRequest<AdminMaintenance[]>('/admin/maintenance'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load maintenance.');
    }
  }

  async function loadSupport() {
    try {
      const qs = supportFilter === 'ALL' ? '' : `?status=${supportFilter}`;
      setSupportTickets(await apiRequest<AdminSupportTicket[]>(`/admin/support-tickets${qs}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load support tickets.');
    }
  }

  async function updateSupportTicket(id: string, body: { status?: string; adminNote?: string }) {
    try {
      setSupportTickets(await apiRequest<AdminSupportTicket[]>(`/admin/support-tickets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update ticket.');
    }
  }

  async function loadPayments() {
    try {
      const qs = paymentsFilter === 'ALL' ? '' : `?status=${paymentsFilter}`;
      setPayments(await apiRequest<AdminPayment[]>(`/admin/payments${qs}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load payments.');
    }
  }

  async function replyToTicket(id: string, message: string) {
    setError(null);
    try {
      setSupportTickets(await apiRequest<AdminSupportTicket[]>(`/admin/support-tickets/${id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      }));
      setNotice('Reply sent to the member.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not send the reply.');
    }
  }

  async function updatePayment(id: string, body: { status?: string; adminNote?: string }) {
    try {
      setPayments(await apiRequest<AdminPayment[]>(`/admin/payments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update payment.');
    }
  }

  async function submitInvoice() {
    if (!invoiceForm) return;
    try {
      setPayments(await apiRequest<AdminPayment[]>('/admin/payments', {
        method: 'POST',
        body: JSON.stringify({
          userId: invoiceForm.userId,
          amountCents: Math.round(Number(invoiceForm.amountCents) * 100),
          description: invoiceForm.description,
          dueDate: invoiceForm.dueDate,
          payUrl: invoiceForm.payUrl,
        }),
      }));
      setInvoiceForm(null);
      setNotice('Invoice created.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create invoice.');
    }
  }

  async function loadEvents() {
    try {
      setEvents(await apiRequest<AdminEvent[]>('/admin/events'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load events.');
    }
  }

  /** `datetime-local` needs a local "YYYY-MM-DDTHH:mm", not an ISO/UTC string. */
  function toLocalInput(iso: string | null): string {
    if (!iso) return '';
    const date = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  async function submitEvent() {
    if (!eventForm) return;
    const body = {
      title: eventForm.title,
      description: eventForm.description,
      location: eventForm.location,
      // The value is local wall-clock; toISOString applies the browser offset.
      startsAt: eventForm.startsAt ? new Date(eventForm.startsAt).toISOString() : undefined,
      endsAt: eventForm.endsAt ? new Date(eventForm.endsAt).toISOString() : null,
      capacity: eventForm.capacity === '' ? null : Number(eventForm.capacity),
      published: eventForm.published,
    };
    try {
      const updated = eventForm.id
        ? await apiRequest<AdminEvent[]>(`/admin/events/${eventForm.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : await apiRequest<AdminEvent[]>('/admin/events', { method: 'POST', body: JSON.stringify(body) });
      setEvents(updated);
      setEventForm(null);
      setNotice(eventForm.id ? 'Event updated.' : 'Event created.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the event.');
    }
  }

  async function deleteEvent(id: string) {
    if (!window.confirm('Delete this event? RSVPs are removed with it.')) return;
    try {
      setEvents(await apiRequest<AdminEvent[]>(`/admin/events/${id}`, { method: 'DELETE' }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete the event.');
    }
  }

  async function loadNotifications(page = notifPage) {
    try {
      // Server-side: the log only grows, so paging in the browser over a fixed
      // "last 40" would have left everything older permanently unreachable.
      const data = await apiRequest<{ items: AdminNotificationLog[]; total: number }>(
        `/admin/notifications?limit=${NOTIFICATIONS_PER_PAGE}&offset=${page * NOTIFICATIONS_PER_PAGE}`,
      );
      setNotifRecent(data.items);
      setNotifTotal(data.total);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load notifications.');
    }
  }

  async function sendNotification() {
    setNotifSending(true);
    setNotifSentMsg(null);
    setError(null);
    try {
      const result = await apiRequest<{ audience: string; sent: number }>('/admin/notifications', {
        method: 'POST',
        body: JSON.stringify(notifForm),
      });
      setNotifSentMsg(`Sent to ${result.sent} recipient${result.sent === 1 ? '' : 's'}.`);
      setNotifForm((f) => ({ ...f, title: '', message: '', link: '' }));
      // Back to the first page: what you just sent is the newest row, and
      // refreshing page 4 in place would leave you looking for it.
      setNotifPage(0);
      await loadNotifications(0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not send notification.');
    } finally {
      setNotifSending(false);
    }
  }

  async function reorderResource(id: string, direction: 'up' | 'down') {
    try {
      setResources(await apiRequest<AdminResource[]>(`/admin/resources/${id}/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ direction }),
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not reorder.');
    }
  }

  async function loadResources() {
    try {
      setResources(await apiRequest<AdminResource[]>('/admin/resources'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load resources.');
    }
  }

  async function loadVehicles() {
    try {
      const [vs, bs] = await Promise.all([
        apiRequest<AdminVehicle[]>('/admin/vehicles'),
        apiRequest<AdminVehicleBooking[]>('/admin/vehicle-bookings'),
      ]);
      setVehicles(vs);
      setVehicleBookings(bs);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load vehicles.');
    }
  }

  async function saveVehicle() {
    if (!vehicleForm) return;
    setError(null);
    try {
      const path = vehicleForm.id ? `/admin/vehicles/${vehicleForm.id}` : '/admin/vehicles';
      await apiRequest(path, {
        method: vehicleForm.id ? 'PATCH' : 'POST',
        body: JSON.stringify({
          name: vehicleForm.name,
          description: vehicleForm.description,
          active: vehicleForm.active,
          ...(vehicleForm.photoBase64
            ? { photoBase64: vehicleForm.photoBase64, photoFileName: vehicleForm.photoFileName, photoFileType: vehicleForm.photoFileType }
            : {}),
        }),
      });
      setVehicleForm(null);
      await loadVehicles();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the vehicle.');
    }
  }

  async function deleteVehicle(id: string) {
    if (!confirm('Delete this vehicle? Its bookings will be removed too.')) return;
    setError(null);
    try {
      await apiRequest(`/admin/vehicles/${id}`, { method: 'DELETE' });
      await loadVehicles();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete.');
    }
  }

  async function cancelVehicleBooking(id: string) {
    try {
      await apiRequest(`/admin/vehicle-bookings/${id}`, { method: 'DELETE' });
      await loadVehicles();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not cancel booking.');
    }
  }

  useEffect(() => {
    if (adminTab === 'maintenance') void loadMaintenance();
    if (adminTab === 'resources') void loadResources();
    if (adminTab === 'vehicles') void loadVehicles();
    if (adminTab === 'support') void loadSupport();
    if (adminTab === 'payments') void loadPayments();
    if (adminTab === 'notifications') void loadNotifications(notifPage);
    if (adminTab === 'events') void loadEvents();
    if (adminTab === 'settings') void loadMembershipPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminTab, supportFilter, paymentsFilter, notifPage]);

  async function updateMaintenance(id: string, body: { status?: string; adminNote?: string }) {
    setError(null);
    try {
      await apiRequest(`/admin/maintenance/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      await loadMaintenance();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update the request.');
    }
  }

  async function viewMaintenancePhoto(id: string) {
    try {
      const photo = await apiRequest<{ fileType: string; dataBase64: string }>(`/admin/maintenance/${id}/photo`);
      const src = photo.dataBase64.startsWith('data:') ? photo.dataBase64 : `data:${photo.fileType};base64,${photo.dataBase64}`;
      window.open(src, '_blank', 'noopener');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not open the photo.');
    }
  }

  async function saveResource() {
    if (!resourceForm) return;
    setError(null);
    try {
      const path = resourceForm.id ? `/admin/resources/${resourceForm.id}` : '/admin/resources';
      await apiRequest(path, {
        method: resourceForm.id ? 'PATCH' : 'POST',
        body: JSON.stringify({ title: resourceForm.title, category: resourceForm.category, body: resourceForm.body, published: resourceForm.published }),
      });
      setResourceForm(null);
      await loadResources();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the resource.');
    }
  }

  async function deleteResource(id: string) {
    setError(null);
    try {
      await apiRequest(`/admin/resources/${id}`, { method: 'DELETE' });
      await loadResources();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete the resource.');
    }
  }

  async function updateApplication(applicationId: string, path: string, body?: object, success?: string) {
    setError(null);
    setNotice(null);
    try {
      await apiRequest(`/admin/applications/${applicationId}/${path}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      });
      setNotice(success ?? 'Application updated.');
      await refreshOverview();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update application.');
    }
  }

  function toggleApplicantSelected(id: string) {
    setSelectedApplicantIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function runBulkAction(path: string, body: object, verb: string) {
    if (selectedApplicantIds.size === 0) return;
    if (!window.confirm(`${verb} ${selectedApplicantIds.size} applicant${selectedApplicantIds.size === 1 ? '' : 's'}?`)) return;
    setIsBulkRunning(true);
    setError(null);
    setNotice(null);
    const ids = Array.from(selectedApplicantIds);
    const results = await Promise.allSettled(
      ids.map((id) =>
        apiRequest(`/admin/applications/${id}/${path}`, {
          method: 'POST',
          body: JSON.stringify(body),
        }),
      ),
    );
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - ok;
    setNotice(`${verb} · ${ok} succeeded${failed > 0 ? `, ${failed} failed` : ''}.`);
    setSelectedApplicantIds(new Set());
    setIsBulkRunning(false);
    await refreshOverview();
  }

  // The single relevant next action for an applicant's current stage, plus any
  // contextual secondary actions (reject / resend). Avoids showing all 6 buttons.
  function applicantActions(app: Applicant): { primary: ApplicantAction | null; secondary: ApplicantAction[] } {
    const run = (path: string, body: object | undefined, msg: string) => () => void updateApplication(app.id, path, body, msg);
    const status = app.status;

    if (status === 'SUBMITTED') {
      return {
        primary: { key: 'first', label: 'Approve first check', icon: <Check size={15} />, run: run('first-check', { approved: true }, 'First check approved.') },
        secondary: [{ key: 'first-no', label: 'Reject', icon: <X size={15} />, tone: 'danger', run: run('first-check', { approved: false }, 'Applicant rejected at first check.') }],
      };
    }
    if (status === 'FIRST_APPROVED') {
      // This is the one stage where we're waiting on the applicant, so it's the
      // one stage that gets a nudge. Listed before Reject: the destructive
      // action stays last in the stack.
      const reminded = app.meetingReminderSentAt ? new Date(app.meetingReminderSentAt) : null;
      return {
        primary: { key: 'meet', label: 'Approve meeting', icon: <ShieldCheck size={15} />, run: run('online-meeting-check', { approved: true }, 'Online meeting approved.') },
        secondary: [
          {
            key: 'remind',
            label: reminded ? 'Remind again' : 'Remind',
            icon: <Send size={15} />,
            tone: 'ghost',
            hint: reminded ? `Last reminded ${reminded.toLocaleDateString()}` : 'Send the follow-up email with the booking link',
            run: run('remind-meeting', undefined, 'Reminder sent.'),
          },
          { key: 'meet-no', label: 'Reject', icon: <X size={15} />, tone: 'danger', run: run('online-meeting-check', { approved: false }, 'Applicant rejected after meeting.') },
        ],
      };
    }
    if (status === 'MEETING_APPROVED' && !app.apartmentAvailable) {
      return {
        primary: { key: 'apt', label: 'Apartment available', icon: <Home size={15} />, run: run('apartment-availability', { available: true }, 'Apartment availability confirmed.') },
        secondary: [{ key: 'apt-no', label: 'No apartment', icon: <X size={15} />, tone: 'danger', run: run('apartment-availability', { available: false }, 'Marked no apartment available.') }],
      };
    }
    if ((status === 'MEETING_APPROVED' || status === 'APARTMENT_AVAILABLE') && app.paymentStatus !== 'PENDING' && app.paymentStatus !== 'SUCCESS') {
      return {
        primary: { key: 'pay', label: 'Send payment link', icon: <LinkIcon size={15} />, run: run('send-payment-link', undefined, 'Payment link prepared.') },
        secondary: [],
      };
    }
    if (status === 'PAYMENT_LINK_SENT') {
      return {
        primary: { key: 'paid', label: 'Confirm payment', icon: <Check size={15} />, run: run('confirm-payment', undefined, 'Payment marked successful.') },
        secondary: [{ key: 'resend-link', label: 'Resend link', icon: <LinkIcon size={15} />, tone: 'ghost', run: run('send-payment-link', undefined, 'Payment link re-sent.') }],
      };
    }
    if (status === 'PAYMENT_CONFIRMED') {
      // Applicant already has an account (created during the self-serve apply
      // flow with a password THEY chose). Finish onboarding by activating their
      // membership — no more credential emails, so their password is never
      // silently overwritten.
      return {
        primary: { key: 'activate', label: 'Complete onboarding', icon: <Check size={15} />, run: run('activate', undefined, 'Member activated.') },
        secondary: [],
      };
    }
    if (status === 'CREDENTIALS_SENT') {
      return { primary: null, secondary: [] };
    }
    return { primary: null, secondary: [] };
  }

  function updateDesignationDraft(userId: string, field: keyof DesignationDraft, value: string) {
    setDesignationDrafts((current) => ({
      ...current,
      [userId]: { ...emptyDesignationDraft, ...current[userId], [field]: value },
    }));
  }

  /**
   * Close the row and put back what the server has.
   *
   * Without the reset, a half-changed dropdown would survive the cancel and sit
   * there looking like the saved answer until the page reloads.
   */
  function cancelDesignationEdit(userId: string) {
    const user = overview?.users.find((candidate) => candidate.id === userId);
    setDesignationDrafts((current) => ({
      ...current,
      [userId]: {
        apartmentName: user?.apartment ?? '',
        mealPlan: user?.mealPlan ?? '',
        mealStartDate: user?.mealStartDate ?? user?.moveInDate ?? '',
        cleaningPlan: user?.cleaningPlan ?? '',
      },
    }));
    setEditingDesignationId(null);
  }

  async function saveDesignations(userId: string) {
    const draft = designationDrafts[userId] ?? emptyDesignationDraft;
    setError(null);
    setNotice(null);
    // Match the picked plan name back to its ProsperaSub id from the loaded
    // catalog so the backend can mirror the subscription with a real plan_id.
    const mealPlanId = draft.mealPlan
      ? globalSettings?.mealOptions.find((o) => o.name === draft.mealPlan)?.id ?? ''
      : '';
    const cleaningPlanId = draft.cleaningPlan
      ? globalSettings?.cleaningOptions.find((o) => o.name === draft.cleaningPlan)?.id ?? ''
      : '';
    try {
      await apiRequest(`/admin/users/${userId}/designations`, {
        method: 'POST',
        body: JSON.stringify({ ...draft, mealPlanId, cleaningPlanId }),
      });
      setNotice('Designations saved for user.');
      setEditingDesignationId(null);
      await refreshOverview();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save designations.');
    }
  }

  /** Cents from what the admin typed. Refuses junk rather than saving a 0. */
  function centsFrom(value: string, label: string): number {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) throw new Error(`${label} must be a number.`);
    return Math.round(amount * 100);
  }

  async function loadMembershipPlans() {
    try {
      const data = await apiRequest<MembershipPlan[]>('/admin/membership-plans');
      setMembershipPlans(data);
      // Reseed every draft: after a save the server is the truth, and keeping
      // stale text would show the old price next to the new one.
      setPlanDrafts(Object.fromEntries(data.map((plan) => [plan.id, draftFrom(plan)])));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load membership plans.');
    }
  }

  /** Close the row and put back what the server has. */
  function cancelPlanEdit(plan: MembershipPlan) {
    setPlanDrafts((current) => ({ ...current, [plan.id]: draftFrom(plan) }));
    setEditingPlanId(null);
  }

  async function savePlan(id: string) {
    const draft = planDrafts[id];
    if (!draft) return;
    setError(null);
    try {
      await apiRequest(`/admin/membership-plans/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: draft.name,
          description: draft.description,
          priceCents: centsFrom(draft.price, 'Monthly price'),
          shortStayPriceCents: centsFrom(draft.shortStayPrice, 'Short-stay price'),
          occupancy: Number(draft.occupancy),
          active: draft.active,
        }),
      });
      setEditingPlanId(null);
      await loadMembershipPlans();
      setNotice('Plan saved.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the plan.');
    }
  }

  async function createPlan() {
    if (!newPlan) return;
    setError(null);
    try {
      await apiRequest('/admin/membership-plans', {
        method: 'POST',
        body: JSON.stringify({
          name: newPlan.name,
          description: newPlan.description,
          priceCents: centsFrom(newPlan.price, 'Monthly price'),
          shortStayPriceCents: centsFrom(newPlan.shortStayPrice, 'Short-stay price'),
          occupancy: Number(newPlan.occupancy),
          order: membershipPlans.length,
        }),
      });
      setNewPlan(null);
      await loadMembershipPlans();
      setNotice('Plan added.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add the plan.');
    }
  }

  async function retirePlan(id: string, name: string) {
    // Not a delete: past applications name the plan they chose, and removing
    // the row would leave that text pointing at nothing.
    if (!window.confirm(`Retire "${name}"? It disappears from the apply form; applications that chose it are untouched.`)) return;
    setError(null);
    try {
      await apiRequest(`/admin/membership-plans/${id}`, { method: 'DELETE' });
      await loadMembershipPlans();
      setNotice('Plan retired.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not retire the plan.');
    }
  }

  function applyGlobalSettings(data: GlobalSettings) {
    setGlobalSettings(data);
    setGlobalMealPlanId(data.mealPlan?.id ?? '');
    setGlobalCleaningPlanId(data.cleaningPlan?.id ?? '');
    setBatchStartDate(data.batch?.startDate ?? '');
    setBatchLabel(data.batch?.label ?? '');
    if (data.mealPlan?.id === 'custom') {
      setCustomMealName(data.mealPlan.name);
      setCustomMealPrice(data.mealPlan.weeklyPriceCents != null ? String(data.mealPlan.weeklyPriceCents / 100) : '');
      setCustomMealMeals(data.mealPlan.mealsLabel ?? '');
    }
  }

  async function saveBatch() {
    setError(null);
    setGlobalMessage(null);
    setIsSavingBatch(true);
    try {
      const data = await apiRequest<GlobalSettings>('/admin/settings/global/batch', {
        method: 'PUT',
        body: JSON.stringify({ startDate: batchStartDate || undefined, label: batchLabel.trim() || undefined }),
      });
      applyGlobalSettings(data);
      setGlobalMessage(
        data.batch?.startDate ? `Batch start set to ${data.batch.startDate}.` : 'Batch start cleared.',
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save batch start.');
    } finally {
      setIsSavingBatch(false);
    }
  }

  async function saveGlobalMealPlan() {
    setError(null);
    setGlobalMessage(null);
    // Dry-run preview: how many active members would inherit this global.
    try {
      const preview = await apiRequest<{ meal: { affected: number } }>('/admin/settings/global/affected-members');
      const n = preview.meal.affected;
      if (n > 0 && !window.confirm(`Apply this meal plan to ${n} active member${n === 1 ? '' : 's'} without a personal plan?`)) {
        return;
      }
    } catch { /* if preview fails, fall through and save anyway */ }
    setIsSavingGlobal(true);
    try {
      const isCustom = globalMealPlanId === 'custom';
      const priceNumber = Number(customMealPrice);
      const body = isCustom
        ? {
            planId: 'custom',
            custom: {
              name: customMealName.trim(),
              weeklyPriceCents: Number.isFinite(priceNumber) && customMealPrice !== '' ? Math.round(priceNumber * 100) : undefined,
              mealsLabel: customMealMeals.trim() || undefined,
            },
          }
        : { planId: globalMealPlanId || undefined };

      const data = await apiRequest<GlobalSettings>('/admin/settings/global/meal-plan', {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      applyGlobalSettings(data);
      setGlobalMessage(
        data.mealPlan
          ? `Global meal plan set to "${data.mealPlan.name}" — applied to every member.`
          : 'Global meal plan cleared.',
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save global meal plan.');
    } finally {
      setIsSavingGlobal(false);
    }
  }

  async function saveGlobalCleaningPlan() {
    setError(null);
    setGlobalMessage(null);
    try {
      const preview = await apiRequest<{ cleaning: { affected: number } }>('/admin/settings/global/affected-members');
      const n = preview.cleaning.affected;
      if (n > 0 && !window.confirm(`Apply this cleaning plan to ${n} active member${n === 1 ? '' : 's'} without a personal plan?`)) {
        return;
      }
    } catch { /* fall through */ }
    setIsSavingGlobalCleaning(true);
    try {
      const data = await apiRequest<GlobalSettings>('/admin/settings/global/cleaning-plan', {
        method: 'PUT',
        body: JSON.stringify({ planId: globalCleaningPlanId || undefined }),
      });
      applyGlobalSettings(data);
      setGlobalMessage(
        data.cleaningPlan
          ? `Global cleaning plan set to "${data.cleaningPlan.name}" — applied to every member.`
          : 'Global cleaning plan cleared.',
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save global cleaning plan.');
    } finally {
      setIsSavingGlobalCleaning(false);
    }
  }

  async function updateUserRole(userId: string, role: string) {
    setError(null);
    setNotice(null);
    try {
      await apiRequest(`/admin/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      setNotice('User role updated.');
      await refreshOverview();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update role.');
    }
  }

  async function openUserDetail(userId: string) {
    setIsUserDetailLoading(true);
    setError(null);
    try {
      const user = await apiRequest<AdminUserDetail>(`/admin/users/${userId}`);
      setSelectedUser(user);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load user detail.');
    } finally {
      setIsUserDetailLoading(false);
    }
  }

  if (selectedUser) {
    const displayName = selectedUser.profile?.fullName ?? selectedUser.email;
    const initials = displayName
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    const documentStats = [
      { label: 'Payments', value: selectedUser.payments.length, detail: `${selectedUser.summary.openPayments} open` },
      { label: 'Apartment', value: selectedUser.assignedApartment ? 1 : 0, detail: selectedUser.assignedApartment?.apartment.name ?? 'No assignment' },
      { label: 'Support', value: selectedUser.summary.supportTickets, detail: 'Tickets' },
    ];

    return (
      <div className="admin-shell">
        <div className="admin-user-detail">
          <aside className="admin-user-profile">
            <button className="ghost-button compact-button" onClick={() => setSelectedUser(null)}>
              <ArrowLeft size={16} />
              Back
            </button>
            <div className="admin-user-avatar">{initials || '?'}</div>
            <h2>{displayName}</h2>
            <p>{selectedUser.email}</p>
            <StatusBadge tone={toneForStatus(selectedUser.membership?.status ?? 'NONE')}>{selectedUser.membership?.status ?? 'NONE'}</StatusBadge>
            <div className="admin-user-actions">
              <a className="ghost-button compact-button" href={`mailto:${selectedUser.email}`}>Mail</a>
              <a className="ghost-button compact-button" href={selectedUser.profile?.phone ? `tel:${selectedUser.profile.phone}` : undefined}>Call</a>
            </div>
            <div className="admin-user-facts">
              <div><span>Role</span><strong>{roleLabel(selectedUser.role)}</strong></div>
              <div><span>Phone</span><strong>{selectedUser.profile?.phone ?? '-'}</strong></div>
              <div><span>Location</span><strong>{selectedUser.profile?.location ?? '-'}</strong></div>
              <div><span>Joined</span><strong>{new Date(selectedUser.createdAt).toLocaleDateString()}</strong></div>
            </div>
          </aside>

          <section className="admin-user-main">
            <div className="admin-user-hero">
              <div>
                <button className="text-button admin-user-breadcrumb" onClick={() => setSelectedUser(null)}>
                  <ArrowLeft size={18} />
                  All users
                </button>
                <h1>{displayName}</h1>
                <p>Created on {new Date(selectedUser.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="status-stack">
                <StatusBadge tone={toneForStatus(selectedUser.residencyApplication?.status ?? 'NOT_STARTED')}>
                  {selectedUser.residencyApplication?.status ?? 'NOT_STARTED'}
                </StatusBadge>
                <StatusBadge tone={selectedUser.mustChangePassword ? 'attention' : 'good'}>
                  {selectedUser.mustChangePassword ? 'Setup required' : 'Password set'}
                </StatusBadge>
              </div>
            </div>

            <nav className="admin-user-tabs" aria-label="User detail sections">
              {['Details', 'Residency', 'Housing', 'Payments', 'Meals', 'Support'].map((tab, index) => (
                <span className={index === 0 ? 'admin-user-tab admin-user-tab--active' : 'admin-user-tab'} key={tab}>{tab}</span>
              ))}
            </nav>

            <section className="admin-user-document-panel">
              <div className="admin-user-stat-grid">
                {documentStats.map((stat) => (
                  <article className="admin-user-stat" key={stat.label}>
                    <span>{stat.label}</span>
                    <strong>{stat.value}</strong>
                    <p>{stat.detail}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="admin-user-grid">
              <article className="panel">
                <h2>Account</h2>
                <div className="detail-box">
                  <div><span>Email verified</span><strong>{selectedUser.emailVerifiedAt ? 'Yes' : 'No'}</strong></div>
                  <div><span>Referral code</span><strong>{selectedUser.referralCode ?? '-'}</strong></div>
                  <div><span>Starting date</span><strong>{selectedUser.membership?.startingDate ? new Date(selectedUser.membership.startingDate).toLocaleDateString() : '-'}</strong></div>
                  <div><span>Due date</span><strong>{selectedUser.membership?.dueDate ? new Date(selectedUser.membership.dueDate).toLocaleDateString() : '-'}</strong></div>
                  <div><span>Finish date</span><strong>{selectedUser.membership?.finishDate ? new Date(selectedUser.membership.finishDate).toLocaleDateString() : '-'}</strong></div>
                </div>
              </article>

              <article className="panel">
                <h2>E-Residency</h2>
                <p>{selectedUser.residencyApplication?.stage ?? 'Not started'}</p>
                <div className="next-step-list">
                  {(selectedUser.residencyApplication?.requiredNextSteps?.length ? selectedUser.residencyApplication.requiredNextSteps : ['No required next steps.']).map((step) => (
                    <div className="next-step" key={step}>{step}</div>
                  ))}
                </div>
              </article>

              <article className="panel">
                <h2>Housing</h2>
                <div className="detail-box">
                  <div><span>Apartment</span><strong>{selectedUser.assignedApartment?.apartment.name ?? '-'}</strong></div>
                  <div><span>Status</span><strong>{selectedUser.assignedApartment?.apartment.availability ?? '-'}</strong></div>
                  <div><span>Move-in</span><strong>{selectedUser.assignedApartment?.moveInDate ? new Date(selectedUser.assignedApartment.moveInDate).toLocaleDateString() : '-'}</strong></div>
                </div>
              </article>

              <article className="panel">
                <h2>Subscription</h2>
                <div className="detail-box">
                  <div><span>Plan</span><strong>{selectedUser.subscriptionPlan?.planName ?? '-'}</strong></div>
                  <div><span>Status</span><strong>{selectedUser.subscriptionPlan?.status ?? '-'}</strong></div>
                  <div><span>Renewal</span><strong>{selectedUser.subscriptionPlan?.renewalDate ? new Date(selectedUser.subscriptionPlan.renewalDate).toLocaleDateString() : '-'}</strong></div>
                  <div><span>Community plans</span><strong>{selectedUser.communityPlans.length}</strong></div>
                </div>
              </article>
            </section>

            <section className="panel admin-user-list-panel">
              <div className="admin-panel__head">
                <div>
                  <h2>Community plans</h2>
                  <p>All Builders Node community plan purchases for this user.</p>
                </div>
              </div>
              {selectedUser.communityPlans.length === 0 ? <div className="empty-state">No community plans purchased yet.</div> : null}
              {selectedUser.communityPlans.map((plan) => (
                <div className="admin-user-list-row" key={plan.id}>
                  <FileText size={18} />
                  <div><strong>{plan.planName}</strong><span>{plan.source} · Purchased {new Date(plan.purchasedAt).toLocaleDateString()} · {formatMoney(plan.amountCents, plan.currency)}</span></div>
                  <StatusBadge tone={toneForStatus(plan.status)}>{plan.status}</StatusBadge>
                </div>
              ))}
            </section>

            <section className="panel admin-user-list-panel">
              <div className="admin-panel__head">
                <div>
                  <h2>Payments</h2>
                  <p>Total paid: {formatMoney(selectedUser.summary.paidTotalCents)}</p>
                </div>
              </div>
              {selectedUser.payments.length === 0 ? <div className="empty-state">No payment records yet.</div> : null}
              {selectedUser.payments.map((payment) => (
                <div className="admin-user-list-row" key={payment.id}>
                  <FileText size={18} />
                  <div><strong>{payment.description}</strong><span>{formatMoney(payment.amountCents, payment.currency)} · Due {new Date(payment.dueDate).toLocaleDateString()}</span></div>
                  <StatusBadge tone={toneForStatus(payment.status)}>{payment.status}</StatusBadge>
                </div>
              ))}
            </section>

            <section className="admin-user-grid">
              <article className="panel">
                <h2>Meals</h2>
                <div className="next-step-list">
                  {selectedUser.meals.length === 0 ? <div className="empty-state">No meals assigned.</div> : null}
                  {selectedUser.meals.map((meal) => <div className="next-step" key={meal.id}><strong>{meal.day}</strong><span>{meal.meal}</span></div>)}
                </div>
              </article>
              <article className="panel">
                <h2>Cleaning</h2>
                <div className="next-step-list">
                  {selectedUser.cleaningSchedules.length === 0 ? <div className="empty-state">No cleaning schedule.</div> : null}
                  {selectedUser.cleaningSchedules.map((cleaning) => <div className="next-step" key={cleaning.id}><strong>{cleaning.frequency ?? 'Cleaning'}</strong><span>{cleaning.notes ?? '-'}</span></div>)}
                </div>
              </article>
            </section>
          </section>
        </div>
      </div>
    );
  }

  const currentPage = adminPage ?? 'adminDashboard';
  const inInbox = INBOX_PAGES.includes(currentPage);
  const inSettings = SETTINGS_PAGES.includes(currentPage);
  const attention = (overview?.attention ?? {}) as Record<string, number>;
  const header = inInbox
    ? { title: 'Inbox', description: 'Everything waiting on an admin decision, in one place.' }
    : inSettings
      ? { title: 'Settings', description: 'Community plans, landing batch, and the shared resources members can book.' }
      : {
          title: 'Admin Dashboard',
          description: `Role access: ${roleLabel(currentUserRole ?? 'MEMBER')}. Manage applicants, members, designations, and operations from the same dashboard.`,
        };

  return (
    <div className="admin-shell">
      <div className="page-stack admin-page">
        {/* No "member home" button here any more — leaving the admin area is the
            shell's job (sidebar and avatar menu), and three buttons doing the
            same thing on one screen just made it unclear which one to use. */}
        <PageHeader title={header.title} description={header.description} />

        {inInbox ? (
          <nav className="tab-row admin-group-tabs" aria-label="Inbox sections">
            {INBOX_TABS.map((tab) => {
              const count = attention[tab.attentionKey] ?? 0;
              return (
                <button
                  key={tab.page}
                  className={currentPage === tab.page ? 'tab-chip tab-chip--active' : 'tab-chip'}
                  onClick={() => setActivePage(tab.page)}
                >
                  {tab.label}
                  {count > 0 ? <strong className="tab-chip__count">{count}</strong> : null}
                </button>
              );
            })}
          </nav>
        ) : null}

        {inSettings ? (
          <nav className="tab-row admin-group-tabs" aria-label="Settings sections">
            {SETTINGS_TABS.map((tab) => (
              <button
                key={tab.page}
                className={currentPage === tab.page ? 'tab-chip tab-chip--active' : 'tab-chip'}
                onClick={() => setActivePage(tab.page)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        ) : null}

        {isLoading ? <section className="panel"><p>Loading admin data...</p></section> : null}
        {isUserDetailLoading ? <section className="panel"><p>Loading user detail...</p></section> : null}
        {/* Errors stay in the flow: they need reading and often re-reading.
            Confirmations float instead — see Toast at the end of this tree. */}
        {error ? <section className="panel"><p className="form-error">{error}</p></section> : null}

        {adminTab === 'overview' ? (
        <>
        <section className="status-grid admin-metrics" id="admin-overview">
          {metrics.map((metric) => (
            <article className="status-card" key={metric.label}>
              <div className="status-card__top">
                <span>{metric.label}</span>
                <StatusBadge tone={metric.tone}>{String(metric.value)}</StatusBadge>
              </div>
            </article>
          ))}
        </section>

        {overview?.attention ? (
          <section className="panel attention-panel">
            <div className="admin-panel__head">
              <div>
                <h2>Needs attention</h2>
                <p>
                  {overview.attention.pendingApplications + overview.attention.pendingResidency + overview.attention.openTickets + overview.attention.overduePayments === 0
                    ? 'All clear — nothing waiting on you.'
                    : 'Items waiting on an admin decision.'}
                </p>
              </div>
            </div>
            <div className="attention-grid">
              {[
                { key: 'apps', label: 'Applications to review', count: overview.attention.pendingApplications, go: () => setActivePage('adminApplicants') },
                { key: 'res', label: 'E-Residency proofs', count: overview.attention.pendingResidency, go: () => setActivePage('adminResidency') },
                { key: 'tickets', label: 'Open support tickets', count: overview.attention.openTickets, go: () => setActivePage('adminSupport') },
                { key: 'pay', label: 'Overdue payments', count: overview.attention.overduePayments, go: () => setActivePage('adminPayments') },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`attention-card${item.count > 0 ? ' attention-card--active' : ''}`}
                  onClick={item.go}
                >
                  <strong>{item.count}</strong>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="panel income-panel">
          <div className="admin-panel__head">
            <div>
              <h2>Income</h2>
              <p>Paid revenue from real payment records in the database.</p>
            </div>
            <div className="income-total">
              <span>All time</span>
              <strong>{formatMoney(overview?.income.allTimeCents ?? 0, overview?.income.currency)}</strong>
            </div>
          </div>
          <div className="income-card-grid">
            {incomeCards.map((card) => (
              <article className="income-card" key={card.label}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <p>{card.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel funnel-panel">
          <div className="admin-panel__head">
            <div>
              <h2>Application Funnel</h2>
              <p>Live stage status from applications, payment checks, and E-Residency records.</p>
            </div>
            <div className="funnel-summary">
              <span>Apply to approved</span>
              <strong>{conversion}</strong>
            </div>
          </div>

          <div className="funnel-bars" aria-label="Application funnel status">
            <div className="funnel-axis">
              <span>100%</span>
              <span>75%</span>
              <span>50%</span>
              <span>25%</span>
            </div>
            <div className="funnel-bar-grid">
              {funnel.map((stage, index) => {
                const stagePercent = index === 0 ? '100%' : percentOfTotal(stage.count, totalApplications);
                const previous = funnel[index - 1];
                const dropOff = dropOffFromPrevious(stage, previous);
                const height = index === 0 ? 100 : Math.max(12, totalApplications ? (stage.count / totalApplications) * 100 : 0);

                return (
                  <article className={`funnel-bar-stage ${index === 2 ? 'funnel-bar-stage--active' : ''}`} key={stage.key}>
                    <div className="funnel-bar-stage__head">
                      <span>{stage.label}</span>
                      <strong>{stage.count}</strong>
                    </div>
                    <div className="funnel-bar-wrap">
                      <div className="funnel-bar" style={{ height: `${height}%` }}>
                        <span className="funnel-bar__stripe" />
                      </div>
                    </div>
                    <div className="funnel-bar-stage__foot">
                      <StatusBadge tone={stage.waiting > 0 ? 'attention' : 'good'}>
                        {stage.waiting > 0 ? `${stage.waiting} waiting` : 'Clear'}
                      </StatusBadge>
                      <small>{stagePercent} conversion{index > 0 ? `, ${dropOff} drop-off` : ''}</small>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
        </>
        ) : null}

        {adminTab === 'applicants' ? (
        <section className="panel admin-panel" id="admin-applicants">
          <div className="admin-panel__head">
            <div>
              <h2>Applicants</h2>
              <p>Follow the pipeline: checks, apartment availability, then payment.</p>
            </div>
            <div className="view-toggle" role="group" aria-label="View mode">
              <button
                className={applicantView === 'board' ? 'view-toggle__btn view-toggle__btn--active' : 'view-toggle__btn'}
                onClick={() => setApplicantView('board')}
              >
                Board
              </button>
              <button
                className={applicantView === 'list' ? 'view-toggle__btn view-toggle__btn--active' : 'view-toggle__btn'}
                onClick={() => setApplicantView('list')}
              >
                List
              </button>
            </div>
          </div>

          <div className="designation-toolbar">
            <div className="designation-search">
              <Search size={16} />
              <input
                value={applicantSearch}
                onChange={(event) => setApplicantSearch(event.target.value)}
                placeholder="Search applicants by name or email…"
                aria-label="Search applicants"
              />
            </div>
            {applicantView === 'list' ? (
              <div className="designation-filter-bar" role="group" aria-label="Applicant filters">
                {applicantFilters.map((filter) => (
                  <button
                    className={applicantFilter === filter.id ? 'designation-filter designation-filter--active' : 'designation-filter'}
                    key={filter.id}
                    onClick={() => setApplicantFilter(filter.id)}
                  >
                    <span>{filter.label}</span>
                    <strong>{applicantCountFor(filter.id)}</strong>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {applicantView === 'board' ? (
            <div className="pipeline-board" ref={pipelineBoardRef}>
              {PIPELINE_COLUMNS.map((column) => {
                const cards = filteredApplicants.filter(
                  (app) => pipelineStage(app.status, app.apartmentAvailable) === column.stage,
                );
                return (
                  <div className="pipeline-col" key={column.stage}>
                    <div className="pipeline-col__head">
                      <span>{column.title}</span>
                      <strong>{cards.length}</strong>
                    </div>
                    <div className="pipeline-col__cards">
                      {cards.length === 0 ? <p className="pipeline-empty">—</p> : null}
                      {cards.map((app) => {
                        const actions = applicantActions(app);
                        return (
                          <article className="pipeline-card" key={app.id}>
                            <strong className="pipeline-card__name">{app.fullName}</strong>
                            <span className="pipeline-card__email">{app.email}</span>
                            <div className="pipeline-card__badges">
                              <StatusBadge tone={toneForStatus(app.status)}>{app.status}</StatusBadge>
                            </div>
                            {/* Above the internal note on purpose: you read what
                                they wrote, then write down what you think. */}
                            <ApplicantAnswers
                              application={app}
                              open={expandedApplicantId === app.id}
                              onToggle={() => setExpandedApplicantId(expandedApplicantId === app.id ? null : app.id)}
                            />
                            <textarea
                              className="pipeline-card__note"
                              defaultValue={app.adminNote ?? ''}
                              placeholder="Internal note…"
                              rows={2}
                              onBlur={(event) => {
                                const value = event.target.value;
                                if (value !== (app.adminNote ?? '')) void updateApplication(app.id, 'note', { note: value }, 'Note saved.');
                              }}
                            />
                            {/* Primary first: these stack in a narrow column, and
                                leading with "Reject" would put the destructive
                                option above the one that moves the pipeline
                                along. The list view has its own markup and is
                                unaffected. */}
                            {actions.primary || actions.secondary.length > 0 ? (
                              <div className="pipeline-card__actions">
                                {actions.primary ? (
                                  <button className="primary-button compact-button" onClick={actions.primary.run}>
                                    {actions.primary.icon}
                                    {actions.primary.label}
                                  </button>
                                ) : null}
                                {actions.secondary.map((action) => (
                                  <button
                                    key={action.key}
                                    className={action.tone === 'danger' ? 'compact-button applicant-action--danger' : 'ghost-button compact-button'}
                                    title={action.hint}
                                    onClick={action.run}
                                  >
                                    {action.icon}
                                    {action.label}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
          <>
          {selectedApplicantIds.size > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 12, background: 'rgba(229, 84, 31, 0.06)', border: '1px solid rgba(229, 84, 31, 0.28)', borderRadius: 12 }}>
              <strong style={{ fontSize: '0.9rem' }}>{selectedApplicantIds.size} selected</strong>
              <button className="primary-button compact-button" disabled={isBulkRunning} onClick={() => void runBulkAction('first-check', { approved: true }, 'Approve first check')}>
                Approve first check
              </button>
              <button className="ghost-button compact-button" disabled={isBulkRunning} onClick={() => void runBulkAction('first-check', { approved: false }, 'Reject at first check')}>
                Reject first check
              </button>
              <button className="ghost-button compact-button" disabled={isBulkRunning} onClick={() => void runBulkAction('online-meeting-check', { approved: true }, 'Approve meeting')}>
                Approve meeting
              </button>
              <button className="text-button" onClick={() => setSelectedApplicantIds(new Set())} style={{ marginLeft: 'auto' }}>
                Clear
              </button>
            </div>
          ) : null}
          <div className="applicant-list">
            {allApplicants.length === 0 ? (
              <div className="empty-state">No applications in the database yet.</div>
            ) : null}
            {allApplicants.length > 0 && filteredApplicants.length === 0 ? (
              <div className="empty-state">No applicants match this search or filter.</div>
            ) : null}
            {pagedApplicants.map((application) => {
              const stageIndex = applicantStageIndex(application.status, application.apartmentAvailable);
              const rejected = stageIndex === -1;
              const onboarded = stageIndex >= APPLICANT_STAGES.length;
              const actions = applicantActions(application);
              const meta = [application.phone, application.referralCode ? `ref ${application.referralCode}` : null].filter(Boolean).join(' · ');

              return (
                <article className="applicant-card" key={application.id}>
                  <div className="applicant-card__top">
                    <div className="applicant-card__id" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <input
                        type="checkbox"
                        checked={selectedApplicantIds.has(application.id)}
                        onChange={() => toggleApplicantSelected(application.id)}
                        aria-label={`Select ${application.fullName}`}
                        style={{ marginTop: 4 }}
                      />
                      <div>
                        <strong>{application.fullName}</strong>
                        <span style={{ display: 'block' }}>{application.email}</span>
                        {meta ? <small>{meta}</small> : null}
                      </div>
                    </div>
                    <div className="applicant-card__status">
                      <StatusBadge tone={toneForStatus(application.status)}>{application.status}</StatusBadge>
                      <StatusBadge tone={toneForStatus(application.paymentStatus)}>{application.paymentStatus}</StatusBadge>
                    </div>
                  </div>

                  {rejected ? (
                    <div className="applicant-stepper applicant-stepper--rejected">
                      {nextStepFor(application.status, application.apartmentAvailable, application.paymentStatus)}
                    </div>
                  ) : (
                    <ol className="applicant-stepper">
                      {APPLICANT_STAGES.map((stage, index) => {
                        const state = index < stageIndex ? 'done' : index === stageIndex ? 'active' : 'todo';
                        return (
                          <li className={`applicant-step applicant-step--${state}`} key={stage}>
                            <span className="applicant-step__dot">{index < stageIndex ? <Check size={12} /> : index + 1}</span>
                            <span className="applicant-step__label">{stage}</span>
                          </li>
                        );
                      })}
                    </ol>
                  )}

                  {/* What they actually wrote. It was already coming down in the
                      payload and had nowhere to be read — deciding on someone
                      meant approving them off a name and an email. */}
                  <ApplicantAnswers
                    application={application}
                    open={expandedApplicantId === application.id}
                    onToggle={() =>
                      setExpandedApplicantId(expandedApplicantId === application.id ? null : application.id)
                    }
                  />

                  <div className="applicant-card__footer">
                    <span className="applicant-card__next">
                      {onboarded
                        ? 'Onboarded — membership is active'
                        : `Next step: ${nextStepFor(application.status, application.apartmentAvailable, application.paymentStatus)}`}
                    </span>
                    <div className="applicant-card__actions">
                      {actions.secondary.map((action) => (
                        <button
                          className={action.tone === 'danger' ? 'compact-button applicant-action applicant-action--danger' : 'ghost-button compact-button'}
                          key={action.key}
                          title={action.hint}
                          onClick={action.run}
                        >
                          {action.icon}
                          {action.label}
                        </button>
                      ))}
                      {actions.primary ? (
                        <button className="primary-button compact-button applicant-action--primary" onClick={actions.primary.run}>
                          {actions.primary.icon}
                          {actions.primary.label}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {applicantPageCount > 1 ? (
            <div className="pagination">
              <button
                className="ghost-button compact-button"
                disabled={safeApplicantPage === 0}
                onClick={() => setApplicantPage((page) => Math.max(0, page - 1))}
              >
                Previous
              </button>
              <span className="pagination__info">
                Page {safeApplicantPage + 1} of {applicantPageCount} · {filteredApplicants.length} applicant{filteredApplicants.length === 1 ? '' : 's'}
              </span>
              <button
                className="ghost-button compact-button"
                disabled={safeApplicantPage >= applicantPageCount - 1}
                onClick={() => setApplicantPage((page) => Math.min(applicantPageCount - 1, page + 1))}
              >
                Next
              </button>
            </div>
          ) : null}
          </>
          )}
        </section>
        ) : null}

        {adminTab === 'maintenance' ? (() => {
          const q = maintenanceSearch.trim().toLowerCase();
          const filtered = maintenance
            .filter((m) => maintenanceFilter === 'ALL' || m.status === maintenanceFilter)
            .filter((m) => !q || m.title.toLowerCase().includes(q) || m.description.toLowerCase().includes(q) || m.requesterEmail.toLowerCase().includes(q));
          return (
        <section className="panel admin-panel">
          <div className="admin-panel__head">
            <div>
              <h2>Maintenance queue</h2>
              <p>Member-reported unit issues. Update status to keep members informed.</p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input placeholder="Search…" value={maintenanceSearch} onChange={(event) => setMaintenanceSearch(event.target.value)} style={{ minWidth: 180 }} />
              <div className="tab-row">
                {(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'ALL'] as const).map((f) => (
                  <button key={f} className={maintenanceFilter === f ? 'tab-chip tab-chip--active' : 'tab-chip'} onClick={() => setMaintenanceFilter(f)}>
                    {f === 'IN_PROGRESS' ? 'In progress' : f[0] + f.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="maintenance-admin-list">
            {filtered.length === 0 ? <div className="empty-state">No maintenance requests in this view.</div> : null}
            {filtered.map((m) => (
              <article className="maintenance-admin-card" key={m.id}>
                <div className="maintenance-admin-card__top">
                  <div>
                    <strong>{m.title}</strong>
                    <span>{m.category} · {m.requesterName} ({m.requesterEmail}) · {new Date(m.createdAt).toLocaleDateString()}</span>
                  </div>
                  <StatusBadge tone={m.status === 'RESOLVED' ? 'good' : m.status === 'IN_PROGRESS' ? 'attention' : 'neutral'}>{m.status}</StatusBadge>
                </div>
                <p className="maintenance-admin-card__desc">{m.description}</p>
                <div className="maintenance-admin-card__row">
                  <select value={m.status} onChange={(event) => void updateMaintenance(m.id, { status: event.target.value })}>
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In progress</option>
                    <option value="RESOLVED">Resolved</option>
                  </select>
                  <input
                    defaultValue={m.adminNote ?? ''}
                    placeholder="Note to member…"
                    onBlur={(event) => { if (event.target.value !== (m.adminNote ?? '')) void updateMaintenance(m.id, { adminNote: event.target.value }); }}
                  />
                  {m.hasPhoto ? <button className="ghost-button compact-button" onClick={() => void viewMaintenancePhoto(m.id)}>View photo</button> : null}
                </div>
              </article>
            ))}
          </div>
        </section>
          );
        })() : null}

        {adminTab === 'support' ? (
        <section className="panel admin-panel">
          <div className="admin-panel__head">
            <div>
              <h2>Support tickets</h2>
              <p>Requests members submitted through Contact support. Update status to close the loop.</p>
            </div>
            <div className="tab-row">
              {(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'ALL'] as const).map((filter) => (
                <button
                  key={filter}
                  className={supportFilter === filter ? 'tab-chip tab-chip--active' : 'tab-chip'}
                  onClick={() => setSupportFilter(filter)}
                >
                  {filter === 'IN_PROGRESS' ? 'In progress' : filter[0] + filter.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="maintenance-admin-list">
            {supportTickets.length === 0 ? <div className="empty-state">No tickets in this view.</div> : null}
            {supportTickets.map((t) => (
              <article className="maintenance-admin-card" key={t.id}>
                <div className="maintenance-admin-card__top">
                  <div>
                    <strong>{t.subject}</strong>
                    <span>{(t.fullName ?? t.email)} · {t.email} · {new Date(t.createdAt).toLocaleDateString()}</span>
                  </div>
                  <StatusBadge tone={t.status === 'RESOLVED' ? 'good' : t.status === 'IN_PROGRESS' ? 'attention' : 'neutral'}>{t.status}</StatusBadge>
                </div>
                <div className="ticket-thread">
                  {(t.messages ?? [{ id: t.id, author: 'MEMBER', body: t.message, createdAt: t.createdAt }]).map((entry) => (
                    <div key={entry.id} className={entry.author === 'ADMIN' ? 'ticket-message ticket-message--admin' : 'ticket-message'}>
                      <span>{entry.author === 'ADMIN' ? 'You' : (t.fullName ?? t.email)}</span>
                      <p>{entry.body}</p>
                    </div>
                  ))}
                </div>
                {/* The reply the member receives. The note beside it stays
                    internal — that field used to be the only place an answer
                    could go, and nothing ever showed it to them. */}
                <form
                  className="ticket-reply"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const input = event.currentTarget.elements.namedItem('reply') as HTMLInputElement;
                    if (!input.value.trim()) return;
                    void replyToTicket(t.id, input.value).then(() => { input.value = ''; });
                  }}
                >
                  <input name="reply" placeholder="Reply to the member…" aria-label={`Reply to ${t.subject}`} />
                  <button className="primary-button compact-button" type="submit">Send reply</button>
                </form>
                <div className="maintenance-admin-card__row">
                  <select value={t.status} onChange={(event) => void updateSupportTicket(t.id, { status: event.target.value })}>
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In progress</option>
                    <option value="RESOLVED">Resolved</option>
                  </select>
                  <input
                    defaultValue={t.adminNote ?? ''}
                    placeholder="Internal note (not sent)…"
                    onBlur={(event) => { if (event.target.value !== (t.adminNote ?? '')) void updateSupportTicket(t.id, { adminNote: event.target.value }); }}
                  />
                </div>
              </article>
            ))}
          </div>
        </section>
        ) : null}

        {adminTab === 'payments' ? (
        <section className="panel admin-panel">
          <div className="admin-panel__head">
            <div>
              <h2>Payments</h2>
              <p>Dues and one-off charges. Mark paid when a manual/off-platform payment lands.</p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div className="tab-row">
                {(['OVERDUE', 'DUE', 'PAID', 'ALL'] as const).map((filter) => (
                  <button
                    key={filter}
                    className={paymentsFilter === filter ? 'tab-chip tab-chip--active' : 'tab-chip'}
                    onClick={() => setPaymentsFilter(filter)}
                  >
                    {filter[0] + filter.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
              <button className="primary-button compact-button" onClick={() => setInvoiceForm({ userId: '', amountCents: '', description: '', dueDate: new Date().toISOString().slice(0, 10), payUrl: '' })}>
                + New invoice
              </button>
            </div>
          </div>
          <div className="maintenance-admin-list">
            {payments.length === 0 ? <div className="empty-state">No payments in this view.</div> : null}
            {payments.map((p) => (
              <article className="maintenance-admin-card" key={p.id}>
                <div className="maintenance-admin-card__top">
                  <div>
                    <strong>{formatMoney(p.amountCents, p.currency)} · {p.description}</strong>
                    <span>{(p.fullName ?? p.email)} · {p.email} · due {new Date(p.dueDate).toLocaleDateString()}{p.paidAt ? ` · paid ${new Date(p.paidAt).toLocaleDateString()}` : ''}</span>
                  </div>
                  <StatusBadge tone={p.status === 'PAID' ? 'good' : p.status === 'OVERDUE' ? 'danger' : p.status === 'CANCELLED' ? 'neutral' : 'attention'}>{p.status}</StatusBadge>
                </div>
                <div className="maintenance-admin-card__row">
                  <select value={p.status} onChange={(event) => void updatePayment(p.id, { status: event.target.value })}>
                    <option value="DUE">Due</option>
                    <option value="OVERDUE">Overdue</option>
                    <option value="PAID">Paid</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                  <input
                    defaultValue={p.adminNote ?? ''}
                    placeholder="Note (payment ref, waived, …)"
                    onBlur={(event) => { if (event.target.value !== (p.adminNote ?? '')) void updatePayment(p.id, { adminNote: event.target.value }); }}
                  />
                  {p.status !== 'PAID' ? (
                    <button className="primary-button compact-button" onClick={() => void updatePayment(p.id, { status: 'PAID' })}>
                      Mark paid
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
        ) : null}

        {/* Units keeps its own page component — rendered inline as a Settings
            sub-tab so the sidebar stays at six entries. */}
        {adminTab === 'units' ? <Units embedded /> : null}

        {adminTab === 'notifications' ? (
        <>
          <section className="panel admin-panel">
            <div className="admin-panel__head">
              <div>
                <h2>Compose notification</h2>
                <p>Send an announcement to all members or a direct notice to a specific one.</p>
              </div>
            </div>
            <form
              onSubmit={(event) => { event.preventDefault(); void sendNotification(); }}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <div className="form-grid">
                <label>
                  Audience
                  <select value={notifForm.audience} onChange={(event) => setNotifForm({ ...notifForm, audience: event.target.value as 'member' | 'all-members' })}>
                    <option value="all-members">All members</option>
                    <option value="member">One member</option>
                  </select>
                </label>
                <label>
                  Type
                  <select value={notifForm.type} onChange={(event) => setNotifForm({ ...notifForm, type: event.target.value as 'info' | 'success' | 'warning' })}>
                    <option value="info">Info</option>
                    <option value="success">Success</option>
                    <option value="warning">Warning</option>
                  </select>
                </label>
              </div>
              {notifForm.audience === 'member' ? (
                <label>
                  Member
                  <select value={notifForm.userId} onChange={(event) => setNotifForm({ ...notifForm, userId: event.target.value })} required>
                    <option value="">— pick a member —</option>
                    {(overview?.users ?? []).map((u) => (
                      <option key={u.id} value={u.id}>{u.fullName ?? u.email} · {u.email}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label>
                Title
                <input value={notifForm.title} onChange={(event) => setNotifForm({ ...notifForm, title: event.target.value })} required placeholder="e.g. Water shutoff Friday" />
              </label>
              <label>
                Message (optional)
                <textarea value={notifForm.message} onChange={(event) => setNotifForm({ ...notifForm, message: event.target.value })} rows={3} placeholder="A short body — 1-2 sentences." />
              </label>
              <label>
                Link (optional)
                <input value={notifForm.link} onChange={(event) => setNotifForm({ ...notifForm, link: event.target.value })} placeholder="/account or full URL" />
              </label>
              {notifSentMsg ? <p className="form-success">{notifSentMsg}</p> : null}
              <button className="primary-button" type="submit" disabled={notifSending || !notifForm.title.trim() || (notifForm.audience === 'member' && !notifForm.userId)}>
                {notifSending ? 'Sending…' : 'Send'}
              </button>
            </form>
          </section>

          <section className="panel admin-panel">
            <div className="admin-panel__head">
              <div>
                <h2>Recent notifications</h2>
                <p>Everything delivered, newest first — system + admin-composed.</p>
              </div>
            </div>
            <div className="maintenance-admin-list">
              {notifRecent.length === 0 ? <div className="empty-state">No notifications yet.</div> : null}
              {notifRecent.map((n) => (
                <article className="maintenance-admin-card" key={n.id}>
                  <div className="maintenance-admin-card__top">
                    <div>
                      <strong>{n.title}</strong>
                      <span>→ {n.recipient} ({n.recipientEmail}) · {new Date(n.createdAt).toLocaleString()}{n.readAt ? ' · read' : ' · unread'}</span>
                    </div>
                    <StatusBadge tone={n.type === 'success' ? 'good' : n.type === 'warning' ? 'attention' : 'neutral'}>{n.type}</StatusBadge>
                  </div>
                  {n.body ? <p className="maintenance-admin-card__desc">{n.body}</p> : null}
                  {n.link ? <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Link: {n.link}</p> : null}
                </article>
              ))}
            </div>

            {notifPageCount > 1 ? (
              <div className="pagination">
                <button
                  className="ghost-button compact-button"
                  disabled={notifPage === 0}
                  onClick={() => setNotifPage((page) => Math.max(0, page - 1))}
                >
                  Previous
                </button>
                <span className="pagination__info">
                  Page {notifPage + 1} of {notifPageCount} · {notifTotal} notification{notifTotal === 1 ? '' : 's'}
                </span>
                <button
                  className="ghost-button compact-button"
                  disabled={notifPage >= notifPageCount - 1}
                  onClick={() => setNotifPage((page) => Math.min(notifPageCount - 1, page + 1))}
                >
                  Next
                </button>
              </div>
            ) : null}
          </section>
        </>
        ) : null}

        {adminTab === 'resources' ? (() => {
          const q = resourcesSearch.trim().toLowerCase();
          const categories = ['ALL', ...Array.from(new Set(resources.map((r) => r.category))).sort()];
          const filteredResources = resources
            .filter((r) => resourcesFilter === 'ALL' || r.category === resourcesFilter)
            .filter((r) => !q || r.title.toLowerCase().includes(q) || r.category.toLowerCase().includes(q));
          return (
        <section className="panel admin-panel">
          <div className="admin-panel__head">
            <div>
              <h2>Resources</h2>
              <p>Guides shown to members in the Resource Hub. Supports ## headings, - bullets, **bold**, and [links](https://…).</p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input placeholder="Search…" value={resourcesSearch} onChange={(event) => setResourcesSearch(event.target.value)} style={{ minWidth: 180 }} />
              {categories.length > 1 ? (
                <div className="tab-row">
                  {categories.map((c) => (
                    <button key={c} className={resourcesFilter === c ? 'tab-chip tab-chip--active' : 'tab-chip'} onClick={() => setResourcesFilter(c)}>{c}</button>
                  ))}
                </div>
              ) : null}
              <button className="primary-button compact-button" onClick={() => setResourceForm({ title: '', category: 'General', body: '', published: true })}>New article</button>
            </div>
          </div>
          <div className="resource-admin-list">
            {filteredResources.length === 0 ? <div className="empty-state">No resources in this view.</div> : null}
            {filteredResources.map((r) => (
              <div className="resource-admin-row" key={r.id}>
                <div className="resource-admin-row__id">
                  <strong>{r.title}</strong>
                  <span>{r.category}{r.published ? '' : ' · draft'}</span>
                </div>
                <div className="resource-admin-row__actions">
                  <button className="ghost-button compact-button" title="Move up" onClick={() => void reorderResource(r.id, 'up')}>↑</button>
                  <button className="ghost-button compact-button" title="Move down" onClick={() => void reorderResource(r.id, 'down')}>↓</button>
                  <button className="ghost-button compact-button" onClick={() => setResourceForm({ id: r.id, title: r.title, category: r.category, body: r.body, published: r.published })}>Edit</button>
                  <button className="compact-button applicant-action--danger" onClick={() => void deleteResource(r.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </section>
          );
        })() : null}

        {adminTab === 'events' ? (
        <section className="panel admin-panel">
          <div className="admin-panel__head">
            <div>
              <h2>Events</h2>
              <p>Publishing an event notifies every member once. Drafts stay hidden until then.</p>
            </div>
            <button
              className="primary-button compact-button"
              onClick={() => setEventForm({ title: '', description: '', location: '', startsAt: '', endsAt: '', capacity: '', published: false })}
            >
              New event
            </button>
          </div>
          <div className="maintenance-admin-list">
            {events.length === 0 ? <div className="empty-state">No events yet — create the first one.</div> : null}
            {events.map((event) => (
              <article className="maintenance-admin-card" key={event.id}>
                <div className="maintenance-admin-card__top">
                  <div>
                    <strong>{event.title}</strong>
                    <span>
                      {new Date(event.startsAt).toLocaleString()}
                      {event.location ? ` · ${event.location}` : ''}
                      {` · ${event.goingCount} going`}
                      {event.maybeCount > 0 ? `, ${event.maybeCount} maybe` : ''}
                      {event.capacity !== null ? ` · cap ${event.capacity}` : ''}
                    </span>
                  </div>
                  <StatusBadge tone={event.published ? 'good' : 'neutral'}>
                    {event.published ? 'Published' : 'Draft'}
                  </StatusBadge>
                </div>
                {event.description ? <p className="maintenance-admin-card__desc">{event.description}</p> : null}
                <div className="maintenance-admin-card__row">
                  <button
                    className="ghost-button compact-button"
                    onClick={() => setEventForm({
                      id: event.id,
                      title: event.title,
                      description: event.description ?? '',
                      location: event.location ?? '',
                      startsAt: toLocalInput(event.startsAt),
                      endsAt: toLocalInput(event.endsAt),
                      capacity: event.capacity === null ? '' : String(event.capacity),
                      published: event.published,
                    })}
                  >
                    Edit
                  </button>
                  {!event.published ? (
                    <button
                      className="primary-button compact-button"
                      onClick={() => void apiRequest<AdminEvent[]>(`/admin/events/${event.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ published: true }),
                      }).then(setEvents).catch((e) => setError(e instanceof Error ? e.message : 'Could not publish.'))}
                    >
                      Publish
                    </button>
                  ) : null}
                  {event.attendees.length > 0 ? (
                    <button
                      className="ghost-button compact-button"
                      onClick={() => setExpandedEventId(expandedEventId === event.id ? null : event.id)}
                    >
                      {expandedEventId === event.id ? 'Hide' : 'Show'} attendees ({event.attendees.length})
                    </button>
                  ) : null}
                  <button className="compact-button applicant-action--danger" onClick={() => void deleteEvent(event.id)}>
                    Delete
                  </button>
                </div>
                {expandedEventId === event.id ? (
                  <div className="detail-box" style={{ marginTop: 10 }}>
                    {event.attendees.map((attendee) => (
                      <div key={attendee.email}>
                        <span>{attendee.name}</span>
                        <strong>{attendee.status === 'GOING' ? 'Going' : 'Maybe'}</strong>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
        ) : null}

        {adminTab === 'vehicles' ? (() => {
          const q = vehiclesSearch.trim().toLowerCase();
          const filteredVehicles = vehicles.filter((v) => !q || v.name.toLowerCase().includes(q) || (v.description ?? '').toLowerCase().includes(q));
          const filteredBookings = vehicleBookings.filter((b) =>
            !q || b.vehicle.name.toLowerCase().includes(q) || b.renterEmail.toLowerCase().includes(q) || (b.renterName ?? '').toLowerCase().includes(q)
          );
          return (
        <>
        <section className="panel admin-panel">
          <div className="admin-panel__head">
            <div>
              <h2>Vehicles</h2>
              <p>Community cars members can rent for free.</p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input placeholder="Search…" value={vehiclesSearch} onChange={(event) => setVehiclesSearch(event.target.value)} style={{ minWidth: 180 }} />
              <button className="primary-button compact-button" onClick={() => setVehicleForm({ name: '', description: '', active: true })}>Add vehicle</button>
            </div>
          </div>
          <div className="resource-admin-list">
            {filteredVehicles.length === 0 ? <div className="empty-state">No vehicles in this view.</div> : null}
            {filteredVehicles.map((v) => (
              <div className="resource-admin-row" key={v.id}>
                <div className="resource-admin-row__id">
                  <strong>{v.name}</strong>
                  <span>{v.active ? 'Active' : 'Inactive'}{v._count?.bookings ? ` · ${v._count.bookings} booking${v._count.bookings === 1 ? '' : 's'}` : ''}</span>
                </div>
                <div className="resource-admin-row__actions">
                  <button className="ghost-button compact-button" onClick={() => setVehicleForm({ id: v.id, name: v.name, description: v.description ?? '', active: v.active })}>Edit</button>
                  <button className="compact-button applicant-action--danger" onClick={() => void deleteVehicle(v.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel admin-panel">
          <div className="admin-panel__head">
            <div>
              <h2>Bookings</h2>
              <p>All member reservations. Cancel one to free up the dates.</p>
            </div>
          </div>
          <div className="maintenance-admin-list">
            {filteredBookings.length === 0 ? <div className="empty-state">No bookings in this view.</div> : null}
            {filteredBookings.map((b) => (
              <article className="maintenance-admin-card" key={b.id}>
                <div className="maintenance-admin-card__top">
                  <div>
                    <strong>{b.vehicle.name}</strong>
                    <span>{b.renterName} ({b.renterEmail}) · {new Date(b.startDate).toLocaleDateString()} → {new Date(b.endDate).toLocaleDateString()}</span>
                  </div>
                  <StatusBadge tone={b.status === 'CANCELLED' ? 'neutral' : 'good'}>{b.status}</StatusBadge>
                </div>
                {b.status !== 'CANCELLED' ? (
                  <div className="maintenance-admin-card__row">
                    <button className="compact-button applicant-action--danger" onClick={() => void cancelVehicleBooking(b.id)}>Cancel booking</button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
        </>
          );
        })() : null}

        {adminTab === 'settings' ? (
        <section className="panel admin-panel" id="admin-membership-plans">
          <div className="admin-panel__head">
            <div>
              <h2>Membership plans</h2>
              <p>What the apply form offers, and what it charges. Two prices per plan: the monthly rate, and the rate for a one-month stay.</p>
            </div>
            {!newPlan ? (
              <button
                className="primary-button compact-button"
                onClick={() => setNewPlan({ name: '', description: '', price: '', shortStayPrice: '', occupancy: '1', active: true })}
              >
                Add plan
              </button>
            ) : null}
          </div>

          <div className="plan-list">
            {membershipPlans.length === 0 && !newPlan ? <div className="empty-state">No plans yet — the apply form has nothing to offer.</div> : null}

            {membershipPlans.map((plan) => {
              const draft = planDrafts[plan.id] ?? draftFrom(plan);
              const editing = editingPlanId === plan.id;
              const update = (patch: Partial<PlanDraft>) =>
                setPlanDrafts((current) => ({ ...current, [plan.id]: { ...draft, ...patch } }));

              if (!editing) {
                return (
                  <article className={plan.active ? 'plan-row' : 'plan-row plan-row--retired'} key={plan.id}>
                    <div className="plan-card">
                      <div className="plan-card__id">
                        <strong>{plan.name}</strong>
                        <small>
                          {plan.occupancy} {plan.occupancy === 1 ? 'person' : 'people'}
                          {plan.description ? ` · ${plan.description}` : ''}
                        </small>
                      </div>
                      <dl className="plan-card__prices">
                        <div>
                          <dt>Monthly</dt>
                          <dd>{planMoney(plan.priceCents, plan.currency)}</dd>
                        </div>
                        <div>
                          <dt>1-month stay</dt>
                          <dd>{planMoney(plan.shortStayPriceCents, plan.currency)}</dd>
                        </div>
                      </dl>
                      <div className="plan-card__end">
                        <span className={plan.active ? 'plan-badge plan-badge--live' : 'plan-badge'}>
                          {plan.active ? 'On the apply form' : 'Retired'}
                        </span>
                        <button className="ghost-button compact-button" onClick={() => setEditingPlanId(plan.id)}>
                          <Pencil size={14} />
                          Edit
                        </button>
                      </div>
                    </div>
                  </article>
                );
              }

              return (
                <article className="plan-row plan-row--editing" key={plan.id}>
                  <div className="plan-row__fields">
                    <label>
                      Name
                      <input value={draft.name} onChange={(event) => update({ name: event.target.value })} />
                    </label>
                    <label>
                      Monthly ({plan.currency})
                      <input type="number" min="0" step="1" value={draft.price} onChange={(event) => update({ price: event.target.value })} />
                    </label>
                    <label>
                      1-month stay
                      <input type="number" min="0" step="1" value={draft.shortStayPrice} onChange={(event) => update({ shortStayPrice: event.target.value })} />
                    </label>
                    <label>
                      People
                      <input type="number" min="1" max="10" step="1" value={draft.occupancy} onChange={(event) => update({ occupancy: event.target.value })} />
                    </label>
                  </div>
                  <label className="plan-row__description">
                    Description
                    <input value={draft.description} onChange={(event) => update({ description: event.target.value })} placeholder="Shown under the price on the apply form" />
                  </label>
                  <div className="plan-row__actions">
                    <label className="plan-row__toggle">
                      <input type="checkbox" checked={draft.active} onChange={(event) => update({ active: event.target.checked })} />
                      Offered on the apply form
                    </label>
                    <div className="plan-row__buttons">
                      {plan.active ? (
                        <button className="ghost-button compact-button" onClick={() => void retirePlan(plan.id, plan.name)}>Retire</button>
                      ) : null}
                      <button className="ghost-button compact-button" onClick={() => cancelPlanEdit(plan)}>Cancel</button>
                      <button className="primary-button compact-button" onClick={() => void savePlan(plan.id)}>Save</button>
                    </div>
                  </div>
                </article>
              );
            })}

            {newPlan ? (
              <article className="plan-row plan-row--new">
                <div className="plan-row__fields">
                  <label>
                    Name
                    <input value={newPlan.name} onChange={(event) => setNewPlan({ ...newPlan, name: event.target.value })} placeholder="e.g. Private room" />
                  </label>
                  <label>
                    Monthly (USD)
                    <input type="number" min="0" step="1" value={newPlan.price} onChange={(event) => setNewPlan({ ...newPlan, price: event.target.value })} />
                  </label>
                  <label>
                    1-month stay
                    <input type="number" min="0" step="1" value={newPlan.shortStayPrice} onChange={(event) => setNewPlan({ ...newPlan, shortStayPrice: event.target.value })} />
                  </label>
                  <label>
                    People
                    <input type="number" min="1" max="10" step="1" value={newPlan.occupancy} onChange={(event) => setNewPlan({ ...newPlan, occupancy: event.target.value })} />
                  </label>
                </div>
                <label className="plan-row__description">
                  Description
                  <input value={newPlan.description} onChange={(event) => setNewPlan({ ...newPlan, description: event.target.value })} placeholder="Shown under the price on the apply form" />
                </label>
                <div className="plan-row__actions">
                  <span className="plan-row__hint">New plans are offered on the apply form straight away.</span>
                  <div className="plan-row__buttons">
                    <button className="ghost-button compact-button" onClick={() => setNewPlan(null)}>Cancel</button>
                    <button className="primary-button compact-button" onClick={() => void createPlan()}>Add plan</button>
                  </div>
                </div>
              </article>
            ) : null}
          </div>
        </section>
        ) : null}

        {adminTab === 'settings' ? (
        <section className="panel admin-panel" id="admin-global">
          <div className="admin-panel__head">
            <div>
              <h2>Global settings</h2>
              <p>Pick one ProsperaSub.com café meal plan and one cleaning plan — they apply to every member automatically.</p>
            </div>
          </div>

          <div className="global-settings">
            <label className="global-settings__field">
              Global café / meal plan
              <select value={globalMealPlanId} onChange={(event) => setGlobalMealPlanId(event.target.value)}>
                <option value="">— No global meal plan —</option>
                {globalSettings?.mealOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                    {option.weeklyPriceCents != null ? ` — ${formatMoney(option.weeklyPriceCents)}/wk` : ''}
                    {option.mealsPerDay != null ? ` · ${option.mealsPerDay} meals/day` : option.mealsPerWeek != null ? ` · ${option.mealsPerWeek} meals/wk` : ''}
                    {' (ProsperaSub)'}
                  </option>
                ))}
                <option value="custom">✏️ Custom plan (enter your own price)</option>
              </select>
            </label>
            <button className="primary-button" disabled={isSavingGlobal} onClick={() => void saveGlobalMealPlan()}>
              {isSavingGlobal ? 'Saving…' : 'Apply to all members'}
            </button>
          </div>

          {globalMealPlanId === 'custom' ? (
            <div className="custom-plan-fields">
              <p className="custom-plan-hint">Define your real meal tariff — this overrides the ProsperaSub.com catalog and applies to everyone.</p>
              <div className="custom-plan-grid">
                <label className="global-settings__field">
                  Plan name
                  <input value={customMealName} onChange={(event) => setCustomMealName(event.target.value)} placeholder="e.g. ProsperaSub Meal Plan" />
                </label>
                <label className="global-settings__field">
                  Price per week (USD)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={customMealPrice}
                    onChange={(event) => setCustomMealPrice(event.target.value)}
                    placeholder="135"
                  />
                </label>
                <label className="global-settings__field">
                  Meals
                  <input value={customMealMeals} onChange={(event) => setCustomMealMeals(event.target.value)} placeholder="3 meals/day" />
                </label>
              </div>
            </div>
          ) : null}

          {globalSettings?.mealPlan ? (
            <p className="global-settings__current">
              Meal plan applied to everyone: <strong>{globalSettings.mealPlan.name}</strong>
              {globalSettings.mealPlan.weeklyPriceCents != null ? ` · ${formatMoney(globalSettings.mealPlan.weeklyPriceCents)}/wk` : ''}
              {globalSettings.mealPlan.mealsLabel
                ? ` · ${globalSettings.mealPlan.mealsLabel}`
                : globalSettings.mealPlan.mealsPerDay != null
                  ? ` · ${globalSettings.mealPlan.mealsPerDay} meals/day`
                  : globalSettings.mealPlan.mealsPerWeek != null
                    ? ` · ${globalSettings.mealPlan.mealsPerWeek} meals/wk`
                    : ''}
            </p>
          ) : (
            <p className="global-settings__current">No global meal plan is set yet.</p>
          )}

          <div className="global-settings">
            <label className="global-settings__field">
              Global cleaning plan (ProsperaSub.com)
              <select value={globalCleaningPlanId} onChange={(event) => setGlobalCleaningPlanId(event.target.value)}>
                <option value="">— No global cleaning plan —</option>
                {globalSettings?.cleaningOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                    {option.pricePerCleaningCents != null ? ` — ${formatMoney(option.pricePerCleaningCents)}/cleaning` : ''}
                    {option.cleaningsPerMonth != null ? ` · ${option.cleaningsPerMonth}×/mo` : ''}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" disabled={isSavingGlobalCleaning} onClick={() => void saveGlobalCleaningPlan()}>
              {isSavingGlobalCleaning ? 'Saving…' : 'Apply to all members'}
            </button>
          </div>
          {globalSettings?.cleaningPlan ? (
            <p className="global-settings__current">
              Cleaning plan applied to everyone: <strong>{globalSettings.cleaningPlan.name}</strong>
              {globalSettings.cleaningPlan.serviceFrequency ? ` · ${globalSettings.cleaningPlan.serviceFrequency}` : ''}
            </p>
          ) : (
            <p className="global-settings__current">No global cleaning plan is set yet.</p>
          )}

          <div className="global-settings global-settings--batch">
            <label className="global-settings__field">
              Batch start date (shown on the landing)
              <input type="date" value={batchStartDate} onChange={(event) => setBatchStartDate(event.target.value)} />
            </label>
            <label className="global-settings__field">
              Badge label (optional — auto-built from the date if empty)
              <input value={batchLabel} onChange={(event) => setBatchLabel(event.target.value)} placeholder="e.g. First Batch · Starting September 1, 2026" />
            </label>
            <button className="primary-button" disabled={isSavingBatch} onClick={() => void saveBatch()}>
              {isSavingBatch ? 'Saving…' : 'Save batch start'}
            </button>
          </div>
          <p className="global-settings__current">
            {globalSettings?.batch?.startDate
              ? `Landing shows batch start: ${globalSettings.batch.startDate}${globalSettings.batch.label ? ` · "${globalSettings.batch.label}"` : ''}`
              : 'No batch start set — landing shows its default date.'}
          </p>

          {globalMessage ? <p className="form-success">{globalMessage}</p> : null}
        </section>
        ) : null}

        {adminTab === 'designations' ? (
        <section className="panel admin-panel" id="admin-designations">
          <div className="admin-panel__head">
            <div>
              <h2>Designations</h2>
              <p>Assign apartment, meal plan, and cleaning plan. Users needing assignment are shown first.</p>
            </div>
          </div>

          <div className="designation-toolbar">
            <div className="designation-search">
              <Search size={16} />
              <input
                value={designationSearch}
                onChange={(event) => setDesignationSearch(event.target.value)}
                placeholder="Search by name or email…"
                aria-label="Search users to designate"
              />
            </div>
            <div className="designation-filter-bar" role="group" aria-label="Designation filters">
              {designationFilters.map((filter) => (
                <button
                  className={designationFilter === filter.id ? 'designation-filter designation-filter--active' : 'designation-filter'}
                  key={filter.id}
                  onClick={() => setDesignationFilter(filter.id)}
                >
                  <span>{filter.label}</span>
                  <strong>{designationCountFor(filter.id)}</strong>
                </button>
              ))}
            </div>
          </div>

          {/* A list, not a wall of forms. Eight cards each carrying three open
              dropdowns and its own full-width Save gave every row the weight of
              a task, whether it needed one or not — and the page never told you
              at a glance who was actually missing something. Rows read as
              answers; the form only appears on the one you're changing. */}
          <div className="assign-list">
            {allDesignationUsers.length === 0 ? <div className="empty-state">No users to designate yet.</div> : null}
            {allDesignationUsers.length > 0 && designationUsers.length === 0 ? (
              <div className="empty-state">No users match this search or filter.</div>
            ) : null}
            {designationUsers.map((user) => {
              const draft = designationDrafts[user.id] ?? emptyDesignationDraft;
              const complete = isDesignationComplete(user);
              const editing = editingDesignationId === user.id;

              return (
                <article className={`assign-row${editing ? ' assign-row--editing' : ''}${complete ? '' : ' assign-row--todo'}`} key={user.id}>
                  <div className="assign-row__person">
                    <span className="assign-row__avatar" aria-hidden="true">
                      {(user.fullName ?? user.email).slice(0, 2).toUpperCase()}
                    </span>
                    <span className="assign-row__id">
                      <strong>
                        {user.fullName ?? user.email}
                        {isNewUser(user.createdAt) ? <span className="badge-new">NEW</span> : null}
                      </strong>
                      <small>{user.email}</small>
                    </span>
                  </div>

                  {editing ? (
                    <div className="assign-row__form">
                      <label>
                        Apartment
                        <select
                          value={draft.apartmentName}
                          onChange={(event) => updateDesignationDraft(user.id, 'apartmentName', event.target.value)}
                        >
                          <option value="">— None —</option>
                          {optionNames(globalSettings?.apartmentOptions.map((option) => option.name) ?? [], draft.apartmentName).map((name) => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Meal plan
                        <select
                          value={draft.mealPlan}
                          onChange={(event) => updateDesignationDraft(user.id, 'mealPlan', event.target.value)}
                        >
                          <option value="">— None —</option>
                          {optionNames(globalSettings?.mealOptions.map((option) => option.name) ?? [], draft.mealPlan).map((name) => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                        {/* Nested under the plan it belongs to, and only once
                            there is one — a start date for no meals is a
                            question about nothing. */}
                        {draft.mealPlan ? (
                          <span className="assign-row__sub">
                            <span>Deliveries start</span>
                            <input
                              type="date"
                              value={draft.mealStartDate}
                              onChange={(event) => updateDesignationDraft(user.id, 'mealStartDate', event.target.value)}
                              aria-label="First meal delivery"
                            />
                            <small>{draft.mealStartDate ? 'First delivery on this date.' : 'Empty starts today.'}</small>
                          </span>
                        ) : null}
                      </label>
                      <label>
                        Cleaning plan
                        <select
                          value={draft.cleaningPlan}
                          onChange={(event) => updateDesignationDraft(user.id, 'cleaningPlan', event.target.value)}
                        >
                          <option value="">— None —</option>
                          {optionNames(globalSettings?.cleaningOptions.map((option) => option.name) ?? [], draft.cleaningPlan).map((name) => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : (
                    <dl className="assign-row__values">
                      <div>
                        <dt>Apartment</dt>
                        <dd className={user.apartment ? undefined : 'assign-row__empty'}>{user.apartment ?? 'Not set'}</dd>
                      </div>
                      <div>
                        <dt>Meals</dt>
                        <dd className={user.mealPlan ? undefined : 'assign-row__empty'}>
                          {user.mealPlan ?? 'Not set'}
                          {user.mealPlan && user.mealStartDate ? (
                            <small>{mealStartLabel(user.mealStartDate)}</small>
                          ) : null}
                        </dd>
                      </div>
                      <div>
                        <dt>Cleaning</dt>
                        <dd className={user.cleaningPlan ? undefined : 'assign-row__empty'}>{user.cleaningPlan ?? 'Not set'}</dd>
                      </div>
                    </dl>
                  )}

                  <div className="assign-row__actions">
                    {editing ? (
                      <>
                        <button className="ghost-button compact-button" onClick={() => cancelDesignationEdit(user.id)}>
                          Cancel
                        </button>
                        <button className="primary-button compact-button" onClick={() => void saveDesignations(user.id)}>
                          Save
                        </button>
                      </>
                    ) : (
                      <>
                        <StatusBadge tone={complete ? 'good' : 'attention'}>{complete ? 'Assigned' : 'Needs assignment'}</StatusBadge>
                        <button className="ghost-button compact-button" onClick={() => setEditingDesignationId(user.id)}>
                          <Pencil size={14} />
                          {complete ? 'Edit' : 'Assign'}
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
        ) : null}

        {adminTab === 'residency' ? (() => {
          const q = residencySearch.trim().toLowerCase();
          const filteredReviews = residencyReviews
            .filter((r) => residencyFilter === 'ALL' || r.status === residencyFilter)
            .filter((r) => !q || (r.fullName ?? '').toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
          return (
        <section className="panel admin-panel" id="admin-residency">
          <div className="admin-panel__head">
            <div>
              <h2>E-Residency reviews</h2>
              <p>Members apply on Prospera.co and upload proof here. Verify it or send it back for changes.</p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input placeholder="Search…" value={residencySearch} onChange={(event) => setResidencySearch(event.target.value)} style={{ minWidth: 180 }} />
              <div className="tab-row">
                {(['PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'ALL'] as const).map((f) => (
                  <button key={f} className={residencyFilter === f ? 'tab-chip tab-chip--active' : 'tab-chip'} onClick={() => setResidencyFilter(f)}>
                    {f === 'PENDING_REVIEW' ? 'Pending' : f[0] + f.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="applicant-list">
            {filteredReviews.length === 0 ? <div className="empty-state">No E-Residency submissions in this view.</div> : null}
            {filteredReviews.map((review) => (
              <article className="applicant-card" key={review.userId}>
                <div className="admin-panel__head">
                  <div>
                    <strong>{review.fullName ?? review.email}</strong>
                    <div className="designation-card__email">{review.email}</div>
                    {review.submittedAt ? (
                      <small className="designation-card__joined">Submitted {new Date(review.submittedAt).toLocaleDateString()}</small>
                    ) : null}
                  </div>
                  <StatusBadge tone={review.status === 'VERIFIED' ? 'good' : review.status === 'REJECTED' ? 'danger' : 'attention'}>
                    {review.status === 'PENDING_REVIEW' ? 'Pending' : review.status === 'VERIFIED' ? 'Verified' : 'Rejected'}
                  </StatusBadge>
                </div>
                <div className="detail-box">
                  <div><span>Proof file</span><strong>{review.proofFileName ?? '—'}</strong></div>
                  {review.reviewNote ? <div><span>Note</span><strong>{review.reviewNote}</strong></div> : null}
                </div>
                <div className="button-row">
                  <button className="ghost-button" onClick={() => void viewResidencyProof(review)} disabled={!review.proofFileName}>
                    View proof
                  </button>
                  {review.status !== 'VERIFIED' ? (
                    <button className="primary-button" onClick={() => void reviewResidency(review.userId, 'VERIFIED')}>
                      Verify
                    </button>
                  ) : null}
                </div>
                {review.status !== 'VERIFIED' ? (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <input
                      style={{ flex: 1 }}
                      value={residencyRejectDrafts[review.userId] ?? ''}
                      onChange={(event) => setResidencyRejectDrafts((drafts) => ({ ...drafts, [review.userId]: event.target.value }))}
                      placeholder="Reason (optional)…"
                      aria-label="Rejection reason"
                    />
                    <button className="ghost-button" onClick={() => void reviewResidency(review.userId, 'REJECTED')}>
                      Reject
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
          );
        })() : null}
      </div>

      {proofView ? (
        <div className="modal-overlay" role="presentation" onClick={() => setProofView(null)}>
          <div className="proof-modal" role="dialog" aria-modal="true" aria-label="E-Residency proof" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>E-Residency proof</h2>
                <p>{proofView.review.fullName ?? proofView.review.email}</p>
              </div>
              <button className="icon-button" onClick={() => setProofView(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="proof-modal__viewer">
              {proofView.fileType === 'application/pdf' ? (
                <iframe src={proofView.src} title={proofView.fileName} />
              ) : (
                <img src={proofView.src} alt={proofView.fileName} />
              )}
            </div>
            {proofView.review.status !== 'VERIFIED' ? (
              <div className="button-row">
                <button
                  className="ghost-button"
                  onClick={() => { void reviewResidency(proofView.review.userId, 'REJECTED'); setProofView(null); }}
                >
                  Reject
                </button>
                <button
                  className="primary-button"
                  onClick={() => { void reviewResidency(proofView.review.userId, 'VERIFIED'); setProofView(null); }}
                >
                  Verify
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {resourceForm ? (
        <div className="modal-overlay" role="presentation" onClick={() => setResourceForm(null)}>
          <div className="profile-edit-modal" role="dialog" aria-modal="true" aria-label="Edit resource" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>{resourceForm.id ? 'Edit article' : 'New article'}</h2>
                <p>Shown to members in the Resource Hub.</p>
              </div>
              <button className="icon-button" onClick={() => setResourceForm(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="form-grid">
              <label>Title<input value={resourceForm.title} onChange={(event) => setResourceForm({ ...resourceForm, title: event.target.value })} placeholder="How to get E-Residency" /></label>
              <label>Category<input value={resourceForm.category} onChange={(event) => setResourceForm({ ...resourceForm, category: event.target.value })} placeholder="Getting started" /></label>
            </div>
            <label>Body<textarea value={resourceForm.body} onChange={(event) => setResourceForm({ ...resourceForm, body: event.target.value })} rows={10} placeholder="## Heading&#10;- bullet&#10;**bold**, [link](https://…)" /></label>
            <label className="checkbox-row">
              <input type="checkbox" checked={resourceForm.published} onChange={(event) => setResourceForm({ ...resourceForm, published: event.target.checked })} />
              Published (visible to members)
            </label>
            <button className="primary-button" onClick={() => void saveResource()}>Save article</button>
          </div>
        </div>
      ) : null}

      {vehicleForm ? (
        <div className="modal-overlay" role="presentation" onClick={() => setVehicleForm(null)}>
          <form
            className="profile-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Edit vehicle"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => { event.preventDefault(); void saveVehicle(); }}
          >
            <div className="modal-head">
              <div>
                <h2>{vehicleForm.id ? 'Edit vehicle' : 'Add vehicle'}</h2>
                <p>Members can rent this car for free from their Home page.</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setVehicleForm(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <label>Name<input value={vehicleForm.name} onChange={(event) => setVehicleForm({ ...vehicleForm, name: event.target.value })} placeholder="e.g. Toyota RAV4 (White)" autoFocus /></label>
            <label>Description<textarea value={vehicleForm.description} onChange={(event) => setVehicleForm({ ...vehicleForm, description: event.target.value })} rows={3} placeholder="Anything members should know — seats, fuel, quirks…" /></label>
            <label>Photo (optional)
              <input
                type="file"
                accept="image/*"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setVehicleForm({ ...vehicleForm, photoBase64: String(reader.result), photoFileName: file.name, photoFileType: file.type });
                  reader.readAsDataURL(file);
                }}
              />
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={vehicleForm.active} onChange={(event) => setVehicleForm({ ...vehicleForm, active: event.target.checked })} />
              Active (visible to members)
            </label>
            <button className="primary-button" type="submit">Save vehicle</button>
          </form>
        </div>
      ) : null}

      {eventForm ? (
        <div className="modal-overlay" role="presentation" onClick={() => setEventForm(null)}>
          <form
            className="profile-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-label={eventForm.id ? 'Edit event' : 'New event'}
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => { event.preventDefault(); void submitEvent(); }}
          >
            <div className="modal-head">
              <div>
                <h2>{eventForm.id ? 'Edit event' : 'New event'}</h2>
                <p>Members see published events in Community → Events.</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setEventForm(null)} aria-label="Close"><X size={18} /></button>
            </div>

            <label>
              Title
              <input value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} required placeholder="e.g. Friday founder dinner" />
            </label>
            <label>
              Description
              <textarea value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} rows={3} placeholder="What is it, who's it for?" />
            </label>
            <label>
              Location
              <input value={eventForm.location} onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })} placeholder="e.g. Rooftop, Duna" />
            </label>
            <div className="form-grid">
              <label>
                Starts
                <input type="datetime-local" value={eventForm.startsAt} onChange={(e) => setEventForm({ ...eventForm, startsAt: e.target.value })} required />
              </label>
              <label>
                Ends (optional)
                <input type="datetime-local" value={eventForm.endsAt} onChange={(e) => setEventForm({ ...eventForm, endsAt: e.target.value })} />
              </label>
            </div>
            <label>
              Capacity — leave empty for unlimited
              <input type="number" min="1" value={eventForm.capacity} onChange={(e) => setEventForm({ ...eventForm, capacity: e.target.value })} placeholder="Unlimited" />
            </label>
            <label className="directory-optin">
              <input type="checkbox" checked={eventForm.published} onChange={(e) => setEventForm({ ...eventForm, published: e.target.checked })} />
              <span>
                <strong>Published</strong>
                <small>Members can see and RSVP. Publishing sends a one-time notification.</small>
              </span>
            </label>

            <button className="primary-button" type="submit">{eventForm.id ? 'Save event' : 'Create event'}</button>
          </form>
        </div>
      ) : null}

      {invoiceForm ? (
        <div className="modal-overlay" role="presentation" onClick={() => setInvoiceForm(null)}>
          <form
            className="profile-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Create invoice"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => { event.preventDefault(); void submitInvoice(); }}
          >
            <div className="modal-head">
              <div>
                <h2>New invoice</h2>
                <p>Create a payment record for a member. They'll see it in their account.</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setInvoiceForm(null)} aria-label="Close"><X size={18} /></button>
            </div>
            <label>
              Member
              <select value={invoiceForm.userId} onChange={(event) => setInvoiceForm({ ...invoiceForm, userId: event.target.value })} required>
                <option value="">— pick a member —</option>
                {(overview?.users ?? []).map((u) => (
                  <option key={u.id} value={u.id}>{u.fullName ?? u.email} · {u.email}</option>
                ))}
              </select>
            </label>
            <div className="form-grid">
              <label>Amount (USD)<input type="number" step="0.01" min="0" value={invoiceForm.amountCents} onChange={(event) => setInvoiceForm({ ...invoiceForm, amountCents: event.target.value })} required /></label>
              <label>Due date<input type="date" value={invoiceForm.dueDate} onChange={(event) => setInvoiceForm({ ...invoiceForm, dueDate: event.target.value })} required /></label>
            </div>
            <label>
              Description
              <input value={invoiceForm.description} onChange={(event) => setInvoiceForm({ ...invoiceForm, description: event.target.value })} placeholder="e.g. Rent — August 2026" required />
            </label>
            <label>
              Payment link (optional)
              <input value={invoiceForm.payUrl} onChange={(event) => setInvoiceForm({ ...invoiceForm, payUrl: event.target.value })} placeholder="Leave empty for bank transfer" />
              {/* Optional on purpose: an invoice settled by transfer still has
                  to be visible to the member, it just has nowhere to click. */}
            </label>
            <button className="primary-button" type="submit">Create invoice &amp; notify</button>
          </form>
        </div>
      ) : null}

      {/* Last in the tree so it sits above the page without being part of its
          layout — saving something no longer shoves the whole dashboard down. */}
      <Toast message={notice} onDismiss={dismissNotice} />
    </div>
  );
}
