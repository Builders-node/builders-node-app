import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Client for the official ProsperaSub API (https://api.prosperasub.com).
 *
 * Server-to-server only — authenticated with the `x-api-key` header. The key is
 * a privileged admin credential and MUST stay on the backend; never expose it to
 * the browser/frontend. The frontend talks to our own NestJS API, which proxies
 * to ProsperaSub here.
 *
 * Configuration (see `.env.example`):
 *   PROSPERA_SUB_API_BASE_URL  default https://api.prosperasub.com
 *   PROSPERA_SUB_API_KEY       ProsperaSub `psub_...` API key (server-side secret)
 *   PROSPERA_SUB_SITE_URL      public site for fallback links (default https://prosperasub.com)
 *
 * Data reads use PostgREST-style filters on /v1/data/{table}
 * (e.g. ?select=*&status=eq.active&order=sort_order.asc). Payments use /v1/payments.
 *
 * When no API key is configured the client returns mock data so the dashboard
 * keeps working in offline local development.
 */

export interface MealPlan {
  id: string;
  name: string;
  description: string | null;
  weeklyPriceCents: number | null;
  mealsPerWeek: number | null;
  mealsPerDay: number | null;
  daysPerWeek: number | null;
  deliveryInfo: string | null;
  location: string | null;
  imageUrl: string | null;
}

export interface CleaningPackage {
  id: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  pricePerCleaningCents: number | null;
  monthlyPriceCents: number | null;
  cleaningsPerMonth: number | null;
  serviceFrequency: string | null;
  apartmentType: string | null;
  /**
   * Time slots (HH:mm, 24h) the cleaner is available for this package.
   * ProsperaSub exposes these as `time_slots` on cleaning_packages when the
   * package supports scheduled slots; empty / omitted = no fixed slots.
   */
  timeSlots: string[];
}

export interface ProvisionMemberInput {
  /** Local Builders Node userId — used for the external_ref idempotency key. */
  userId: string;
  email: string;
  fullName?: string | null;
  /** E.164 phone / WhatsApp number, if we have it on the profile. */
  phone?: string | null;
  mealPlanId?: string | null;
  mealPlanName?: string | null;
  /** How many weeks of meals to bill for. Defaults to 4 (one month). */
  weeks?: number | null;
  /** Optional delivery address for the food subscription. */
  deliveryAddress?: string | null;
  /** Optional residence / building name — helps their kitchen route deliveries. */
  residence?: string | null;
  cleaningPlanId?: string | null;
  cleaningPlanName?: string | null;
  /** How many months of cleaning to bill for. Defaults to 1. */
  months?: number | null;
  /** Optional note for the cleaners about the apartment (pets, door code, …). */
  apartmentNote?: string | null;
  /**
   * Activate the Beach Club perk that comes with a Próspera E-Residency.
   * ProsperaSub creates the subscription on their side and returns a
   * beach_club_subscription_id in the response. Pass true only when the
   * member's residency is VERIFIED.
   */
  activateBeachClub?: boolean;
  /** ISO date the subscription becomes active (defaults to today). */
  startDate?: Date;
}

export interface ProvisionMemberResult {
  /** ACTIVE = provisioned on ProsperaSub; PENDING = queued (not yet configured / awaiting mapping). */
  status: 'ACTIVE' | 'PENDING' | 'PARTIAL';
  /** ProsperaSub user_id (once created/looked-up). */
  externalMemberId: string | null;
  /** ProsperaSub food_subscriptions row id. */
  externalFoodSubscriptionId: string | null;
  /** ProsperaSub cleaning_subscriptions row id. */
  externalCleaningSubscriptionId: string | null;
  /** ProsperaSub beach_club_subscriptions row id (set when residency is verified). */
  externalBeachClubSubscriptionId: string | null;
  message: string;
  /** Non-fatal issues encountered during provisioning (e.g. missing provider id). */
  warnings: string[];
  /** @deprecated old field kept for audit compatibility. */
  externalAccountId: string | null;
}

/**
 * ProsperaSub may return cleaning time slots in a few shapes depending on
 * how the column is typed:
 *   - "09:00,11:00,15:00"  (comma-separated string)
 *   - ["09:00","11:00"]    (JSON array)
 *   - null / undefined     (no slots configured)
 * Normalize to HH:mm strings, trim whitespace, dedupe, sort.
 */
function normalizeTimeSlots(raw: unknown): string[] {
  if (!raw) return [];
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(',')
      : [];
  const HH_MM = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  const seen = new Set<string>();
  for (const item of list) {
    const trimmed = String(item ?? '').trim();
    if (HH_MM.test(trimmed)) seen.add(trimmed);
  }
  return Array.from(seen).sort();
}

/**
 * ProsperaSub's real schema stores per-package booking config in a jsonb
 * column called `booking_settings` (not `time_slots`). Slots — if / when
 * the team adds them — will most likely land as booking_settings.time_slots
 * or booking_settings.slots. Look in both places so we pick them up without
 * a code change once they're populated.
 */
function extractTimeSlots(row: Record<string, unknown>): string[] {
  const topLevel = normalizeTimeSlots(row.time_slots);
  if (topLevel.length > 0) return topLevel;
  const booking = row.booking_settings as Record<string, unknown> | null | undefined;
  if (!booking || typeof booking !== 'object') return [];
  return normalizeTimeSlots(booking.time_slots ?? booking.slots);
}

export interface CreatePaymentInput {
  amountCents: number;
  currency?: string;
  description?: string;
  reference?: Record<string, unknown>;
}

export interface PaymentResult {
  paymentId: string | null;
  checkoutUrl: string | null;
  status: string | null;
}

@Injectable()
export class ProsperaSubClient {
  private readonly logger = new Logger(ProsperaSubClient.name);

  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return (this.config.get<string>('PROSPERA_SUB_API_BASE_URL') ?? 'https://api.prosperasub.com').replace(/\/$/, '');
  }

  private get apiKey(): string | undefined {
    const key = this.config.get<string>('PROSPERA_SUB_API_KEY');
    return key && key.length > 0 ? key : undefined;
  }

  private get siteUrl(): string {
    return this.config.get<string>('PROSPERA_SUB_SITE_URL') ?? 'https://prosperasub.com';
  }

  /**
   * Shared-secret bearer for the ProsperaSub /integrations/builders-node/*
   * endpoints. Distinct from PROSPERA_SUB_API_KEY (which is for their public
   * PostgREST data reads) — this one authenticates the Builders Node ↔
   * ProsperaSub back-channel and must be rotated together on both sides.
   */
  private get buildersNodeSecret(): string | undefined {
    const v = this.config.get<string>('BUILDERS_NODE_API_SECRET');
    return v && v.length > 0 ? v : undefined;
  }

  private get configured(): boolean {
    return Boolean(this.apiKey);
  }

  private headers(): Record<string, string> {
    return {
      'x-api-key': this.apiKey as string,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  private async request<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers(),
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.error(`ProsperaSub API ${method} ${path} -> ${response.status}: ${text.slice(0, 200)}`);
      throw new Error(`ProsperaSub API responded ${response.status}.`);
    }

    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }

  /**
   * Active meal PLANS from ProsperaSub (`food_meal_plans`) — the real customer-facing
   * tiers (e.g. "Standard Plan - 3 Times", $135/wk, 3 meals/day). NOTE: the
   * `food_providers` row carries only a provider-level summary and is NOT a real
   * plan, so we deliberately read `food_meal_plans` here.
   */
  async getMealsMenu(_userId: string): Promise<MealPlan[]> {
    if (!this.configured) {
      return [
        {
          id: 'mock-provider',
          name: 'ProsperaSub Meal Plan (mock)',
          description: 'Configure PROSPERA_SUB_API_KEY to load the live ProsperaSub menu.',
          weeklyPriceCents: null,
          mealsPerWeek: null,
          mealsPerDay: null,
          daysPerWeek: null,
          deliveryInfo: null,
          location: null,
          imageUrl: null,
        },
      ];
    }

    const rows = await this.request<Record<string, unknown>[]>(
      'GET',
      '/v1/data/food_meal_plans?select=*&status=eq.active&order=weekly_price_cents.desc',
    );

    return (rows ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      description: (row.description as string) ?? null,
      weeklyPriceCents: (row.weekly_price_cents as number) ?? null,
      mealsPerWeek: (row.meals_per_week as number) ?? null,
      mealsPerDay: (row.meals_per_day as number) ?? null,
      daysPerWeek: (row.days_per_week as number) ?? null,
      deliveryInfo: null,
      location: null,
      imageUrl: null,
    }));
  }

  /** Active cleaning packages from ProsperaSub (`cleaning_packages`). */
  async getCleaningSchedule(_userId: string): Promise<CleaningPackage[]> {
    if (!this.configured) {
      return [
        {
          id: 'mock-cleaning',
          name: 'Studio Apartment (mock)',
          shortDescription: 'Configure PROSPERA_SUB_API_KEY to load live cleaning plans.',
          description: null,
          pricePerCleaningCents: null,
          monthlyPriceCents: null,
          cleaningsPerMonth: null,
          serviceFrequency: null,
          apartmentType: null,
          timeSlots: [],
        },
      ];
    }

    const rows = await this.request<Record<string, unknown>[]>(
      'GET',
      '/v1/data/cleaning_packages?select=*&is_active=eq.true&order=sort_order.asc',
    );

    return (rows ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      shortDescription: (row.short_description as string) ?? null,
      description: (row.description as string) ?? null,
      pricePerCleaningCents: (row.price_per_cleaning_cents as number) ?? null,
      monthlyPriceCents: (row.monthly_price_cents as number) ?? null,
      cleaningsPerMonth: (row.cleanings_per_month as number) ?? null,
      serviceFrequency: (row.service_frequency as string) ?? null,
      apartmentType: (row.apartment_type as string) ?? null,
      timeSlots: extractTimeSlots(row),
    }));
  }

  /**
   * Create a real ProsperaSub payment (POST /v1/payments). Redirect the member to
   * the returned `checkoutUrl` to pay (crypto/LIVES via SimpleFi).
   */
  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    if (!this.configured) {
      throw new Error('ProsperaSub API key is not configured.');
    }
    const data = await this.request<{ payment_id?: string; checkout_url?: string; status?: string }>('POST', '/v1/payments', {
      amount_cents: Math.max(0, Math.round(input.amountCents)),
      currency: input.currency ?? 'USD',
      description: input.description,
      reference: input.reference,
    });
    return {
      paymentId: data.payment_id ?? null,
      checkoutUrl: data.checkout_url ?? null,
      status: data.status ?? null,
    };
  }

  /** Look up a ProsperaSub payment status (GET /v1/payments/{id}). */
  async getPaymentStatus(paymentId: string): Promise<{ status: string | null; raw: unknown }> {
    if (!this.configured) {
      throw new Error('ProsperaSub API key is not configured.');
    }
    const data = await this.request<{ status?: string }>('GET', `/v1/payments/${paymentId}`);
    return { status: data.status ?? null, raw: data };
  }

  /**
   * Activation link a member follows. Payments are completed on ProsperaSub; the
   * real checkout link is produced by createPayment(). Kept as a stable fallback.
   */
  async activationLink(userId: string) {
    return {
      externalSubscriptionId: `builders-node-${userId}`,
      paymentUrl: `${this.siteUrl}/?ref=builders-node`,
    };
  }

  /**
   * Cancel a previously-mirrored subscription on ProsperaSub. Called when the
   * admin removes a meal / cleaning plan from a member on our side so the
   * provider stops billing / preparing meals.
   *
   * DELETE /integrations/builders-node/subscription/:subscription_id — Bearer auth.
   * Never throws; returns { ok, status, message } for the caller to audit.
   */
  async cancelSubscription(subscriptionId: string): Promise<{ ok: boolean; status?: number; message: string }> {
    const secret = this.buildersNodeSecret;
    if (!secret) {
      this.logger.warn(`ProsperaSub cancel skipped for ${subscriptionId}: BUILDERS_NODE_API_SECRET not set.`);
      return { ok: false, message: 'BUILDERS_NODE_API_SECRET is not configured.' };
    }
    if (!subscriptionId) return { ok: false, message: 'No subscription id — nothing to cancel.' };

    try {
      const response = await fetch(
        `${this.baseUrl}/integrations/builders-node/subscription/${encodeURIComponent(subscriptionId)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' },
        },
      );
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        const msg = `ProsperaSub cancel responded ${response.status}: ${text.slice(0, 200)}`;
        this.logger.error(msg);
        return { ok: false, status: response.status, message: msg };
      }
      return { ok: true, status: response.status, message: 'Cancelled on ProsperaSub.' };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown ProsperaSub error.';
      this.logger.error(`ProsperaSub cancel failed for ${subscriptionId}: ${msg}`);
      return { ok: false, message: msg };
    }
  }

  /**
   * Mirror an approved / designated member's plans onto ProsperaSub so the
   * provider sees the subscription on their side.
   *
   * Single POST to the ProsperaSub integration endpoint — ProsperaSub owns
   * user upsert, plan lookup, and provider derivation. Idempotent on
   * `external_ref`, so repeated calls with the same userId return the
   * existing subscription ids rather than creating duplicates.
   *
   * Never throws — a ProsperaSub failure is returned as PENDING with a
   * message, so the caller's local grant + audit still complete.
   */
  async provisionMember(input: ProvisionMemberInput): Promise<ProvisionMemberResult> {
    const base: ProvisionMemberResult = {
      status: 'PENDING',
      externalMemberId: null,
      externalFoodSubscriptionId: null,
      externalCleaningSubscriptionId: null,
      externalBeachClubSubscriptionId: null,
      externalAccountId: null,
      warnings: [],
      message: '',
    };

    const secret = this.buildersNodeSecret;
    if (!secret) {
      base.message = 'Queued — BUILDERS_NODE_API_SECRET is not configured.';
      this.logger.warn(`ProsperaSub provisioning skipped for ${input.email}: BUILDERS_NODE_API_SECRET not set.`);
      return base;
    }

    // ProsperaSub's integration endpoint validates meal_plan_id / package_id
    // as UUIDs and rejects the WHOLE request on the first bad id — so we
    // drop non-UUID ids here (with a warning) rather than sending a payload
    // that's guaranteed to 400 and lose the good leg too.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let mealPlanId = input.mealPlanId ?? null;
    let cleaningPlanId = input.cleaningPlanId ?? null;
    if (mealPlanId && !UUID_RE.test(mealPlanId)) {
      base.warnings.push(`Skipped food mirror — mealPlanId "${mealPlanId}" is not a UUID (ProsperaSub catalog entry looks malformed).`);
      mealPlanId = null;
    }
    if (cleaningPlanId && !UUID_RE.test(cleaningPlanId)) {
      base.warnings.push(`Skipped cleaning mirror — cleaningPlanId "${cleaningPlanId}" is not a UUID (ProsperaSub catalog entry looks malformed).`);
      cleaningPlanId = null;
    }

    const wantsFood = Boolean(mealPlanId);
    const wantsCleaning = Boolean(cleaningPlanId);
    const wantsBeachClub = Boolean(input.activateBeachClub);
    if (!wantsFood && !wantsCleaning && !wantsBeachClub) {
      // Nothing to bill for — no reason to call. Local grant may still have
      // written a plan-name-only meal item; that's fine, just not mirrorable.
      base.status = 'ACTIVE';
      base.message = base.warnings.length
        ? 'Nothing to mirror — both plan ids were rejected as non-UUIDs (see warnings).'
        : 'Nothing to mirror — no ProsperaSub plan ids in the grant.';
      return base;
    }

    const startedAt = (input.startDate ?? new Date()).toISOString().slice(0, 10);
    const payload: Record<string, unknown> = {
      customer: {
        email: input.email.toLowerCase().trim(),
        name: input.fullName ?? undefined,
        whatsapp: input.phone ?? undefined,
      },
      external_ref: `builders-node:${input.userId}`,
    };
    if (wantsFood) {
      payload.food = {
        meal_plan_id: mealPlanId,
        weeks: input.weeks ?? 4,
        started_at: startedAt,
        delivery_address: input.deliveryAddress ?? undefined,
        residence: input.residence ?? undefined,
      };
    }
    if (wantsCleaning) {
      payload.cleaning = {
        package_id: cleaningPlanId,
        months: input.months ?? 1,
        apartment_note: input.apartmentNote ?? undefined,
      };
    }
    if (wantsBeachClub) {
      // Beach Club is bundled with a Próspera E-Residency — pass a flag so
      // ProsperaSub creates/reuses the free "Beach Club" subscription tied
      // to this member. Returned as beach_club_subscription_id.
      payload.beach_club = { activate: true, started_at: startedAt };
    }

    try {
      const response = await fetch(`${this.baseUrl}/integrations/builders-node/subscription`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        const msg = `ProsperaSub integration responded ${response.status}: ${text.slice(0, 200)}`;
        this.logger.error(msg);
        base.message = msg;
        return base;
      }

      const data = (await response.json()) as {
        user_id?: string;
        food_subscription_id?: string | null;
        cleaning_subscription_id?: string | null;
        beach_club_subscription_id?: string | null;
        warnings?: string[];
      };

      base.externalMemberId = data.user_id ?? null;
      base.externalAccountId = base.externalMemberId;
      base.externalFoodSubscriptionId = data.food_subscription_id ?? null;
      base.externalCleaningSubscriptionId = data.cleaning_subscription_id ?? null;
      base.externalBeachClubSubscriptionId = data.beach_club_subscription_id ?? null;
      // Append endpoint-reported warnings to any pre-flight ones we already
      // pushed (e.g. non-UUID plan ids we stripped before sending).
      if (Array.isArray(data.warnings)) base.warnings.push(...data.warnings);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown ProsperaSub error.';
      this.logger.error(`ProsperaSub integration call failed for ${input.email}: ${msg}`);
      base.message = `ProsperaSub call failed: ${msg}`;
      return base;
    }

    const gotFood = Boolean(base.externalFoodSubscriptionId);
    const gotCleaning = Boolean(base.externalCleaningSubscriptionId);
    const gotBeachClub = Boolean(base.externalBeachClubSubscriptionId);
    const foodOk = !wantsFood || gotFood;
    const cleaningOk = !wantsCleaning || gotCleaning;
    const beachClubOk = !wantsBeachClub || gotBeachClub;

    if (foodOk && cleaningOk && beachClubOk) {
      base.status = 'ACTIVE';
      base.message = 'Mirrored on ProsperaSub.';
    } else if (gotFood || gotCleaning || gotBeachClub) {
      base.status = 'PARTIAL';
      base.message = 'Partially mirrored on ProsperaSub — see warnings.';
    } else {
      base.status = 'PENDING';
      base.message = 'Member mirrored, no subscriptions created — see warnings.';
    }

    return base;
  }
}
