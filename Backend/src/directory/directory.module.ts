import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DirectoryController } from './directory.controller';
import { DirectoryService } from './directory.service';

@Module({
  imports: [DatabaseModule],
  controllers: [DirectoryController],
  providers: [DirectoryService],
})
export class DirectoryModule {}
