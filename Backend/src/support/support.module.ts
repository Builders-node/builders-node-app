import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
