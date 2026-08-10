import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AdminMembershipPlansController, PublicMembershipPlansController } from './membership-plans.controller';
import { MembershipPlansService } from './membership-plans.service';
import { ProsperaSubClient } from './prospera-sub.client';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SubscriptionsController, PublicMembershipPlansController, AdminMembershipPlansController],
  providers: [ProsperaSubClient, SubscriptionsService, MembershipPlansService],
  exports: [ProsperaSubClient, MembershipPlansService],
})
export class SubscriptionsModule {}
