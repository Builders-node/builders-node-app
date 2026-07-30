import { ConfigService } from '@nestjs/config';
import { ProsperaSubClient } from './prospera-sub.client';

function makeClient(env: Record<string, string | undefined>) {
  const config = { get: (key: string) => env[key] } as unknown as ConfigService;
  return new ProsperaSubClient(config);
}

describe('ProsperaSubClient (official api.prosperasub.com)', () => {
  const liveEnv = {
    PROSPERA_SUB_API_BASE_URL: 'https://api.prosperasub.com',
    PROSPERA_SUB_API_KEY: 'psub_test',
    PROSPERA_SUB_SITE_URL: 'https://prosperasub.com',
  };

  afterEach(() => jest.restoreAllMocks());

  it('returns mock data when no API key is configured', async () => {
    const client = makeClient({ PROSPERA_SUB_API_BASE_URL: liveEnv.PROSPERA_SUB_API_BASE_URL });
    const meals = await client.getMealsMenu('user-1');
    expect(meals[0].id).toBe('mock-provider');
  });

  it('reads the real plans from food_meal_plans with the x-api-key header', async () => {
    const client = makeClient(liveEnv);
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        { id: 'plan1', name: 'Standard Plan - 3 Times', description: null, weekly_price_cents: 13500, meals_per_week: 18, meals_per_day: 3, days_per_week: 6, status: 'active' },
      ],
    } as Response);

    const meals = await client.getMealsMenu('user-1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.prosperasub.com/v1/data/food_meal_plans?select=*&status=eq.active&order=weekly_price_cents.desc');
    expect((init?.headers as Record<string, string>)['x-api-key']).toBe('psub_test');
    expect(meals[0]).toMatchObject({ id: 'plan1', name: 'Standard Plan - 3 Times', weeklyPriceCents: 13500, mealsPerWeek: 18, mealsPerDay: 3, daysPerWeek: 6 });
  });

  it('reads cleaning_packages from /v1/data', async () => {
    const client = makeClient(liveEnv);
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ id: 'c1', name: 'Studio Apartment', price_per_cleaning_cents: 1975, cleanings_per_month: 4 }],
    } as Response);

    const packages = await client.getCleaningSchedule('user-1');
    expect((fetchMock.mock.calls[0][0] as string)).toContain('/v1/data/cleaning_packages');
    expect(packages[0]).toMatchObject({ id: 'c1', pricePerCleaningCents: 1975, cleaningsPerMonth: 4 });
  });

  it('creates a payment via POST /v1/payments and returns the checkout url', async () => {
    const client = makeClient(liveEnv);
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ payment_id: 'pay_1', checkout_url: 'https://pay.prosperasub.com/pay_1', status: 'pending' }),
    } as Response);

    const result = await client.createPayment({ amountCents: 13500, description: 'Community plan', reference: { orderId: 'abc' } });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.prosperasub.com/v1/payments');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)['x-api-key']).toBe('psub_test');
    expect(JSON.parse(init?.body as string)).toMatchObject({ amount_cents: 13500, currency: 'USD' });
    expect(result).toEqual({ paymentId: 'pay_1', checkoutUrl: 'https://pay.prosperasub.com/pay_1', status: 'pending' });
  });

  it('throws a clear error on a non-OK API response', async () => {
    const client = makeClient(liveEnv);
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 401, text: async () => 'unauthorized' } as Response);
    await expect(client.getMealsMenu('user-1')).rejects.toThrow('ProsperaSub API responded 401.');
  });

  it('skips provisioning (PENDING) when BUILDERS_NODE_API_SECRET is not set', async () => {
    const client = makeClient(liveEnv); // no BUILDERS_NODE_API_SECRET
    const fetchMock = jest.spyOn(global, 'fetch');
    const result = await client.provisionMember({ userId: 'u1', email: 'a@b.test', mealPlanId: '11111111-1111-4111-8111-111111111111' });
    expect(result.status).toBe('PENDING');
    expect(result.message).toMatch(/BUILDERS_NODE_API_SECRET/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('short-circuits (no HTTP call) when no plan ids are supplied', async () => {
    const client = makeClient({ ...liveEnv, BUILDERS_NODE_API_SECRET: 'bn_secret' });
    const fetchMock = jest.spyOn(global, 'fetch');
    const result = await client.provisionMember({ userId: 'u1', email: 'a@b.test' });
    expect(result.status).toBe('ACTIVE');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs to /integrations/builders-node/subscription with the full payload', async () => {
    const client = makeClient({ ...liveEnv, BUILDERS_NODE_API_SECRET: 'bn_secret' });
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        user_id: 'psub_user_1',
        food_subscription_id: 'food_9',
        cleaning_subscription_id: 'clean_5',
        warnings: [],
      }),
    } as Response);

    const result = await client.provisionMember({
      userId: 'member-123',
      email: 'JANE@Example.test',
      fullName: 'Jane Doe',
      phone: '+50412345678',
      mealPlanId: '11111111-1111-4111-8111-111111111111',
      mealPlanName: 'Standard Plan - 3 Times',
      cleaningPlanId: '22222222-2222-4222-8222-222222222222',
      cleaningPlanName: 'Studio Weekly',
      deliveryAddress: 'Duna 407',
      residence: 'Duna Residences',
      apartmentNote: 'Unit Duna 407',
      startDate: new Date('2026-08-01T00:00:00Z'),
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.prosperasub.com/integrations/builders-node/subscription');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer bn_secret');
    expect(JSON.parse(String(init?.body))).toEqual({
      customer: { email: 'jane@example.test', name: 'Jane Doe', whatsapp: '+50412345678' },
      food: {
        meal_plan_id: '11111111-1111-4111-8111-111111111111',
        weeks: 4,
        started_at: '2026-08-01',
        delivery_address: 'Duna 407',
        residence: 'Duna Residences',
      },
      cleaning: { package_id: '22222222-2222-4222-8222-222222222222', months: 1, apartment_note: 'Unit Duna 407' },
      external_ref: 'builders-node:member-123',
    });

    expect(result).toMatchObject({
      status: 'ACTIVE',
      externalMemberId: 'psub_user_1',
      externalFoodSubscriptionId: 'food_9',
      externalCleaningSubscriptionId: 'clean_5',
      warnings: [],
    });
  });

  it('returns PARTIAL and passes through warnings on a half-success response', async () => {
    const client = makeClient({ ...liveEnv, BUILDERS_NODE_API_SECRET: 'bn_secret' });
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        user_id: 'psub_user_1',
        food_subscription_id: 'food_9',
        cleaning_subscription_id: null,
        warnings: ['Cleaning package not found.'],
      }),
    } as Response);

    const result = await client.provisionMember({
      userId: 'u1',
      email: 'a@b.test',
      mealPlanId: '11111111-1111-4111-8111-111111111111',
      cleaningPlanId: '33333333-3333-4333-8333-333333333333',
    });

    expect(result.status).toBe('PARTIAL');
    expect(result.externalFoodSubscriptionId).toBe('food_9');
    expect(result.externalCleaningSubscriptionId).toBeNull();
    expect(result.warnings).toEqual(['Cleaning package not found.']);
  });

  it('drops non-UUID plan ids with a warning instead of sending them to be rejected', async () => {
    const client = makeClient({ ...liveEnv, BUILDERS_NODE_API_SECRET: 'bn_secret' });
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user_id: 'psub_user_1', food_subscription_id: 'food_9', cleaning_subscription_id: null, warnings: [] }),
    } as Response);

    const result = await client.provisionMember({
      userId: 'u1',
      email: 'a@b.test',
      mealPlanId: '11111111-1111-4111-8111-111111111111',
      cleaningPlanId: 'pkg-standard', // malformed on ProsperaSub's side
    });

    // The cleaning leg is stripped before the call — endpoint receives food only.
    const [, init] = fetchMock.mock.calls[0];
    const sent = JSON.parse(String(init?.body));
    expect(sent.food).toBeDefined();
    expect(sent.cleaning).toBeUndefined();

    expect(result.warnings[0]).toMatch(/pkg-standard.*not a UUID/);
    expect(result.externalFoodSubscriptionId).toBe('food_9');
  });

  it('returns PENDING with the error body when the integration endpoint 4xxs', async () => {
    const client = makeClient({ ...liveEnv, BUILDERS_NODE_API_SECRET: 'bn_secret' });
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'invalid bearer',
    } as Response);

    const result = await client.provisionMember({ userId: 'u1', email: 'a@b.test', mealPlanId: '11111111-1111-4111-8111-111111111111' });
    expect(result.status).toBe('PENDING');
    expect(result.message).toMatch(/401/);
    expect(result.message).toMatch(/invalid bearer/);
  });

  it('builds a stable activation link', async () => {
    const client = makeClient(liveEnv);
    const activation = await client.activationLink('user-42');
    expect(activation.externalSubscriptionId).toBe('builders-node-user-42');
    expect(activation.paymentUrl).toBe('https://prosperasub.com/?ref=builders-node');
  });
});
