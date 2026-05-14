import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { SlackModule } from './slack/slack.module';
import { AuthModule } from './auth/auth.module';
import { FilesModule } from './files/files.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ReportsModule } from './reports/reports.module';
import { AdminModule } from './admin/admin.module';
import { SchedulerModule } from './scheduler/scheduler.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    SlackModule,
    AuthModule,
    FilesModule,
    ProductsModule,
    OrdersModule,
    ReviewsModule,
    ReportsModule,
    AdminModule,
    SchedulerModule,
  ],
})
export class AppModule {}
