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

  it('skips provisioning (PENDING) when the API key is not set', async () => {
    const client = makeClient({ PROSPERA_SUB_API_BASE_URL: liveEnv.PROSPERA_SUB_API_BASE_URL });
    const fetchMock = jest.spyOn(global, 'fetch');
    const result = await client.provisionMember({ email: 'a@b.test' });
    expect(result.status).toBe('PENDING');
    expect(result.message).toMatch(/not configured/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('creates a member on ProsperaSub when the email is not found', async () => {
    const client = makeClient(liveEnv);
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] } as Response) // lookup: empty
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 'psub_user_1' }) } as Response); // create
    const result = await client.provisionMember({ email: 'NEW@Member.test', fullName: 'New Member' });

    const [lookupUrl] = fetchMock.mock.calls[0];
    expect(lookupUrl).toBe('https://api.prosperasub.com/v1/data/users?select=id&email=eq.new%40member.test&limit=1');
    const [createUrl, createInit] = fetchMock.mock.calls[1];
    expect(createUrl).toBe('https://api.prosperasub.com/v1/data/users');
    expect(createInit?.method).toBe('POST');
    expect(JSON.parse(String(createInit?.body))).toEqual({ email: 'new@member.test', full_name: 'New Member', source: 'builders-node' });

    expect(result.externalMemberId).toBe('psub_user_1');
    expect(result.status).toBe('ACTIVE'); // no plans requested → member-only mirror still counts as ACTIVE
  });

  it('mirrors a food subscription against the configured provider', async () => {
    const client = makeClient({ ...liveEnv, PROSPERA_SUB_FOOD_PROVIDER_ID: 'prov_food_bn' });
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ id: 'psub_user_1' }] } as Response) // lookup
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 'food_sub_9' }) } as Response); // food sub

    const result = await client.provisionMember({
      email: 'a@b.test',
      mealPlanId: 'plan1',
      mealPlanName: 'Standard Plan - 3 Times',
      startDate: new Date('2026-08-01T00:00:00Z'),
    });

    expect(result.status).toBe('ACTIVE');
    expect(result.externalFoodSubscriptionId).toBe('food_sub_9');
    expect(result.warnings).toEqual([]);
  });

  it('returns PARTIAL + a warning when a provider id is missing', async () => {
    const client = makeClient(liveEnv); // no PROSPERA_SUB_FOOD_PROVIDER_ID
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ id: 'psub_user_1' }] } as Response);

    const result = await client.provisionMember({ email: 'a@b.test', mealPlanName: 'Standard Plan - 3 Times' });
    expect(result.status).toBe('PENDING');
    expect(result.externalFoodSubscriptionId).toBeNull();
    expect(result.warnings[0]).toMatch(/PROSPERA_SUB_FOOD_PROVIDER_ID/);
  });

  it('builds a stable activation link', async () => {
    const client = makeClient(liveEnv);
    const activation = await client.activationLink('user-42');
    expect(activation.externalSubscriptionId).toBe('builders-node-user-42');
    expect(activation.paymentUrl).toBe('https://prosperasub.com/?ref=builders-node');
  });
});
