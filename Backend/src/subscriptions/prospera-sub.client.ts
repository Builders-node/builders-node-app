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
}

export interface ProvisionMemberResult {
  /** ACTIVE = provisioned on ProsperaSub; PENDING = queued (not yet configured / awaiting member mapping). */
  status: 'ACTIVE' | 'PENDING';
  externalAccountId: string | null;
  message: string;
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
   * Provision an approved member on ProsperaSub. Creating a `food_subscriptions`
   * row requires a ProsperaSub `user_id` + `provider_id`; until the member→ProsperaSub
   * user mapping is defined this returns PENDING rather than writing a malformed row.
   * The local grant + audit still happen in AdminService so the member sees their
   * paid plan immediately.
   */
  async provisionMember(input: ProvisionMemberInput): Promise<ProvisionMemberResult> {
    if (!this.configured) {
      this.logger.warn(`ProsperaSub provisioning skipped for ${input.email}: PROSPERA_SUB_API_KEY not set.`);
      return { status: 'PENDING', externalAccountId: null, message: 'Queued — ProsperaSub API key is not configured.' };
    }

    this.logger.log(`ProsperaSub provisioning queued for ${input.email} (food_subscriptions write awaits member→user mapping).`);
    return {
      status: 'PENDING',
      externalAccountId: null,
      message: 'Queued — confirm how Builders Node members map to ProsperaSub users before creating a food subscription.',
    };
  }
}
