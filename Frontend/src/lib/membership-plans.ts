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

/**
 * Shown only while the catalogue is loading, or if it can't be read at all.
 *
 * The landing hero is the first thing a visitor sees, and "membership starts at
 * /month" is worse than a number that's a month out of date. This is the one
 * place a price is still written down — it used to be three sentences across
 * three components, each free to drift on its own.
 */
const FALLBACK_STARTING_PRICE = '$1,950';

/**
 * "Starting at ___" — the cheapest plan on offer, formatted for prose.
 *
 * `isSettled` matters more than it looks: a GSAP-animated heading splits its
 * text into per-character spans on mount and never re-splits (restoring
 * innerHTML crashes React), so a price that arrives afterwards would be frozen
 * at the fallback forever. Callers inside an animated title must wait for this
 * before rendering. Plain paragraphs can ignore it — React owns those.
 *
 * Whole dollars: these are marketing sentences, not an invoice.
 */
export function useStartingPrice(): { price: string; isSettled: boolean } {
  const { plans, isLoading } = useMembershipPlans();
  if (plans.length === 0) return { price: FALLBACK_STARTING_PRICE, isSettled: !isLoading };

  const cheapest = Math.min(...plans.map((plan) => plan.priceCents));
  return {
    price: new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: plans[0].currency,
      maximumFractionDigits: 0,
    }).format(cheapest / 100),
    isSettled: true,
  };
}
