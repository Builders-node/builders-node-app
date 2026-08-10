import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../admin/admin.guard';
import { MembershipPlansService, type PlanInput } from './membership-plans.service';

/**
 * What the apply form offers. Public and unauthenticated on purpose: anyone
 * looking at the form is by definition not a member yet.
 *
 * Only active plans, and only the fields a price card needs.
 */
@Controller('public/membership-plans')
export class PublicMembershipPlansController {
  constructor(private readonly plans: MembershipPlansService) {}

  @Get()
  list() {
    return this.plans.listActive();
  }
}

/** The same catalogue, editable. */
@Controller('admin/membership-plans')
@UseGuards(AdminGuard)
export class AdminMembershipPlansController {
  constructor(private readonly plans: MembershipPlansService) {}

  @Get()
  list() {
    return this.plans.listAll();
  }

  @Post()
  create(@Body() body: PlanInput) {
    return this.plans.create(body);
  }

  @Patch(':planId')
  update(@Param('planId') planId: string, @Body() body: PlanInput) {
    return this.plans.update(planId, body);
  }

  /** Retires the plan — see the service for why this isn't a real delete. */
  @Delete(':planId')
  remove(@Param('planId') planId: string) {
    return this.plans.remove(planId);
  }
}
