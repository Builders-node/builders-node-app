import { ArrowLeft, Check, FileText, Home, Link as LinkIcon, Search, Send, ShieldCheck, Users, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import type { PageId, StatusTone } from '../data/dashboard';
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
    paymentStatus: string;
    paymentLink?: string | null;
    adminNote?: string | null;
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
    cleaningPlan?: string | null;
    mustChangePassword: boolean;
    createdAt: string;
  }>;
};

type DesignationUser = AdminOverview['users'][number];
type DesignationFilterId = 'all' | 'incomplete' | 'new' | 'members';
type Applicant = AdminOverview['applications'][number];
type ApplicantAction = { key: string; label: string; icon: ReactNode; tone?: 'ghost' | 'danger'; run: () => void };
type AdminTab = 'overview' | 'applicants' | 'residency' | 'designations' | 'maintenance' | 'resources' | 'settings';

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
  rentalRequests: Array<{ id: string; status: string; message?: string | null; moveInDate?: string | null; moveOutDate?: string | null; apartment: { name: string } }>;
  supportTickets: Array<{ id: string; subject: string; message: string; status: string; createdAt: string }>;
  summary: {
    paidTotalCents: number;
    openPayments: number;
    supportTickets: number;
    rentalRequests: number;
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
const APPLICANT_STAGES = ['Apply', 'First check', 'Meeting', 'Apartment', 'Payment', 'Password'];

// Kanban columns for the pipeline board, keyed by the applicant's current stage.
const PIPELINE_COLUMNS: { stage: number; title: string }[] = [
  { stage: 1, title: 'First check' },
  { stage: 2, title: 'Meeting' },
  { stage: 3, title: 'Apartment' },
  { stage: 4, title: 'Payment' },
  { stage: 5, title: 'Credentials' },
  { stage: 6, title: 'Onboarded' },
  { stage: -1, title: 'Rejected' },
];

function pipelineStage(status: string, apartmentAvailable?: boolean | null): number {
  const index = applicantStageIndex(status, apartmentAvailable);
  return index < 0 ? -1 : Math.min(index, 6);
}

type ApplicantBucket = 'action' | 'onboarded' | 'rejected';
type ApplicantFilterId = 'all' | ApplicantBucket;
const APPLICANTS_PER_PAGE = 8;

// Index of the stage the applicant is currently AT (stages before it are done).
// 6 = fully onboarded, -1 = rejected / no apartment.
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
    case 'PAYMENT_CONFIRMED':
      return 5;
    case 'CREDENTIALS_SENT':
      return 6;
    default:
      return status.includes('REJECTED') || status === 'NO_APARTMENT_AVAILABLE' ? -1 : 1;
  }
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

export function AdminDashboard({ currentUserRole, setActivePage }: AdminDashboardProps) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [isUserDetailLoading, setIsUserDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentialMessage, setCredentialMessage] = useState<string | null>(null);
  const [adminTab, setAdminTab] = useState<AdminTab>('overview');
  const [applicantView, setApplicantView] = useState<'list' | 'board'>('board');
  const [maintenance, setMaintenance] = useState<AdminMaintenance[]>([]);
  const [resources, setResources] = useState<AdminResource[]>([]);
  const [resourceForm, setResourceForm] = useState<{ id?: string; title: string; category: string; body: string; published: boolean } | null>(null);
  useEscapeToClose(Boolean(resourceForm), () => setResourceForm(null));
  const [residencyReviews, setResidencyReviews] = useState<ResidencyReview[]>([]);
  const [residencyRejectDrafts, setResidencyRejectDrafts] = useState<Record<string, string>>({});
  const [proofView, setProofView] = useState<{ review: ResidencyReview; src: string; fileType: string; fileName: string } | null>(null);
  useEscapeToClose(Boolean(proofView), () => setProofView(null));
  const [applicantSearch, setApplicantSearch] = useState('');
  const [applicantFilter, setApplicantFilter] = useState<ApplicantFilterId>('action');
  const [applicantPage, setApplicantPage] = useState(0);
  const [designationDrafts, setDesignationDrafts] = useState<Record<string, { apartmentName: string; mealPlan: string; cleaningPlan: string }>>({});
  const [designationSearch, setDesignationSearch] = useState('');
  const [designationFilter, setDesignationFilter] = useState<DesignationFilterId>('all');
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);
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
    setCredentialMessage(null);
    try {
      const note = decision === 'REJECTED' ? residencyRejectDrafts[userId]?.trim() : undefined;
      const data = await apiRequest<ResidencyReview[]>(`/admin/users/${userId}/residency/review`, {
        method: 'POST',
        body: JSON.stringify({ decision, note }),
      });
      setResidencyReviews(data);
      setCredentialMessage(decision === 'VERIFIED' ? 'E-Residency verified.' : 'E-Residency sent back for changes.');
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
  const filteredApplicants = allApplicants
    .filter(activeApplicantFilter.matches)
    .filter(
      (app) =>
        !applicantQuery ||
        (app.fullName ?? '').toLowerCase().includes(applicantQuery) ||
        app.email.toLowerCase().includes(applicantQuery),
    );
  const applicantPageCount = Math.max(1, Math.ceil(filteredApplicants.length / APPLICANTS_PER_PAGE));
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

  // Admin sub-pages. Counts surface pending work so the admin sees it at a glance.
  const adminTabs: Array<{ id: AdminTab; label: string; count?: number }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'applicants', label: 'Applicants', count: applicantCountFor('action') },
    { id: 'residency', label: 'E-Residency', count: residencyPendingCount },
    { id: 'designations', label: 'Designations', count: designationCountFor('incomplete') },
    { id: 'maintenance', label: 'Maintenance', count: maintenance.filter((m) => m.status !== 'RESOLVED').length },
    { id: 'resources', label: 'Resources' },
    { id: 'settings', label: 'Global settings' },
  ];

  async function refreshOverview() {
    const data = await apiRequest<AdminOverview>('/admin/overview');
    setOverview(data);
    setDesignationDrafts((current) => {
      const next = { ...current };
      data.users.forEach((user) => {
        next[user.id] = {
          apartmentName: current[user.id]?.apartmentName ?? user.apartment ?? '',
          mealPlan: current[user.id]?.mealPlan ?? user.mealPlan ?? '',
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

  async function loadResources() {
    try {
      setResources(await apiRequest<AdminResource[]>('/admin/resources'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load resources.');
    }
  }

  useEffect(() => {
    if (adminTab === 'maintenance') void loadMaintenance();
    if (adminTab === 'resources') void loadResources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminTab]);

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

  async function sendCredentials(applicationId: string) {
    setError(null);
    setCredentialMessage(null);
    try {
      const result = await apiRequest<{
        invitation: { to: string; setupUrl: string; temporaryPassword: string };
      }>(`/admin/applications/${applicationId}/send-credentials`, {
        method: 'POST',
      });
      setCredentialMessage(`Credentials for ${result.invitation.to}: ${result.invitation.setupUrl} temporary password ${result.invitation.temporaryPassword}`);
      await refreshOverview();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not send credentials.');
    }
  }

  async function updateApplication(applicationId: string, path: string, body?: object, success?: string) {
    setError(null);
    setCredentialMessage(null);
    try {
      await apiRequest(`/admin/applications/${applicationId}/${path}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      });
      setCredentialMessage(success ?? 'Application updated.');
      await refreshOverview();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update application.');
    }
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
      return {
        primary: { key: 'meet', label: 'Approve meeting', icon: <ShieldCheck size={15} />, run: run('online-meeting-check', { approved: true }, 'Online meeting approved.') },
        secondary: [{ key: 'meet-no', label: 'Reject', icon: <X size={15} />, tone: 'danger', run: run('online-meeting-check', { approved: false }, 'Applicant rejected after meeting.') }],
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

  function updateDesignationDraft(userId: string, field: 'apartmentName' | 'mealPlan' | 'cleaningPlan', value: string) {
    setDesignationDrafts((current) => ({
      ...current,
      [userId]: {
        apartmentName: current[userId]?.apartmentName ?? '',
        mealPlan: current[userId]?.mealPlan ?? '',
        cleaningPlan: current[userId]?.cleaningPlan ?? '',
        [field]: value,
      },
    }));
  }

  async function saveDesignations(userId: string) {
    const draft = designationDrafts[userId] ?? { apartmentName: '', mealPlan: '', cleaningPlan: '' };
    setError(null);
    setCredentialMessage(null);
    try {
      await apiRequest(`/admin/users/${userId}/designations`, {
        method: 'POST',
        body: JSON.stringify(draft),
      });
      setCredentialMessage('Designations saved for user.');
      await refreshOverview();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save designations.');
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
    setCredentialMessage(null);
    try {
      await apiRequest(`/admin/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      setCredentialMessage('User role updated.');
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
      { label: 'Rentals', value: selectedUser.summary.rentalRequests, detail: selectedUser.assignedApartment?.apartment.name ?? 'No assignment' },
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

  return (
    <div className="admin-shell">
      <div className="page-stack admin-page">
        <PageHeader
          title="Admin Dashboard"
          description={`Role access: ${roleLabel(currentUserRole ?? 'MEMBER')}. Manage applicants, members, designations, and operations from the same dashboard.`}
          action={
            <button className="ghost-button" onClick={() => setActivePage('profile')}>
              <Home size={16} />
              Member home
            </button>
          }
        />

        <nav className="admin-tabs" aria-label="Admin sections">
          {adminTabs.map((tab) => (
            <button
              className={adminTab === tab.id ? 'admin-tab admin-tab--active' : 'admin-tab'}
              key={tab.id}
              onClick={() => setAdminTab(tab.id)}
            >
              <span>{tab.label}</span>
              {tab.count ? <strong className="admin-tab__count">{tab.count}</strong> : null}
            </button>
          ))}
          <button className="admin-tab admin-tab--users" onClick={() => setActivePage('allUsers')}>
            <Users size={15} />
            All users
          </button>
        </nav>

        {isLoading ? <section className="panel"><p>Loading admin data...</p></section> : null}
        {isUserDetailLoading ? <section className="panel"><p>Loading user detail...</p></section> : null}
        {error ? <section className="panel"><p className="form-error">{error}</p></section> : null}
        {credentialMessage ? <section className="panel"><p className="form-success">{credentialMessage}</p></section> : null}

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
                { key: 'apps', label: 'Applications to review', count: overview.attention.pendingApplications, go: () => setAdminTab('applicants') },
                { key: 'res', label: 'E-Residency proofs', count: overview.attention.pendingResidency, go: () => setAdminTab('residency') },
                { key: 'tickets', label: 'Open support tickets', count: overview.attention.openTickets, go: undefined },
                { key: 'pay', label: 'Overdue payments', count: overview.attention.overduePayments, go: undefined },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`attention-card${item.count > 0 ? ' attention-card--active' : ''}${item.go ? '' : ' attention-card--static'}`}
                  onClick={item.go}
                  disabled={!item.go}
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
              <p>Follow the pipeline: checks, apartment availability, payment, then password creation.</p>
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
          </div>

          {applicantView === 'board' ? (
            <div className="pipeline-board">
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
                            {actions.primary || actions.secondary.length > 0 ? (
                              <div className="pipeline-card__actions">
                                {actions.secondary.map((action) => (
                                  <button
                                    key={action.key}
                                    className={action.tone === 'danger' ? 'compact-button applicant-action--danger' : 'ghost-button compact-button'}
                                    onClick={action.run}
                                  >
                                    {action.icon}
                                    {action.label}
                                  </button>
                                ))}
                                {actions.primary ? (
                                  <button className="primary-button compact-button" onClick={actions.primary.run}>
                                    {actions.primary.icon}
                                    {actions.primary.label}
                                  </button>
                                ) : null}
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
                    <div className="applicant-card__id">
                      <strong>{application.fullName}</strong>
                      <span>{application.email}</span>
                      {meta ? <small>{meta}</small> : null}
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

                  <div className="applicant-card__footer">
                    <span className="applicant-card__next">
                      {onboarded
                        ? 'Onboarded — member can create their password'
                        : `Next step: ${nextStepFor(application.status, application.apartmentAvailable, application.paymentStatus)}`}
                    </span>
                    <div className="applicant-card__actions">
                      {actions.secondary.map((action) => (
                        <button
                          className={action.tone === 'danger' ? 'compact-button applicant-action applicant-action--danger' : 'ghost-button compact-button'}
                          key={action.key}
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

        {adminTab === 'maintenance' ? (
        <section className="panel admin-panel">
          <div className="admin-panel__head">
            <div>
              <h2>Maintenance queue</h2>
              <p>Member-reported unit issues. Update status to keep members informed.</p>
            </div>
          </div>
          <div className="maintenance-admin-list">
            {maintenance.length === 0 ? <div className="empty-state">No maintenance requests.</div> : null}
            {maintenance.map((m) => (
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
        ) : null}

        {adminTab === 'resources' ? (
        <section className="panel admin-panel">
          <div className="admin-panel__head">
            <div>
              <h2>Resources</h2>
              <p>Guides shown to members in the Resource Hub. Supports ## headings, - bullets, **bold**, and [links](https://…).</p>
            </div>
            <button className="primary-button compact-button" onClick={() => setResourceForm({ title: '', category: 'General', body: '', published: true })}>New article</button>
          </div>
          <div className="resource-admin-list">
            {resources.length === 0 ? <div className="empty-state">No resources yet — create your first guide.</div> : null}
            {resources.map((r) => (
              <div className="resource-admin-row" key={r.id}>
                <div className="resource-admin-row__id">
                  <strong>{r.title}</strong>
                  <span>{r.category}{r.published ? '' : ' · draft'}</span>
                </div>
                <div className="resource-admin-row__actions">
                  <button className="ghost-button compact-button" onClick={() => setResourceForm({ id: r.id, title: r.title, category: r.category, body: r.body, published: r.published })}>Edit</button>
                  <button className="compact-button applicant-action--danger" onClick={() => void deleteResource(r.id)}>Delete</button>
                </div>
              </div>
            ))}
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

          <div className="designation-grid">
            {allDesignationUsers.length === 0 ? <div className="empty-state">No users to designate yet.</div> : null}
            {allDesignationUsers.length > 0 && designationUsers.length === 0 ? (
              <div className="empty-state">No users match this search or filter.</div>
            ) : null}
            {designationUsers.map((user) => {
              const draft = designationDrafts[user.id] ?? { apartmentName: '', mealPlan: '', cleaningPlan: '' };
              const complete = isDesignationComplete(user);

              return (
                <article className={complete ? 'designation-card' : 'designation-card designation-card--todo'} key={user.id}>
                  <div className="designation-card__head">
                    <div className="designation-card__id">
                      <div className="designation-card__name">
                        <strong>{user.fullName ?? user.email}</strong>
                        {isNewUser(user.createdAt) ? <span className="badge-new">NEW</span> : null}
                      </div>
                      <span className="designation-card__email">{user.email}</span>
                      <small className="designation-card__joined">{joinedLabel(user.createdAt)}</small>
                    </div>
                    <div className="designation-card__badges">
                      <StatusBadge tone={toneForStatus(user.membershipStatus ?? 'NONE')}>{user.membershipStatus ?? 'NONE'}</StatusBadge>
                      <StatusBadge tone={complete ? 'good' : 'attention'}>{complete ? 'Assigned' : 'Needs assignment'}</StatusBadge>
                    </div>
                  </div>

                  <div className="designation-fields">
                    <label>
                      Apartment
                      <select
                        value={draft.apartmentName}
                        onChange={(event) => updateDesignationDraft(user.id, 'apartmentName', event.target.value)}
                      >
                        <option value="">— Select apartment —</option>
                        {optionNames(globalSettings?.apartmentOptions.map((option) => option.name) ?? [], draft.apartmentName).map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Meal plan
                      <select
                        value={draft.mealPlan}
                        onChange={(event) => updateDesignationDraft(user.id, 'mealPlan', event.target.value)}
                      >
                        <option value="">— Select meal plan —</option>
                        {optionNames(globalSettings?.mealOptions.map((option) => option.name) ?? [], draft.mealPlan).map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Cleaning plan
                      <select
                        value={draft.cleaningPlan}
                        onChange={(event) => updateDesignationDraft(user.id, 'cleaningPlan', event.target.value)}
                      >
                        <option value="">— Select cleaning plan —</option>
                        {optionNames(globalSettings?.cleaningOptions.map((option) => option.name) ?? [], draft.cleaningPlan).map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <button className="primary-button" onClick={() => void saveDesignations(user.id)}>
                    Save designations
                  </button>
                </article>
              );
            })}
          </div>
        </section>
        ) : null}

        {adminTab === 'residency' ? (
        <section className="panel admin-panel" id="admin-residency">
          <div className="admin-panel__head">
            <div>
              <h2>E-Residency reviews</h2>
              <p>Members apply on Prospera.co and upload proof here. Verify it or send it back for changes.</p>
            </div>
          </div>
          <div className="applicant-list">
            {residencyReviews.length === 0 ? <div className="empty-state">No E-Residency submissions yet.</div> : null}
            {residencyReviews.map((review) => (
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
                  <button className="primary-button" onClick={() => void reviewResidency(review.userId, 'VERIFIED')} disabled={review.status === 'VERIFIED'}>
                    Verify
                  </button>
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
        ) : null}
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
    </div>
  );
}
