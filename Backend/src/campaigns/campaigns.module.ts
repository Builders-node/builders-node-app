import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AdminCampaignsController, PublicCampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';

// AdminGuard's own dependencies come from elsewhere: ConfigModule and
// AuthModule are global, so this only has to bring the database in — the same
// shape SubscriptionsModule uses for its admin controller.
@Module({
  imports: [DatabaseModule],
  controllers: [PublicCampaignsController, AdminCampaignsController],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
