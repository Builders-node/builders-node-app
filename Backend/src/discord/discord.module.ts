import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DiscordController } from './discord.controller';
import { DiscordService } from './discord.service';

@Global()
@Module({
  imports: [DatabaseModule],
  controllers: [DiscordController],
  providers: [DiscordService],
  exports: [DiscordService],
})
export class DiscordModule {}
