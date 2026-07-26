import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ResidencyController } from './residency.controller';
import { ResidencyService } from './residency.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ResidencyController],
  providers: [ResidencyService],
})
export class ResidencyModule {}
