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

  it('queues provisioning (PENDING) until member→ProsperaSub mapping is defined', async () => {
    const client = makeClient(liveEnv);
    const fetchMock = jest.spyOn(global, 'fetch');
    const result = await client.provisionMember({ email: 'new@member.test', fullName: 'New Member' });
    expect(result.status).toBe('PENDING');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('builds a stable activation link', async () => {
    const client = makeClient(liveEnv);
    const activation = await client.activationLink('user-42');
    expect(activation.externalSubscriptionId).toBe('builders-node-user-42');
    expect(activation.paymentUrl).toBe('https://prosperasub.com/?ref=builders-node');
  });
});
