export type MembershipStatus = 'APPLICANT' | 'APPROVED' | 'ACTIVE_MEMBER';

export function membershipStatusLabel(status: MembershipStatus): string {
  const labels: Record<MembershipStatus, string> = {
    APPLICANT: 'Applicant',
    APPROVED: 'Approved',
    ACTIVE_MEMBER: 'Active Member',
  };

  return labels[status];
}
