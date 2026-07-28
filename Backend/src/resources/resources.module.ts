import { Module } from '@nestjs/common';
import { AdminGuard } from '../admin/admin.guard';
import { DatabaseModule } from '../database/database.module';
import { ResourcesController } from './resources.controller';
import { ResourcesService } from './resources.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ResourcesController],
  // AdminGuard is used on the admin routes; provide it so Nest can resolve it here.
  providers: [ResourcesService, AdminGuard],
})
export class ResourcesModule {}
