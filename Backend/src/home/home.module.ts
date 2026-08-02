import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';

@Module({
  imports: [DatabaseModule, SubscriptionsModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
