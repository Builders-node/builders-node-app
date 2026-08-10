import { MembershipPlansService } from './membership-plans.service';

/**
 * The plan catalogue.
 *
 * These rows are what Builders Node charges, so the validation matters more
 * than the CRUD: a plan saved at zero, or at a hundred times its price because
 * someone typed cents into a dollars field, is a bad day either way.
 */
function makeService(plan: Record<string, unknown> | null = {}) {
  const row = plan && {
    id: 'plan-1',
    name: 'Private room',
    description: null,
    priceCents: 195000,
    shortStayPriceCents: 245000,
    currency: 'USD',
    occupancy: 1,
    active: true,
    order: 0,
    ...plan,
  };
  const prisma = {
    membershipPlan: {
      findMany: jest.fn().mockResolvedValue(row ? [row] : []),
      findUnique: jest.fn().mockResolvedValue(row),
      create: jest.fn().mockResolvedValue(row),
      update: jest.fn().mockResolvedValue(row),
    },
  };
  return { service: new MembershipPlansService(prisma as never), prisma };
}

describe('MembershipPlansService reads', () => {
  it('offers only active plans to the apply form', async () => {
    const { service, prisma } = makeService();
    await service.listActive();
    expect(prisma.membershipPlan.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { active: true } }));
  });

  it('gives the admin retired plans too', async () => {
    const { service, prisma } = makeService();
    await service.listAll();
    expect(prisma.membershipPlan.findMany.mock.calls[0][0].where).toBeUndefined();
  });

  it('resolves a missing short-stay price to the monthly one', async () => {
    // So the apply form never has to decide what a blank means.
    const { service } = makeService({ shortStayPriceCents: null });
    const [plan] = await service.listActive();
    expect(plan.shortStayPriceCents).toBe(195000);
  });
});

describe('MembershipPlansService.create', () => {
  it('stores what the admin typed', async () => {
    const { service, prisma } = makeService();
    await service.create({ name: 'Studio', priceCents: 210000, shortStayPriceCents: 260000, occupancy: 1 });
    expect(prisma.membershipPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'Studio', priceCents: 210000 }) }),
    );
  });

  it('refuses a plan with no name', async () => {
    const { service } = makeService();
    await expect(service.create({ name: '  ', priceCents: 1000 })).rejects.toThrow(/name/i);
  });

  it('refuses a price that is not a number', async () => {
    const { service } = makeService();
    await expect(service.create({ name: 'Studio', priceCents: Number('abc') })).rejects.toThrow(/positive amount/);
  });

  it('refuses a negative price', async () => {
    const { service } = makeService();
    await expect(service.create({ name: 'Studio', priceCents: -100 })).rejects.toThrow(/positive amount/);
  });

  it('catches a price that looks like a slipped decimal', async () => {
    // $1,950 typed as cents is $195,000 — plausible enough to save, wrong
    // enough to invoice someone for.
    const { service } = makeService();
    await expect(service.create({ name: 'Studio', priceCents: 999_999_99 })).rejects.toThrow(/typo/);
  });

  it('refuses nonsense occupancy', async () => {
    const { service } = makeService();
    await expect(service.create({ name: 'Studio', priceCents: 1000, occupancy: 0 })).rejects.toThrow(/Occupancy/);
  });
});

describe('MembershipPlansService.update', () => {
  it('changes only what was sent', async () => {
    const { service, prisma } = makeService();
    await service.update('plan-1', { priceCents: 205000 });
    expect(prisma.membershipPlan.update).toHaveBeenCalledWith({ where: { id: 'plan-1' }, data: { priceCents: 205000 } });
  });

  it('lets an explicit null clear the short-stay price', async () => {
    const { service, prisma } = makeService();
    await service.update('plan-1', { shortStayPriceCents: null });
    expect(prisma.membershipPlan.update).toHaveBeenCalledWith({
      where: { id: 'plan-1' },
      data: { shortStayPriceCents: null },
    });
  });

  it('404s on a plan that does not exist', async () => {
    const { service } = makeService(null);
    await expect(service.update('nope', { priceCents: 1000 })).rejects.toThrow(/not found/i);
  });
});

describe('MembershipPlansService.remove', () => {
  it('retires rather than deletes', async () => {
    // Applications record the plan name they chose; deleting the row would
    // leave that text pointing at nothing.
    const { service, prisma } = makeService();
    await service.remove('plan-1');
    expect(prisma.membershipPlan.update).toHaveBeenCalledWith({ where: { id: 'plan-1' }, data: { active: false } });
  });
});
