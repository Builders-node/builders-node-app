import { Module } from '@nestjs/common';
import { AdminGuard } from '../admin/admin.guard';
import { DatabaseModule } from '../database/database.module';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';

@Module({
  imports: [DatabaseModule],
  controllers: [VehiclesController],
  providers: [VehiclesService, AdminGuard],
})
export class VehiclesModule {}
