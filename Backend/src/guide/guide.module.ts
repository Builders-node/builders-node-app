import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AdminGuideController, PublicGuideController } from './guide.controller';
import { GuideService } from './guide.service';

// MailModule is @Global, as are ConfigModule and AuthModule which AdminGuard
// needs — so this only has to bring the database in.
@Module({
  imports: [DatabaseModule],
  controllers: [PublicGuideController, AdminGuideController],
  providers: [GuideService],
  exports: [GuideService],
})
export class GuideModule {}
