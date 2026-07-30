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
}

export interface ProvisionMemberInput {
  email: string;
  fullName?: string | null;
  mealPlanId?: string | null;
  mealPlanName?: string | null;
  cleaningPlanId?: string | null;
  cleaningPlanName?: string | null;
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
  message: string;
  /** Non-fatal issues encountered during provisioning (e.g. missing provider id). */
  warnings: string[];
  /** @deprecated old field kept for audit compatibility. */
  externalAccountId: string | null;
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

  /** Builders Node's food provider row id on ProsperaSub (food_providers.id). */
  private get foodProviderId(): string | undefined {
    const v = this.config.get<string>('PROSPERA_SUB_FOOD_PROVIDER_ID');
    return v && v.length > 0 ? v : undefined;
  }

  /** Builders Node's cleaning provider row id on ProsperaSub. */
  private get cleaningProviderId(): string | undefined {
    const v = this.config.get<string>('PROSPERA_SUB_CLEANING_PROVIDER_ID');
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
   * Find a ProsperaSub member by email or create one if missing. Uses the
   * PostgREST-style /v1/data/users endpoint that mirrors the read pattern used
   * elsewhere in this client. Returns the ProsperaSub user_id.
   *
   * The exact user table shape isn't public — if ProsperaSub uses different
   * column names (e.g. `member_id` instead of `id`, or `full_name` vs `name`)
   * this call will surface a clear 4xx error which the caller records as an
   * audit event without breaking the local grant.
   */
  async findOrCreateMember(email: string, fullName?: string | null): Promise<string> {
    if (!this.configured) throw new Error('ProsperaSub API key is not configured.');
    const encodedEmail = encodeURIComponent(email.toLowerCase().trim());
    const existing = await this.request<Array<{ id?: string }>>(
      'GET',
      `/v1/data/users?select=id&email=eq.${encodedEmail}&limit=1`,
    );
    if (existing?.[0]?.id) return String(existing[0].id);

    const created = await this.request<{ id?: string } | Array<{ id?: string }>>(
      'POST',
      '/v1/data/users',
      { email: email.toLowerCase().trim(), full_name: fullName ?? null, source: 'builders-node' },
    );
    const created0 = Array.isArray(created) ? created[0] : created;
    if (!created0?.id) throw new Error('ProsperaSub user creation did not return an id.');
    return String(created0.id);
  }

  /** Create a food_subscriptions row on ProsperaSub. Returns the row id. */
  async createFoodSubscription(input: {
    memberId: string;
    providerId: string;
    planId?: string | null;
    planName?: string | null;
    startDate?: Date;
  }): Promise<string> {
    if (!this.configured) throw new Error('ProsperaSub API key is not configured.');
    const body = {
      user_id: input.memberId,
      provider_id: input.providerId,
      plan_id: input.planId ?? null,
      plan_name: input.planName ?? null,
      status: 'active',
      start_date: (input.startDate ?? new Date()).toISOString().slice(0, 10),
      source: 'builders-node',
    };
    const created = await this.request<{ id?: string } | Array<{ id?: string }>>('POST', '/v1/data/food_subscriptions', body);
    const created0 = Array.isArray(created) ? created[0] : created;
    if (!created0?.id) throw new Error('ProsperaSub food_subscriptions create did not return an id.');
    return String(created0.id);
  }

  /** Create a cleaning_subscriptions row on ProsperaSub. Returns the row id. */
  async createCleaningSubscription(input: {
    memberId: string;
    providerId: string;
    planId?: string | null;
    planName?: string | null;
    startDate?: Date;
  }): Promise<string> {
    if (!this.configured) throw new Error('ProsperaSub API key is not configured.');
    const body = {
      user_id: input.memberId,
      provider_id: input.providerId,
      plan_id: input.planId ?? null,
      plan_name: input.planName ?? null,
      status: 'active',
      start_date: (input.startDate ?? new Date()).toISOString().slice(0, 10),
      source: 'builders-node',
    };
    const created = await this.request<{ id?: string } | Array<{ id?: string }>>('POST', '/v1/data/cleaning_subscriptions', body);
    const created0 = Array.isArray(created) ? created[0] : created;
    if (!created0?.id) throw new Error('ProsperaSub cleaning_subscriptions create did not return an id.');
    return String(created0.id);
  }

  /**
   * Mirror an approved / designated member's plans onto ProsperaSub so the
   * provider sees the subscription on their side. Orchestrates:
   *   1. findOrCreateMember → gets/creates the ProsperaSub user_id
   *   2. createFoodSubscription (if a meal plan is assigned + provider configured)
   *   3. createCleaningSubscription (same, for cleaning)
   *
   * Each step degrades gracefully — a partial success returns PARTIAL and the
   * caller can persist whichever ids came back. The local grant is never
   * blocked by a ProsperaSub failure (the caller wraps in try/catch + audit).
   */
  async provisionMember(input: ProvisionMemberInput): Promise<ProvisionMemberResult> {
    const base: ProvisionMemberResult = {
      status: 'PENDING',
      externalMemberId: null,
      externalFoodSubscriptionId: null,
      externalCleaningSubscriptionId: null,
      externalAccountId: null,
      warnings: [],
      message: '',
    };

    if (!this.configured) {
      base.message = 'Queued — ProsperaSub API key is not configured.';
      this.logger.warn(`ProsperaSub provisioning skipped for ${input.email}: PROSPERA_SUB_API_KEY not set.`);
      return base;
    }

    // 1. Member mapping.
    try {
      base.externalMemberId = await this.findOrCreateMember(input.email, input.fullName);
      base.externalAccountId = base.externalMemberId;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown ProsperaSub error.';
      this.logger.error(`ProsperaSub member lookup/create failed for ${input.email}: ${msg}`);
      base.message = `Member could not be mirrored on ProsperaSub: ${msg}`;
      return base;
    }

    // 2. Food subscription (only if we have both a plan and a provider id).
    if (input.mealPlanId || input.mealPlanName) {
      if (!this.foodProviderId) {
        base.warnings.push('PROSPERA_SUB_FOOD_PROVIDER_ID not set — skipped food subscription mirror.');
      } else {
        try {
          base.externalFoodSubscriptionId = await this.createFoodSubscription({
            memberId: base.externalMemberId,
            providerId: this.foodProviderId,
            planId: input.mealPlanId,
            planName: input.mealPlanName,
            startDate: input.startDate,
          });
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown ProsperaSub error.';
          this.logger.error(`ProsperaSub food subscription failed for ${input.email}: ${msg}`);
          base.warnings.push(`Food subscription mirror failed: ${msg}`);
        }
      }
    }

    // 3. Cleaning subscription.
    if (input.cleaningPlanId || input.cleaningPlanName) {
      if (!this.cleaningProviderId) {
        base.warnings.push('PROSPERA_SUB_CLEANING_PROVIDER_ID not set — skipped cleaning subscription mirror.');
      } else {
        try {
          base.externalCleaningSubscriptionId = await this.createCleaningSubscription({
            memberId: base.externalMemberId,
            providerId: this.cleaningProviderId,
            planId: input.cleaningPlanId,
            planName: input.cleaningPlanName,
            startDate: input.startDate,
          });
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown ProsperaSub error.';
          this.logger.error(`ProsperaSub cleaning subscription failed for ${input.email}: ${msg}`);
          base.warnings.push(`Cleaning subscription mirror failed: ${msg}`);
        }
      }
    }

    const gotFood = Boolean(base.externalFoodSubscriptionId);
    const gotCleaning = Boolean(base.externalCleaningSubscriptionId);
    const wantedFood = Boolean(input.mealPlanId || input.mealPlanName);
    const wantedCleaning = Boolean(input.cleaningPlanId || input.cleaningPlanName);
    const foodOk = !wantedFood || gotFood;
    const cleaningOk = !wantedCleaning || gotCleaning;

    if (foodOk && cleaningOk) {
      base.status = 'ACTIVE';
      base.message = 'Mirrored on ProsperaSub.';
    } else if (gotFood || gotCleaning) {
      base.status = 'PARTIAL';
      base.message = 'Partially mirrored on ProsperaSub — see warnings.';
    } else {
      base.status = 'PENDING';
      base.message = 'Member mirrored, no subscriptions created — see warnings.';
    }

    return base;
  }
}
