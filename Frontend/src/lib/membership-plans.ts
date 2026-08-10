import { useEffect, useState } from 'react';
import { apiRequest } from './api';

export type MembershipPlanOption = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  /** Already resolved by the server: falls back to the monthly price. */
  shortStayPriceCents: number;
  currency: string;
  occupancy: number;
};

/**
 * The plans the apply form offers, priced by the admin.
 *
 * Not a React Query hook: the apply form is public and mounts outside the
 * member app's QueryClient. It's one small public read, so plain state keeps
 * the page free of a provider it otherwise doesn't need.
 */
export function useMembershipPlans() {
  const [plans, setPlans] = useState<MembershipPlanOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiRequest<MembershipPlanOption[]>('/public/membership-plans')
      .then((data) => {
        if (!cancelled) setPlans(data);
      })
      .catch(() => {
        // Leaving the list empty is the honest failure: an applicant should
        // not be shown a price we couldn't confirm.
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { plans, isLoading };
}
