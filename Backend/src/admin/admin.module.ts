import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { ProsperaSubClient } from '../subscriptions/prospera-sub.client';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@Module({
  imports: [ConfigModule, DatabaseModule, AuthModule],
  controllers: [AdminController],
  providers: [AdminGuard, AdminService, ProsperaSubClient],
})
export class AdminModule {}
