import { paymentSeverity } from './payment-status';

describe('paymentSeverity', () => {
  it('marks overdue payments as danger', () => {
    expect(paymentSeverity('OVERDUE')).toBe('danger');
  });
});
