import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { SlackModule } from './slack/slack.module';
import { AuthModule } from './auth/auth.module';
import { FilesModule } from './files/files.module';
import { IpfsModule } from './ipfs/ipfs.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ReportsModule } from './reports/reports.module';
import { AdminModule } from './admin/admin.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { CartModule } from './cart/cart.module';
import { FabricModule } from './fabric/fabric.module';
import { PointsModule } from './points/points.module';
import { WalletModule } from './wallet/wallet.module';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    SlackModule,
    AuthModule,
    FilesModule,
    IpfsModule,
    ProductsModule,
    OrdersModule,
    ReviewsModule,
    ReportsModule,
    AdminModule,
    SchedulerModule,
    WishlistModule,
    CartModule,
    FabricModule,
    PointsModule,
    WalletModule,
    PaymentsModule,
  ],
})
export class AppModule {}
