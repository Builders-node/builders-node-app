import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './api';
import { qk } from './queryClient';

/**
 * Every server read the member-facing app does, in one place.
 *
 * Before this, `/users/:id/profile` was fetched independently by App, Profile
 * and MyProfile — three requests for one payload, three loading states, and
 * three chances for them to disagree about the member's own name.
 */

export type Links = { website?: string; twitter?: string; linkedin?: string; github?: string };

/** The full `/users/:id/profile` payload. Different screens read different slices. */
export type MemberProfile = {
  email: string;
  role: string;
  referralCode?: string | null;
  emailVerifiedAt?: string | null;
  discordId?: string | null;
  discordUsername?: string | null;
  discordEnabled?: boolean;
  profile?: {
    fullName?: string | null;
    phone?: string | null;
    location?: string | null;
    headline?: string | null;
    bio?: string | null;
    skills?: string[];
    links?: Links;
    directoryOptIn?: boolean;
    avatarUrl?: string | null;
  } | null;
  membership?: {
    status: string;
    startingDate?: string | null;
    dueDate?: string | null;
    finishDate?: string | null;
  } | null;
  communityPlans?: Array<{
    id: string;
    planName: string;
    status: string;
    amountCents: number;
    currency: string;
    purchasedAt: string;
    startsAt?: string | null;
    endsAt?: string | null;
    renewalDate?: string | null;
    source: string;
  }>;
};

export type ResidencyData = {
  status: string; // NOT_STARTED | PENDING_REVIEW | VERIFIED | REJECTED
  applyUrl: string;
  hasProof: boolean;
  proofFileName?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
};

export type HomeMemberData = {
  account?: { externalMemberId?: string | null };
  membership?: { status: string; hasApplied: boolean; applicationStatus?: string | null };
  apartment: { name: string; status: string; moveInDate?: string | null; details: string } | null;
  meals: { items: Array<{ id: string; day: string; meal: string }> };
  cleaning: {
    nextCleaning?: string | null;
    frequency?: string | null;
    notes?: string | null;
    // The standing weekly slot, once the member has picked one.
    weekday?: number | null;
    weekdayName?: string | null;
    timeSlot?: string | null;
    booked?: boolean;
  } | null;
};

export type NotificationItem = {
  id: string;
  type: 'info' | 'success' | 'warning';
  title: string;
  body?: string | null;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
};

export type NotificationsPayload = { items: NotificationItem[]; unread: number };

export type DirectoryItem = {
  userId: string;
  fullName: string;
  location: string | null;
  avatarUrl: string | null;
  headline: string | null;
  skills: string[];
  memberSince: string | null;
  isSelf: boolean;
};

export type DirectoryDetail = DirectoryItem & {
  bio: string | null;
  links: Links;
  discordUsername: string | null;
};

export type DirectoryPayload = {
  items: DirectoryItem[];
  skills: Array<{ name: string; count: number }>;
};

export type MyDirectoryProfile = {
  fullName: string | null;
  headline: string | null;
  bio: string | null;
  skills: string[];
  links: Links;
  directoryOptIn: boolean;
};

// --- reads ------------------------------------------------------------------

export function useProfile(userId: string | null | undefined) {
  return useQuery({
    queryKey: qk.profile(userId ?? ''),
    queryFn: ({ signal }) => apiRequest<MemberProfile>(`/users/${userId}/profile`, { signal }),
    enabled: Boolean(userId),
  });
}

export function useResidency(userId: string | null | undefined) {
  return useQuery({
    queryKey: qk.residency(userId ?? ''),
    queryFn: ({ signal }) => apiRequest<ResidencyData>(`/users/${userId}/residency`, { signal }),
    enabled: Boolean(userId),
  });
}

export function useHome(userId: string | null | undefined) {
  return useQuery({
    queryKey: qk.home(userId ?? ''),
    queryFn: ({ signal }) => apiRequest<HomeMemberData>(`/users/${userId}/home`, { signal }),
    enabled: Boolean(userId),
  });
}

export function useNotifications(userId: string | null | undefined) {
  return useQuery({
    queryKey: qk.notifications(userId ?? ''),
    queryFn: ({ signal }) => apiRequest<NotificationsPayload>(`/users/${userId}/notifications`, { signal }),
    enabled: Boolean(userId),
    refetchInterval: 60_000,
    // A backgrounded tab shouldn't poll; returning to it refetches anyway.
    refetchIntervalInBackground: false,
  });
}

/**
 * Counts only — `/admin/overview` returns every application, user and payment,
 * which is far too much to poll for five numbers.
 */
export function useAdminCounters(enabled: boolean) {
  return useQuery({
    queryKey: qk.adminCounters(),
    queryFn: ({ signal }) => apiRequest<Record<string, number>>('/admin/counters', { signal }),
    enabled,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}

/**
 * The directory list. Keying on the search text is what fixes the old race:
 * an in-flight request for a stale query gets cancelled via `signal`, so a slow
 * response can no longer land on top of a newer one.
 */
export function useDirectory(search: string, skill: string | null) {
  const trimmed = search.trim();
  return useQuery({
    queryKey: qk.directory(trimmed, skill),
    queryFn: ({ signal }) => {
      const params = new URLSearchParams();
      if (trimmed) params.set('search', trimmed);
      if (skill) params.set('skill', skill);
      const qs = params.toString();
      return apiRequest<DirectoryPayload>(`/directory${qs ? `?${qs}` : ''}`, { signal });
    },
    // Keep the previous list on screen while a new search loads, instead of
    // flashing an empty state on every keystroke.
    placeholderData: (previous) => previous,
  });
}

export function useDirectoryProfile(userId: string | null | undefined) {
  return useQuery({
    queryKey: qk.directoryProfile(userId ?? ''),
    queryFn: ({ signal }) => apiRequest<MyDirectoryProfile>(`/users/${userId}/directory-profile`, { signal }),
    enabled: Boolean(userId),
  });
}

export type MyCleaning = {
  booked: boolean;
  weekday: number | null;
  weekdayName: string | null;
  timeSlot: string | null;
  nextCleaning: string | null;
  frequency: string | null;
  notes: string | null;
  /** What the member wants the cleaner to know — theirs, not the admin's `notes`. */
  memberNote: string | null;
  slots: string[];
  /** Start + end of each bookable window — a cleaning visit is ~1h45, not a point. */
  windows: Array<{ startTime: string; endTime: string | null }>;
  slotsSource: 'prospera' | 'default';
};

/**
 * The member's standing weekly cleaning slot, together with the slots on offer —
 * one request, because the picker needs both at once.
 */
export function useMyCleaning(userId: string | null | undefined) {
  return useQuery({
    queryKey: qk.cleaning(userId ?? ''),
    queryFn: ({ signal }) => apiRequest<MyCleaning>(`/users/${userId}/cleaning`, { signal }),
    enabled: Boolean(userId),
  });
}

/** Set or move the weekly slot. Replaces it — there's only ever one. */
export function useSetCleaning(userId: string | null | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { weekday: number; timeSlot: string; memberNote: string }) =>
      apiRequest<MyCleaning>(`/users/${userId}/cleaning`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: (data) => {
      if (!userId) return;
      client.setQueryData(qk.cleaning(userId), data);
      // Home shows the next cleaning date, so it has to catch up too.
      void client.invalidateQueries({ queryKey: qk.home(userId) });
    },
  });
}

export function useCleaningSlots(enabled: boolean) {
  return useQuery({
    queryKey: qk.cleaningSlots(),
    queryFn: ({ signal }) =>
      apiRequest<{ slots: string[]; source: 'prospera' | 'default' }>('/public/cleaning-slots', { signal }),
    enabled,
    // Slots come from ProsperaSub and barely move — no point refetching them
    // every time the modal opens.
    staleTime: 10 * 60_000,
  });
}

// --- writes -----------------------------------------------------------------

/**
 * Saving the profile has to invalidate everywhere the member's name, avatar or
 * directory opt-in is shown — the header, the directory card, the directory
 * editor. (The old code fired a `profile:updated` event that nothing listened
 * to, so the header kept the stale name until a reload.)
 */
export function useSaveProfile(userId: string | null | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest<unknown>(`/users/${userId}/profile`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => {
      if (!userId) return;
      void client.invalidateQueries({ queryKey: qk.profile(userId) });
      void client.invalidateQueries({ queryKey: qk.directoryProfile(userId) });
      void client.invalidateQueries({ queryKey: ['directory'] });
    },
  });
}

export function useMarkNotificationsRead(userId: string | null | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<unknown>(`/users/${userId}/notifications/read`, { method: 'POST', body: '{}' }),
    // Opening the panel is the read — the dot clears immediately rather than
    // waiting on a round trip.
    onMutate: () => {
      if (!userId) return;
      const key = qk.notifications(userId);
      void client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<NotificationsPayload>(key);
      if (previous) {
        const now = new Date().toISOString();
        client.setQueryData<NotificationsPayload>(key, {
          unread: 0,
          items: previous.items.map((item) => ({ ...item, readAt: item.readAt ?? now })),
        });
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      // Put the badge back if the server didn't actually record the read.
      if (userId && context?.previous) client.setQueryData(qk.notifications(userId), context.previous);
    },
  });
}
