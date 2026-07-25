import { planWarning } from './subscription-status';

describe('planWarning', () => {
  it('does not warn for active plans', () => {
    expect(planWarning('ACTIVE')).toBeNull();
  });

  it('warns clearly for overdue plans', () => {
    expect(planWarning('OVERDUE')).toContain('overdue');
  });
});
