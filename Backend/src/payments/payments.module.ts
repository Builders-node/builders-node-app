import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { BillingService } from './billing.service';
import { JobsController } from './jobs.controller';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PaymentsController, JobsController],
  providers: [PaymentsService, BillingService],
  exports: [BillingService],
})
export class PaymentsModule {}
