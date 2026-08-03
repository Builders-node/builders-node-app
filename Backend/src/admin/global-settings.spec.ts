import { AdminService } from './admin.service';
import { GLOBAL_MEAL_PLAN_KEY, parseGlobalMealPlan } from './global-settings';

describe('parseGlobalMealPlan', () => {
  it('returns null for empty or invalid values', () => {
    expect(parseGlobalMealPlan(null)).toBeNull();
    expect(parseGlobalMealPlan('')).toBeNull();
    expect(parseGlobalMealPlan('not-json')).toBeNull();
    expect(parseGlobalMealPlan('{"name":"missing id"}')).toBeNull();
  });

  it('parses a stored meal plan and fills missing optionals with null', () => {
    expect(parseGlobalMealPlan('{"id":"p1","name":"Elias"}')).toEqual({
      id: 'p1',
      name: 'Elias',
      description: null,
      weeklyPriceCents: null,
      mealsPerWeek: null,
      mealsPerDay: null,
      daysPerWeek: null,
      mealsLabel: null,
      deliveryInfo: null,
      location: null,
      imageUrl: null,
    });
  });
});

describe('AdminService.setGlobalMealPlan', () => {
  const option = {
    id: 'p1',
    name: 'Elias Cuisine',
    description: 'Weekly meals',
    weeklyPriceCents: 18000,
    mealsPerWeek: 10,
    deliveryInfo: 'Mon–Fri',
    location: 'Próspera Village',
    imageUrl: null,
  };

  function makeService() {
    const upsert = jest.fn().mockResolvedValue(undefined);
    const deleteMany = jest.fn().mockResolvedValue(undefined);
    const findUnique = jest.fn().mockResolvedValue(null);
    const prisma = {
      globalSetting: { upsert, deleteMany, findUnique },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
      apartment: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const prosperaSub = {
      getMealsMenu: jest.fn().mockResolvedValue([option]),
      getCleaningSchedule: jest.fn().mockResolvedValue([]),
    };
    const service = new AdminService(prisma as never, prosperaSub as never, {} as never, {} as never);
    return { service, upsert, deleteMany, findUnique };
  }

  it('stores the chosen plan as JSON under the global meal key', async () => {
    const { service, upsert } = makeService();
    await service.setGlobalMealPlan('p1');
    expect(upsert).toHaveBeenCalledTimes(1);
    const call = upsert.mock.calls[0][0];
    expect(call.where).toEqual({ key: GLOBAL_MEAL_PLAN_KEY });
    expect(JSON.parse(call.create.value).name).toBe('Elias Cuisine');
  });

  it('rejects a plan id that is not offered by ProsperaSub.com', async () => {
    const { service, upsert } = makeService();
    await expect(service.setGlobalMealPlan('nope')).rejects.toThrow('not available on ProsperaSub.com');
    expect(upsert).not.toHaveBeenCalled();
  });

  it('clears the global plan when no id is provided', async () => {
    const { service, deleteMany, upsert } = makeService();
    await service.setGlobalMealPlan(undefined);
    expect(deleteMany).toHaveBeenCalledWith({ where: { key: GLOBAL_MEAL_PLAN_KEY } });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('stores a custom meal plan with its own price and meals label', async () => {
    const { service, upsert } = makeService();
    await service.setGlobalMealPlan('custom', { name: 'ProsperaSub Meal Plan', weeklyPriceCents: 13500, mealsLabel: '3 meals/day' });
    const stored = JSON.parse(upsert.mock.calls[0][0].create.value);
    expect(stored).toMatchObject({ id: 'custom', name: 'ProsperaSub Meal Plan', weeklyPriceCents: 13500, mealsLabel: '3 meals/day' });
  });

  it('rejects a custom meal plan without a name', async () => {
    const { service, upsert } = makeService();
    await expect(service.setGlobalMealPlan('custom', { weeklyPriceCents: 13500 })).rejects.toThrow('name for the custom meal plan');
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe('AdminService.setGlobalCleaningPlan', () => {
  const cleaningOption = {
    id: 'c1',
    name: 'Studio Apartment',
    shortDescription: null,
    description: 'Weekly tidy',
    pricePerCleaningCents: 1975,
    monthlyPriceCents: 7900,
    cleaningsPerMonth: 4,
    serviceFrequency: '4x per month',
    apartmentType: 'studio',
  };

  function makeService() {
    const upsert = jest.fn().mockResolvedValue(undefined);
    const deleteMany = jest.fn().mockResolvedValue(undefined);
    const findUnique = jest.fn().mockResolvedValue(null);
    const prisma = {
      globalSetting: { upsert, deleteMany, findUnique },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
      apartment: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const prosperaSub = {
      getMealsMenu: jest.fn().mockResolvedValue([]),
      getCleaningSchedule: jest.fn().mockResolvedValue([cleaningOption]),
    };
    const service = new AdminService(prisma as never, prosperaSub as never, {} as never, {} as never);
    return { service, upsert, deleteMany };
  }

  it('stores the chosen cleaning plan as JSON', async () => {
    const { service, upsert } = makeService();
    await service.setGlobalCleaningPlan('c1');
    const call = upsert.mock.calls[0][0];
    expect(call.where).toEqual({ key: 'global_cleaning_plan' });
    expect(JSON.parse(call.create.value).name).toBe('Studio Apartment');
  });

  it('rejects an unknown cleaning plan id', async () => {
    const { service, upsert } = makeService();
    await expect(service.setGlobalCleaningPlan('nope')).rejects.toThrow('not available on ProsperaSub.com');
    expect(upsert).not.toHaveBeenCalled();
  });
});
