import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from './api';

type AffiliateReward = {
  /** Paid once, per person who joins through the affiliate. */
  rewardCents: number;
  currency: string;
};

/**
 * Used only until /public/settings answers, and if it never does.
 *
 * Keep it in step with the amount in admin settings. This is the figure a
 * visitor reads when the API is down, so it should be the terms we are actually
 * offering rather than the terms we once offered.
 */
const FALLBACK_REWARD_CENTS = 20_000;

/**
 * How long to hold the headline back while waiting, before giving up and
 * showing the fallback.
 *
 * `isPending` alone isn't safe: when the API can't be reached the query can sit
 * pending for a long time, and this page's headline *is* the number — a hero
 * with no heading at all is far worse than one quoting a figure that hasn't
 * been confirmed yet.
 */
const GRACE_MS = 1200;

/**
 * What one referral pays, from admin settings.
 *
 * Quoted rather than written into the page for the same reason the membership
 * price is: it appears in the hero, in the steps, in the FAQ and in every
 * approval email, and four copies of a number is three chances to disagree.
 *
 * `isSettled` matters: the GSAP heading animation splits its text into
 * per-character spans on mount and can never re-split, so a heading that paints
 * the fallback first would keep the fallback forever.
 */
export function useAffiliateReward() {
  const { data, isPending } = useQuery({
    queryKey: ['public-settings'],
    queryFn: ({ signal }) => apiRequest<{ affiliate?: AffiliateReward }>('/public/settings', { signal }),
    // Public marketing copy; no reason to refetch it while someone reads the page.
    staleTime: 10 * 60_000,
  });

  const [waitedLongEnough, setWaitedLongEnough] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setWaitedLongEnough(true), GRACE_MS);
    return () => clearTimeout(timer);
  }, []);

  const cents = data?.affiliate?.rewardCents ?? FALLBACK_REWARD_CENTS;
  const currency = data?.affiliate?.currency ?? 'USD';

  return {
    cents,
    currency,
    /** "$200" — whole dollars, because the amount always is one. */
    amount: formatReward(cents, currency),
    /** False until the real amount is known, or we've waited long enough. */
    isSettled: !isPending || waitedLongEnough,
  };
}

function formatReward(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
