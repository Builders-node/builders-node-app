import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  /** Counts only — what the sidebar badge polls. See AdminService.counters(). */
  @Get('counters')
  counters() {
    return this.admin.counters();
  }

  /** Who brought whom, with per-referrer counts. See AdminService.referrals(). */
  @Get('referrals')
  referrals() {
    return this.admin.referrals();
  }

  @Get('users/:userId')
  userDetail(@Param('userId') userId: string) {
    return this.admin.userDetail(userId);
  }

  @Post('applications/:applicationId/send-credentials')
  sendCredentials(@Param('applicationId') applicationId: string) {
    return this.admin.sendCredentials(applicationId);
  }

  @Post('applications/:applicationId/activate')
  activateMembership(@Param('applicationId') applicationId: string) {
    return this.admin.activateMembership(applicationId);
  }

  @Post('applications/:applicationId/note')
  setApplicationNote(@Param('applicationId') applicationId: string, @Body() body: { note?: string }) {
    return this.admin.setApplicationNote(applicationId, body.note);
  }

  @Post('applications/:applicationId/apartment-availability')
  setApartmentAvailability(
    @Param('applicationId') applicationId: string,
    @Body() body: { available: boolean },
  ) {
    return this.admin.setApartmentAvailability(applicationId, body.available);
  }

  @Post('applications/:applicationId/first-check')
  firstCheck(
    @Param('applicationId') applicationId: string,
    @Body() body: { approved: boolean },
  ) {
    return this.admin.firstCheck(applicationId, body.approved);
  }

  @Post('applications/:applicationId/online-meeting-check')
  onlineMeetingCheck(
    @Param('applicationId') applicationId: string,
    @Body() body: { approved: boolean },
  ) {
    return this.admin.onlineMeetingCheck(applicationId, body.approved);
  }

  @Post('applications/:applicationId/send-payment-link')
  sendPaymentLink(
    @Param('applicationId') applicationId: string,
    @Body() body: { paymentLink?: string },
  ) {
    return this.admin.sendPaymentLink(applicationId, body.paymentLink);
  }

  @Post('applications/:applicationId/confirm-payment')
  confirmPayment(@Param('applicationId') applicationId: string) {
    return this.admin.confirmPayment(applicationId);
  }

  @Get('apartments')
  listApartments() {
    return this.admin.listApartments();
  }

  @Post('apartments')
  createApartment(
    @Body() body: { name?: string; description?: string; priceCents?: number; currency?: string; availability?: string; bedrooms?: number; bathrooms?: number; squareFeet?: number; unitTypeId?: string },
  ) {
    return this.admin.createApartment(body);
  }

  @Get('unit-types')
  listUnitTypes() {
    return this.admin.listUnitTypes();
  }

  @Post('unit-types')
  createUnitType(@Body() body: { name?: string; priceCents?: number; bedrooms?: number; bathrooms?: number; squareFeet?: number; description?: string }) {
    return this.admin.createUnitType(body);
  }

  @Patch('unit-types/:typeId')
  updateUnitType(@Param('typeId') typeId: string, @Body() body: { name?: string; priceCents?: number; bedrooms?: number; bathrooms?: number; squareFeet?: number | null; description?: string }) {
    return this.admin.updateUnitType(typeId, body);
  }

  @Delete('unit-types/:typeId')
  deleteUnitType(@Param('typeId') typeId: string) {
    return this.admin.deleteUnitType(typeId);
  }

  @Patch('apartments/:apartmentId')
  updateApartment(
    @Param('apartmentId') apartmentId: string,
    @Body() body: { name?: string; description?: string; availability?: string; unitTypeId?: string | null; priceCents?: number; currency?: string; bedrooms?: number; bathrooms?: number; squareFeet?: number | null },
  ) {
    return this.admin.updateApartment(apartmentId, body);
  }

  @Delete('apartments/:apartmentId')
  deleteApartment(@Param('apartmentId') apartmentId: string) {
    return this.admin.deleteApartment(apartmentId);
  }

  @Post('apartments/:apartmentId/assign')
  assignResident(@Param('apartmentId') apartmentId: string, @Body() body: { userId?: string; moveInDate?: string }) {
    return this.admin.assignResident(apartmentId, body.userId, body.moveInDate);
  }

  @Post('apartments/:apartmentId/unassign')
  unassignResident(@Param('apartmentId') apartmentId: string, @Body() body: { userId?: string }) {
    return this.admin.unassignResident(apartmentId, body.userId);
  }

  @Get('residency-reviews')
  listResidencyReviews() {
    return this.admin.listResidencyReviews();
  }

  @Get('notifications')
  listRecentNotifications(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    // Both are parsed loosely and clamped in the service — a bad query string
    // should give the first page, not a 500.
    return this.admin.listRecentNotifications(
      limit ? Number(limit) : undefined,
      offset ? Number(offset) : undefined,
    );
  }

  @Post('notifications')
  composeNotification(@Body() body: {
    audience?: 'member' | 'all-members';
    userId?: string;
    type?: 'info' | 'success' | 'warning';
    title?: string;
    message?: string;
    link?: string;
  }) {
    return this.admin.composeNotification(body);
  }

  @Get('support-tickets')
  listSupportTickets(@Query('status') status?: string) {
    return this.admin.listSupportTickets(status);
  }

  @Post('support-tickets/:ticketId/reply')
  replyToTicket(@Param('ticketId') ticketId: string, @Body() body: { message?: string }) {
    return this.admin.replyToTicket(ticketId, body.message);
  }

  @Patch('support-tickets/:ticketId')
  updateSupportTicket(
    @Param('ticketId') ticketId: string,
    @Body() body: { status?: string; adminNote?: string },
  ) {
    return this.admin.updateSupportTicket(ticketId, body);
  }

  @Get('payments')
  listPayments(@Query('status') status?: string) {
    return this.admin.listPayments(status);
  }

  @Post('payments')
  createPayment(@Body() body: { userId?: string; amountCents?: number; currency?: string; dueDate?: string; description?: string; status?: string; payUrl?: string }) {
    return this.admin.createPayment(body);
  }

  @Patch('payments/:paymentId')
  updatePayment(
    @Param('paymentId') paymentId: string,
    @Body() body: { status?: string; adminNote?: string },
  ) {
    return this.admin.updatePayment(paymentId, body);
  }

  @Post('users/:userId/residency/review')
  reviewResidency(@Param('userId') userId: string, @Body() body: { decision?: string; note?: string }) {
    return this.admin.reviewResidency(userId, body.decision, body.note);
  }

  @Get('settings/global')
  globalSettings() {
    return this.admin.getGlobalSettings();
  }

  /**
   * Dry-run preview for a global-plan change — returns { affectedMembers, sampleEmails }
   * so the admin sees "This will affect N members" before hitting Apply.
   */
  @Get('settings/global/affected-members')
  globalPlanAffected() {
    return this.admin.previewGlobalPlanAffected();
  }

  @Put('settings/global/meal-plan')
  setGlobalMealPlan(
    @Body() body: { planId?: string; custom?: { name?: string; weeklyPriceCents?: number; mealsLabel?: string } },
  ) {
    return this.admin.setGlobalMealPlan(body.planId, body.custom);
  }

  @Put('settings/global/cleaning-plan')
  setGlobalCleaningPlan(@Body() body: { planId?: string }) {
    return this.admin.setGlobalCleaningPlan(body.planId);
  }

  @Put('settings/global/batch')
  setBatch(@Body() body: { startDate?: string; label?: string }) {
    return this.admin.setBatch(body);
  }

  @Post('users/:userId/designations')
  designateUser(
    @Param('userId') userId: string,
    @Body() body: {
      apartmentName?: string;
      mealPlan?: string;
      mealPlanId?: string;
      mealStartDate?: string;
      cleaningPlan?: string;
      cleaningPlanId?: string;
    },
  ) {
    return this.admin.designateUser(userId, body);
  }

  @Patch('users/:userId/role')
  updateUserRole(
    @Param('userId') userId: string,
    @Body() body: { role?: string },
    // userId matters here: a Super Admin must not be able to demote themselves.
    @Req() request: Request & { adminAccess?: { userId?: string; role: string; via: 'key' | 'session' } },
  ) {
    return this.admin.updateUserRole(userId, body.role, request.adminAccess);
  }

  @Patch('users/:userId')
  updateUser(
    @Param('userId') userId: string,
    @Body() body: { fullName?: string; phone?: string; location?: string; membershipStatus?: string; role?: string; monthlyAmountCents?: number | null; nextDueDate?: string | null },
    @Req() request: Request & { adminAccess?: { userId?: string; role: string; via: 'key' | 'session' } },
  ) {
    return this.admin.updateUser(userId, body, request.adminAccess);
  }

  @Post('users')
  createUser(
    @Body() body: { email?: string; fullName?: string; phone?: string; location?: string; role?: string; membershipStatus?: string },
    @Req() request: Request & { adminAccess?: { userId?: string; role: string; via: 'key' | 'session' } },
  ) {
    return this.admin.createUser(body, request.adminAccess);
  }

  @Post('users/bulk-delete')
  deleteUsers(
    @Body() body: { userIds?: string[] },
    @Req() request: Request & { adminAccess?: { userId?: string; role: string; via: 'key' | 'session' } },
  ) {
    return this.admin.deleteUsers(body.userIds ?? [], request.adminAccess);
  }

  @Delete('users/:userId')
  deleteUser(
    @Param('userId') userId: string,
    @Req() request: Request & { adminAccess?: { userId?: string; role: string; via: 'key' | 'session' } },
  ) {
    return this.admin.deleteUser(userId, request.adminAccess);
  }
}
