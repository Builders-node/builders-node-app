import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

/**
 * The app's single QueryClient.
 *
 * Defaults are tuned for what this actually is: a residence dashboard opened on
 * phones, often on island mobile data. That pushes two ways at once — be
 * forgiving about reconnects, but don't burn the user's data or battery on
 * retries that can't succeed.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Dashboard data doesn't change second to second. Half a minute of
      // staleness means tab-switching is instant instead of refetching.
      staleTime: 30_000,
      gcTime: 5 * 60_000,

      // A 4xx won't fix itself on a second attempt — retrying a 401/403/404
      // just delays the error the user needs to see. Network and 5xx get one
      // retry, which covers the usual flaky-connection blip.
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 1;
      },

      // Coming back to a backgrounded tab, or regaining signal, should show
      // current data — both are common here.
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      // Never silently repeat a write.
      retry: false,
    },
  },
});

/** Query keys in one place, so invalidation can't drift from the fetch. */
export const qk = {
  profile: (userId: string) => ['profile', userId] as const,
  home: (userId: string) => ['home', userId] as const,
  residency: (userId: string) => ['residency', userId] as const,
  notifications: (userId: string) => ['notifications', userId] as const,
  adminCounters: () => ['admin', 'counters'] as const,
  directory: (search: string, skill: string | null) => ['directory', search, skill] as const,
  directoryProfile: (userId: string) => ['directory-profile', userId] as const,
  events: () => ['events'] as const,
  cleaningSlots: () => ['cleaning-slots'] as const,
  cleaning: (userId: string) => ['cleaning', userId] as const,
};
