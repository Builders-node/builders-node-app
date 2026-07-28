import { Module } from '@nestjs/common';
import { AdminGuard } from '../admin/admin.guard';
import { DatabaseModule } from '../database/database.module';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';

@Module({
  imports: [DatabaseModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceService, AdminGuard],
})
export class MaintenanceModule {}
