import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from './api';

type BatchValue = {
  /** Raw ISO date (YYYY-MM-DD) or null. */
  startDate: string | null;
  /** Optional custom badge label. */
  label: string | null;
};

/**
 * Only used when /public/settings can't be reached. Keep it in step with the
 * batch date in admin settings — a stale value here is what someone sees when
 * the API is down, so it should be the truth, not last year's truth.
 */
const FALLBACK_START_DATE = '2026-10-01';

/**
 * The first-arrival date, from admin settings.
 *
 * `isLoaded` is the important part: until the request settles we don't know the
 * real date, and callers must not render one. The landing page used to paint the
 * hardcoded fallback immediately and then visibly swap it for the real date a
 * moment later — September flipping to October in front of the visitor.
 */
/** How long to hide the date while waiting, before giving up and showing the fallback. */
const GRACE_MS = 1200;

export function useBatch() {
  const { data, isPending } = useQuery({
    queryKey: ['public-settings'],
    queryFn: ({ signal }) => apiRequest<{ batch: BatchValue }>('/public/settings', { signal }),
    // Public marketing copy; no reason to refetch it while someone reads the page.
    staleTime: 10 * 60_000,
  });

  // Waiting on `isPending` alone isn't safe: when the API is unreachable the
  // query can sit in pending indefinitely, and a permanently missing badge is
  // worse than a slightly stale date. After the grace period we show the
  // fallback regardless.
  const [waitedLongEnough, setWaitedLongEnough] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setWaitedLongEnough(true), GRACE_MS);
    return () => clearTimeout(timer);
  }, []);

  const startDate = data?.batch?.startDate ?? FALLBACK_START_DATE;
  const label = isPending ? null : data?.batch?.label ?? null;

  // Parse as a local date (avoid timezone shifting a YYYY-MM-DD by a day).
  const date = new Date(`${startDate}T00:00:00`);
  const valid = Number.isNaN(date.getTime()) ? new Date(`${FALLBACK_START_DATE}T00:00:00`) : date;

  return {
    startDate,
    label,
    date: valid,
    longDate: valid.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    monthDay: valid.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
    /** False until the real date is known. Don't show a date while this is false. */
    isLoaded: !isPending || waitedLongEnough,
  };
}
