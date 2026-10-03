import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { NudgesService } from './nudges.service';

// MailModule is @Global.
@Module({
  imports: [DatabaseModule],
  providers: [NudgesService],
  exports: [NudgesService],
})
export class NudgesModule {}
