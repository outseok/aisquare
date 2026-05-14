import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [OrdersModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
