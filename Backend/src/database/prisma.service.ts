import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private connected = false;

  async onModuleInit() {
    if (!process.env.DATABASE_URL) {
      this.logger.warn('DATABASE_URL is not set. API started without an active PostgreSQL connection.');
      return;
    }

    try {
      await this.$connect();
      this.connected = true;
      this.logger.log('Connected to database.');
    } catch (error) {
      this.connected = false;
      this.logger.error(
        'Could not connect to the database. API started in limited mode; database-backed routes will fail until the DB is running.',
      );
      if (error instanceof Error) {
        this.logger.error(error.message);
      }
    }
  }

  async onModuleDestroy() {
    if (this.connected) {
      await this.$disconnect();
    }
  }

  isConnected() {
    return this.connected;
  }
}
