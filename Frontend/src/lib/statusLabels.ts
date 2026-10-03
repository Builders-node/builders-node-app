/**
 * Human labels for the status codes the API sends.
 *
 * The backend stores statuses as plain SCREAMING_SNAKE strings (schema.prisma
 * has no enums; the allowed values live in comments and service code), and
 * the UI used to print them as-is — an admin read "FIRST_APPROVED" where the
 * pipeline means "first check passed". One map here so every badge and
 * dropdown says the same thing for the same state.
 *
 * Only codes whose plain reading is wrong or unclear strictly need an entry;
 * the rest are listed anyway so the full vocabulary is in one place. Anything
 * missing falls back to Title Case, which is at least readable.
 */
export const STATUS_LABELS: Record<string, string> = {
  // Membership
  APPLICANT: 'Applicant',
  MEMBER: 'Member',
  ACTIVE_MEMBER: 'Active member',
  PAST_MEMBER: 'Past member',
  FORMER_MEMBER: 'Former member',
  PAST_RESIDENT: 'Past resident',
  SUSPENDED: 'Suspended',

  // Roles
  SUPER_ADMIN: 'Super admin',
  MODERATOR: 'Moderator',
  COMMUNITY_LEADER: 'Community leader',
  ADMIN: 'Admin',

  // Application pipeline (order as in AdminDashboard's applicantStageIndex)
  SUBMITTED: 'Submitted',
  FIRST_APPROVED: 'First check passed',
  FIRST_REJECTED: 'Rejected at first check',
  MEETING_SCHEDULED: 'Meeting scheduled',
  MEETING_APPROVED: 'Meeting passed',
  MEETING_REJECTED: 'Rejected after meeting',
  APARTMENT_AVAILABLE: 'Apartment available',
  NO_APARTMENT_AVAILABLE: 'No apartment available',
  PAYMENT_LINK_SENT: 'Payment link sent',
  PAYMENT_CONFIRMED: 'Payment confirmed',
  CREDENTIALS_SENT: 'Onboarded',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  DECLINED: 'Declined',

  // Residency (E-Residency verification)
  NOT_STARTED: 'Not started',
  PENDING_REVIEW: 'Pending review',
  VERIFIED: 'Verified',

  // Payments and plans
  NOT_SENT: 'Not sent',
  PENDING: 'Pending',
  DUE: 'Due',
  OVERDUE: 'Overdue',
  PAID: 'Paid',
  PARTIAL: 'Partly paid',
  OWED: 'Owed',
  FAILED: 'Failed',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',

  // Support and maintenance tickets
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',

  // Units and vehicles
  AVAILABLE: 'Available',
  AVAILABLE_SOON: 'Available soon',
  OCCUPIED: 'Occupied',
  UNAVAILABLE: 'Unavailable',
  MAINTENANCE: 'Maintenance',
  ASSIGNED: 'Assigned',

  // Events
  GOING: 'Going',
  MAYBE: 'Maybe',
  SKIPPED: 'Skipped',
};

/** True for a raw status code ("NOT_SENT"), false for prose or numbers. */
export function isStatusCode(value: string): boolean {
  return /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/.test(value);
}

/** "FIRST_APPROVED" → "First check passed"; unknown codes → "Some New Code". */
export function statusLabel(code: string): string {
  return (
    STATUS_LABELS[code] ??
    code
      .split('_')
      .filter(Boolean)
      .map((word) => word[0] + word.slice(1).toLowerCase())
      .join(' ')
  );
}
