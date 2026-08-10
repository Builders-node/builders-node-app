import { Controller, ForbiddenException, Get, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { isValidAdminAccessKey } from '../admin/admin-access';
import { BillingService } from './billing.service';

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

  private run(request: Request) {
    this.assertAuthorised(request);
    return this.billing.runDaily();
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
