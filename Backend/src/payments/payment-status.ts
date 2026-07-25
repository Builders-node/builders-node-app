export type PaymentStatus = 'PAID' | 'DUE' | 'OVERDUE' | 'FAILED';

export function paymentSeverity(status: PaymentStatus | string): 'good' | 'attention' | 'danger' {
  if (status === 'PAID') return 'good';
  if (status === 'OVERDUE' || status === 'FAILED') return 'danger';
  return 'attention';
}
