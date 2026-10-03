import { Controller, ForbiddenException, Get, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { isValidAdminAccessKey } from '../admin/admin-access';
import { BILLING_TIME_BUDGET_MS, BillingService } from './billing.service';
import { CleanupService } from './cleanup.service';
import { NudgesService } from '../nudges/nudges.service';

/**
 * The daily job, triggered over HTTP.
 *
 * The API runs as a serverless function, so there is no process alive to hold a
 * timer — the schedule lives in vercel.json and calls this. Vercel sends
 * `Authorization: Bearer $CRON_SECRET` when that variable is set.
 *
 * GET as well as POST because Vercel's scheduler issues a GET.
 */
@Controller('jobs')
export class JobsController {
  constructor(
    private readonly billing: BillingService,
    private readonly config: ConfigService,
    private readonly cleanup: CleanupService,
    private readonly nudges: NudgesService,
  ) {}

  @Get('daily')
  runDailyViaCron(@Req() request: Request) {
    return this.run(request);
  }

  /** Same job, for running it by hand with the admin key. */
  @Post('daily')
  runDailyManually(@Req() request: Request) {
    return this.run(request);
  }

  /**
   * The follow-up emails (see NudgesService), on a schedule of their own —
   * later in the day, at a civil hour in Honduras, and with a whole function
   * time budget rather than whatever billing leaves over.
   */
  @Get('nudges')
  runNudgesViaCron(@Req() request: Request) {
    this.assertAuthorised(request);
    return this.nudges.runDaily(new Date(), Date.now() + 25_000);
  }

  @Post('nudges')
  runNudgesManually(@Req() request: Request) {
    this.assertAuthorised(request);
    return this.nudges.runDaily(new Date(), Date.now() + 25_000);
  }

  private run(request: Request) {
    // Synchronous, before any work starts: an unauthorised call throws here
    // rather than as a rejected promise halfway through a run.
    this.assertAuthorised(request);
    return this.runJob(Date.now());
  }

  /**
   * Cleanup first, billing second, against one clock.
   *
   * Cleanup is a handful of single-statement deletes and never throws (each
   * step reports its own failure). Running it first means billing — the part
   * that matters, and the part that can be long — gets the rest of the time
   * budget, measured from when the job started rather than from when billing
   * did, so the two together stay inside Vercel's 30s.
   */
  private async runJob(startedAt: number) {
    const cleanup = await this.cleanup.runDaily();
    const billing = await this.billing.runDaily(new Date(), startedAt + BILLING_TIME_BUDGET_MS);
    return { ...billing, cleanup };
  }

  /**
   * Two ways in: the cron secret Vercel sends, or the break-glass admin key an
   * operator can use to run the job on demand.
   *
   * With neither configured the endpoint is closed rather than open — this
   * writes to member records and sends real email, so an unauthenticated
   * default would be a way to spam every overdue member on request.
   */
  private assertAuthorised(request: Request): void {
    const cronSecret = this.config.get<string>('CRON_SECRET')?.trim();
    if (cronSecret) {
      const header = request.header('authorization');
      if (header === `Bearer ${cronSecret}`) return;
    }

    const adminKey = this.config.get<string>('ADMIN_ACCESS_KEY')?.trim();
    if (adminKey && isValidAdminAccessKey(request.header('x-admin-key'), adminKey)) return;

    throw new ForbiddenException('This job endpoint requires the cron secret or the admin key.');
  }
}
