/**
 * Shape and helpers for community-wide settings stored in the `GlobalSetting`
 * key/value table. Currently this drives the single global ProsperaSub.com meal
 * plan that automatically applies to every member.
 */

export const GLOBAL_MEAL_PLAN_KEY = 'global_meal_plan';
export const GLOBAL_CLEANING_PLAN_KEY = 'global_cleaning_plan';
export const BATCH_KEY = 'batch_start';

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
