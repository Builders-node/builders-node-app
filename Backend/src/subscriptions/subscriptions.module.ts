import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ProsperaSubClient } from './prospera-sub.client';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SubscriptionsController],
  providers: [ProsperaSubClient, SubscriptionsService],
})
export class SubscriptionsModule {}
