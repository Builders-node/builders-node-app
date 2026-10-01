import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

/**
 * Whether the guide can actually be handed out.
 *
 * False until an admin has set the link it lives at. The page uses this to
 * stop offering something it cannot deliver — a landing whose main call to
 * action always errors is worse than one that quietly asks for the next best
 * thing instead.
 *
 * Shares the `public-settings` cache entry with the batch date and the
 * affiliate reward, so this costs no extra request.
 *
 * Starts false and only turns true on a real answer: showing the form and
 * pulling it away a moment later is worse than showing it a moment late.
 */
export function useGuideAvailable(): boolean {
  const { data } = useQuery({
    queryKey: ['public-settings'],
    queryFn: ({ signal }) => apiRequest<{ guide?: { available: boolean } }>('/public/settings', { signal }),
    staleTime: 10 * 60_000,
  });
  return data?.guide?.available === true;
}
