import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { ProductsModule } from '../products/products.module';
import { FilesModule } from '../files/files.module';
import { TokenModule } from '../token/token.module';
import { FabricModule } from '../fabric/fabric.module';

@Module({
  imports: [ProductsModule, FilesModule, TokenModule, FabricModule],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
