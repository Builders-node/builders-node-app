import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { NudgesModule } from '../nudges/nudges.module';
import { BillingService } from './billing.service';
import { CleanupService } from './cleanup.service';
import { JobsController } from './jobs.controller';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [DatabaseModule, NudgesModule],
  controllers: [PaymentsController, JobsController],
  providers: [PaymentsService, BillingService, CleanupService],
  exports: [BillingService],
})
export class PaymentsModule {}
