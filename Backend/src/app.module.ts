import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.validation';
import { ApartmentsModule } from './apartments/apartments.module';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { PaymentsModule } from './payments/payments.module';
import { ResidencyModule } from './residency/residency.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { SupportModule } from './support/support.module';
import { UsersModule } from './users/users.module';
import { AppController } from './app.controller';
import { ApplicationsModule } from './applications/applications.module';
import { HomeModule } from './home/home.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Baseline rate limit: 120 requests / minute per IP. Auth routes tighten
    // this further with @Throttle. Note: on serverless the store is per-lambda
    // (in-memory), so this is a best-effort guard, not a global counter.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    DatabaseModule,
    AdminModule,
    ApplicationsModule,
    AuthModule,
    UsersModule,
    HomeModule,
    ResidencyModule,
    SubscriptionsModule,
    PaymentsModule,
    ApartmentsModule,
    SupportModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
