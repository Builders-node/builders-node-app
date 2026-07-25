import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
    ConfigModule.forRoot({ isGlobal: true }),
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
})
export class AppModule {}
