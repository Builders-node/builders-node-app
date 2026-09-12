import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AdminAffiliatesController, PublicAffiliatesController } from './affiliates.controller';
import { AffiliatesService } from './affiliates.service';

// MailModule and NotificationsModule are @Global, and AdminGuard's own
// dependencies (ConfigModule, AuthModule) are too — so this only has to bring
// the database in, the same shape CampaignsModule uses.
@Module({
  imports: [DatabaseModule],
  controllers: [PublicAffiliatesController, AdminAffiliatesController],
  providers: [AffiliatesService],
  exports: [AffiliatesService],
})
export class AffiliatesModule {}
