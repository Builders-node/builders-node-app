import { residencyCallToAction } from './residency-status';

describe('residencyCallToAction', () => {
  it('prioritizes API sync errors over stale next steps', () => {
    expect(
      residencyCallToAction({
        status: 'ACTION_REQUIRED',
        stage: 'Identity check',
        requiredNextSteps: ['Upload passport'],
        lastError: 'Prospera API unavailable',
      }),
    ).toBe('We could not sync your E-Residency status. Try again or contact support.');
  });

  it('shows the first required next step when the API provides one', () => {
    expect(
      residencyCallToAction({
        status: 'ACTION_REQUIRED',
        stage: 'Documents',
        requiredNextSteps: ['Upload proof of address', 'Confirm legal name'],
      }),
    ).toBe('Upload proof of address');
  });
});
