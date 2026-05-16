import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { ProductsModule } from '../products/products.module';
import { FilesModule } from '../files/files.module';
import { TokenModule } from '../token/token.module';

@Module({
  imports: [ProductsModule, FilesModule, TokenModule],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
