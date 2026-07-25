import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ProsperaResidencyClient } from './prospera-residency.client';
import { ResidencyController } from './residency.controller';
import { ResidencyService } from './residency.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ResidencyController],
  providers: [ProsperaResidencyClient, ResidencyService],
})
export class ResidencyModule {}
