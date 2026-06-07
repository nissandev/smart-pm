import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { GroupsModule } from './groups/groups.module';
import { ActivityModule } from './activity/activity.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ExpensesModule } from './expenses/expenses.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    // Config — loads .env
    ConfigModule.forRoot({ isGlobal: true }),

    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),

    // MongoDB connection
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGO_URI'),
        dbName: config.get<string>('MONGO_DB', 'smartpm'),
        maxPoolSize: config.get<number>('MONGO_MAX_POOL_SIZE', 20),
        minPoolSize: config.get<number>('MONGO_MIN_POOL_SIZE', 2),
        serverSelectionTimeoutMS: 10_000,
        socketTimeoutMS: 45_000,
      }),
      inject: [ConfigService],
    }),

    // Feature modules
    AuthModule,
    UsersModule,
    ProjectsModule,
    TasksModule,
    GroupsModule,
    ActivityModule,
    DashboardModule,
    NotificationsModule,
    ExpensesModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
