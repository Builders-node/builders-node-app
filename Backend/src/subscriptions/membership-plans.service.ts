import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

/** A price nobody would type on purpose. Guards a fat finger, not a policy. */
const MAX_PRICE_CENTS = 100_000_00;

export type PlanInput = {
  name?: string;
  description?: string | null;
  priceCents?: number;
  shortStayPriceCents?: number | null;
  currency?: string;
  occupancy?: number;
  active?: boolean;
  order?: number;
};

/**
 * The membership tiers the apply form offers.
 *
 * These were two lines of arithmetic inside the apply form, so changing what
 * Builders Node charges meant editing React and shipping a deploy. They're
 * rows now, and the form asks the server what the options are.
 */
@Injectable()
export class MembershipPlansService {
  constructor(private readonly prisma: PrismaService) {}

  /** What the public apply form offers — active plans only. */
  async listActive() {
    const plans = await this.prisma.membershipPlan.findMany({
      where: { active: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    return plans.map(shape);
  }

  /** Everything, including what's been retired, for the admin. */
  async listAll() {
    const plans = await this.prisma.membershipPlan.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    return plans.map(shape);
  }

  async create(input: PlanInput) {
    const data = this.validate(input, { requireName: true, requirePrice: true });
    await this.prisma.membershipPlan.create({
      data: {
        name: data.name!,
        description: data.description ?? null,
        priceCents: data.priceCents!,
        shortStayPriceCents: data.shortStayPriceCents ?? null,
        currency: data.currency ?? 'USD',
        occupancy: data.occupancy ?? 1,
        active: data.active ?? true,
        order: data.order ?? 0,
      },
    });
    return this.listAll();
  }

  async update(id: string, input: PlanInput) {
    await this.require(id);
    const data = this.validate(input, { requireName: false, requirePrice: false });
    await this.prisma.membershipPlan.update({ where: { id }, data });
    return this.listAll();
  }

  /**
   * Retire rather than delete when the plan has been used.
   *
   * Applications record the plan by name in their note, and deleting the row
   * an applicant chose would leave that text pointing at nothing. Deactivating
   * takes it off the form and keeps the history readable.
   */
  async remove(id: string) {
    await this.require(id);
    await this.prisma.membershipPlan.update({ where: { id }, data: { active: false } });
    return this.listAll();
  }

  private async require(id: string) {
    const plan = await this.prisma.membershipPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found.');
    return plan;
  }

  private validate(input: PlanInput, opts: { requireName: boolean; requirePrice: boolean }): PlanInput {
    const out: PlanInput = {};

    if (input.name !== undefined || opts.requireName) {
      const name = input.name?.trim();
      if (!name) throw new BadRequestException('Give the plan a name.');
      out.name = name.slice(0, 120);
    }

    if (input.priceCents !== undefined || opts.requirePrice) {
      out.priceCents = this.price(input.priceCents, 'Monthly price');
    }

    // Explicit null clears it — "same as the monthly price" is a real answer,
    // and without the distinction there'd be no way to go back to it.
    if (input.shortStayPriceCents !== undefined) {
      out.shortStayPriceCents =
        input.shortStayPriceCents === null ? null : this.price(input.shortStayPriceCents, 'Short-stay price');
    }

    if (input.description !== undefined) out.description = input.description?.trim() || null;
    if (input.currency !== undefined) out.currency = input.currency?.trim().toUpperCase().slice(0, 3) || 'USD';
    if (input.active !== undefined) out.active = Boolean(input.active);

    if (input.occupancy !== undefined) {
      const occupancy = Math.floor(Number(input.occupancy));
      if (!Number.isFinite(occupancy) || occupancy < 1 || occupancy > 10) {
        throw new BadRequestException('Occupancy must be between 1 and 10 people.');
      }
      out.occupancy = occupancy;
    }

    if (input.order !== undefined) {
      const order = Math.floor(Number(input.order));
      out.order = Number.isFinite(order) ? order : 0;
    }

    return out;
  }

  private price(value: unknown, label: string): number {
    const cents = Math.round(Number(value));
    if (!Number.isFinite(cents) || cents < 0) throw new BadRequestException(`${label} must be a positive amount.`);
    if (cents > MAX_PRICE_CENTS) throw new BadRequestException(`${label} looks like a typo — check the amount.`);
    return cents;
  }
}

function shape(plan: {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  shortStayPriceCents: number | null;
  currency: string;
  occupancy: number;
  active: boolean;
  order: number;
}) {
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    priceCents: plan.priceCents,
    // Resolved here rather than in each caller, so the apply form and any
    // future invoicing agree on what a one-month stay costs.
    shortStayPriceCents: plan.shortStayPriceCents ?? plan.priceCents,
    currency: plan.currency,
    occupancy: plan.occupancy,
    active: plan.active,
    order: plan.order,
  };
}
