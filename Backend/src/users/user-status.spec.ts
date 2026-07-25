import { membershipStatusLabel } from './user-status';

describe('membershipStatusLabel', () => {
  it('keeps Builders Node membership status separate and readable', () => {
    expect(membershipStatusLabel('APPLICANT')).toBe('Applicant');
    expect(membershipStatusLabel('APPROVED')).toBe('Approved');
    expect(membershipStatusLabel('ACTIVE_MEMBER')).toBe('Active Member');
  });
});
