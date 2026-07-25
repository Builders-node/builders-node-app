export type PlanStatus = 'ACTIVE' | 'PENDING' | 'OVERDUE' | 'CANCELLED';

export function planWarning(status: PlanStatus | string): string | null {
  const warnings: Record<PlanStatus, string | null> = {
    ACTIVE: null,
    PENDING: 'Your ProsperaSub.com plan is pending activation.',
    OVERDUE: 'Your plan payment is overdue. Please update payment to avoid interruption.',
    CANCELLED: 'Your subscription plan is cancelled.',
  };

  return warnings[status as PlanStatus] ?? null;
}
