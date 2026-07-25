import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ApartmentsController } from './apartments.controller';
import { ApartmentsService } from './apartments.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ApartmentsController],
  providers: [ApartmentsService],
})
export class ApartmentsModule {}
