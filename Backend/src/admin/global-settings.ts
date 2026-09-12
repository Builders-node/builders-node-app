/**
 * Shape and helpers for community-wide settings stored in the `GlobalSetting`
 * key/value table. Currently this drives the single global ProsperaSub.com meal
 * plan that automatically applies to every member.
 */

export const GLOBAL_MEAL_PLAN_KEY = 'global_meal_plan';
export const GLOBAL_CLEANING_PLAN_KEY = 'global_cleaning_plan';
export const BATCH_KEY = 'batch_start';
export const AFFILIATE_KEY = 'affiliate_reward';

/**
 * What an affiliate is paid for one person who joins through them.
 *
 * Stored rather than written into the affiliate page, for the same reason
 * membership prices are: this number is a promise printed on a public page and
 * repeated in the emails we send affiliates, and the day it changes it has to
 * change in one place, not four.
 */
export interface AffiliateReward {
  /** Paid once, per person who joins. */
  rewardCents: number;
  currency: string;
}

/** Used until an admin sets one — the terms the program launched with. */
export const DEFAULT_AFFILIATE_REWARD: AffiliateReward = { rewardCents: 20_000, currency: 'USD' };

export function parseAffiliateReward(value: string | null | undefined): AffiliateReward {
  if (!value) return DEFAULT_AFFILIATE_REWARD;
  try {
    const parsed = JSON.parse(value) as Partial<AffiliateReward>;
    const cents = Number(parsed.rewardCents);
    return {
      // A missing or nonsense amount falls back rather than printing "$0 per
      // referral" on a recruiting page.
      rewardCents: Number.isFinite(cents) && cents > 0 ? Math.round(cents) : DEFAULT_AFFILIATE_REWARD.rewardCents,
      currency: typeof parsed.currency === 'string' && parsed.currency.trim() ? parsed.currency.trim().toUpperCase() : 'USD',
    };
  } catch {
    return DEFAULT_AFFILIATE_REWARD;
  }
}

export interface BatchInfo {
  /** ISO date (YYYY-MM-DD) the batch starts. */
  startDate: string | null;
  /** Optional custom label; when empty the UI builds one from startDate. */
  label: string | null;
}

export function parseBatch(value: string | null | undefined): BatchInfo {
  if (!value) return { startDate: null, label: null };
  try {
    const parsed = JSON.parse(value) as Partial<BatchInfo>;
    return {
      startDate: typeof parsed.startDate === 'string' ? parsed.startDate : null,
      label: typeof parsed.label === 'string' && parsed.label.length > 0 ? parsed.label : null,
    };
  } catch {
    return { startDate: null, label: null };
  }
}

export interface GlobalMealPlan {
  id: string;
  name: string;
  description: string | null;
  weeklyPriceCents: number | null;
  mealsPerWeek: number | null;
  mealsPerDay: number | null;
  daysPerWeek: number | null;
  /** Free-text portion description (e.g. "3 meals/day"); used by custom plans. */
  mealsLabel: string | null;
  deliveryInfo: string | null;
  location: string | null;
  imageUrl: string | null;
}

export interface GlobalCleaningPlan {
  id: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  pricePerCleaningCents: number | null;
  monthlyPriceCents: number | null;
  cleaningsPerMonth: number | null;
  serviceFrequency: string | null;
  apartmentType: string | null;
}

export function parseGlobalMealPlan(value: string | null | undefined): GlobalMealPlan | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<GlobalMealPlan>;
    if (!parsed || typeof parsed.id !== 'string' || typeof parsed.name !== 'string') {
      return null;
    }

    return {
      id: parsed.id,
      name: parsed.name,
      description: parsed.description ?? null,
      weeklyPriceCents: parsed.weeklyPriceCents ?? null,
      mealsPerWeek: parsed.mealsPerWeek ?? null,
      mealsPerDay: parsed.mealsPerDay ?? null,
      daysPerWeek: parsed.daysPerWeek ?? null,
      mealsLabel: parsed.mealsLabel ?? null,
      deliveryInfo: parsed.deliveryInfo ?? null,
      location: parsed.location ?? null,
      imageUrl: parsed.imageUrl ?? null,
    };
  } catch {
    return null;
  }
}

export function parseGlobalCleaningPlan(value: string | null | undefined): GlobalCleaningPlan | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<GlobalCleaningPlan>;
    if (!parsed || typeof parsed.id !== 'string' || typeof parsed.name !== 'string') {
      return null;
    }

    return {
      id: parsed.id,
      name: parsed.name,
      shortDescription: parsed.shortDescription ?? null,
      description: parsed.description ?? null,
      pricePerCleaningCents: parsed.pricePerCleaningCents ?? null,
      monthlyPriceCents: parsed.monthlyPriceCents ?? null,
      cleaningsPerMonth: parsed.cleaningsPerMonth ?? null,
      serviceFrequency: parsed.serviceFrequency ?? null,
      apartmentType: parsed.apartmentType ?? null,
    };
  } catch {
    return null;
  }
}
